/**
 * 游戏流程控制器：状态、回合、历史、悔棋、AI 调度、动画计时
 * 依赖 rules.js / ai.js / renderer.js / sound.js
 */
(function (global) {
  'use strict';

  const { CHARS, DIFFICULTY, RED } = global.XQ.Constants;
  const Rules = global.XQ.Rules;
  const AI = global.XQ.AI;
  const Sound = global.XQ.Sound;

  const TIMING = {
    moveAnimation: 280,   // 走子动画时长(ms)
    undoAnimation: 260,   // 悔棋“飞回”动画时长(ms)
    undoStagger: 80,      // 多子回退的时间错开(ms)
    captureEffect: 420,   // 吃子特效时长(ms)
    checkEffect: 1000,    // 将军冲击波 + 文字特效时长(ms)
    resultDelay: 480,     // 对局结束后延迟弹窗，先让最后一步动画播完
    aiThinkDelay: 320,    // 电脑"思考"延迟(ms)，纯为了手感
  };

  /** 毫秒 → 可读时长（不足 1 秒用毫秒） */
  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '';
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
  }

  class GameController {
    /**
     * @param {object} dom
     * @param {object} dom.view        BoardView 实例
     * @param {HTMLElement} dom.statusEl
     * @param {HTMLElement} dom.logEl
     * @param {HTMLSelectElement} dom.difficultyEl
     * @param {HTMLSelectElement} dom.sideEl
     * @param {object} [dom.dialog]       对局结束弹窗（ResultDialog 实例）
     * @param {HTMLElement} [dom.thinkTimeEl] 电脑思考用时数值
     * @param {HTMLElement} [dom.moveCountEl] 棋谱手数
     */
    constructor({ view, statusEl, logEl, difficultyEl, sideEl, dialog, thinkTimeEl, moveCountEl }) {
      this.view = view;
      this.statusEl = statusEl;
      this.logEl = logEl;
      this.difficultyEl = difficultyEl;
      this.sideEl = sideEl;
      this.dialog = dialog || null;
      this.thinkTimeEl = thinkTimeEl || null;
      this.moveCountEl = moveCountEl || null;

      this.aiTimer = null;
      this.resultTimer = null;
      this.frameHandle = null;
      this.newGame();
    }

    // -------------------------------------------------------------------------
    // 生命周期 / 外部命令
    // -------------------------------------------------------------------------

    newGame() {
      this.cancelAi();
      this.cancelResult();
      if (this.dialog) this.dialog.hide();
      this.board = Rules.initBoard();
      this.turn = RED;
      this.humanColor = this.sideEl.value === 'black' ? 'black' : RED;
      this.selected = null;
      this.legalMoves = [];
      this.lastMove = null;
      this.checkSquare = null;
      this.history = [];
      this.moveLog = [];
      this.gameOver = false;
      this.thinking = false;
      this.animations = [];
      this.effects = [];
      this.thinkMs = null;                       // 电脑最近一次的搜索耗时
      this.turnStartedAt = performance.now();    // 人类回合开始时间，用于统计人类思考时长

      this.renderLog();
      this.updateThinkTime(false);
      this.setThinkingIndicator(false);
      this.render();

      if (this.turn !== this.humanColor) {
        this.setStatus('电脑（红方）先行…');
        this.runAiTurn();
      } else {
        this.setStatus('红方先行，轮到你走棋');
      }
    }

    undo() {
      if (this.thinking || this.isAnimating() || this.history.length === 0) return;

      // 找到最近一次"轮到人类走棋"之前的快照，撤回人类这一步（以及其后的电脑应手）
      let index = -1;
      for (let i = this.history.length - 1; i >= 0; i--) {
        if (this.history[i].turn === this.humanColor) {
          index = i;
          break;
        }
      }
      if (index < 0) return;

      const undoneMoves = this.history.slice(index).map((entry) => entry.move).reverse();
      const snapshot = this.history[index];
      this.history.length = index;
      this.board = snapshot.board;
      this.turn = snapshot.turn;
      this.lastMove = snapshot.lastMove;
      this.checkSquare = this.checkedKingSquare();
      this.moveLog.length = snapshot.logLength;
      this.thinkMs = snapshot.thinkMs;
      this.turnStartedAt = performance.now();

      this.cancelAi();
      this.cancelResult();
      if (this.dialog) this.dialog.hide();
      this.selected = null;
      this.legalMoves = [];
      this.gameOver = false;
      this.thinking = false;
      this.effects = [];
      this.animations = this.createRewindAnimations(undoneMoves);
      Sound.play('undo');

      this.renderLog();
      this.updateThinkTime(false);
      this.setThinkingIndicator(false);
      this.render();
      this.setStatus('已悔棋，轮到你走棋' + this.checkSuffix());
    }

    /** 悔棋的"飞回"动画：棋子从落点飞回起点，多子时依次错开 */
    createRewindAnimations(moves) {
      const now = performance.now();
      return moves
        .map((move, i) => {
          const piece = this.board[move.fr][move.fc];
          if (!piece) return null;
          return {
            move,
            piece,
            direction: 'back',
            startedAt: now + i * TIMING.undoStagger,
            duration: TIMING.undoAnimation,
          };
        })
        .filter(Boolean);
    }

    resign() {
      if (this.gameOver || this.thinking || this.isAnimating()) return;
      this.cancelAi();
      this.gameOver = true;
      const winner = Rules.opponent(this.humanColor);
      this.setStatus('你认输了。' + this.winnerSuffix(winner));
      this.render();
      this.scheduleResult({
        outcome: 'lose',
        title: '你认输了',
        message: this.resultMessage(winner),
      });
    }

    // -------------------------------------------------------------------------
    // 交互
    // -------------------------------------------------------------------------

    /** canvas 点击：选中己方棋子 / 落子 / 取消选中 */
    handleBoardClick(event) {
      if (this.isLocked() || this.turn !== this.humanColor) return;

      const cell = this.view.pointToCell(event.clientX, event.clientY);
      if (!cell) return this.clearSelection();

      const { r, c } = cell;
      if (this.selected) {
        const target = this.legalMoves.find((m) => m.tr === r && m.tc === c);
        if (target) return this.commitMove(target);
      }

      const piece = this.board[r][c];
      if (piece && piece.color === this.humanColor) return this.selectCell(r, c);
      this.clearSelection();
    }

    selectCell(r, c) {
      this.selected = { r, c };
      this.legalMoves = Rules.getLegalMovesFrom(this.board, this.humanColor, r, c);
      this.render();
    }

    clearSelection() {
      this.selected = null;
      this.legalMoves = [];
      this.render();
    }

    // -------------------------------------------------------------------------
    // 走子流程
    // -------------------------------------------------------------------------

    /** 执行一步棋：记录历史 → 更新状态 → 播放动画 → 轮转回合 */
    commitMove(move, meta = {}) {
      const piece = this.board[move.fr][move.fc];
      const captured = this.board[move.tr][move.tc];
      const isAiMove = piece.color !== this.humanColor;
      const elapsedMs = isAiMove
        ? (meta.thinkMs != null ? meta.thinkMs : 0)
        : performance.now() - this.turnStartedAt;

      this.history.push({
        board: this.board,          // 棋盘走子时是不可变更新，直接存引用即可
        turn: this.turn,
        lastMove: this.lastMove,
        logLength: this.moveLog.length,
        thinkMs: this.thinkMs,
        move,
      });

      this.appendLog(move, piece, captured, elapsedMs);
      this.board = Rules.makeMove(this.board, move);
      this.lastMove = move;
      this.turn = Rules.opponent(this.turn);
      if (isAiMove) this.thinkMs = elapsedMs;
      this.checkSquare = this.checkedKingSquare();
      this.selected = null;
      this.legalMoves = [];

      this.playMoveFeedback(move, piece, captured);
      this.render();
      this.afterMove();
    }

    /** 走子后的判定：将死 / 轮到电脑 / 轮到人类 */
    afterMove() {
      if (Rules.getLegalMoves(this.board, this.turn).length === 0) return this.finishGame();

      if (this.turn !== this.humanColor) return this.runAiTurn();
      this.turnStartedAt = performance.now();
      const thinkSuffix = this.thinkMs != null ? ` · 电脑思考 ${formatDuration(this.thinkMs)}` : '';
      this.setStatus('轮到你走棋' + this.checkSuffix() + thinkSuffix);
      this.render();
    }

    finishGame() {
      this.gameOver = true;
      const winner = Rules.opponent(this.turn);
      const outcome = winner === this.humanColor ? 'win' : 'lose';
      this.setStatus((outcome === 'win' ? '🎉 你赢了！' : '😞 你输了。') + this.winnerSuffix(winner));
      this.render();
      this.scheduleResult({
        outcome,
        title: outcome === 'win' ? '你赢了！' : '你输了',
        message: this.resultMessage(winner),
      });
    }

    /** 延迟弹窗：先让最后一步的走子/将军特效播完 */
    scheduleResult(result) {
      this.cancelResult();
      this.resultTimer = setTimeout(() => {
        this.resultTimer = null;
        if (this.dialog) this.dialog.show(result);
      }, TIMING.resultDelay);
    }

    cancelResult() {
      if (this.resultTimer) {
        clearTimeout(this.resultTimer);
        this.resultTimer = null;
      }
    }

    resultMessage(winner) {
      return `${winner === RED ? '红方' : '黑方'}胜 · 共 ${this.moveLog.length} 手`;
    }

    runAiTurn() {
      this.thinking = true;
      this.setStatus('电脑思考中…');
      this.setThinkTimeLabel('思考中…');
      this.setThinkingIndicator(true);
      this.render();

      this.cancelAi();
      this.aiTimer = setTimeout(() => {
        this.aiTimer = null;
        // 只统计真正的搜索耗时（不含上面的人工延迟），思考中界面会被阻塞，无法实时跳动
        const startedAt = performance.now();
        const move = AI.getBestMove(this.board, this.turn, this.searchDepth());
        const thinkMs = performance.now() - startedAt;
        this.thinking = false;
        this.setThinkingIndicator(false);

        if (move) this.commitMove(move, { thinkMs });
        else {
          this.thinkMs = thinkMs;
          this.finishGame();
        }
        this.updateThinkTime();
      }, TIMING.aiThinkDelay);
    }

    searchDepth() {
      const preset = DIFFICULTY[this.difficultyEl.value] || DIFFICULTY.medium;
      return preset.depth;
    }

    cancelAi() {
      if (this.aiTimer) {
        clearTimeout(this.aiTimer);
        this.aiTimer = null;
      }
    }

    /** 动画 + 音效 + 吃子/将军特效 */
    playMoveFeedback(move, piece, captured) {
      const now = performance.now();
      Sound.play(captured ? 'capture' : 'move');

      this.animations = [{
        move,
        piece,
        direction: 'forward',
        captured: !!captured,
        startedAt: now,
        duration: TIMING.moveAnimation,
      }];
      if (captured) {
        this.effects.push({
          kind: 'capture',
          r: move.tr,
          c: move.tc,
          startedAt: now,
          duration: TIMING.captureEffect,
        });
      }
      if (this.checkSquare) {
        this.effects.push({
          kind: 'check',
          r: this.checkSquare.r,
          c: this.checkSquare.c,
          startedAt: now,
          duration: TIMING.checkEffect,
        });
        Sound.play('check');
      }
    }

    /** 当前行棋方被将军时，返回其将/帅所在格；否则 null */
    checkedKingSquare() {
      return Rules.isInCheck(this.board, this.turn) ? Rules.findKing(this.board, this.turn) : null;
    }

    isAnimating() {
      const now = performance.now();
      return this.animations.some((animation) => now - animation.startedAt < animation.duration);
    }

    /** 思考中 / 动画中 / 已结束：都不接受操作 */
    isLocked() {
      return this.gameOver || this.thinking || this.isAnimating();
    }

    // -------------------------------------------------------------------------
    // 棋谱与状态文本
    // -------------------------------------------------------------------------

    appendLog(move, piece, captured, elapsedMs) {
      const sideLabel = piece.color === RED ? '红' : '黑';
      const captureLabel = captured ? ` 吃${CHARS[captured.color][captured.type]}` : '';
      this.moveLog.push({
        side: piece.color,
        text: `${sideLabel} ${CHARS[piece.color][piece.type]} (${move.fr},${move.fc})→(${move.tr},${move.tc})${captureLabel}`,
        time: formatDuration(elapsedMs),
      });
      this.renderLog();
    }

    renderLog() {
      this.logEl.innerHTML = this.moveLog
        .map((entry) => `<div class="line ${entry.side}">`
          + `<span class="line-text">${entry.text}</span>`
          + `<span class="log-time">${entry.time}</span></div>`)
        .join('');
      this.logEl.scrollTop = this.logEl.scrollHeight;
      if (this.moveCountEl) this.moveCountEl.textContent = String(this.moveLog.length);
    }

    /** 电脑思考用时显示：思考中 → 具体耗时（带闪动） */
    setThinkTimeLabel(label, flash = false) {
      if (!this.thinkTimeEl || this.thinkTimeEl.textContent === label) return;
      this.thinkTimeEl.textContent = label;
      if (!flash) return;
      this.thinkTimeEl.classList.remove('is-new');
      void this.thinkTimeEl.offsetWidth; // 强制回流，让动画重播
      this.thinkTimeEl.classList.add('is-new');
    }

    updateThinkTime(flash = true) {
      this.setThinkTimeLabel(this.thinkMs == null ? '—' : formatDuration(this.thinkMs), flash);
    }

    /** 纯 CSS 呼吸效果：即使主线程在搜索，合成器仍会让它跳动 */
    setThinkingIndicator(on) {
      if (!this.thinkTimeEl) return;
      this.thinkTimeEl.classList.toggle('is-thinking', !!on);
    }

    setStatus(text) {
      this.statusEl.textContent = text;
    }

    checkSuffix() {
      return Rules.isInCheck(this.board, this.turn) ? ' — ⚠ 将军！' : '';
    }

    winnerSuffix(winner) {
      return winner === RED ? '（红方胜）' : '（黑方胜）';
    }

    // -------------------------------------------------------------------------
    // 渲染循环
    // -------------------------------------------------------------------------

    /** 立即重绘，并在需要连续帧时（动画 / 呼吸光环）预约下一帧 */
    render() {
      const now = performance.now();
      this.pruneVisuals(now);

      this.view.draw({
        board: this.board,
        selected: this.selected,
        legalMoves: this.legalMoves,
        lastMove: this.lastMove,
        check: this.checkSquare,
        animations: this.animations,
        effects: this.effects,
        now,
      });

      if (this.needsContinuousFrames() && !this.frameHandle) {
        this.frameHandle = requestAnimationFrame(() => {
          this.frameHandle = null;
          this.render();
        });
      }
    }

    pruneVisuals(now) {
      if (this.animations.length) {
        this.animations = this.animations.filter(
          (animation) => now - animation.startedAt < animation.duration,
        );
      }
      if (this.effects.length) {
        this.effects = this.effects.filter((effect) => now - effect.startedAt < effect.duration);
      }
    }

    needsContinuousFrames() {
      // 对局结束后不再为脉冲光环持续请求帧
      return !!this.selected || (!this.gameOver && !!this.checkSquare)
        || this.animations.length > 0 || this.effects.length > 0;
    }
  }

  global.XQ = global.XQ || {};
  global.XQ.GameController = GameController;
})(typeof globalThis !== 'undefined' ? globalThis : window);

/**
 * Game.js — 对局状态机（人机对战）
 *
 * 统一管理整个对局生命周期：玩家颜色、当前回合、对局状态、
 * 落子历史、悔棋、重新开始，以及 AI 的调度与结果校验。
 *
 * 这是整个应用唯一的状态权威来源（single source of truth）：
 * Renderer、InputController 和页面 DOM 都只是读取 Game 暴露的状态做展示，
 * 不自行维护业务状态。所有落子（玩家与电脑）都经过统一校验。
 *
 * 状态（status）取值：
 *   'idle'    — 未开始（等待选择颜色并点击“开始游戏”）
 *   'playing' — 对局进行中
 *   'won'     — 已分胜负
 *   'draw'    — 平局
 *
 * 回合（turn）取值（仅 playing 时有意义）：'player' | 'ai'
 *
 * AI 结果失效机制：
 *   使用一个单调递增的版本号 _aiVersion。每次调度 AI、悔棋、重新开始时
 *   都会自增，使“在途”的旧计算结果在回调执行时因版本不匹配而被丢弃，
 *   从根本上保证“悔棋/重开后旧 AI 结果不再写入棋盘”。
 */
(function (NS) {
  'use strict';

  const CONFIG = NS.CONFIG;
  const Board = NS.Board;
  const RuleChecker = NS.RuleChecker;
  const AiPlayer = NS.AiPlayer;

  const EMPTY = CONFIG.EMPTY;
  const BLACK = CONFIG.BLACK;
  const WHITE = CONFIG.WHITE;

  class Game {
    constructor() {
      this.board = new Board();
      this.aiPlayer = new AiPlayer();

      this.status = 'idle';          // 'idle' | 'playing' | 'won' | 'draw'
      this.playerColor = BLACK;      // 默认玩家执黑
      this.aiColor = WHITE;
      this.turn = null;              // 'player' | 'ai'
      this.winner = null;            // 获胜方颜色，未分胜负为 null
      this.winCells = [];            // 获胜连线坐标
      this.history = [];             // [{ row, col, player }]

      this._listeners = [];
      this._aiVersion = 0;           // AI 结果版本号
      this._aiTimer = null;          // AI 延时定时器句柄
    }

    // ═════════════════════════════════════════════════════════
    //   订阅 / 通知
    // ═════════════════════════════════════════════════════════
    subscribe(listener) {
      this._listeners.push(listener);
    }

    _notify() {
      for (let i = 0; i < this._listeners.length; i++) {
        this._listeners[i](this);
      }
    }

    // ═════════════════════════════════════════════════════════
    //   查询
    // ═════════════════════════════════════════════════════════
    getLastMove() {
      if (this.history.length === 0) return null;
      return this.history[this.history.length - 1];
    }

    /** 是否轮到玩家落子（且对局进行中） */
    isPlayerTurn() {
      return this.status === 'playing' && this.turn === 'player';
    }

    /** 是否轮到电脑落子（且对局进行中） */
    isAiTurn() {
      return this.status === 'playing' && this.turn === 'ai';
    }

    /**
     * 统计某颜色当前落子数量。
     * @param {number} color
     * @returns {number}
     */
    countStones(color) {
      let count = 0;
      for (let i = 0; i < this.history.length; i++) {
        if (this.history[i].player === color) count++;
      }
      return count;
    }

    /**
     * 当前是否允许悔棋。
     * 规则：有历史记录即可悔棋；但“玩家执白且只剩电脑开局首手”时不能悔棋。
     * @returns {boolean}
     */
    canUndo() {
      if (this.status === 'idle') return false;
      if (this.history.length === 0) return false;
      if (
        this.playerColor === WHITE &&
        this.history.length === 1 &&
        this.history[0].player === this.aiColor
      ) {
        return false; // 只剩电脑开局首手，玩家尚未落子
      }
      return true;
    }

    // ═════════════════════════════════════════════════════════
    //   开始 / 重新开始
    // ═════════════════════════════════════════════════════════

    /**
     * 开始一局新游戏。
     * @param {number} playerColor 玩家选择的颜色（BLACK 或 WHITE）
     */
    start(playerColor) {
      this.playerColor = playerColor;
      this.aiColor = playerColor === BLACK ? WHITE : BLACK;

      this._resetToPlaying();

      if (this.playerColor === WHITE) {
        // 玩家执白：电脑（黑棋）自动先手
        this.turn = 'ai';
        this._scheduleAiMove();
      } else {
        // 玩家执黑：玩家先手
        this.turn = 'player';
      }

      this._notify();
    }

    /**
     * 重新开始：清空棋盘、历史、胜负标记，取消在途 AI 任务，回到 idle。
     */
    restart() {
      this._cancelAiTask();
      this.board.clear();
      this.status = 'idle';
      this.turn = null;
      this.winner = null;
      this.winCells = [];
      this.history = [];
      this._notify();
    }

    /** 重置到“刚开局”状态（保留已设定的玩家/电脑颜色） */
    _resetToPlaying() {
      this._cancelAiTask();
      this.board.clear();
      this.status = 'playing';
      this.turn = null;
      this.winner = null;
      this.winCells = [];
      this.history = [];
    }

    // ═════════════════════════════════════════════════════════
    //   玩家落子入口（唯一）
    // ═════════════════════════════════════════════════════════
    /**
     * 玩家在 (row, col) 落子。
     * 所有输入（鼠标/触摸）最终都调用此方法，统一校验合法性。
     * @param {number} row
     * @param {number} col
     * @returns {boolean} 是否成功落子
     */
    playerMove(row, col) {
      if (!this.isPlayerTurn()) return false;         // 非玩家回合
      if (!this.board.isInBounds(row, col)) return false; // 越界
      if (!this.board.isEmpty(row, col)) return false;    // 已有棋子

      this._applyMove(row, col, this.playerColor);

      if (this.status === 'playing') {
        this.turn = 'ai';
        this._scheduleAiMove();
      }

      this._notify();
      return true;
    }

    // ═════════════════════════════════════════════════════════
    //   AI 调度（含失效校验）
    // ═════════════════════════════════════════════════════════
    _scheduleAiMove() {
      this._aiVersion++;                 // 使任何在途结果失效
      const version = this._aiVersion;
      const delay = CONFIG.AI.DELAY_MS;

      this._aiTimer = setTimeout(() => {
        this._aiTimer = null;
        this._runAiTurn(version);
      }, delay);
    }

    /**
     * 执行 AI 回合。
     * @param {number} version 调度时的版本号，用于校验结果是否仍有效
     */
    _runAiTurn(version) {
      // 版本不匹配：说明期间发生了悔棋/重开，丢弃本次结果
      if (version !== this._aiVersion) return;
      if (!this.isAiTurn()) return;

      // AI 只返回建议坐标，真实落子仍走统一校验
      const move = this.aiPlayer.getMove(this.board, this.aiColor);
      if (!move) return; // 无合法位置（理论上 playing 中不会发生）
      if (!this.board.isInBounds(move.row, move.col) || !this.board.isEmpty(move.row, move.col)) {
        return; // 防御性校验：AI 返回非法点则忽略
      }

      this._applyMove(move.row, move.col, this.aiColor);

      if (this.status === 'playing') {
        this.turn = 'player';
      }

      this._notify();
    }

    /**
     * 取消在途 AI 任务：清除定时器，并使版本号自增以丢弃任何已触发的结果。
     */
    _cancelAiTask() {
      this._aiVersion++;
      if (this._aiTimer !== null) {
        clearTimeout(this._aiTimer);
        this._aiTimer = null;
      }
    }

    // ═════════════════════════════════════════════════════════
    //   统一落子执行（玩家与电脑共用）
    // ═════════════════════════════════════════════════════════
    /**
     * 在棋盘上真正落子并做胜负/平局判定。
     * 调用方需先完成“回合/坐标/占用”的合法性校验。
     * @param {number} row
     * @param {number} col
     * @param {number} color
     */
    _applyMove(row, col, color) {
      this.board.placeStone(row, col, color);
      this.history.push({ row, col, player: color });

      const result = RuleChecker.checkWin(this.board, row, col, color);
      if (result.isWin) {
        this.status = 'won';
        this.winner = color;
        this.winCells = result.winCells;
      } else if (RuleChecker.checkDraw(this.board)) {
        // 先判胜后判平：只有未获胜才检查是否下满
        this.status = 'draw';
        this.winner = null;
        this.winCells = [];
      }
      // 否则保持 playing，由调用方切换回合
    }

    // ═════════════════════════════════════════════════════════
    //   悔棋
    // ═════════════════════════════════════════════════════════
    /**
     * 悔棋。分两种情况：
     *
     * A. 玩家刚落子、电脑尚未回应（turn === 'ai' 且 playing）：
     *    取消电脑在途任务，仅撤销玩家这一手。
     *
     * B. 电脑已回应，或对局已结束：
     *    撤销“电脑回应 + 玩家上一手”，回到玩家落子前的局面。
     *
     * 玩家执白时，电脑的开局首手始终保留（由 canUndo 保证在只剩首手时禁止悔棋）。
     *
     * @returns {boolean} 是否成功悔棋
     */
    undo() {
      if (!this.canUndo()) return false;

      if (this.status === 'playing' && this.turn === 'ai') {
        // 情况 A：电脑正在思考
        this._cancelAiTask();
        this._removeTopPlayerMove();
        this.turn = 'player';
      } else {
        // 情况 B：电脑已回应 / 对局已结束
        this._cancelAiTask();
        this._removeTopAiMoveIfAny();
        this._removeTopPlayerMove();

        this.status = 'playing';
        this.turn = 'player';
        this.winner = null;
        this.winCells = [];
      }

      this._notify();
      return true;
    }

    /** 若历史栈顶是玩家棋子，则移除它（并同步从棋盘移除） */
    _removeTopPlayerMove() {
      if (this.history.length === 0) return;
      const top = this.history[this.history.length - 1];
      if (top.player === this.playerColor) {
        this.history.pop();
        this.board.removeStone(top.row, top.col);
      }
    }

    /** 若历史栈顶是电脑棋子，则移除它（撤销电脑回应） */
    _removeTopAiMoveIfAny() {
      if (this.history.length === 0) return;
      const top = this.history[this.history.length - 1];
      if (top.player === this.aiColor) {
        this.history.pop();
        this.board.removeStone(top.row, top.col);
      }
    }
  }

  NS.Game = Game;
})(window.Gomoku = window.Gomoku || {});

/**
 * 棋盘渲染：只负责"把 scene 画到 canvas 上"，不修改游戏状态
 *
 * scene = {
 *   board,                 // 棋盘二维数组
 *   selected,              // 选中格 {r,c} | null
 *   legalMoves,            // 选中棋子的合法落点
 *   lastMove,              // 上一步 {fr,fc,tr,tc} | null
 *   check,                 // 正处于被将军状态的将/帅格 {r,c} | null
 *   animations,            // 走子动画数组 [{move, piece, direction, startedAt, duration}]
 *                          // direction: 'forward' 落子 | 'back' 悔棋回退
 *   effects,               // 特效数组 [{kind,r,c,startedAt,duration}]
 *   now,                   // 当前时间戳（毫秒），缺省用 performance.now()
 * }
 */
(function (global) {
  'use strict';

  const Constants = global.XQ.Constants;
  const { CHARS, BOARD_METRICS } = Constants;
  const MARGIN = BOARD_METRICS.margin;
  const CELL = BOARD_METRICS.cell;

  const PALETTE = {
    boardTop: '#e9c68a',
    boardBottom: '#d9b06a',
    frame: '#7a4a21',
    grid: '#5a3a1a',
    lastMove: 'rgba(255,196,40,0.30)',
    hintEmpty: 'rgba(45,160,80,0.85)',
    hintCapture: 'rgba(220,60,50,0.9)',
    red: '#b0352b',
    black: '#23201d',
    pieceEdgeRed: '#a9342a',
    pieceEdgeBlack: '#2f2a26',
  };

  const FONT_FAMILY = '"KaiTi","STKaiti","SimSun",serif';
  const PIECE_RADIUS = CELL * 0.42;

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const progressOf = (item, now) => Math.min(Math.max((now - item.startedAt) / item.duration, 0), 1);

  class BoardView {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.width = BOARD_METRICS.width;
      this.height = BOARD_METRICS.height;
      canvas.width = this.width;
      canvas.height = this.height;
    }

    // -------------------------------------------------------------------------
    // 坐标换算
    // -------------------------------------------------------------------------

    /** 屏幕坐标 → 棋盘格（超出落子范围返回 null） */
    pointToCell(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * (this.width / rect.width);
      const y = (clientY - rect.top) * (this.height / rect.height);
      const c = Math.round((x - MARGIN) / CELL);
      const r = Math.round((y - MARGIN) / CELL);
      if (r < 0 || r > 9 || c < 0 || c > 8) return null;
      const centerX = MARGIN + c * CELL;
      const centerY = MARGIN + r * CELL;
      if (Math.hypot(x - centerX, y - centerY) > CELL * 0.5) return null;
      return { r, c };
    }

    xOf(col) { return MARGIN + col * CELL; }
    yOf(row) { return MARGIN + row * CELL; }

    // -------------------------------------------------------------------------
    // 主绘制流程
    // -------------------------------------------------------------------------

    draw(scene) {
      const now = scene.now != null ? scene.now : performance.now();
      this.drawBackground();
      this.drawGrid();
      this.drawRiver();
      this.drawPalaces();
      this.drawMarkers();
      this.drawLastMove(scene.lastMove);
      this.drawMoveHints(scene);
      this.drawPieces(scene);
      this.drawCheckHighlight(scene.check, now);
      this.drawSelection(scene.selected, now);
      this.drawMoveAnimations(scene.animations, now);
      this.drawEffects(scene.effects || [], now);
    }

    drawBackground() {
      const { ctx } = this;
      ctx.clearRect(0, 0, this.width, this.height);

      const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
      gradient.addColorStop(0, PALETTE.boardTop);
      gradient.addColorStop(1, PALETTE.boardBottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      // 外框
      ctx.strokeStyle = PALETTE.frame;
      ctx.lineWidth = 6;
      ctx.strokeRect(MARGIN - 16, MARGIN - 16, 8 * CELL + 32, 9 * CELL + 32);
    }

    drawLine(x1, y1, x2, y2) {
      const { ctx } = this;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    drawGrid() {
      const { ctx } = this;
      ctx.strokeStyle = PALETTE.grid;
      ctx.lineWidth = 1;

      // 竖线：边线贯通，中间 7 条在楚河汉界处断开
      for (let c = 0; c < 9; c++) {
        const x = this.xOf(c);
        if (c === 0 || c === 8) {
          this.drawLine(x, this.yOf(0), x, this.yOf(9));
        } else {
          this.drawLine(x, this.yOf(0), x, this.yOf(4));
          this.drawLine(x, this.yOf(5), x, this.yOf(9));
        }
      }
      // 横线
      for (let r = 0; r < 10; r++) {
        this.drawLine(this.xOf(0), this.yOf(r), this.xOf(8), this.yOf(r));
      }
    }

    drawRiver() {
      const { ctx } = this;
      ctx.fillStyle = PALETTE.grid;
      ctx.font = `italic 20px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const riverY = MARGIN + 4.5 * CELL;
      ctx.fillText('楚  河', this.xOf(2), riverY);
      ctx.fillText('汉  界', this.xOf(6), riverY);
    }

    drawPalaces() {
      const { ctx } = this;
      ctx.strokeStyle = PALETTE.grid;
      ctx.lineWidth = 1;
      // 上方九宫
      this.drawLine(this.xOf(3), this.yOf(0), this.xOf(5), this.yOf(2));
      this.drawLine(this.xOf(5), this.yOf(0), this.xOf(3), this.yOf(2));
      // 下方九宫
      this.drawLine(this.xOf(3), this.yOf(7), this.xOf(5), this.yOf(9));
      this.drawLine(this.xOf(5), this.yOf(7), this.xOf(3), this.yOf(9));
    }

    /** 炮位与兵位的传统小角标 */
    drawMarkers() {
      const { ctx } = this;
      const points = [];
      for (const c of [1, 7]) points.push([2, c], [7, c]);
      for (let c = 0; c < 9; c += 2) points.push([3, c], [6, c]);

      ctx.strokeStyle = PALETTE.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [r, c] of points) {
        const x = this.xOf(c);
        const y = this.yOf(r);
        const arm = 6;
        const gap = 3;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const cornerX = x + sx * gap;
          const cornerY = y + sy * gap;
          ctx.moveTo(cornerX + sx * arm, cornerY);
          ctx.lineTo(cornerX, cornerY);
          ctx.lineTo(cornerX, cornerY + sy * arm);
        }
      }
      ctx.stroke();
    }

    drawDisc(r, c, color, { ring = false } = {}) {
      const { ctx } = this;
      ctx.beginPath();
      ctx.arc(this.xOf(c), this.yOf(r), CELL * 0.46, 0, Math.PI * 2);
      if (ring) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    drawLastMove(lastMove) {
      if (!lastMove) return;
      this.drawDisc(lastMove.fr, lastMove.fc, PALETTE.lastMove);
      this.drawDisc(lastMove.tr, lastMove.tc, PALETTE.lastMove);
    }

    /** 选中棋子的可落点：空格画绿点，可吃子画红圈 */
    drawMoveHints(scene) {
      const { ctx } = this;
      for (const move of scene.legalMoves || []) {
        const x = this.xOf(move.tc);
        const y = this.yOf(move.tr);
        if (scene.board[move.tr][move.tc]) {
          ctx.beginPath();
          ctx.arc(x, y, CELL * 0.45, 0, Math.PI * 2);
          ctx.strokeStyle = PALETTE.hintCapture;
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fillStyle = PALETTE.hintEmpty;
          ctx.fill();
        }
      }
    }

    /** 己方选中棋子：金色呼吸光环 */
    drawSelection(selected, now) {
      if (!selected) return;
      const { ctx } = this;
      const x = this.xOf(selected.c);
      const y = this.yOf(selected.r);
      const pulse = 0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 2);

      ctx.save();
      // 外圈发光
      ctx.beginPath();
      ctx.arc(x, y, CELL * (0.46 + 0.03 * pulse), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,190,40,${0.75 - 0.25 * pulse})`;
      ctx.lineWidth = 4 - 1.5 * pulse;
      ctx.shadowColor = 'rgba(255,175,30,0.95)';
      ctx.shadowBlur = 14 + 8 * pulse;
      ctx.stroke();
      // 内圈亮环
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.40, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,246,200,0.95)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    drawPieceAt(x, y, piece, scale = 1) {
      const { ctx } = this;
      const radius = PIECE_RADIUS * scale;
      const isRed = piece.color === 'red';

      // 阴影
      ctx.beginPath();
      ctx.arc(x + 2, y + 3, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fill();

      // 棋子盘面
      const gradient = ctx.createRadialGradient(
        x - radius * 0.4, y - radius * 0.4, radius * 0.2, x, y, radius,
      );
      gradient.addColorStop(0, '#fdf3d8');
      gradient.addColorStop(1, '#e8c98f');
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isRed ? PALETTE.pieceEdgeRed : PALETTE.pieceEdgeBlack;
      ctx.stroke();

      // 内圈
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.78, 0, Math.PI * 2);
      ctx.strokeStyle = isRed ? 'rgba(169,52,42,0.5)' : 'rgba(47,42,38,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 汉字
      ctx.fillStyle = isRed ? PALETTE.red : PALETTE.black;
      ctx.font = `bold ${Math.round(radius * 1.1)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(CHARS[piece.color][piece.type], x, y + 1);
    }

    /** 动画路径：落子为 起点→落点，悔棋回退为 落点→起点 */
    animationPath(animation) {
      const { move } = animation;
      return animation.direction === 'back'
        ? { from: { r: move.tr, c: move.tc }, to: { r: move.fr, c: move.fc } }
        : { from: { r: move.fr, c: move.fc }, to: { r: move.tr, c: move.tc } };
    }

    drawPieces(scene) {
      // 正在飞行的棋子：不画它在“动画终点”上的静止版本，否则会重影
      const flying = new Set();
      for (const animation of scene.animations || []) {
        const { to } = this.animationPath(animation);
        if (scene.board[to.r][to.c] === animation.piece) flying.add(`${to.r},${to.c}`);
      }

      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          const piece = scene.board[r][c];
          if (!piece || flying.has(`${r},${c}`)) continue;
          this.drawPieceAt(this.xOf(c), this.yOf(r), piece);
        }
      }
    }

    drawMoveAnimations(animations, now) {
      for (const animation of animations || []) {
        this.drawMoveAnimation(animation, now);
      }
    }

    /** 走子动画：残影拖尾 + 中段轻微抬升 */
    drawMoveAnimation(animation, now) {
      if (!animation) return;
      const { ctx } = this;
      const { from, to } = this.animationPath(animation);
      const t = progressOf(animation, now);
      const eased = easeOutCubic(t);

      const x = this.xOf(from.c + (to.c - from.c) * eased);
      const y = this.yOf(from.r + (to.r - from.r) * eased);

      // 残影
      for (let i = 4; i >= 1; i--) {
        const ghostT = t - i * 0.06;
        if (ghostT <= 0) continue;
        const ghostEased = easeOutCubic(ghostT);
        ctx.globalAlpha = 0.10 * (5 - i) * (1 - t);
        this.drawPieceAt(
          this.xOf(from.c + (to.c - from.c) * ghostEased),
          this.yOf(from.r + (to.r - from.r) * ghostEased),
          animation.piece,
          0.9,
        );
      }
      ctx.globalAlpha = 1;

      // 本体：飞行中段放大，模拟抬手落子
      const scale = 1 + 0.10 * Math.sin(Math.PI * t);
      this.drawPieceAt(x, y, animation.piece, scale);
    }

    /**
     * 被将军的将/帅：红色脉冲光环（持续到解除将军）
     */
    drawCheckHighlight(check, now) {
      if (!check) return;
      const { ctx } = this;
      const x = this.xOf(check.c);
      const y = this.yOf(check.r);
      const pulse = 0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 2 * 1.4);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, CELL * (0.47 + 0.04 * pulse), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(220,45,35,${0.5 + 0.4 * pulse})`;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = 'rgba(230,40,30,0.95)';
      ctx.shadowBlur = 12 + 12 * pulse;
      ctx.stroke();
      ctx.restore();
    }

    drawEffects(effects, now) {
      for (const effect of effects) {
        const t = progressOf(effect, now);
        if (t >= 1) continue;
        if (effect.kind === 'capture') this.drawCaptureEffect(effect, t);
        else if (effect.kind === 'check') this.drawCheckEffect(effect, t);
      }
    }

    /** 吃子：红色圆环扩散 */
    drawCaptureEffect(effect, t) {
      const { ctx } = this;
      ctx.beginPath();
      ctx.arc(this.xOf(effect.c), this.yOf(effect.r), CELL * (0.2 + 0.5 * t), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(235,85,60,${(1 - t) * 0.9})`;
      ctx.lineWidth = 3 * (1 - t) + 0.5;
      ctx.stroke();
    }

    /** 将军：双层冲击波 + “将军！”上浮文字 */
    drawCheckEffect(effect, t) {
      const { ctx } = this;
      const x = this.xOf(effect.c);
      const y = this.yOf(effect.r);

      // 冲击波：两圈错开扩散，做出“炸开”的层次感
      for (const offset of [0, 0.25]) {
        const p = (t - offset) / (1 - offset);
        if (p <= 0) continue;
        ctx.beginPath();
        ctx.arc(x, y, CELL * (0.45 + 1.6 * p), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(224,52,38,${(1 - p) * 0.8})`;
        ctx.lineWidth = 4 * (1 - p) + 0.5;
        ctx.stroke();
      }

      // 文字：先弹出再上浮淡出；靠近上边界时改为向下浮
      const appear = Math.min(t / 0.12, 1);
      const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      const rise = 46 * easeOutCubic(t);
      const floatY = y - 30 - rise;
      const textY = floatY < 20 ? Math.min(y + 34 + rise, this.height - 18) : floatY;
      const fontSize = Math.round(30 * (0.75 + 0.25 * easeOutCubic(appear)));

      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(96,18,10,0.9)';
      ctx.shadowColor = 'rgba(230,40,30,0.9)';
      ctx.shadowBlur = 14;
      ctx.strokeText('将军！', x, textY);
      ctx.fillStyle = '#ffd94a';
      ctx.fillText('将军！', x, textY);
      ctx.restore();
    }
  }

  global.XQ = global.XQ || {};
  global.XQ.BoardView = BoardView;
})(typeof globalThis !== 'undefined' ? globalThis : window);

/**
 * Renderer.js — Canvas 渲染器
 *
 * 只负责把 Game 的当前状态（棋盘、最后一手、获胜连线）以及
 * 悬停预览绘制到 Canvas，绝不修改任何游戏业务状态。
 *
 * 职责边界：
 *   - 读取 Game 暴露的数据进行绘制
 *   - 处理 Canvas 的 CSS 尺寸 / 物理像素尺寸 / devicePixelRatio 适配
 *   - 向 InputController 提供“屏幕坐标 → 棋盘坐标”的转换能力
 *     （转换使用与绘制同一套缩放参数，保证点击与绘制完全一致）
 */
(function (NS) {
  'use strict';

  const CONFIG = NS.CONFIG;
  const getLogicalBoardSize = NS.getLogicalBoardSize;

  class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');

      /** 棋盘逻辑设计尺寸（与 dpr、CSS 缩放无关） */
      this.logicalSize = getLogicalBoardSize();

      /** 当前 Canvas 的 CSS 显示尺寸（由 resize() 设置） */
      this.cssSize = this.logicalSize;
    }

    /**
     * 根据目标显示尺寸（CSS 像素）调整 Canvas。
     *
     * 三层尺寸关系：
     *   - CSS 尺寸（canvas.style.width/height）：浏览器排版占用大小
     *   - 物理像素尺寸（canvas.width/height）：= CSS 尺寸 × dpr，高清屏不模糊
     *   - 逻辑绘制坐标（this.logicalSize）：固定设计尺寸，通过 ctx 变换映射到物理像素
     *
     * @param {number} targetCssSize 期望的 CSS 显示边长（正方形）
     */
    resize(targetCssSize) {
      const dpr = window.devicePixelRatio || 1;
      this.cssSize = targetCssSize;

      this.canvas.style.width = `${targetCssSize}px`;
      this.canvas.style.height = `${targetCssSize}px`;
      this.canvas.width = Math.round(targetCssSize * dpr);
      this.canvas.height = Math.round(targetCssSize * dpr);

      // 把绘制坐标系从“逻辑尺寸”缩放映射到“物理像素尺寸”，
      // 后续绘制代码可直接使用逻辑坐标（MARGIN/CELL），无需关心 dpr。
      const scale = (targetCssSize * dpr) / this.logicalSize;
      this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }

    /**
     * 棋盘行列索引 → 逻辑绘制坐标（交叉点中心）。
     * @param {number} index row 或 col
     * @returns {number}
     */
    _indexToCoord(index) {
      return CONFIG.MARGIN + index * CONFIG.CELL;
    }

    /**
     * 屏幕坐标（相对 Canvas 左上角的 CSS 像素）→ 最近交叉点。
     *
     * 若映射结果超出棋盘范围，或点击点距离最近交叉点超过容差，
     * 返回 null（不会被强制吸附到边缘）。
     *
     * @param {number} cssX
     * @param {number} cssY
     * @returns {{row:number, col:number} | null}
     */
    screenToCell(cssX, cssY) {
      // CSS 像素 → 逻辑坐标：二者只差统一缩放比例（与 dpr 无关，
      // 因为 CSS 像素本身就是设备无关像素）
      const scaleRatio = this.logicalSize / this.cssSize;
      const logicalX = cssX * scaleRatio;
      const logicalY = cssY * scaleRatio;

      const col = Math.round((logicalX - CONFIG.MARGIN) / CONFIG.CELL);
      const row = Math.round((logicalY - CONFIG.MARGIN) / CONFIG.CELL);

      if (row < 0 || row >= CONFIG.BOARD_SIZE || col < 0 || col >= CONFIG.BOARD_SIZE) {
        return null;
      }

      // 容差校验：点击点到最近交叉点的距离不能超过命中半径
      const nearestX = this._indexToCoord(col);
      const nearestY = this._indexToCoord(row);
      const distance = Math.hypot(logicalX - nearestX, logicalY - nearestY);
      const hitRadius = CONFIG.CELL * CONFIG.HIT_RADIUS_RATIO;

      if (distance > hitRadius) return null;

      return { row, col };
    }

    /**
     * 主绘制入口：绘制棋盘、棋子、最后一手、获胜连线、悬停预览。
     * 仅在状态变化 / 悬停变化 / 尺寸变化时调用，无持续渲染循环。
     *
     * @param {Game} game 当前对局（只读取）
     * @param {{row:number, col:number} | null} hoverCell 当前悬停交叉点
     */
    render(game, hoverCell) {
      this._clear();
      this._drawBoardBackground();
      this._drawGridLines();
      this._drawStarPoints();
      this._drawAllStones(game.board);
      this._drawLastMoveMark(game.getLastMove());
      this._drawWinLine(game.winCells);
      this._drawHoverPreview(game, hoverCell);
    }

    _clear() {
      this.ctx.clearRect(0, 0, this.logicalSize, this.logicalSize);
    }

    _drawBoardBackground() {
      this.ctx.fillStyle = CONFIG.COLOR.BOARD_BACKGROUND;
      this.ctx.fillRect(0, 0, this.logicalSize, this.logicalSize);
    }

    _drawGridLines() {
      const ctx = this.ctx;
      const firstLine = this._indexToCoord(0);
      const lastLine = this._indexToCoord(CONFIG.BOARD_SIZE - 1);

      ctx.strokeStyle = CONFIG.COLOR.BOARD_LINE;
      ctx.lineWidth = 1;

      for (let i = 0; i < CONFIG.BOARD_SIZE; i++) {
        const pos = this._indexToCoord(i);

        ctx.beginPath();
        ctx.moveTo(firstLine, pos);
        ctx.lineTo(lastLine, pos);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pos, firstLine);
        ctx.lineTo(pos, lastLine);
        ctx.stroke();
      }
    }

    _drawStarPoints() {
      const ctx = this.ctx;
      ctx.fillStyle = CONFIG.COLOR.STAR_POINT;
      for (let i = 0; i < CONFIG.STAR_POINTS.length; i++) {
        const row = CONFIG.STAR_POINTS[i][0];
        const col = CONFIG.STAR_POINTS[i][1];
        ctx.beginPath();
        ctx.arc(this._indexToCoord(col), this._indexToCoord(row), CONFIG.STAR_POINT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /** 绘制所有已落子的棋子 */
    _drawAllStones(board) {
      for (let row = 0; row < board.size; row++) {
        for (let col = 0; col < board.size; col++) {
          const player = board.getStone(row, col);
          if (player !== CONFIG.EMPTY) {
            this._drawStone(row, col, player, 1);
          }
        }
      }
    }

    /**
     * 绘制单颗棋子（径向渐变模拟立体质感）。
     * @param {number} row
     * @param {number} col
     * @param {number} player
     * @param {number} alpha 透明度（悬停预览用半透明）
     */
    _drawStone(row, col, player, alpha) {
      const ctx = this.ctx;
      const x = this._indexToCoord(col);
      const y = this._indexToCoord(row);
      const radius = CONFIG.CELL * CONFIG.STONE_RADIUS_RATIO;
      const isBlack = player === CONFIG.BLACK;

      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.shadowColor = CONFIG.COLOR.STONE_SHADOW;
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1.5;
      ctx.shadowOffsetY = 2;

      const gradient = ctx.createRadialGradient(
        x - radius * 0.35, y - radius * 0.35, radius * 0.1,
        x, y, radius
      );
      if (isBlack) {
        gradient.addColorStop(0, CONFIG.COLOR.STONE_BLACK_HIGHLIGHT);
        gradient.addColorStop(1, CONFIG.COLOR.STONE_BLACK_FILL);
      } else {
        gradient.addColorStop(0, CONFIG.COLOR.STONE_WHITE_HIGHLIGHT);
        gradient.addColorStop(1, CONFIG.COLOR.STONE_WHITE_FILL);
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.restore();
    }

    /**
     * 最后一手标记：在棋子中心叠加一个小圆点，半径远小于棋子，不遮挡辨识度。
     */
    _drawLastMoveMark(lastMove) {
      if (!lastMove) return;
      const ctx = this.ctx;
      const x = this._indexToCoord(lastMove.col);
      const y = this._indexToCoord(lastMove.row);
      const radius = CONFIG.CELL * CONFIG.LAST_MARK_RADIUS_RATIO;

      ctx.save();
      ctx.fillStyle = CONFIG.COLOR.LAST_MARK;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /** 获胜后沿连线绘制一条半透明高亮线 */
    _drawWinLine(winCells) {
      if (!winCells || winCells.length < 2) return;
      const ctx = this.ctx;
      const first = winCells[0];
      const last = winCells[winCells.length - 1];

      ctx.save();
      ctx.strokeStyle = CONFIG.COLOR.WIN_LINE;
      ctx.lineWidth = CONFIG.CELL * CONFIG.STONE_RADIUS_RATIO * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this._indexToCoord(first.col), this._indexToCoord(first.row));
      ctx.lineTo(this._indexToCoord(last.col), this._indexToCoord(last.row));
      ctx.stroke();
      ctx.restore();
    }

    /**
     * 悬停预览：仅玩家回合且位置为空时显示，用玩家颜色半透明棋子表示。
     * 电脑回合、游戏结束后、已有棋子的位置均不显示。
     */
    _drawHoverPreview(game, hoverCell) {
      if (!hoverCell) return;
      if (!game.isPlayerTurn()) return;
      if (!game.board.isEmpty(hoverCell.row, hoverCell.col)) return;
      this._drawStone(hoverCell.row, hoverCell.col, game.playerColor, 0.4);
    }
  }

  NS.Renderer = Renderer;
})(window.Gomoku = window.Gomoku || {});

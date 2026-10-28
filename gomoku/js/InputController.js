/**
 * InputController.js — 指针事件控制器
 *
 * 使用 Pointer Events 统一处理鼠标与触摸输入：
 *   - pointerdown → 触发落子（调用 Game.playerMove，不直接改棋盘）
 *   - pointermove → 仅鼠标场景更新悬停预览（触摸不依赖悬停）
 *   - pointerleave → 清除悬停
 *
 * 防止触摸重复落子的关键：
 *   只在 pointerdown 触发落子，并对事件 preventDefault() 阻止浏览器
 *   合成额外的鼠标事件/触摸滚动，从而避免一次触摸触发两次落子。
 */
(function (NS) {
  'use strict';

  class InputController {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Game} game
     * @param {Renderer} renderer
     * @param {(cell: {row:number,col:number}|null) => void} onHoverChange
     */
    constructor(canvas, game, renderer, onHoverChange) {
      this.canvas = canvas;
      this.game = game;
      this.renderer = renderer;
      this.onHoverChange = onHoverChange;

      this.hoverCell = null;

      this._handlePointerMove = this._onPointerMove.bind(this);
      this._handlePointerDown = this._onPointerDown.bind(this);
      this._handlePointerLeave = this._onPointerLeave.bind(this);

      canvas.addEventListener('pointermove', this._handlePointerMove);
      canvas.addEventListener('pointerdown', this._handlePointerDown);
      canvas.addEventListener('pointerleave', this._handlePointerLeave);
    }

    _onPointerMove(event) {
      // 触摸设备的 pointermove 只在手指按住拖动时触发，不用于悬停预览
      if (event.pointerType === 'touch') return;

      const cell = this._resolveCell(event);
      // 仅当“玩家回合且该位置可落子”时才显示预览，否则清除
      if (cell && this.game.isPlayerTurn() && this.game.board.isEmpty(cell.row, cell.col)) {
        this._setHoverCell(cell);
      } else {
        this._setHoverCell(null);
      }
    }

    _onPointerDown(event) {
      event.preventDefault();

      const cell = this._resolveCell(event);
      if (cell && this.game.isPlayerTurn()) {
        this.game.playerMove(cell.row, cell.col);
      }

      // 触摸落子后没有悬停概念，清除预览
      if (event.pointerType === 'touch') {
        this._setHoverCell(null);
      }
    }

    _onPointerLeave() {
      this._setHoverCell(null);
    }

    /**
     * 将指针事件的屏幕坐标转换为棋盘坐标。
     * 使用 getBoundingClientRect 获取 Canvas 实际显示位置与尺寸，
     * 无论页面如何缩放、Canvas 如何被 CSS 布局，换算都基于真实显示区域。
     */
    _resolveCell(event) {
      const rect = this.canvas.getBoundingClientRect();
      const cssX = event.clientX - rect.left;
      const cssY = event.clientY - rect.top;
      return this.renderer.screenToCell(cssX, cssY);
    }

    /**
     * 更新悬停格子，仅在变化时触发回调，避免无意义重绘。
     */
    _setHoverCell(cell) {
      const prev = this.hoverCell;
      const same =
        (prev === null && cell === null) ||
        (prev !== null && cell !== null && prev.row === cell.row && prev.col === cell.col);

      if (same) return;
      this.hoverCell = cell;
      this.onHoverChange(cell);
    }
  }

  NS.InputController = InputController;
})(window.Gomoku = window.Gomoku || {});

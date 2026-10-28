/**
 * Board.js — 棋盘数据模型
 *
 * 只负责存储和读写棋盘格子状态，不包含任何规则判断逻辑，
 * 也不感知“回合”“玩家”“AI”等上层概念。
 *
 * 棋盘用二维数组表示：grid[row][col]
 *   0 = 空（CONFIG.EMPTY）
 *   1 = 黑棋（CONFIG.BLACK）
 *   2 = 白棋（CONFIG.WHITE）
 */
(function (NS) {
  'use strict';

  const CONFIG = NS.CONFIG;

  class Board {
    constructor() {
      this.size = CONFIG.BOARD_SIZE;
      this.grid = this._createEmptyGrid();
    }

    /** 创建全 0 的二维数组 */
    _createEmptyGrid() {
      const grid = [];
      for (let row = 0; row < this.size; row++) {
        grid.push(new Array(this.size).fill(CONFIG.EMPTY));
      }
      return grid;
    }

    /**
     * 判断坐标是否在棋盘范围内。
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    isInBounds(row, col) {
      return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    /**
     * 判断某坐标是否为空（可落子）。越界坐标视为不可落子。
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    isEmpty(row, col) {
      if (!this.isInBounds(row, col)) return false;
      return this.grid[row][col] === CONFIG.EMPTY;
    }

    /**
     * 读取某坐标的棋子颜色。越界返回 CONFIG.EMPTY。
     * @param {number} row
     * @param {number} col
     * @returns {number} 0 空 | 1 黑 | 2 白
     */
    getStone(row, col) {
      if (!this.isInBounds(row, col)) return CONFIG.EMPTY;
      return this.grid[row][col];
    }

    /**
     * 在指定坐标放置棋子。
     * 调用方需自行保证坐标合法且为空（合法性校验统一由 Game 完成）。
     * @param {number} row
     * @param {number} col
     * @param {number} player
     */
    placeStone(row, col, player) {
      this.grid[row][col] = player;
    }

    /**
     * 移除指定坐标的棋子（悔棋时使用）。
     * @param {number} row
     * @param {number} col
     */
    removeStone(row, col) {
      this.grid[row][col] = CONFIG.EMPTY;
    }

    /** 清空整个棋盘。 */
    clear() {
      this.grid = this._createEmptyGrid();
    }

    /**
     * 判断棋盘是否已下满（用于平局判定）。
     * @returns {boolean}
     */
    isFull() {
      for (let row = 0; row < this.size; row++) {
        for (let col = 0; col < this.size; col++) {
          if (this.grid[row][col] === CONFIG.EMPTY) return false;
        }
      }
      return true;
    }

    /**
     * 复制一份棋盘副本（用于 AI 推演时避免污染真实棋盘）。
     * @returns {Board}
     */
    clone() {
      const copy = new Board();
      for (let row = 0; row < this.size; row++) {
        for (let col = 0; col < this.size; col++) {
          copy.grid[row][col] = this.grid[row][col];
        }
      }
      return copy;
    }
  }

  NS.Board = Board;
})(window.Gomoku = window.Gomoku || {});

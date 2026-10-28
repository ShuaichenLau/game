/**
 * RuleChecker.js — 五子棋规则检查（纯函数模块）
 *
 * 不操作 DOM，不持有状态，只根据传入的棋盘数据进行判断。
 * 使用无禁手自由规则：任意方向连续 5 颗及以上同色棋子即获胜。
 */
(function (NS) {
  'use strict';

  /** 四个基本检测方向：水平、垂直、主对角线、副对角线 */
  const DIRECTIONS = [
    { dr: 0, dc: 1 },  // 横向 →
    { dr: 1, dc: 0 },  // 纵向 ↓
    { dr: 1, dc: 1 },  // 主对角线 ↘
    { dr: 1, dc: -1 }, // 副对角线 ↙
  ];

  /**
   * 从起点沿某一方向连续计数同色棋子（不含起点本身）。
   * @param {Board} board
   * @param {number} row 起点行
   * @param {number} col 起点列
   * @param {number} dr 行方向增量
   * @param {number} dc 列方向增量
   * @param {number} player 目标棋子颜色
   * @returns {Array<{row:number, col:number}>} 该方向上连续同色棋子坐标
   */
  function collectSameColorInDirection(board, row, col, dr, dc, player) {
    const cells = [];
    let r = row + dr;
    let c = col + dc;
    while (board.isInBounds(r, c) && board.getStone(r, c) === player) {
      cells.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    return cells;
  }

  /**
   * 检查以 (lastRow, lastCol) 为“最后落子点”是否构成获胜。
   *
   * 关键：此函数把 (lastRow, lastCol) 视为一颗 `player` 棋子参与计数，
   * 但【不会真的修改棋盘】。因此它既能用于真实落子后的胜负判定，
   * 也能用于 AI 的“假设我在这里落子是否获胜”的推演，天然不污染棋盘。
   *
   * 复杂度 O(1)：只从最后落子出发，沿 4 个方向各向两端延伸，
   * 最多探测 4 × 2 × 4 = 32 个格子，无需扫描全盘。
   *
   * @param {Board} board
   * @param {number} lastRow 最后落子的行
   * @param {number} lastCol 最后落子的列
   * @param {number} player 落子方颜色
   * @returns {{ isWin: boolean, winCells: Array<{row:number,col:number}> }}
   */
  function checkWin(board, lastRow, lastCol, player) {
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const { dr, dc } = DIRECTIONS[i];
      const forwardCells = collectSameColorInDirection(board, lastRow, lastCol, dr, dc, player);
      const backwardCells = collectSameColorInDirection(board, lastRow, lastCol, -dr, -dc, player);

      const totalCount = 1 + forwardCells.length + backwardCells.length;

      if (totalCount >= 5) {
        // 拼接连线坐标：反方向需倒序，使整体顺序从一端连续到另一端
        const winCells = [];
        for (let j = backwardCells.length - 1; j >= 0; j--) {
          winCells.push(backwardCells[j]);
        }
        winCells.push({ row: lastRow, col: lastCol });
        for (let j = 0; j < forwardCells.length; j++) {
          winCells.push(forwardCells[j]);
        }
        return { isWin: true, winCells };
      }
    }
    return { isWin: false, winCells: [] };
  }

  /**
   * 检查是否平局：棋盘已满且（调用前提）未产生获胜。
   * 必须在 checkWin 判定为 false 之后再调用，保证“先判胜后判平”的顺序。
   * @param {Board} board
   * @returns {boolean}
   */
  function checkDraw(board) {
    return board.isFull();
  }

  NS.RuleChecker = {
    checkWin,
    checkDraw,
  };
})(window.Gomoku = window.Gomoku || {});

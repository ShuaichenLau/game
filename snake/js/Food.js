/**
 * Food.js — 食物数据模型
 *
 * 负责：
 *  - 持有食物当前坐标
 *  - 提供 randomize(excludeCells) 方法在空白格随机刷新位置
 *
 * 不持有任何 DOM / Canvas 引用。
 */

import { CONFIG } from './config.js';

export class Food {
  /**
   * @param {number} gridCount 网格大小（行列数）
   */
  constructor(gridCount = CONFIG.GRID_COUNT) {
    this.gridCount = gridCount;
    // 初始坐标设为 -1，表示尚未放置
    this.position = { x: -1, y: -1 };
  }

  /**
   * 在空白格随机生成食物坐标。
   * 若所有格子均被占用（理论上蛇满格），则放置在 (0,0)。
   *
   * @param {{ x: number, y: number }[]} excludeCells 不能放置的格子（蛇身）
   */
  randomize(excludeCells) {
    // 构建空格集合
    const occupied = new Set(excludeCells.map(c => `${c.x},${c.y}`));

    const available = [];
    for (let x = 0; x < this.gridCount; x++) {
      for (let y = 0; y < this.gridCount; y++) {
        if (!occupied.has(`${x},${y}`)) {
          available.push({ x, y });
        }
      }
    }

    if (available.length === 0) {
      this.position = { x: 0, y: 0 };
      return;
    }

    const idx = Math.floor(Math.random() * available.length);
    this.position = { ...available[idx] };
  }

  /**
   * 判断某坐标是否命中食物。
   * @param {{ x: number, y: number }} cell
   * @returns {boolean}
   */
  isAt(cell) {
    return cell.x === this.position.x && cell.y === this.position.y;
  }
}

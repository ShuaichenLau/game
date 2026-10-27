/**
 * Snake.js — 蛇的数据模型
 *
 * 负责：
 *  - 维护蛇身节点列表（head 在 index 0）
 *  - 管理当前方向与"待确认方向"缓冲（防止同帧反向）
 *  - 提供 move()、grow()、reset() 方法
 *
 * 不持有任何 DOM / Canvas 引用，纯数据操作。
 */

import { CONFIG } from './config.js';

export class Snake {
  /**
   * @param {number} gridCount 网格大小（行列数）
   */
  constructor(gridCount = CONFIG.GRID_COUNT) {
    this.gridCount = gridCount;
    this.reset();
  }

  /** 重置到初始状态 */
  reset() {
    const midRow = Math.floor(this.gridCount / 2);
    const midCol = Math.floor(this.gridCount / 2);

    // 初始身体：head 在最右，向右延伸
    this.body = [];
    for (let i = 0; i < CONFIG.INITIAL_LENGTH; i++) {
      this.body.push({ x: midCol - i, y: midRow });
    }

    // 当前移动方向
    this.direction = { ...CONFIG.INITIAL_DIR };

    // 下一帧方向缓冲（玩家输入写入此处，tick 时才真正采用）
    this._nextDir = { ...CONFIG.INITIAL_DIR };

    // 是否待增长（吃到食物后置 true，下次 move 时不移除尾部）
    this._grow = false;
  }

  /** 获取蛇头坐标（只读） */
  get head() {
    return this.body[0];
  }

  /**
   * 请求改变方向。
   * 规则：不能直接掉头（新方向与当前方向互为反向则忽略）。
   *
   * @param {{ x: number, y: number }} dir
   */
  setDirection(dir) {
    const isReverse =
      dir.x === -this.direction.x && dir.y === -this.direction.y;
    if (!isReverse) {
      this._nextDir = { ...dir };
    }
  }

  /**
   * 向前移动一步。
   * - 先确认方向（消费缓冲）
   * - 在头部前方插入新头
   * - 若不处于增长状态，移除尾部
   */
  move() {
    // 提交下一帧方向
    this.direction = { ...this._nextDir };

    const newHead = {
      x: this.head.x + this.direction.x,
      y: this.head.y + this.direction.y,
    };

    this.body.unshift(newHead);

    if (this._grow) {
      this._grow = false; // 消费增长标记，保留尾部
    } else {
      this.body.pop();    // 正常移动，移除旧尾
    }
  }

  /**
   * 标记蛇即将增长一节（在下一次 move 时生效）。
   */
  grow() {
    this._grow = true;
  }

  /**
   * 返回所有蛇身节点的只读副本。
   * @returns {{ x: number, y: number }[]}
   */
  getSegments() {
    return this.body;
  }
}

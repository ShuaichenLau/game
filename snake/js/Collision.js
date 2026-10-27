/**
 * Collision.js — 碰撞检测
 *
 * 所有碰撞规则集中在此，方便独立修改和测试。
 * 函数均为纯函数，不持有任何状态。
 */

import { CONFIG } from './config.js';

/**
 * 判断坐标是否越出网格边界（撞墙）。
 *
 * @param {{ x: number, y: number }} head
 * @param {number} gridCount
 * @returns {boolean}
 */
export function hitWall(head, gridCount = CONFIG.GRID_COUNT) {
  return (
    head.x < 0 ||
    head.x >= gridCount ||
    head.y < 0 ||
    head.y >= gridCount
  );
}

/**
 * 判断蛇头是否与自身某节相撞（撞自己）。
 * 检测范围为 body[1] 之后（跳过蛇头本身）。
 *
 * @param {{ x: number, y: number }[]} body 完整蛇身（含头部）
 * @returns {boolean}
 */
export function hitSelf(body) {
  const head = body[0];
  for (let i = 1; i < body.length; i++) {
    if (body[i].x === head.x && body[i].y === head.y) {
      return true;
    }
  }
  return false;
}

/**
 * 综合判断：移动后是否触发死亡。
 *
 * @param {{ x: number, y: number }[]} body
 * @param {number} gridCount
 * @returns {boolean}
 */
export function isDead(body, gridCount = CONFIG.GRID_COUNT) {
  return hitWall(body[0], gridCount) || hitSelf(body);
}

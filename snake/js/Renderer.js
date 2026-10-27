/**
 * Renderer.js — Canvas 渲染器
 *
 * 负责所有绘制工作，不持有游戏逻辑状态。
 * 通过 render(scene) 接收快照数据，一次性完成绘制。
 *
 * scene = {
 *   snake     : Snake 实例
 *   food      : Food  实例
 *   score     : number
 *   hiscore   : number
 *   state     : 'idle' | 'running' | 'paused' | 'over'
 * }
 */

import { CONFIG } from './config.js';

const C = CONFIG.COLOR;
const CELL = CONFIG.CELL_SIZE;
const N    = CONFIG.GRID_COUNT;

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // 设置画布物理像素尺寸
    const size = CONFIG.CANVAS_SIZE;
    canvas.width  = size;
    canvas.height = size;
  }

  /**
   * 主渲染入口，每帧调用一次。
   * @param {object} scene
   */
  render(scene) {
    const { snake, food, score, hiscore, state } = scene;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawBackground();
    this._drawGrid();
    this._drawFood(food.position);
    this._drawSnake(snake.getSegments());

    // 根据状态叠加遮罩文字
    if (state === 'idle') {
      this._drawOverlay('贪 吃 蛇', ['方向键 / WASD 开始', '空格键 暂停 / 继续'], score, hiscore);
    } else if (state === 'paused') {
      this._drawOverlay('已  暂  停', ['空格键 / Enter 继续'], score, hiscore);
    } else if (state === 'over') {
      this._drawOverlay('游 戏 结 束', [`得分：${score}`, '空格键 / Enter 重新开始'], score, hiscore);
    }
  }

  // ─── 私有绘制方法 ─────────────────────────────────────────────

  /** 纯色背景 */
  _drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = C.BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** 极淡网格线（装饰性） */
  _drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = C.GRID;
    ctx.lineWidth   = 0.5;
    ctx.globalAlpha = 0.4;

    for (let i = 0; i <= N; i++) {
      const pos = i * CELL;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, this.canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(this.canvas.width, pos);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  /**
   * 绘制食物（带高光的圆形）
   * @param {{ x: number, y: number }} pos
   */
  _drawFood(pos) {
    if (pos.x < 0) return; // 尚未初始化
    const ctx = this.ctx;
    const cx  = pos.x * CELL + CELL / 2;
    const cy  = pos.y * CELL + CELL / 2;
    const r   = CELL * 0.38;

    // 主体
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, C.FOOD_SHINE);
    grad.addColorStop(1, C.FOOD);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 高光点
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  }

  /**
   * 绘制蛇（圆角矩形，头部单独配色）
   * @param {{ x: number, y: number }[]} segments
   */
  _drawSnake(segments) {
    if (segments.length === 0) return;
    const ctx = this.ctx;
    const pad = 2; // 内边距，使格子间有微小间隙

    segments.forEach((seg, index) => {
      const x = seg.x * CELL + pad;
      const y = seg.y * CELL + pad;
      const w = CELL - pad * 2;
      const h = CELL - pad * 2;
      const radius = index === 0 ? 7 : 5;

      // 蛇身渐变：头部亮，尾部偏暗
      const alpha = Math.max(0.35, 1 - index / (segments.length + 4));
      ctx.globalAlpha = alpha;

      ctx.fillStyle   = index === 0 ? C.SNAKE_HEAD : C.SNAKE_BODY;
      ctx.strokeStyle = C.SNAKE_STROKE;
      ctx.lineWidth   = 1.5;

      this._roundRect(x, y, w, h, radius);
      ctx.fill();
      ctx.stroke();
    });

    ctx.globalAlpha = 1;

    // 蛇头眼睛
    this._drawEyes(segments[0], segments.length > 1 ? segments[1] : null);
  }

  /**
   * 在蛇头上画两个小眼睛，方向朝移动方向。
   * @param {{ x: number, y: number }} head
   * @param {{ x: number, y: number } | null} neck
   */
  _drawEyes(head, neck) {
    const ctx = this.ctx;
    const cx  = head.x * CELL + CELL / 2;
    const cy  = head.y * CELL + CELL / 2;

    // 根据颈部推断面朝方向（没有颈部默认朝右）
    let dx = 1, dy = 0;
    if (neck) {
      dx = head.x - neck.x;
      dy = head.y - neck.y;
    }

    // 眼睛相对头部中心的偏移（垂直于移动方向）
    const eyeOffset = CELL * 0.22;
    const eyeDist   = CELL * 0.25;
    const eyeRadius = CELL * 0.09;

    // 两只眼睛位置（垂直于 dir 的两侧）
    const perpX = -dy;
    const perpY =  dx;

    const eyes = [
      { x: cx + dx * eyeDist + perpX * eyeOffset, y: cy + dy * eyeDist + perpY * eyeOffset },
      { x: cx + dx * eyeDist - perpX * eyeOffset, y: cy + dy * eyeDist - perpY * eyeOffset },
    ];

    ctx.fillStyle = '#001233';
    eyes.forEach(e => {
      ctx.beginPath();
      ctx.arc(e.x, e.y, eyeRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 白色高光
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    eyes.forEach(e => {
      ctx.beginPath();
      ctx.arc(e.x - eyeRadius * 0.3, e.y - eyeRadius * 0.3, eyeRadius * 0.38, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * 绘制半透明遮罩 + 标题 + 提示 + 分数。
   * @param {string} title
   * @param {string[]} hints
   * @param {number} score
   * @param {number} hiscore
   */
  _drawOverlay(title, hints, score, hiscore) {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    // 半透明遮罩
    ctx.fillStyle = C.OVERLAY;
    ctx.fillRect(0, 0, W, H);

    // 标题
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = C.TEXT_PRIMARY;
    ctx.font         = `bold 36px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillText(title, W / 2, H / 2 - 56);

    // 提示行
    ctx.font      = `16px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillStyle = C.TEXT_DIM;
    hints.forEach((line, i) => {
      ctx.fillText(line, W / 2, H / 2 + i * 26);
    });

    // 分数行
    ctx.font      = `14px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillStyle = C.TEXT_DIM;
    ctx.fillText(`最高分：${hiscore}`, W / 2, H / 2 + hints.length * 26 + 20);
  }

  /**
   * 辅助：在 ctx 上绘制圆角矩形路径（不 fill/stroke）。
   * @param {number} x @param {number} y
   * @param {number} w @param {number} h
   * @param {number} r 圆角半径
   */
  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
}

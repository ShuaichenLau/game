// ============================================================
//  renderer.js — 渲染地图、玩家、敌人、特效（Canvas）
// ============================================================
"use strict";

const Renderer = {
  ctx: null,
  canvas: null,
  camX: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
  },

  // 相机：跟随玩家，限制在地图范围内
  updateCamera(px, mapPixelW) {
    this.camX = Math.max(0, Math.min(px - CONFIG.VIEW_W / 2, mapPixelW - CONFIG.VIEW_W));
  },

  _fillRect(x, y, w, h, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - this.camX), Math.round(y), Math.round(w), Math.round(h));
  },

  drawMap(map) {
    const ctx = this.ctx;
    const TILE = CONFIG.TILE;
    // 天空背景渐变
    const g = ctx.createLinearGradient(0, 0, 0, CONFIG.VIEW_H);
    g.addColorStop(0, "#5c94fc");
    g.addColorStop(0.7, "#8ec7ff");
    g.addColorStop(1, "#b8e0ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    const startCol = Math.floor(this.camX / TILE);
    const endCol = Math.ceil((this.camX + CONFIG.VIEW_W) / TILE);

    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = startCol; c <= endCol && c < CONFIG.COLS; c++) {
        const t = map[r][c];
        if (t === T.EMPTY) continue;
        const x = c * TILE;
        const y = r * TILE;
        this._drawTile(t, x, y);
      }
    }
  },

  _drawTile(t, x, y) {
    const ctx = this.ctx;
    const TILE = CONFIG.TILE;
    const sx = x - this.camX;
    const u = TILE / 16;
    switch (t) {
      case T.GROUND:
        this._fillRect(x, y, TILE, TILE, "#b5733f");
        this._fillRect(x, y, TILE, 4 * u, "#e09a5b");
        // 砖缝
        ctx.fillStyle = "#7a4a24";
        ctx.fillRect(sx + TILE - 1, y, 1, TILE);
        ctx.fillRect(sx, y + TILE - 1, TILE, 1);
        break;
      case T.BRICK:
        this._fillRect(x, y, TILE, TILE, "#c26a3a");
        ctx.fillStyle = "#7a3c1d";
        ctx.fillRect(sx + TILE - 1, y, 1, TILE);
        ctx.fillRect(sx, y + TILE - 1, TILE, 1);
        ctx.fillStyle = "#e0925c";
        ctx.fillRect(sx, y + 7 * u, TILE, 1);
        ctx.fillRect(sx + 7 * u, y, 1, 8 * u);
        break;
      case T.BLOCK:
        this._fillRect(x, y, TILE, TILE, "#e8a33c");
        ctx.fillStyle = "#8a5a12";
        ctx.fillRect(sx, y, TILE, 1);
        ctx.fillRect(sx, y + TILE - 1, TILE, 1);
        ctx.fillRect(sx, y, 1, TILE);
        ctx.fillRect(sx + TILE - 1, y, 1, TILE);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.round(11 * u)}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText("?", sx + TILE / 2, y + TILE - 3 * u);
        break;
      case T.USED:
        this._fillRect(x, y, TILE, TILE, "#9c6b3a");
        ctx.fillStyle = "#6a4320";
        ctx.fillRect(sx, y, TILE, 1);
        ctx.fillRect(sx, y + TILE - 1, TILE, 1);
        ctx.fillRect(sx, y, 1, TILE);
        ctx.fillRect(sx + TILE - 1, y, 1, TILE);
        break;
      case T.PIPE_TL:
      case T.PIPE_TR:
      case T.PIPE_L:
      case T.PIPE_R: {
        const left = (t === T.PIPE_TL || t === T.PIPE_L);
        const top = (t === T.PIPE_TL || t === T.PIPE_TR);
        this._fillRect(x, y, TILE, TILE, "#3fae3f");
        // 高光在左，阴影在右
        if (left) ctx.fillStyle = "#8ce08c"; else ctx.fillStyle = "#2a7a2a";
        ctx.fillRect(sx, y, 4 * u, TILE);
        if (top) {
          ctx.fillStyle = "#2a7a2a";
          ctx.fillRect(sx, y, TILE, 3 * u);
        }
        break;
      }
      case T.FLAG: {
        const u = CONFIG.TILE / 16;
        const poleH = 6 * CONFIG.TILE;
        // 旗杆
        this._fillRect(x + 7 * u, y - poleH, 3 * u, poleH + CONFIG.TILE, "#5a5a5a");
        // 旗子
        ctx.fillStyle = "#ff5555";
        ctx.beginPath();
        ctx.moveTo(sx + 10 * u, y - poleH);
        ctx.lineTo(sx + 10 * u + 26 * u, y - poleH + 8 * u);
        ctx.lineTo(sx + 10 * u, y - poleH + 16 * u);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
  },

  drawPlayer(p) {
    const ctx = this.ctx;
    const TILE = CONFIG.TILE;
    const x = p.x - this.camX;
    const y = p.y;
    const w = p.w, h = p.h;
    // 用单位 u 做比例，保证任意尺寸下细节不错位
    const u = w / 13;

    if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0) return; // 闪烁

    ctx.save();
    // 身体颜色（大马里奥红+蓝，小马里奥红+棕）
    const skin = "#ffc9a3";
    const hatShirt = "#e53935";
    const overalls = p.big ? "#2d5bd8" : "#8a5a2a";

    // 帽子
    this._fillRect(x + 2 * u, y, w - 4 * u, 3 * u, hatShirt);
    this._fillRect(x, y + 1 * u, 2 * u, 4 * u, hatShirt);
    // 脸
    this._fillRect(x + 3 * u, y + 3 * u, w - 6 * u, 3 * u, skin);
    this._fillRect(x + 2 * u, y + 6 * u, w - 4 * u, 1 * u, skin);
    // 胡子
    this._fillRect(x + 4 * u, y + 7 * u, w - 8 * u, 1 * u, "#5a3a1a");
    // 眼睛
    this._fillRect(x + 4 * u, y + 3 * u, 2 * u, 2 * u, "#222");
    // 衣服
    this._fillRect(x + 2 * u, y + 8 * u, w - 4 * u, h - 12 * u, hatShirt);
    // 背带裤
    this._fillRect(x + 3 * u, y + h - 5 * u, w - 6 * u, 5 * u, overalls);
    this._fillRect(x + 3 * u, y + h - 5 * u, 2 * u, 2 * u, overalls);
    this._fillRect(x + w - 5 * u, y + h - 5 * u, 2 * u, 2 * u, overalls);
    // 手臂
    this._fillRect(x, y + 8 * u, 2 * u, 4 * u, hatShirt);
    this._fillRect(x + w - 2 * u, y + 8 * u, 2 * u, 4 * u, hatShirt);
    // 脚
    this._fillRect(x + 2 * u, y + h - 2 * u, 4 * u, 2 * u, "#5a3a1a");
    this._fillRect(x + w - 6 * u, y + h - 2 * u, 4 * u, 2 * u, "#5a3a1a");
    ctx.restore();
  },

  drawEnemy(e) {
    const ctx = this.ctx;
    const TILE = CONFIG.TILE;
    const x = e.x - this.camX;
    const y = e.y;
    const u = e.w / 14;
    if (e.dead) {
      // 被踩扁
      this._fillRect(x, y + e.h - 4 * u, e.w, 4 * u, e.type === "koopa" ? "#3fae3f" : "#8a5a2a");
      return;
    }
    if (e.type === "goomba") {
      // 栗子头
      this._fillRect(x + 2 * u, y, e.w - 4 * u, e.h - 4 * u, "#8a5a2a");
      this._fillRect(x + 1 * u, y + 2 * u, e.w - 2 * u, e.h - 6 * u, "#a96a35");
      // 眼睛
      this._fillRect(x + 4 * u, y + 5 * u, 2 * u, 3 * u, "#fff");
      this._fillRect(x + e.w - 6 * u, y + 5 * u, 2 * u, 3 * u, "#fff");
      this._fillRect(x + 4 * u, y + 6 * u, 1 * u, 2 * u, "#222");
      this._fillRect(x + e.w - 6 * u, y + 6 * u, 1 * u, 2 * u, "#222");
      // 脚
      this._fillRect(x + 1 * u, y + e.h - 3 * u, 4 * u, 3 * u, "#5a3a1a");
      this._fillRect(x + e.w - 5 * u, y + e.h - 3 * u, 4 * u, 3 * u, "#5a3a1a");
    } else if (e.type === "koopa") {
      // 乌龟
      this._fillRect(x + 2 * u, y, e.w - 4 * u, e.h - 3 * u, "#3fae3f");
      this._fillRect(x + 1 * u, y + 3 * u, e.w - 2 * u, e.h - 6 * u, "#5cc95c");
      this._fillRect(x + 3 * u, y + 4 * u, 2 * u, 2 * u, "#222");
      // 壳
      this._fillRect(x + 3 * u, y + 6 * u, e.w - 6 * u, e.h - 8 * u, "#e8a33c");
      this._fillRect(x + 3 * u, y + 6 * u, e.w - 6 * u, 2 * u, "#c8842a");
      this._fillRect(x + 1 * u, y + e.h - 2 * u, 3 * u, 2 * u, "#f7d06a");
      this._fillRect(x + e.w - 4 * u, y + e.h - 2 * u, 3 * u, 2 * u, "#f7d06a");
    }
  },

  drawCoin(c) {
    const ctx = this.ctx;
    const x = c.x - this.camX;
    const y = c.y;
    const w = c.size || Math.round(CONFIG.TILE * 0.5);
    const sway = Math.sin(c.t * 0.15) * 3;
    ctx.fillStyle = "#ffd23e";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + w / 2 + sway, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8860b";
    ctx.fillRect(x + w / 2 - 1.5, y + 2 + sway, 3, w - 4);
  },

  drawParticles(particles) {
    for (const p of particles) {
      this._fillRect(p.x, p.y, p.size, p.size, p.color);
    }
  },

  drawFlag() {
    // 旗杆已在 drawMap 中绘制
  },

  // 全屏覆盖文字
  drawOverlay(text, sub, color = "#fff") {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.font = "bold 40px Arial";
    ctx.fillText(text, CONFIG.VIEW_W / 2, CONFIG.VIEW_H / 2 - 10);
    if (sub) {
      ctx.font = "18px Arial";
      ctx.fillStyle = "#ddd";
      ctx.fillText(sub, CONFIG.VIEW_W / 2, CONFIG.VIEW_H / 2 + 30);
    }
  },
};

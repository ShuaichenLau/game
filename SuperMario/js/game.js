// ============================================================
//  game.js — 游戏核心：物理、碰撞、敌人 AI、关卡流程、主循环
// ============================================================
"use strict";

const Game = {
  map: null,
  player: null,
  enemies: [],
  coins: [],
  particles: [],
  score: 0,
  coinCount: 0,
  lives: 3,
  state: "title",   // title | playing | dead | win | paused
  frame: 0,
  worldWidth: 0,

  start() {
    AudioSys.init();
    Input.init();
    Renderer.init(document.getElementById("game"));
    this.worldWidth = CONFIG.COLS * CONFIG.TILE;
    this.reset();
    this.bindHud();
    this.loop();
  },

  reset() {
    this.map = buildMap();
    this.enemies = [];
    this.coins = [];
    this.particles = [];
    this.player = this.makePlayer();
    // 生成敌人
    for (const s of ENEMY_SPAWNS) {
      this.enemies.push(this.makeEnemy(s.col, s.type));
    }
    // 在部分问号块上方放金币
    this.spawnCoins();
    this.state = "title";
  },

  makePlayer() {
    return {
      x: 2 * CONFIG.TILE,
      y: 11 * CONFIG.TILE,
      w: Math.round(CONFIG.TILE * CONFIG.PLAYER_W),
      h: Math.round(CONFIG.TILE * CONFIG.PLAYER_H),
      vx: 0,
      vy: 0,
      onGround: false,
      big: false,
      invincible: 0,
      coyote: 0,
      jumpBuffer: 0,
      facing: 1,
    };
  },

  makeEnemy(col, type) {
    const w = Math.round(CONFIG.TILE * 0.72);
    const h = type === "koopa" ? Math.round(CONFIG.TILE * 0.78) : Math.round(CONFIG.TILE * 0.72);
    return {
      x: col * CONFIG.TILE,
      y: 12 * CONFIG.TILE - h,
      vx: -1.05,
      vy: 0,
      type,
      dead: false,
      deadTimer: 0,
      alive: true,
    };
  },

  spawnCoins() {
    // 固定位置几枚漂浮金币
    const spots = [
      [6, 7], [8, 6], [14, 8], [26, 9], [36, 8],
    ];
    const coinSize = Math.round(CONFIG.TILE * 0.5);
    for (const [col, row] of spots) {
      this.coins.push({ x: col * CONFIG.TILE + (CONFIG.TILE - coinSize) / 2, y: row * CONFIG.TILE, t: this.frame + col, size: coinSize });
    }
  },

  bindHud() {
    this.hud = {
      score: document.getElementById("score"),
      coins: document.getElementById("coins"),
      lives: document.getElementById("lives"),
    };
  },

  updateHud() {
    this.hud.score.textContent = this.score;
    this.hud.coins.textContent = this.coinCount;
    this.hud.lives.textContent = this.lives;
  },

  // ---------- 主循环 ----------
  loop() {
    this.frame++;
    this.update();
    this.render();
    Input.endFrame();
    requestAnimationFrame(() => this.loop());
  },

  restart() {
    this.reset();
    this.state = "playing";
    AudioSys.resume();
  },

  togglePause() {
    if (this.state === "playing") this.state = "paused";
    else if (this.state === "paused") this.state = "playing";
  },

  update() {
    if (this.state === "title") {
      if (Input.anyJump) { this.state = "playing"; AudioSys.resume(); }
      return;
    }
    if (this.state === "paused") return;
    if (this.state === "dead") {
      this.player.vy += CONFIG.GRAVITY;
      this.player.y += this.player.vy;
      this.deadTimer--;
      if (this.deadTimer <= 0) {
        this.lives--;
        this.updateHud();
        if (this.lives <= 0) {
          this.state = "gameover";
        } else {
          this.player = this.makePlayer();
          this.state = "playing";
        }
      }
      this.updateParticles();
      return;
    }
    if (this.state === "gameover") {
      if (Input.anyJump) { this.score = 0; this.coinCount = 0; this.lives = 3; this.restart(); }
      return;
    }
    if (this.state === "win") {
      this.updateParticles();
      if (Input.anyJump) { this.score = 0; this.coinCount = 0; this.lives = 3; this.restart(); }
      return;
    }

    this.updatePlayer();
    this.updateEnemies();
    this.updateCoins();
    this.updateParticles();
    this.checkWin();
    this.updateHud();
  },

  updatePlayer() {
    const p = this.player;
    const acc = Input.left || Input.right ? CONFIG.MOVE_ACC : 0;
    if (Input.left) { p.vx -= acc; p.facing = -1; }
    if (Input.right) { p.vx += acc; p.facing = 1; }
    // 摩擦 / 限速：按住时摩擦，松开时强力刹车（更跟手）
    if (!Input.left && !Input.right) {
      p.vx *= CONFIG.MOVE_FRICTION;
      if (p.onGround && Math.abs(p.vx) < 0.8) p.vx = 0; // 落地且速度很小时直接停下
    }
    p.vx = Math.max(-CONFIG.MAX_RUN, Math.min(CONFIG.MAX_RUN, p.vx));
    if (Math.abs(p.vx) < 0.05) p.vx = 0;

    // 重力
    p.vy += CONFIG.GRAVITY;
    if (p.vy > CONFIG.MAX_FALL) p.vy = CONFIG.MAX_FALL;

    // 跳跃缓冲
    if (Input.jumpPressed) p.jumpBuffer = CONFIG.JUMP_BUFFER;
    else if (p.jumpBuffer > 0) p.jumpBuffer--;
    // 土狼时间
    if (p.onGround) p.coyote = CONFIG.COYOTE;
    else if (p.coyote > 0) p.coyote--;

    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = CONFIG.JUMP_VEL;
      p.jumpBuffer = 0;
      p.coyote = 0;
      p.onGround = false;
      AudioSys.jump();
    }
    // 松开跳跃键则截断上升（短跳）
    if (!Input.jumpHeld && p.vy < -3) p.vy = -3;

    // 水平移动 + 碰撞
    this.moveX(p, p.vx);
    this.moveY(p, p.vy);

    // 掉出地图
    if (p.y > CONFIG.ROWS * CONFIG.TILE + 40) {
      this.kill();
      return;
    }

    // 无敌时间递减
    if (p.invincible > 0) p.invincible--;
  },

  // X 轴移动 + 碰撞
  moveX(p, dx) {
    if (dx === 0) return;
    p.x += dx;
    // 边界
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x + p.w > this.worldWidth) { p.x = this.worldWidth - p.w; }
    // 图块碰撞
    const r1 = Math.floor(p.y / CONFIG.TILE);
    const r2 = Math.floor((p.y + p.h - 1) / CONFIG.TILE);
    if (dx > 0) {
      const c = Math.floor((p.x + p.w) / CONFIG.TILE);
      for (let r = r1; r <= r2; r++) {
        if (this.tileSolid(r, c)) { p.x = c * CONFIG.TILE - p.w - 0.01; p.vx = 0; break; }
      }
    } else {
      const c = Math.floor(p.x / CONFIG.TILE);
      for (let r = r1; r <= r2; r++) {
        if (this.tileSolid(r, c)) { p.x = (c + 1) * CONFIG.TILE + 0.01; p.vx = 0; break; }
      }
    }
  },

  // Y 轴移动 + 碰撞
  moveY(p, dy) {
    p.y += dy;
    const c1 = Math.floor(p.x / CONFIG.TILE);
    const c2 = Math.floor((p.x + p.w - 1) / CONFIG.TILE);
    if (dy > 0) {
      // 下落
      const r = Math.floor((p.y + p.h) / CONFIG.TILE);
      for (let c = c1; c <= c2; c++) {
        if (this.tileSolid(r, c)) {
          p.y = r * CONFIG.TILE - p.h;
          p.vy = 0;
          p.onGround = true;
          return;
        }
      }
      p.onGround = false;
    } else {
      // 上升（顶头）
      const r = Math.floor(p.y / CONFIG.TILE);
      for (let c = c1; c <= c2; c++) {
        if (this.tileSolid(r, c)) {
          p.y = (r + 1) * CONFIG.TILE;
          p.vy = 0;
          this.bumpBlock(r, c);
        }
      }
    }
  },

  tileSolid(r, c) {
    if (r < 0 || r >= CONFIG.ROWS || c < 0 || c >= CONFIG.COLS) return true;
    return solid(this.map[r][c]);
  },

  bumpBlock(r, c) {
    const t = this.map[r][c];
    if (t === T.BLOCK) {
      this.map[r][c] = T.USED;
      this.score += 200;
      this.coinCount++;
      this.spawnBump(r, c);
      AudioSys.coin();
    } else if (t === T.BRICK) {
      // 大马里奥可顶碎
      if (this.player.big) {
        this.map[r][c] = T.EMPTY;
        this.score += 50;
        this.spawnBreak(r, c);
        AudioSys.break_();
      } else {
        this.spawnBump(r, c);
        AudioSys.bump();
      }
    } else {
      AudioSys.bump();
    }
  },

  updateEnemies() {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.dead) {
        e.deadTimer--;
        if (e.deadTimer <= 0) e.alive = false;
        continue;
      }
      // 重力
      e.vy += CONFIG.GRAVITY;
      if (e.vy > CONFIG.MAX_FALL) e.vy = CONFIG.MAX_FALL;
      e.x += e.vx;
      e.y += e.vy;

      // 平台碰撞（简化：只检测脚下与水平）
      const r1 = Math.floor(e.y / CONFIG.TILE);
      const r2 = Math.floor((e.y + e.h - 1) / CONFIG.TILE);
      // 水平
      if (e.vx > 0) {
        const c = Math.floor((e.x + e.w) / CONFIG.TILE);
        for (let r = r1; r <= r2; r++) if (this.tileSolid(r, c)) { e.vx = -Math.abs(e.vx); e.x = c * CONFIG.TILE - e.w; break; }
      } else if (e.vx < 0) {
        const c = Math.floor(e.x / CONFIG.TILE);
        for (let r = r1; r <= r2; r++) if (this.tileSolid(r, c)) { e.vx = Math.abs(e.vx); e.x = (c + 1) * CONFIG.TILE; break; }
      }
      // 垂直
      if (e.vy > 0) {
        const c1 = Math.floor(e.x / CONFIG.TILE);
        const c2 = Math.floor((e.x + e.w - 1) / CONFIG.TILE);
        const r = Math.floor((e.y + e.h) / CONFIG.TILE);
        for (let c = c1; c <= c2; c++) {
          if (this.tileSolid(r, c)) { e.y = r * CONFIG.TILE - e.h; e.vy = 0; break; }
        }
      }

      // 掉出地图
      if (e.y > CONFIG.ROWS * CONFIG.TILE + 40) { e.alive = false; continue; }

      // 与玩家碰撞
      if (this.rectHit(p, e)) {
        const fallingOn = p.vy > 0 && (p.y + p.h - e.y) < CONFIG.TILE * 0.6;
        if (fallingOn) {
          // 踩死
          e.dead = true;
          e.deadTimer = 30;
          p.vy = CONFIG.JUMP_VEL * 0.6;
          this.score += 100;
          AudioSys.stomp();
          this.spawnBreak(Math.floor(e.y / CONFIG.TILE), Math.floor(e.x / CONFIG.TILE), "#8a5a2a");
        } else {
          this.hitPlayer();
        }
      }
    }
  },

  hitPlayer() {
    const p = this.player;
    if (p.invincible > 0) return;
    if (p.big) {
      // 大马里奥变小
      p.big = false;
      p.invincible = 60;
      p.h = Math.round(CONFIG.TILE * CONFIG.PLAYER_H);
      AudioSys.powerup();
    } else {
      this.kill();
    }
  },

  kill() {
    this.player.vy = -6;
    this.player.vx = 0;
    this.state = "dead";
    this.deadTimer = 80;
    AudioSys.die();
  },

  updateCoins() {
    for (const c of this.coins) {
      c.t++;
      if (!c.collected && this.rectHit(this.player, { x: c.x, y: c.y, w: c.size, h: c.size })) {
        c.collected = true;
        this.score += 100;
        this.coinCount++;
        AudioSys.coin();
        this.spawnBreak(c.y, c.x, "#ffd23e");
      }
    }
    this.coins = this.coins.filter((c) => !c.collected);
  },

  updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  },

  spawnBump(r, c) {
    // 问号块弹跳粒子
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: c * CONFIG.TILE + Math.random() * CONFIG.TILE,
        y: r * CONFIG.TILE,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 4,
        size: 3,
        color: "#ffd23e",
        life: 20,
      });
    }
  },

  spawnBreak(r, c, color = "#c26a3a") {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: c * CONFIG.TILE + Math.random() * CONFIG.TILE,
        y: r * CONFIG.TILE,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 6,
        size: 4,
        color,
        life: 25 + Math.random() * 15,
      });
    }
  },

  checkWin() {
    const p = this.player;
    // 到达旗杆附近
    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        if (this.map[r][c] === T.FLAG) {
          const fx = c * CONFIG.TILE;
          if (p.x + p.w > fx) {
            this.state = "win";
            this.score += 1000;
            AudioSys.win();
            return;
          }
        }
      }
    }
  },

  rectHit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  },

  // ---------- 渲染 ----------
  render() {
    const ctx = Renderer.ctx;
    Renderer.updateCamera(this.player.x, this.worldWidth);

    Renderer.drawMap(this.map);

    for (const c of this.coins) Renderer.drawCoin(c);

    if (this.state !== "dead" || this.deadTimer > 40) {
      Renderer.drawPlayer(this.player);
    }
    for (const e of this.enemies) if (e.alive) Renderer.drawEnemy(e);

    Renderer.drawParticles(this.particles);

    if (this.state === "title") {
      Renderer.drawOverlay("SUPER MARIO", "按 ↑ / 空格 开始", "#ffd23e");
    } else if (this.state === "paused") {
      Renderer.drawOverlay("暂停", "按 P 继续");
    } else if (this.state === "win") {
      Renderer.drawOverlay("通关！", "按 ↑ / 空格 重新开始", "#7ce07c");
    } else if (this.state === "gameover") {
      Renderer.drawOverlay("GAME OVER", "按 ↑ / 空格 重新开始", "#ff6b6b");
    }
  },
};

// 启动
window.addEventListener("DOMContentLoaded", () => Game.start());

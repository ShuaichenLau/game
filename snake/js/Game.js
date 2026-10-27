/**
 * Game.js — 游戏主控制器（状态机）
 *
 * 状态：
 *   idle    → 等待玩家按下方向键开始
 *   running → 正在游戏
 *   paused  → 暂停中
 *   over    → 游戏结束，等待重启
 *
 * 职责：
 *  - 驱动游戏循环（基于 setTimeout 而非 requestAnimationFrame，
 *    保证移动速度固定，RAF 仅用于渲染）
 *  - 协调 Snake、Food、Collision、Renderer、InputController
 *  - 管理分数与最高分（含 localStorage 持久化）
 *  - 通过 _updateHUD() 刷新页面上的分数 DOM
 */

import { CONFIG }          from './config.js';
import { Snake }           from './Snake.js';
import { Food }            from './Food.js';
import { isDead }          from './Collision.js';
import { Renderer }        from './Renderer.js';
import { InputController } from './InputController.js';

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ scoreEl: HTMLElement, hiscoreEl: HTMLElement }} hudEls
   */
  constructor(canvas, { scoreEl, hiscoreEl }) {
    // ── 子系统 ────────────────────────────────────────────────
    this.snake    = new Snake();
    this.food     = new Food();
    this.renderer = new Renderer(canvas);
    this.input    = new InputController({
      onDirection: dir  => this._onDirection(dir),
      onAction:    ()   => this._onAction(),
    });

    // ── HUD DOM ───────────────────────────────────────────────
    this._scoreEl   = scoreEl;
    this._hiscoreEl = hiscoreEl;

    // ── 状态 ──────────────────────────────────────────────────
    /** @type {'idle'|'running'|'paused'|'over'} */
    this.state    = 'idle';
    this.score    = 0;
    this.hiscore  = this._loadHiscore();
    this.speed    = CONFIG.INITIAL_SPEED; // 当前帧间隔 ms

    // ── 循环句柄 ──────────────────────────────────────────────
    this._tickTimer  = null; // setTimeout 句柄
    this._rafHandle  = null; // requestAnimationFrame 句柄

    // ── 初始化 ────────────────────────────────────────────────
    this._initGame();
    this._startRenderLoop();
  }

  // ═══════════════════════════════════════════════════════════
  //   公开 API
  // ═══════════════════════════════════════════════════════════

  /** 销毁游戏（移除监听、停止循环） */
  destroy() {
    this._stopTick();
    this._stopRenderLoop();
    this.input.destroy();
  }

  // ═══════════════════════════════════════════════════════════
  //   输入回调
  // ═══════════════════════════════════════════════════════════

  /**
   * 玩家按下方向键。
   * - idle 状态：首次按键启动游戏
   * - running 状态：传递给蛇
   */
  _onDirection(dir) {
    if (this.state === 'idle') {
      this.snake.setDirection(dir);
      this._startGame();
      return;
    }
    if (this.state === 'running') {
      this.snake.setDirection(dir);
    }
  }

  /**
   * 玩家按下空格 / Enter。
   * - idle / over → 开始 / 重新开始
   * - running     → 暂停
   * - paused      → 继续
   */
  _onAction() {
    if (this.state === 'idle' || this.state === 'over') {
      this._initGame();
      this._startGame();
    } else if (this.state === 'running') {
      this._pause();
    } else if (this.state === 'paused') {
      this._resume();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //   状态切换
  // ═══════════════════════════════════════════════════════════

  /** 重置所有数据，回到 idle */
  _initGame() {
    this._stopTick();
    this.snake.reset();
    this.score = 0;
    this.speed = CONFIG.INITIAL_SPEED;
    this.food.randomize(this.snake.getSegments());
    this.state = 'idle';
    this._updateHUD();
  }

  /** 真正启动游戏循环 */
  _startGame() {
    this.state = 'running';
    this._scheduleTick();
  }

  _pause() {
    this.state = 'paused';
    this._stopTick();
  }

  _resume() {
    this.state = 'running';
    this._scheduleTick();
  }

  _gameOver() {
    this._stopTick();
    this.state = 'over';
    this._saveHiscore();
    this._updateHUD();
  }

  // ═══════════════════════════════════════════════════════════
  //   游戏 Tick（逻辑更新）
  // ═══════════════════════════════════════════════════════════

  /** 安排下一次 tick */
  _scheduleTick() {
    this._tickTimer = setTimeout(() => this._tick(), this.speed);
  }

  _stopTick() {
    if (this._tickTimer !== null) {
      clearTimeout(this._tickTimer);
      this._tickTimer = null;
    }
  }

  /**
   * 游戏逻辑主循环（每 speed ms 执行一次）
   */
  _tick() {
    if (this.state !== 'running') return;

    // 1. 移动蛇
    this.snake.move();

    // 2. 死亡检测
    if (isDead(this.snake.getSegments(), CONFIG.GRID_COUNT)) {
      this._gameOver();
      return;
    }

    // 3. 吃食物
    if (this.food.isAt(this.snake.head)) {
      this.snake.grow();
      this.score += CONFIG.SCORE_PER_FOOD;
      this._updateHUD();
      this._updateSpeed();
      this.food.randomize(this.snake.getSegments());
    }

    // 4. 安排下一次 tick
    this._scheduleTick();
  }

  /**
   * 根据当前分数动态加速。
   */
  _updateSpeed() {
    const level = Math.floor(this.score / (CONFIG.SCORE_PER_FOOD * CONFIG.SPEED_EVERY));
    const newSpeed = Math.max(
      CONFIG.MIN_SPEED,
      CONFIG.INITIAL_SPEED - level * CONFIG.SPEED_STEP,
    );
    this.speed = newSpeed;
  }

  // ═══════════════════════════════════════════════════════════
  //   渲染循环（requestAnimationFrame）
  // ═══════════════════════════════════════════════════════════

  _startRenderLoop() {
    const loop = () => {
      this._render();
      this._rafHandle = requestAnimationFrame(loop);
    };
    this._rafHandle = requestAnimationFrame(loop);
  }

  _stopRenderLoop() {
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  }

  _render() {
    this.renderer.render({
      snake:   this.snake,
      food:    this.food,
      score:   this.score,
      hiscore: this.hiscore,
      state:   this.state,
    });
  }

  // ═══════════════════════════════════════════════════════════
  //   HUD 与持久化
  // ═══════════════════════════════════════════════════════════

  _updateHUD() {
    if (this._scoreEl)   this._scoreEl.textContent   = this.score;
    if (this._hiscoreEl) this._hiscoreEl.textContent = this.hiscore;
  }

  _loadHiscore() {
    try {
      return parseInt(localStorage.getItem(CONFIG.HISCORE_KEY) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  _saveHiscore() {
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      try {
        localStorage.setItem(CONFIG.HISCORE_KEY, String(this.hiscore));
      } catch {
        // localStorage 不可用时静默忽略
      }
      this._updateHUD();
    }
  }
}

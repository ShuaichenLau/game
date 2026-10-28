/**
 * main.js — 应用入口
 *
 * 职责：
 *   1. 获取页面 DOM 元素引用
 *   2. 实例化 Game / Renderer / InputController 并完成装配
 *   3. 订阅 Game 状态变化，驱动页面文字更新与 Canvas 重绘
 *   4. 绑定“开始游戏 / 重新开始 / 悔棋”按钮事件（只绑定一次）
 *   5. 监听窗口尺寸变化，让棋盘自适应屏幕
 */
(function (NS) {
  'use strict';

  const CONFIG = NS.CONFIG;
  const getLogicalBoardSize = NS.getLogicalBoardSize;
  const Game = NS.Game;
  const Renderer = NS.Renderer;
  const InputController = NS.InputController;

  const BLACK = CONFIG.BLACK;
  const WHITE = CONFIG.WHITE;

  // ── DOM 元素 ───────────────────────────────────────────────
  const canvas = document.getElementById('board-canvas');
  const playerBadge = document.getElementById('player-badge');
  const aiBadge = document.getElementById('ai-badge');
  const turnText = document.getElementById('turn-text');
  const statusText = document.getElementById('status-text');
  const blackCount = document.getElementById('black-count');
  const whiteCount = document.getElementById('white-count');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const undoBtn = document.getElementById('undo-btn');
  const colorInputs = document.querySelectorAll('input[name="color-choice"]');

  // ── 实例化 ────────────────────────────────────────────────
  const game = new Game();
  const renderer = new Renderer(canvas);
  let hoverCell = null;

  const inputController = new InputController(canvas, game, renderer, (cell) => {
    hoverCell = cell;
    redraw();
  });

  // ── 重绘与尺寸 ────────────────────────────────────────────
  function redraw() {
    renderer.render(game, hoverCell);
  }

  /**
   * 基于视口计算棋盘合适的 CSS 显示尺寸。
   * 不依赖父容器宽度（父容器可能因无显式宽度而塌缩成 Canvas 默认 300px），
   * 直接按视口宽高计算，并限制不超过棋盘逻辑设计尺寸。
   */
  function computeDisplaySize() {
    const logicalSize = getLogicalBoardSize();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const isNarrowViewport = viewportWidth < 1024;
    // 桌面端：棋盘绝对居中，左侧信息栏（约 240）绝对定位在左，不参与居中；
    // 预留“信息栏宽度 + 边距 + 间距”的两倍，保证居中后的棋盘不与左侧栏重叠。
    const widthBudget = isNarrowViewport
      ? viewportWidth * 0.94
      : viewportWidth - 560;
    // 高度预算：标题（约 60）+ 上下内边距与间距
    const heightBudget = viewportHeight - 140;

    const available = Math.max(240, Math.min(widthBudget, heightBudget));
    return Math.min(available, logicalSize);
  }

  function handleResize() {
    const size = computeDisplaySize();
    renderer.resize(size);
    // 将棋盘实际显示尺寸写入 CSS 变量，供左侧信息栏“紧贴棋盘”定位
    document.documentElement.style.setProperty('--board-size', size + 'px');
    redraw();
  }

  // ── UI 更新 ───────────────────────────────────────────────
  function updateUI() {
    // 玩家 / 电脑颜色徽标
    const playerIsBlack = game.playerColor === BLACK;
    playerBadge.textContent = '玩家 · ' + (playerIsBlack ? '黑棋' : '白棋');
    playerBadge.className = 'badge ' + (playerIsBlack ? 'badge-black' : 'badge-white');
    aiBadge.textContent = '电脑 · ' + (playerIsBlack ? '白棋' : '黑棋');
    aiBadge.className = 'badge ' + (playerIsBlack ? 'badge-white' : 'badge-black');

    // 当前回合
    if (game.status === 'idle') {
      turnText.textContent = '—';
    } else if (game.status === 'playing') {
      turnText.textContent = game.turn === 'player' ? '玩家' : '电脑思考中…';
    } else {
      turnText.textContent = '—';
    }

    // 对局结果
    if (game.status === 'idle') {
      statusText.textContent = '等待开始';
      statusText.className = 'status-text';
    } else if (game.status === 'playing') {
      statusText.textContent = '对局进行中';
      statusText.className = 'status-text status-playing';
    } else if (game.status === 'won') {
      const playerWon = game.winner === game.playerColor;
      statusText.textContent = playerWon ? '玩家获胜！' : '电脑获胜！';
      statusText.className = 'status-text ' + (playerWon ? 'status-won' : 'status-lost');
    } else {
      statusText.textContent = '平局';
      statusText.className = 'status-text status-draw';
    }

    // 落子数
    blackCount.textContent = String(game.countStones(BLACK));
    whiteCount.textContent = String(game.countStones(WHITE));

    // 按钮状态
    const playing = game.status === 'playing';
    startBtn.disabled = playing;                    // 进行中不可重复开始
    restartBtn.disabled = game.status === 'idle';   // 空闲时无需重新开始
    undoBtn.disabled = !game.canUndo();

    // 颜色选择仅在 idle 阶段可用
    colorInputs.forEach((input) => {
      input.disabled = game.status !== 'idle';
    });
  }

  /** Game 状态每次变化时的统一响应 */
  function onGameChange() {
    updateUI();
    // 非玩家回合（电脑回合 / 结束 / 空闲）清除悬停预览
    if (!game.isPlayerTurn()) hoverCell = null;
    redraw();
  }

  game.subscribe(onGameChange);

  // ── 按钮事件（只在应用启动时绑定一次）──────────────────────
  startBtn.addEventListener('click', () => {
    const selected = document.querySelector('input[name="color-choice"]:checked');
    const color = selected && selected.value === 'white' ? WHITE : BLACK;
    game.start(color);
  });

  restartBtn.addEventListener('click', () => {
    game.restart();
  });

  undoBtn.addEventListener('click', () => {
    game.undo();
  });

  // ── 窗口尺寸变化 ──────────────────────────────────────────
  window.addEventListener('resize', handleResize);

  // ── 初始化 ────────────────────────────────────────────────
  handleResize();
  updateUI();
  redraw();
})(window.Gomoku = window.Gomoku || {});

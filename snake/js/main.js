/**
 * main.js — 应用入口
 *
 * 等待 DOM 就绪后，获取页面元素并启动游戏。
 * 如果游戏已存在，先销毁旧实例再创建新实例（热重载场景）。
 */

import { Game } from './Game.js';

let gameInstance = null;

function init() {
  const canvas    = document.getElementById('gameCanvas');
  const scoreEl   = document.getElementById('score');
  const hiscoreEl = document.getElementById('hiscore');

  if (!canvas) {
    console.error('[Snake] 找不到 #gameCanvas 元素');
    return;
  }

  // 销毁旧实例（如果有）
  if (gameInstance) {
    gameInstance.destroy();
  }

  gameInstance = new Game(canvas, { scoreEl, hiscoreEl });
}

// DOM 已就绪则立即初始化，否则等待 DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

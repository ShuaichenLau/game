/**
 * tests.js — 规则与 AI 基础测试（Node 环境）
 *
 * 运行方式：在项目目录下执行  node tests.js
 *
 * 说明：本项目 JS 使用经典 <script> 挂载到 window.Gomoku 命名空间，
 * 因此这里在 Node 中伪造 window 对象，再逐个加载源文件进行测试，
 * 测试对象与浏览器实际加载的是同一份源码。
 */
'use strict';

const fs = require('fs');
const path = require('path');

// 伪造 window 以便加载非模块脚本
global.window = global;

const JS_DIR = path.join(__dirname, 'js');
// 只加载不含 DOM 依赖的模块（Renderer/InputController/main 依赖浏览器环境）
const FILES = ['config.js', 'Board.js', 'RuleChecker.js', 'AiPlayer.js', 'Game.js'];

for (const file of FILES) {
  const code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
  (0, eval)(code);
}

const { CONFIG, Board, RuleChecker, AiPlayer, Game } = global.Gomoku;
const { checkWin, checkDraw } = RuleChecker;
const BLACK = CONFIG.BLACK;
const WHITE = CONFIG.WHITE;

// ── 测试框架 ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function assert(label, cond) {
  if (cond) { console.log('  ✅ ' + label); passed++; }
  else { console.log('  ❌ ' + label); failed++; }
}
function section(title) { console.log('\n[' + title + ']'); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 在棋盘指定行列连续摆子（用于快速构造局面） */
function placeLine(board, startRow, startCol, dr, dc, count, player) {
  let r = startRow, c = startCol;
  for (let i = 0; i < count; i++) {
    board.placeStone(r, c, player);
    r += dr; c += dc;
  }
}

// ══════════════════════════════════════════════════════════════════
//   第一部分：规则测试（同步）
// ══════════════════════════════════════════════════════════════════
async function testRules() {
  section('规则：横向 / 纵向 / 两种斜线 / 边角 / 五连以上 / 隔断 / 最后一格');

  let b = new Board();
  placeLine(b, 7, 3, 0, 1, 5, BLACK);
  assert('横向五连获胜', checkWin(b, 7, 7, BLACK).isWin);

  b = new Board();
  placeLine(b, 3, 7, 1, 0, 5, BLACK);
  assert('纵向五连获胜', checkWin(b, 7, 7, BLACK).isWin);

  b = new Board();
  placeLine(b, 3, 3, 1, 1, 5, BLACK);
  assert('主对角线(↘)五连获胜', checkWin(b, 7, 7, BLACK).isWin);

  b = new Board();
  placeLine(b, 3, 7, 1, -1, 5, BLACK);
  assert('副对角线(↙)五连获胜', checkWin(b, 7, 3, BLACK).isWin);

  b = new Board();
  placeLine(b, 0, 0, 0, 1, 5, BLACK);
  assert('顶边横向五连获胜', checkWin(b, 0, 4, BLACK).isWin);

  b = new Board();
  placeLine(b, 10, 14, 1, 0, 5, WHITE);
  assert('右下角纵向五连获胜', checkWin(b, 14, 14, WHITE).isWin);

  b = new Board();
  placeLine(b, 5, 0, 0, 1, 6, BLACK);
  const r6 = checkWin(b, 5, 5, BLACK);
  assert('六连获胜（无长连禁手）', r6.isWin);
  assert('六连连线坐标数 >= 5', r6.winCells.length >= 5);

  b = new Board();
  placeLine(b, 7, 3, 0, 1, 3, BLACK); // 黑 3,4,5
  b.placeStone(7, 6, WHITE);          // 白棋隔断
  b.placeStone(7, 7, BLACK);
  b.placeStone(7, 8, BLACK);
  assert('连线被隔断不误判（7,8 处仅两连）', !checkWin(b, 7, 8, BLACK).isWin);

  b = new Board();
  assert('四连不获胜', !checkWin(b, 7, 7, BLACK).isWin);

  // 最后一格落子获胜 → 先判胜不判平
  b = new Board();
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) b.grid[r][c] = ((r + c) % 2 === 0) ? BLACK : WHITE;
  [0, 1, 2, 3, 4].forEach((c) => b.removeStone(0, c));
  [1, 2, 3, 4].forEach((c) => b.placeStone(0, c, BLACK));
  b.placeStone(0, 0, BLACK); // 这是最后一个空位，且形成五连
  assert('最后一格落子获胜时 checkWin 为 true', checkWin(b, 0, 0, BLACK).isWin);

  // 平局判定
  b = new Board();
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) b.grid[r][c] = ((r + c) % 2 === 0) ? BLACK : WHITE;
  assert('棋盘下满为平局', checkDraw(b));
  b.grid[0][0] = CONFIG.EMPTY;
  assert('有空位非平局', !checkDraw(b));
}

// ══════════════════════════════════════════════════════════════════
//   第二部分：AI 测试（同步）
// ══════════════════════════════════════════════════════════════════
function testAi() {
  const ai = new AiPlayer();

  section('AI：空棋盘落中心');
  let b = new Board();
  let mv = ai.getMove(b, BLACK);
  assert('空棋盘返回中心(7,7)', mv && mv.row === 7 && mv.col === 7);

  section('AI：一步获胜');
  b = new Board();
  placeLine(b, 7, 3, 0, 1, 4, BLACK); // 黑 4 连，AI 执黑
  mv = ai.getMove(b, BLACK);
  assert('返回获胜点', mv && checkWin(b, mv.row, mv.col, BLACK).isWin);

  section('AI：封堵玩家一步获胜');
  b = new Board();
  placeLine(b, 8, 3, 0, 1, 4, WHITE); // 玩家(白) 4 连，AI 执黑需封堵
  mv = ai.getMove(b, BLACK);
  assert('返回封堵点（该处白棋可获胜）', mv && checkWin(b, mv.row, mv.col, WHITE).isWin);

  section('AI：获胜优先于防守');
  b = new Board();
  placeLine(b, 7, 3, 0, 1, 4, BLACK);  // AI 黑棋 4 连（可胜）
  placeLine(b, 10, 3, 0, 1, 4, WHITE); // 玩家白棋 4 连（威胁）
  mv = ai.getMove(b, BLACK);
  assert('优先选择自己的获胜点', mv && checkWin(b, mv.row, mv.col, BLACK).isWin);

  section('AI：返回合法空位且不污染棋盘');
  b = new Board();
  b.placeStone(7, 7, BLACK);
  b.placeStone(7, 8, WHITE);
  b.placeStone(8, 8, BLACK);
  const snapshot = JSON.stringify(b.grid);
  mv = ai.getMove(b, BLACK);
  assert('返回坐标合法且在棋盘内', mv && b.isInBounds(mv.row, mv.col));
  assert('返回的是空位', mv && b.isEmpty(mv.row, mv.col));
  assert('计算前后真实棋盘保持不变', JSON.stringify(b.grid) === snapshot);

  section('AI：无合法位置返回 null（棋盘已满）');
  b = new Board();
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) b.grid[r][c] = BLACK;
  mv = ai.getMove(b, BLACK);
  assert('满棋盘返回 null', mv === null);
}

// ══════════════════════════════════════════════════════════════════
//   第三部分：Game 回合 / 悔棋 / 重开（异步，AI 延迟设为最小）
// ══════════════════════════════════════════════════════════════════
async function testGame() {
  CONFIG.AI.DELAY_MS = 10; // 加速测试

  section('Game：玩家执黑开局');
  let g = new Game();
  g.start(BLACK);
  assert('开始后为进行中', g.status === 'playing');
  assert('玩家执黑时玩家先手', g.isPlayerTurn());

  section('Game：玩家执白，电脑自动先手');
  g = new Game();
  g.start(WHITE);
  assert('玩家执白时电脑先手', g.isAiTurn());
  await sleep(30);
  assert('电脑已自动落一子（开局首手）', g.history.length === 1);
  assert('电脑首手为黑棋', g.history[0].player === BLACK);
  assert('首手落在中心', g.history[0].row === 7 && g.history[0].col === 7);
  assert('电脑落子后轮到玩家', g.isPlayerTurn());

  section('Game：电脑回合禁止玩家落子');
  g = new Game();
  g.start(WHITE); // 电脑先手，思考中
  assert('电脑回合玩家落子返回 false', g.playerMove(7, 7) === false);
  await sleep(30);

  section('Game：已有棋子处 / 越界落子无效');
  g = new Game();
  g.start(BLACK);
  g.playerMove(7, 7);
  assert('同一位置重复落子返回 false', g.playerMove(7, 7) === false);
  assert('越界落子返回 false', g.playerMove(-1, -1) === false);

  section('Game：思考期间悔棋，旧结果不再落子');
  g = new Game();
  g.start(BLACK);
  g.playerMove(7, 7);      // 玩家落子，AI 开始思考
  assert('玩家落子后为电脑回合', g.isAiTurn());
  g.undo();                // 思考中悔棋
  assert('思考中悔棋后回到玩家回合', g.isPlayerTurn());
  assert('思考中悔棋后历史清空', g.history.length === 0);
  await sleep(40);         // 等待旧 AI 结果（应已被版本号拦截）
  assert('旧 AI 结果未被写入（历史仍为空）', g.history.length === 0);

  section('Game：电脑回应后悔棋，撤销双方各一手');
  g = new Game();
  g.start(BLACK);
  g.playerMove(7, 7);
  await sleep(30);         // 等 AI 回应
  assert('电脑已回应（历史 2 手）', g.history.length === 2);
  g.undo();
  assert('悔棋后历史清空', g.history.length === 0);
  assert('悔棋后轮到玩家', g.isPlayerTurn());

  section('Game：玩家执白悔棋不误删电脑开局首手');
  g = new Game();
  g.start(WHITE);
  await sleep(30);         // 电脑开局
  g.playerMove(7, 8);      // 玩家落子
  await sleep(30);         // 电脑回应
  assert('悔棋前历史 3 手', g.history.length === 3);
  g.undo();
  assert('悔棋后保留电脑开局首手（历史 1 手）', g.history.length === 1);
  assert('保留的首手是黑棋(电脑)', g.history[0].player === BLACK);
  assert('悔棋后轮到玩家', g.isPlayerTurn());
  assert('只剩开局首手时不能再悔棋', g.canUndo() === false);

  section('Game：结束后的悔棋与重新开始');
  g = new Game();
  g.start(BLACK);
  // 直接构造玩家获胜局面（通过内部棋盘放置，跳过 AI）
  g.restart(); // 回到 idle
  g.start(BLACK);
  g.board.placeStone(7, 3, BLACK); g.history.push({ row: 7, col: 3, player: BLACK });
  g.board.placeStone(7, 4, BLACK); g.history.push({ row: 7, col: 4, player: BLACK });
  g.board.placeStone(7, 5, BLACK); g.history.push({ row: 7, col: 5, player: BLACK });
  g.board.placeStone(7, 6, BLACK); g.history.push({ row: 7, col: 6, player: BLACK });
  // 模拟玩家第 5 手获胜
  const ok = g.playerMove(7, 7);
  assert('玩家五连获胜', ok && g.status === 'won' && g.winner === BLACK);
  assert('结束后玩家落子无效', g.playerMove(0, 0) === false);
  g.undo();
  assert('结束后悔棋恢复进行中', g.status === 'playing' && g.isPlayerTurn());
  g.restart();
  assert('重开后回到 idle', g.status === 'idle');
  assert('重开后历史清空', g.history.length === 0);
  assert('重开后棋盘清空', g.board.getStone(7, 7) === CONFIG.EMPTY);
}

// ── 主流程 ─────────────────────────────────────────────────────────
(async function main() {
  console.log('===== 五子棋人机对战 · 规则与 AI 测试 =====');
  await testRules();
  testAi();
  await testGame();
  console.log('\n' + '='.repeat(40));
  console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
  if (failed > 0) process.exitCode = 1;
})();

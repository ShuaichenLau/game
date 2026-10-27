/**
 * 启动入口：把 DOM 与 GameController 装配起来
 */
(function () {
  'use strict';

  const { BoardView, GameController, ResultDialog } = window.XQ;

  const view = new BoardView(document.getElementById('board'));

  let game = null;
  const dialog = new ResultDialog({ onNewGame: () => game.newGame() });

  game = new GameController({
    view,
    statusEl: document.getElementById('status'),
    logEl: document.getElementById('log'),
    difficultyEl: document.getElementById('difficulty'),
    sideEl: document.getElementById('side'),
    dialog,
    thinkTimeEl: document.getElementById('thinkTime'),
    moveCountEl: document.getElementById('moveCount'),
  });

  document.getElementById('board').addEventListener('click', (event) => game.handleBoardClick(event));
  document.getElementById('btnNew').addEventListener('click', () => game.newGame());
  document.getElementById('btnUndo').addEventListener('click', () => game.undo());
  document.getElementById('btnResign').addEventListener('click', () => game.resign());

  // 便于在控制台调试：xiangqi.board / xiangqi.undo() ...
  window.xiangqi = game;
})();

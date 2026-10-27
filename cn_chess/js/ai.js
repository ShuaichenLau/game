/**
 * AI：局面评估 + negamax(alpha-beta) 搜索
 * 依赖 rules.js（纯逻辑，无 DOM）
 */
(function (global) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Constants = isNode ? require('./constants.js') : global.XQ.Constants;
  const Rules = isNode ? require('./rules.js') : global.XQ.Rules;
  const { RED, PIECE, PIECE_VALUES, MATE } = Constants;
  const { opponent, getLegalMoves, makeMove } = Rules;

  // ---------------------------------------------------------------------------
  // 评估
  // ---------------------------------------------------------------------------

  /** 兵/卒越靠近对方底线越有价值 */
  function pawnBonus(r, color) {
    if (color === RED) {
      if (r <= 2) return 50;
      if (r <= 4) return 20;
      return 0;
    }
    if (r >= 7) return 50;
    if (r >= 5) return 20;
    return 0;
  }

  /** 马在中路更灵活 */
  function horseBonus(r, c) {
    const centerDistance = Math.abs(c - 4) + Math.abs(r - 4.5);
    return Math.max(0, 15 - centerDistance * 2);
  }

  function positionBonus(piece, r, c) {
    if (piece.type === PIECE.PAWN) return pawnBonus(r, piece.color);
    if (piece.type === PIECE.HORSE) return horseBonus(r, c);
    return 0;
  }

  /** 从 color 视角评估局面分值（正数表示 color 占优） */
  function evaluateFor(board, color) {
    let score = 0;
    board.forEach((row, r) => {
      row.forEach((piece, c) => {
        if (!piece) return;
        const value = PIECE_VALUES[piece.type] + positionBonus(piece, r, c);
        score += piece.color === color ? value : -value;
      });
    });
    return score;
  }

  // ---------------------------------------------------------------------------
  // 搜索
  // ---------------------------------------------------------------------------

  /** 走法排序：吃子优先，便于 alpha-beta 剪枝 */
  function orderMoves(moves, board) {
    for (const move of moves) {
      const victim = board[move.tr][move.tc];
      move.score = victim ? PIECE_VALUES[victim.type] + 100 : 0;
    }
    moves.sort((a, b) => b.score - a.score);
    return moves;
  }

  /**
   * negamax + alpha-beta
   * 约定：返回值始终站在"当前行棋方 color"的视角
   */
  function negamax(board, depth, alpha, beta, color) {
    const moves = getLegalMoves(board, color);
    if (moves.length === 0) return -(MATE - depth); // 无子可走即被将死，越晚输越好
    if (depth === 0) return evaluateFor(board, color);

    orderMoves(moves, board);
    let best = -Infinity;
    for (const move of moves) {
      const next = makeMove(board, move);
      const score = -negamax(next, depth - 1, -beta, -alpha, opponent(color));
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break; // 剪枝
    }
    return best;
  }

  /**
   * 选出最佳走法；同分走法随机挑选，避免每局开局雷同
   * @returns {{fr:number,fc:number,tr:number,tc:number}|null}
   */
  function getBestMove(board, color, depth) {
    const moves = orderMoves(getLegalMoves(board, color), board);
    if (moves.length === 0) return null;

    let alpha = -Infinity;
    let best = [];
    for (const move of moves) {
      const next = makeMove(board, move);
      const score = -negamax(next, depth - 1, -Infinity, -alpha, opponent(color));
      if (score > alpha) {
        alpha = score;
        best = [move];
      } else if (score === alpha) {
        best.push(move);
      }
    }
    return best[Math.floor(Math.random() * best.length)];
  }

  const AI = { evaluateFor, orderMoves, negamax, getBestMove };

  global.XQ = global.XQ || {};
  global.XQ.AI = AI;
  if (isNode) module.exports = AI;
})(typeof globalThis !== 'undefined' ? globalThis : window);

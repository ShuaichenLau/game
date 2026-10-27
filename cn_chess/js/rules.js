/**
 * 中国象棋规则（纯函数，无 DOM 依赖）
 *
 * 走法表示为 { fr, fc, tr, tc }：from row/col → to row/col
 * 棋子表示为 { type, color }，空格为 null
 *
 * 对外 API 见文件底部的 Rules 对象。
 */
(function (global) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Constants = isNode ? require('./constants.js') : global.XQ.Constants;
  const { RED, BLACK, ROWS, COLS, PIECE, PIECE_VALUES, MATE } = Constants;

  // ---------------------------------------------------------------------------
  // 基础几何与坐标判断
  // ---------------------------------------------------------------------------

  const ORTHOGONAL = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const DIAGONAL = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const HORSE_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const ELEPHANT_STEPS = [[2, 2], [2, -2], [-2, 2], [-2, -2]];

  function opponent(color) {
    return color === RED ? BLACK : RED;
  }

  function inBoard(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
  }

  /** 九宫格范围 */
  function inPalace(r, c, color) {
    if (c < 3 || c > 5) return false;
    return color === RED ? r >= 7 && r <= 9 : r >= 0 && r <= 2;
  }

  /** 兵/卒是否已过河 */
  function crossedRiver(r, color) {
    return color === RED ? r <= 4 : r >= 5;
  }

  /** 是否在己方半场（相/象 不能过河） */
  function ownSide(r, color) {
    return color === RED ? r >= 5 : r <= 4;
  }

  /** 兵/卒前进方向（红方向上，黑方向下） */
  function forwardStep(color) {
    return color === RED ? -1 : 1;
  }

  /** 取棋子，越界或空返回 null */
  function pieceAt(board, r, c) {
    return inBoard(r, c) ? board[r][c] : null;
  }

  /** 该格是否为指定颜色指定类型的棋子 */
  function isPiece(board, r, c, type, color) {
    const p = pieceAt(board, r, c);
    return !!p && p.type === type && p.color === color;
  }

  /** 两点之间（同行或同列）是否无子遮挡 */
  function isPathClear(board, from, to) {
    const dr = Math.sign(to.r - from.r);
    const dc = Math.sign(to.c - from.c);
    let r = from.r + dr;
    let c = from.c + dc;
    while (r !== to.r || c !== to.c) {
      if (board[r][c]) return false;
      r += dr;
      c += dc;
    }
    return true;
  }

  function createMove(fr, fc, tr, tc) {
    return { fr, fc, tr, tc };
  }

  // ---------------------------------------------------------------------------
  // 棋盘创建 / 修改
  // ---------------------------------------------------------------------------

  function initBoard() {
    const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const backRank = [PIECE.CHARIOT, PIECE.HORSE, PIECE.ELEPHANT, PIECE.ADVISOR, PIECE.GENERAL,
      PIECE.ADVISOR, PIECE.ELEPHANT, PIECE.HORSE, PIECE.CHARIOT];

    for (let c = 0; c < COLS; c++) {
      board[0][c] = { type: backRank[c], color: BLACK };
      board[9][c] = { type: backRank[c], color: RED };
    }
    for (const c of [1, 7]) {
      board[2][c] = { type: PIECE.CANNON, color: BLACK };
      board[7][c] = { type: PIECE.CANNON, color: RED };
    }
    for (let c = 0; c < COLS; c += 2) {
      board[3][c] = { type: PIECE.PAWN, color: BLACK };
      board[6][c] = { type: PIECE.PAWN, color: RED };
    }
    return board;
  }

  function cloneBoard(board) {
    return board.map((row) => row.slice());
  }

  /** 返回执行 move 后的新棋盘（不修改原棋盘） */
  function makeMove(board, move) {
    const next = cloneBoard(board);
    next[move.tr][move.tc] = next[move.fr][move.fc];
    next[move.fr][move.fc] = null;
    return next;
  }

  function findKing(board, color) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isPiece(board, r, c, PIECE.GENERAL, color)) return { r, c };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // 走法生成（伪合法：未排除走后被将军的走法）
  // ---------------------------------------------------------------------------

  /** 把落点加入走法列表：不能吃己方子，越界忽略 */
  function addTarget(from, color, board, nr, nc, moves) {
    if (!inBoard(nr, nc)) return;
    const target = board[nr][nc];
    if (target && target.color === color) return;
    moves.push(createMove(from.r, from.c, nr, nc));
  }

  /** 马的“蹩马腿”位置 */
  function horseLeg(r, c, dr, dc) {
    return Math.abs(dr) === 2 ? { r: r + dr / 2, c } : { r, c: c + dc / 2 };
  }

  /** 象的“塞象眼”位置 */
  function elephantEye(r, c, dr, dc) {
    return { r: r + dr / 2, c: c + dc / 2 };
  }

  /** 各棋子的走法生成器：(board, r, c, piece, moves) => void */
  const MOVE_GENERATORS = {
    general(board, r, c, piece, moves) {
      const from = { r, c };
      for (const [dr, dc] of ORTHOGONAL) {
        const nr = r + dr;
        const nc = c + dc;
        if (inPalace(nr, nc, piece.color)) addTarget(from, piece.color, board, nr, nc, moves);
      }
      // 飞将：同列且中间无子，可直接吃对方将
      const enemyKing = findKing(board, opponent(piece.color));
      if (enemyKing && enemyKing.c === c && isPathClear(board, from, enemyKing)) {
        moves.push(createMove(r, c, enemyKing.r, enemyKing.c));
      }
    },

    advisor(board, r, c, piece, moves) {
      const from = { r, c };
      for (const [dr, dc] of DIAGONAL) {
        const nr = r + dr;
        const nc = c + dc;
        if (inPalace(nr, nc, piece.color)) addTarget(from, piece.color, board, nr, nc, moves);
      }
    },

    elephant(board, r, c, piece, moves) {
      const from = { r, c };
      for (const [dr, dc] of ELEPHANT_STEPS) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBoard(nr, nc) || !ownSide(nr, piece.color)) continue;
        const eye = elephantEye(r, c, dr, dc);
        if (board[eye.r][eye.c]) continue; // 塞象眼
        addTarget(from, piece.color, board, nr, nc, moves);
      }
    },

    horse(board, r, c, piece, moves) {
      const from = { r, c };
      for (const [dr, dc] of HORSE_STEPS) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBoard(nr, nc)) continue;
        const leg = horseLeg(r, c, dr, dc);
        if (board[leg.r][leg.c]) continue; // 蹩马腿
        addTarget(from, piece.color, board, nr, nc, moves);
      }
    },

    chariot(board, r, c, piece, moves) {
      for (const [dr, dc] of ORTHOGONAL) {
        for (let nr = r + dr, nc = c + dc; inBoard(nr, nc); nr += dr, nc += dc) {
          const target = board[nr][nc];
          if (!target) {
            moves.push(createMove(r, c, nr, nc));
          } else {
            if (target.color !== piece.color) moves.push(createMove(r, c, nr, nc));
            break;
          }
        }
      }
    },

    cannon(board, r, c, piece, moves) {
      for (const [dr, dc] of ORTHOGONAL) {
        let jumped = false; // 是否已越过炮架
        for (let nr = r + dr, nc = c + dc; inBoard(nr, nc); nr += dr, nc += dc) {
          const target = board[nr][nc];
          if (!jumped) {
            if (!target) {
              moves.push(createMove(r, c, nr, nc));
            } else {
              jumped = true; // 找到炮架
            }
          } else if (target) {
            if (target.color !== piece.color) moves.push(createMove(r, c, nr, nc));
            break;
          }
        }
      }
    },

    pawn(board, r, c, piece, moves) {
      const from = { r, c };
      // 向前一步
      addTarget(from, piece.color, board, r + forwardStep(piece.color), c, moves);
      // 过河后可左右平移
      if (crossedRiver(r, piece.color)) {
        addTarget(from, piece.color, board, r, c - 1, moves);
        addTarget(from, piece.color, board, r, c + 1, moves);
      }
    },
  };

  function addPieceMoves(board, r, c, piece, moves) {
    const generator = MOVE_GENERATORS[piece.type];
    if (generator) generator(board, r, c, piece, moves);
  }

  /** 某一方的全部伪合法走法 */
  function generatePseudoMoves(board, color) {
    const moves = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = board[r][c];
        if (piece && piece.color === color) addPieceMoves(board, r, c, piece, moves);
      }
    }
    return moves;
  }

  /** 指定棋子的伪合法走法（不校验走后是否被将军） */
  function generatePieceMoves(board, r, c) {
    const piece = pieceAt(board, r, c);
    if (!piece) return [];
    const moves = [];
    addPieceMoves(board, r, c, piece, moves);
    return moves;
  }

  // ---------------------------------------------------------------------------
  // 攻击判断：目标格是否被 byColor 方攻击
  // ---------------------------------------------------------------------------

  function attackedByPawn(board, tr, tc, byColor) {
    // 兵只能向前攻击：红兵在目标格下方，黑卒在目标格上方
    const pawnRow = byColor === RED ? tr + 1 : tr - 1;
    if (isPiece(board, pawnRow, tc, PIECE.PAWN, byColor)) return true;
    // 侧向攻击要求兵已过河（即目标格在兵所在半场之外）
    if (crossedRiver(tr, byColor)) {
      if (isPiece(board, tr, tc - 1, PIECE.PAWN, byColor)) return true;
      if (isPiece(board, tr, tc + 1, PIECE.PAWN, byColor)) return true;
    }
    return false;
  }

  function attackedByHorse(board, tr, tc, byColor) {
    for (const [dr, dc] of HORSE_STEPS) {
      const r = tr - dr;
      const c = tc - dc;
      if (!isPiece(board, r, c, PIECE.HORSE, byColor)) continue;
      const leg = horseLeg(r, c, dr, dc);
      if (!board[leg.r][leg.c]) return true; // 马腿未被蹩
    }
    return false;
  }

  function attackedByChariot(board, tr, tc, byColor) {
    for (const [dr, dc] of ORTHOGONAL) {
      for (let r = tr + dr, c = tc + dc; inBoard(r, c); r += dr, c += dc) {
        if (!board[r][c]) continue;
        if (isPiece(board, r, c, PIECE.CHARIOT, byColor)) return true;
        break; // 被第一个棋子挡住
      }
    }
    return false;
  }

  function attackedByCannon(board, tr, tc, byColor) {
    for (const [dr, dc] of ORTHOGONAL) {
      let screens = 0;
      for (let r = tr + dr, c = tc + dc; inBoard(r, c); r += dr, c += dc) {
        if (!board[r][c]) continue;
        screens++;
        if (screens === 2) {
          if (isPiece(board, r, c, PIECE.CANNON, byColor)) return true;
          break; // 第二个棋子即为目标，之后不可能再有炮
        }
      }
    }
    return false;
  }

  function attackedByAdvisor(board, tr, tc, byColor) {
    return DIAGONAL.some(([dr, dc]) => isPiece(board, tr - dr, tc - dc, PIECE.ADVISOR, byColor));
  }

  function attackedByElephant(board, tr, tc, byColor) {
    return ELEPHANT_STEPS.some(([dr, dc]) => {
      const r = tr - dr;
      const c = tc - dc;
      if (!isPiece(board, r, c, PIECE.ELEPHANT, byColor)) return false;
      const eye = elephantEye(r, c, dr, dc);
      return !board[eye.r][eye.c];
    });
  }

  function attackedByGeneral(board, tr, tc, byColor) {
    if (ORTHOGONAL.some(([dr, dc]) => isPiece(board, tr - dr, tc - dc, PIECE.GENERAL, byColor))) {
      return true;
    }
    // 飞将：两将同列且中间无子
    const enemyKing = findKing(board, byColor);
    if (enemyKing && enemyKing.c === tc && isPathClear(board, enemyKing, { r: tr, c: tc })) {
      return true;
    }
    return false;
  }

  function isSquareAttacked(board, tr, tc, byColor) {
    return attackedByPawn(board, tr, tc, byColor)
      || attackedByHorse(board, tr, tc, byColor)
      || attackedByChariot(board, tr, tc, byColor)
      || attackedByCannon(board, tr, tc, byColor)
      || attackedByAdvisor(board, tr, tc, byColor)
      || attackedByElephant(board, tr, tc, byColor)
      || attackedByGeneral(board, tr, tc, byColor);
  }

  /** 该方是否被将军（将已被吃时视为被将军） */
  function isInCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return true;
    return isSquareAttacked(board, king.r, king.c, opponent(color));
  }

  /** 走后己方将是否安全 */
  function leavesKingSafe(board, move, color) {
    return !isInCheck(makeMove(board, move), color);
  }

  // ---------------------------------------------------------------------------
  // 合法走法：伪合法走法中排除“走后送将”
  // ---------------------------------------------------------------------------

  function getLegalMoves(board, color) {
    return generatePseudoMoves(board, color).filter((move) => leavesKingSafe(board, move, color));
  }

  /** 指定棋子的合法走法（用于点选棋子时高亮落点） */
  function getLegalMovesFrom(board, color, r, c) {
    const piece = pieceAt(board, r, c);
    if (!piece || piece.color !== color) return [];
    return generatePieceMoves(board, r, c).filter((move) => leavesKingSafe(board, move, color));
  }

  /** 走法是否合法（供外部校验，例如 AI 返回值的兜底校验） */
  function isLegalMove(board, move, color) {
    return getLegalMoves(board, color)
      .some((m) => m.fr === move.fr && m.fc === move.fc && m.tr === move.tr && m.tc === move.tc);
  }

  const Rules = {
    // 常量透传，便于调用方只依赖一个模块
    RED, BLACK, ROWS, COLS, PIECE, PIECE_VALUES, MATE,
    // 几何
    opponent, inBoard, inPalace, crossedRiver, ownSide, forwardStep, pieceAt, isPathClear,
    // 棋盘
    initBoard, cloneBoard, makeMove, findKing, createMove,
    // 走法
    generatePseudoMoves, generatePieceMoves, getLegalMoves, getLegalMovesFrom, isLegalMove,
    // 将军
    isSquareAttacked, isInCheck,
  };

  global.XQ = global.XQ || {};
  global.XQ.Rules = Rules;
  if (isNode) module.exports = Rules;
})(typeof globalThis !== 'undefined' ? globalThis : window);

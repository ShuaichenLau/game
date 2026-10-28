/**
 * AiPlayer.js — 本地 AI（启发式策略）
 *
 * 决策优先级：
 *   1. 若电脑有一步直接获胜的位置 → 立即落子获胜。
 *   2. 否则，若玩家下一步可直接获胜 → 封堵。
 *   3. 其余情况：对候选空位综合评估进攻（电脑成棋）与防守（封堵玩家），
 *      识别活四/冲四/活三/眠三/活二/眠二等棋形，取评分最高的位置。
 *
 * 设计要点：
 *   - AI 只返回建议坐标 { row, col }，由 Game 统一校验并执行真实落子。
 *   - AI 全程不修改传入的棋盘。立即获胜/封堵检测直接利用
 *     RuleChecker.checkWin 的“假设中心落子”语义，无需复制棋盘。
 *   - 同分时优先靠近中心，再按固定遍历次序（行优先）选择，便于测试复现。
 *   - 空棋盘直接落中心。
 *
 * 已知局限（不声称支持）：
 *   - 不识别“跳活三”（如 X_XX 或 XX_X）等带空档的棋形：这类棋形在评分阶段
 *     只会按“连续子”被低估为活二/眠二等。但凡是“一步即可成五”的跳四
 *     （如 XXX_X、XX_XX）都会在“立即获胜/立即封堵”的穷举扫描中被正确捕获。
 *   - 不做多层搜索，无法应对“双活三”等多点同时威胁——按评分选最优应对。
 */
(function (NS) {
  'use strict';

  const CONFIG = NS.CONFIG;
  const RuleChecker = NS.RuleChecker;

  const DIRECTIONS = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
  ];

  class AiPlayer {
    constructor() {
      this.config = CONFIG.AI;
      // 棋盘中心坐标（15×15 时为中心 7,7）
      this.center = (CONFIG.BOARD_SIZE - 1) / 2;
    }

    /**
     * AI 主入口：返回建议落子坐标。
     * @param {Board} board 当前棋盘（只读，不会被修改）
     * @param {number} aiColor 电脑执棋颜色
     * @returns {{row:number, col:number} | null} 无合法位置时返回 null
     */
    getMove(board, aiColor) {
      const playerColor = aiColor === CONFIG.BLACK ? CONFIG.WHITE : CONFIG.BLACK;

      // 1. 空棋盘 → 优先落中心
      if (this._isBoardEmpty(board)) {
        return { row: this.center, col: this.center };
      }

      // 2. 电脑有一步直接获胜的位置 → 立即获胜
      const winMove = this._findImmediateWin(board, aiColor);
      if (winMove) return winMove;

      // 3. 玩家下一步可直接获胜 → 优先封堵
      const blockMove = this._findImmediateWin(board, playerColor);
      if (blockMove) return blockMove;

      // 4. 综合评分候选点
      return this._scoreBestMove(board, aiColor, playerColor);
    }

    /** 判断棋盘是否为空 */
    _isBoardEmpty(board) {
      for (let r = 0; r < board.size; r++) {
        for (let c = 0; c < board.size; c++) {
          if (board.getStone(r, c) !== CONFIG.EMPTY) return false;
        }
      }
      return true;
    }

    /**
     * 穷举所有空位，找出“在该处落 color 即可获胜”的位置。
     * 为保证不遗漏任何合法威胁点，这里扫描全部空位（棋盘最多 225 个点，
     * 每次 checkWin 为 O(1)，总开销可忽略），不因优化而漏判。
     *
     * @param {Board} board
     * @param {number} color 待检测的进攻方颜色
     * @returns {{row:number, col:number} | null}
     */
    _findImmediateWin(board, color) {
      for (let r = 0; r < board.size; r++) {
        for (let c = 0; c < board.size; c++) {
          if (!board.isEmpty(r, c)) continue;
          // checkWin 不修改棋盘，把 (r,c) 当作假设落子来判定
          if (RuleChecker.checkWin(board, r, c, color).isWin) {
            return { row: r, col: c };
          }
        }
      }
      return null;
    }

    /**
     * 收集评分候选点：已有棋子周围 SEARCH_RADIUS 格内的空位。
     * 若结果为空（理论上的兜底，例如棋子极度稀疏的异常局面），
     * 则回退为全部空位。返回结果按行优先次序排列，保证确定性。
     *
     * @param {Board} board
     * @returns {Array<{row:number, col:number}>}
     */
    _collectCandidates(board) {
      const size = board.size;
      const radius = this.config.SEARCH_RADIUS;
      const marked = [];
      for (let r = 0; r < size; r++) marked.push(new Array(size).fill(false));
      let any = false;

      // 标记所有“已有棋子周围 radius 格内”的空位
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board.getStone(r, c) === CONFIG.EMPTY) continue;
          for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (board.isInBounds(nr, nc) && board.isEmpty(nr, nc) && !marked[nr][nc]) {
                marked[nr][nc] = true;
                any = true;
              }
            }
          }
        }
      }

      // 兜底：若一个候选都没有，改用全部空位
      if (!any) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (board.isEmpty(r, c)) marked[r][c] = true;
          }
        }
      }

      // 行优先输出
      const cells = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (marked[r][c]) cells.push({ row: r, col: c });
        }
      }
      return cells;
    }

    /**
     * 对候选点评分并返回最优解。
     * 同分时：优先靠近中心；再同分时保留行优先次序中先出现者。
     *
     * @param {Board} board
     * @param {number} aiColor
     * @param {number} playerColor
     * @returns {{row:number, col:number} | null}
     */
    _scoreBestMove(board, aiColor, playerColor) {
      const candidates = this._collectCandidates(board);
      if (candidates.length === 0) return null;

      let best = null;
      let bestScore = -Infinity;

      for (let i = 0; i < candidates.length; i++) {
        const { row, col } = candidates[i];
        const score = this._scorePoint(board, row, col, aiColor, playerColor);

        if (score > bestScore) {
          bestScore = score;
          best = { row, col };
        } else if (score === bestScore) {
          // 同分：靠近中心者优先
          const dNew = this._distToCenter(row, col);
          const dBest = this._distToCenter(best.row, best.col);
          if (dNew < dBest) {
            best = { row, col };
          }
          // 距离也相同 → 保持先出现者（固定次序）
        }
      }

      return best;
    }

    /**
     * 计算某候选点的综合评分 = 进攻分 × 进攻权重 + 防守分 × 防守权重。
     */
    _scorePoint(board, row, col, aiColor, playerColor) {
      const attack = this._evaluatePoint(board, row, col, aiColor);
      const defense = this._evaluatePoint(board, row, col, playerColor);
      return attack * this.config.ATTACK_WEIGHT + defense * this.config.DEFENSE_WEIGHT;
    }

    /**
     * 评估某颜色在候选点落子后，四个方向棋形评分之和。
     */
    _evaluatePoint(board, row, col, color) {
      let total = 0;
      for (let i = 0; i < DIRECTIONS.length; i++) {
        total += this._shapeScore(board, row, col, color, DIRECTIONS[i].dr, DIRECTIONS[i].dc);
      }
      return total;
    }

    /**
     * 计算某一方向上的棋形评分。
     *
     * 判定规则：
     *   - 把候选点视为已落下 `color`，向正负两端连续计数同色棋子。
     *   - 棋盘边界与对方棋子都视为“阻挡”（即该端不开放）。
     *   - 一端开放 = 紧邻的下一格为空且在棋盘内。
     *   - 根据连续子数 + 开放端数，映射到活四/冲四/活三/眠三/活二/眠二/孤子。
     *
     * @returns {number} 该方向的棋形分值
     */
    _shapeScore(board, row, col, color, dr, dc) {
      let count = 1;      // 候选点本身
      let openEnds = 0;

      // 正向延伸
      let r = row + dr;
      let c = col + dc;
      while (board.isInBounds(r, c) && board.getStone(r, c) === color) {
        count++;
        r += dr;
        c += dc;
      }
      if (board.isInBounds(r, c) && board.getStone(r, c) === CONFIG.EMPTY) openEnds++;

      // 负向延伸
      r = row - dr;
      c = col - dc;
      while (board.isInBounds(r, c) && board.getStone(r, c) === color) {
        count++;
        r -= dr;
        c -= dc;
      }
      if (board.isInBounds(r, c) && board.getStone(r, c) === CONFIG.EMPTY) openEnds++;

      return this._classifyScore(count, openEnds);
    }

    /**
     * 根据连续子数与开放端数映射分值。
     * @param {number} count 连续同色子数（含假设的候选点）
     * @param {number} openEnds 开放端数（0/1/2）
     * @returns {number}
     */
    _classifyScore(count, openEnds) {
      const S = this.config.SHAPE_SCORES;
      if (count >= 5) return S.FIVE;
      if (count === 4) {
        if (openEnds >= 2) return S.LIVE_FOUR;
        if (openEnds === 1) return S.RUSH_FOUR;
        return 0; // 两端都被堵死的四，无发展价值
      }
      if (count === 3) {
        if (openEnds >= 2) return S.LIVE_THREE;
        if (openEnds === 1) return S.SLEEP_THREE;
        return 0;
      }
      if (count === 2) {
        if (openEnds >= 2) return S.LIVE_TWO;
        if (openEnds === 1) return S.SLEEP_TWO;
        return 0;
      }
      if (count === 1) {
        return openEnds >= 1 ? S.ONE : 0;
      }
      return 0;
    }

    /** 到棋盘中心的欧氏距离（平方，避免开方开销） */
    _distToCenter(row, col) {
      const dr = row - this.center;
      const dc = col - this.center;
      return dr * dr + dc * dc;
    }
  }

  NS.AiPlayer = AiPlayer;
})(window.Gomoku = window.Gomoku || {});

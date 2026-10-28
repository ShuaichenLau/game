// ============================================================
//  config.js — 全局配置、图块定义、关卡地图、精灵像素数据
//  零依赖，file:// 双击即可运行
// ============================================================
"use strict";

const CONFIG = {
  // 逻辑像素 / 物理
  TILE: 24,                 // 每个图块 24px（放大整体）
  COLS: 50,                 // 地图列数
  ROWS: 15,                 // 地图行数（可视区）
  VIEW_W: 960,
  VIEW_H: 576,

  // 角色尺寸（基于图块比例，随 TILE 缩放）
  PLAYER_W: 0.62,           // 玩家宽 = TILE * 0.62 ≈ 15px
  PLAYER_H: 0.78,           // 玩家高（小）= TILE * 0.78 ≈ 19px
  PLAYER_H_BIG: 1.15,       // 大马里奥高 = TILE * 1.15 ≈ 28px

  // 物理（速度单位：像素/帧，已按 TILE 24px 缩放）
  GRAVITY: 0.75,
  MAX_FALL: 13.5,
  MOVE_ACC: 0.9,
  MOVE_FRICTION: 0.35,      // 越小越跟手（松开后更快停下）
  MAX_WALK: 3.6,
  MAX_RUN: 5.4,
  JUMP_VEL: -9.6,
  COYOTE: 6,                // 土狼时间（离开平台还能跳的帧数）
  JUMP_BUFFER: 6,           // 跳跃缓冲（落地前按跳也生效）
};

// 图块类型（数字）
const T = {
  EMPTY: 0,
  GROUND: 1,       // 地面
  BRICK: 2,        // 砖块（可顶碎）
  BLOCK: 3,        // 问号块
  USED: 4,         // 用过的问号块
  PIPE_TL: 5,      // 水管左上
  PIPE_TR: 6,      // 水管右上
  PIPE_L: 7,       // 水管左侧（身）
  PIPE_R: 8,       // 水管右侧（身）
  FLAG: 9,         // 旗杆
  FLAG_TOP: 10,
};

// 是否实心
function solid(t) {
  return t === T.GROUND || t === T.BRICK || t === T.BLOCK || t === T.USED ||
         t === T.PIPE_TL || t === T.PIPE_TR || t === T.PIPE_L || t === T.PIPE_R;
}

// 地图：每行 50 列。用字符串表示，便于阅读。
// # 地面  B 砖块  ? 问号块  X 用过的块  | 水管  F 旗杆
const MAP_STR = [
  "                                                  ",
  "                                                  ",
  "                                                  ",
  "                                                  ",
  "          F                                      ",
  "          |                                      ",
  "        ??                                      ",
  "      B   B                                      ",
  "    ?       ?            B                       ",
  "  B   B       B    ?   B B   B                   ",
  "                          ? ?                    ",
  "    |      |   |     B   B B B                   ",
  "##############|#####|#############|######### ####",
  "##############|#####|#############|######### ####",
  "##############|#####|#############|######### ####",
];

const CHAR_TO_TILE = {
  " ": T.EMPTY,
  "#": T.GROUND,
  "B": T.BRICK,
  "?": T.BLOCK,
  "X": T.USED,
  "|": T.PIPE_TL,
  "F": T.FLAG,
};

// 解析地图字符串 -> 二维数组
function buildMap() {
  const map = [];
  for (let r = 0; r < CONFIG.ROWS; r++) {
    map[r] = [];
    const line = MAP_STR[r] || "";
    for (let c = 0; c < CONFIG.COLS; c++) {
      let ch = line[c] || " ";
      map[r][c] = CHAR_TO_TILE[ch] !== undefined ? CHAR_TO_TILE[ch] : T.EMPTY;
    }
  }
  // 水管：把 | 扩展成完整水管（上 + 身），并补上顶部
  for (let r = 0; r < CONFIG.ROWS; r++) {
    for (let c = 0; c < CONFIG.COLS; c++) {
      if (map[r][c] === T.PIPE_TL) {
        map[r][c] = T.PIPE_TL;
        map[r][c + 1] = T.PIPE_TR;
        // 向下填充身
        for (let rr = r + 1; rr < CONFIG.ROWS; rr++) {
          map[rr][c] = T.PIPE_L;
          map[rr][c + 1] = T.PIPE_R;
        }
      }
    }
  }
  return map;
}

// 敌人生成点（列位置，越靠后越晚遇到）
const ENEMY_SPAWNS = [
  { col: 18, type: "goomba" },
  { col: 24, type: "goomba" },
  { col: 28, type: "goomba" },
  { col: 34, type: "koopa" },
  { col: 40, type: "goomba" },
];

// 金币/道具位置（col, row 是问号块位置，从上方弹出）
const COIN_BLOCKS = [];

// ============================================================
//  精灵像素数据（每个 sprite 是字符串数组，# 为不透明）
// ============================================================
const SPRITES = {
  // 马里奥 待机 (16x16)
  mario_stand: [
    "......#####.....",
    ".....#######...",
    ".....######....",
    ".....#####.....",
    ".....######....",
    "......#####....",
    ".....#####.....",
    "....######.....",
    "....######.....",
    "....#####......",
    "...######......",
    "...######......",
    "....####.......",
    "...##..##......",
    "..##...##......",
    ".###...###.....",
  ],
};

// 生成纯色像素精灵（用于简单形状）
function solidSprite(w, h, colorFn) {
  const arr = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      row += colorFn(x, y);
    }
    arr.push(row);
  }
  return arr;
}

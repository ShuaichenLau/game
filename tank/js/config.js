/* =====================================================================
 * 模块：Config — 全局常量与规格配置
 * ===================================================================== */
(function(){
"use strict";

window.NB = window.NB || {};
const NB = window.NB;

NB.Config = {
  /* 网格规格 */
  SUB: 18, COLS: 26, ROWS: 26, BATTLE: 468, CELL: 36, TANK: 36, HIT: 32,
  OX: 22, OY: 22, GAP: 14, PANEL_W: 170,

  /* 前 N 关老鹰基地免疫保护 */
  BASE_IMMUNE_STAGES: 10,

  DIRS: [[0,-1],[1,0],[0,1],[-1,0]],

  /* 红坦（携带数据芯片）编号：第 4 / 11 / 18 辆（0 基 3/10/17） */
  RED_IDX: new Set([3, 10, 17]),
  ENEMY_PLAN: [
    'scout','scout','phantom','scout','striker','scout','phantom','titan','scout','striker',
    'phantom','scout','titan','phantom','striker','scout','titan','phantom','striker','titan'
  ],
  ENEMY_DEF: {
    scout  :{ speed:0.8, fireRate:110, bulletSpeed:4, hp:1, points:100 },
    phantom:{ speed:1.9, fireRate:105, bulletSpeed:4, hp:1, points:200 },
    striker:{ speed:1.0, fireRate:50,  bulletSpeed:7, hp:1, points:300 },
    titan  :{ speed:0.8, fireRate:100, bulletSpeed:4, hp:4, points:400 }
  },
  SPAWN_PTS: [{x:0,y:0},{x:216,y:0},{x:432,y:0}],

  /* 五关地图（13×13 大格）：. 空 B 砖 S 钢 W 水 I 冰 F 草丛 E 主脑 */
  LEVELS: [
    [".............","..BB.BBB.BB..","..BB.BBB.BB..",".............",".B.B.B.B.B.B.",".............","..BBB...BBB..",".............","..B.BBBBB.B..","....F...F....","..W.......W..",".............","......E......"],
    [".............","..SS.....SS..","..SS.....SS..",".............",".SS.......SS.",".SS..BBB..SS.",".SS..B.B..SS.",".SS..BBB..SS.",".............","...F.F.F.F...","..SS.....SS..",".............","......E......"],
    [".............",".BB.B.B.B.BB.",".BB.B.B.B.BB.",".............",".F.B.BBB.B.F.",".F.B.....B.F.",".F.B.....B.F.",".F.BBB.BBB.F.",".............","..BBBB.BBBB..",".............",".............","......E......"],
    [".............","..BB.....BB..","..BB.....BB..",".............",".WWW.....WWW.",".WWW..B..WWW.",".WWW.....WWW.",".WWW..B..WWW.",".WWW.....WWW.",".............","..SS.....SS..",".............","......E......"],
    [".............","..II..S..II..","..II..S..II..",".............",".II...S...II.",".II.SSS.S.II.",".II...S...II.",".............","..II..S..II..","..II..S..II..",".............",".............","......E......"]
  ]
};

/* 派生尺寸 */
NB.Config.PANEL_X = NB.Config.OX + NB.Config.BATTLE + NB.Config.GAP;
NB.Config.CW = NB.Config.OX + NB.Config.BATTLE + NB.Config.GAP + NB.Config.PANEL_W + NB.Config.OX;
NB.Config.CH = NB.Config.OY + NB.Config.BATTLE + NB.Config.OY;
})();

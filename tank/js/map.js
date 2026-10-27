/* =====================================================================
 * 模块：Map — 战场网格数据、地形碰撞查询与地图装载
 * ===================================================================== */
(function(){
"use strict";

const NB = window.NB;
const Config = NB.Config;

NB.Map = class Map {
  constructor(){
    this.solid = [];            // 26×26 地形类型：0空 1砖 2钢 3水 4冰 5主脑
    this.bush = [];             // 26×26 草丛（前景遮挡）
    this.baseCells = [];        // 主脑围墙子格
    this.baseCellSet = new Set();
    this.eagleDead = false;
    this.baseSteel = false;
    this.baseSteelTimer = 0;
  }
  inRange(c,r){ const {COLS,ROWS}=Config; return c>=0 && c<COLS && r>=0 && r<ROWS; }
  solidAt(c,r){ return this.inRange(c,r) ? this.solid[r][c] : -1; }
  boxCells(x,y,w,h){ const {SUB}=Config; return { c0:Math.floor(x/SUB), c1:Math.floor((x+w-1)/SUB), r0:Math.floor(y/SUB), r1:Math.floor((y+h-1)/SUB) }; }
  rectsOverlap(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }
  onIce(t){ const {HIT}=Config; const b=this.boxCells(t.x+2,t.y+2,HIT,HIT); for(let r=b.r0;r<=b.r1;r++) for(let c=b.c0;c<=b.c1;c++) if(this.solidAt(c,r)===4) return true; return false; }

  /* 主脑核心 + 围墙 */
  placeBase(){
    this.baseCells=[];
    for(let r=24;r<=25;r++) for(let c=12;c<=13;c++) this.solid[r][c]=5;
    const bricks=[[11,23],[12,23],[13,23],[14,23],[11,24],[14,24],[11,25],[14,25]];
    for(const [c,r] of bricks){ this.solid[r][c]=1; this.baseCells.push({c,r}); }
    this.baseCellSet=new Set(bricks.map(([c,r])=>r+','+c));
    this.eagleDead=false; this.baseSteel=false; this.baseSteelTimer=0;
  }
  setBaseSteel(){ this.baseSteel=true; for(const b of this.baseCells) this.solid[b.r][b.c]=2; }
  setBaseBrick(){ this.baseSteel=false; for(const b of this.baseCells) this.solid[b.r][b.c]=1; }

  loadLevel(n){
    const {LEVELS,ROWS,COLS}=Config, map=LEVELS[(n-1)%LEVELS.length];
    this.solid=Array.from({length:ROWS},()=>new Array(COLS).fill(0));
    this.bush=Array.from({length:ROWS},()=>new Array(COLS).fill(false));
    for(let lr=0;lr<13;lr++) for(let lc=0;lc<13;lc++){
      const ch=map[lr][lc];
      for(let dr=0;dr<2;dr++) for(let dc=0;dc<2;dc++){
        const r=lr*2+dr, c=lc*2+dc;
        if(ch==='B') this.solid[r][c]=1; else if(ch==='S') this.solid[r][c]=2; else if(ch==='W') this.solid[r][c]=3;
        else if(ch==='I') this.solid[r][c]=4; else if(ch==='F') this.bush[r][c]=true; else if(ch==='E') this.solid[r][c]=5;
      }
    }
    this.placeBase();
  }
};
})();

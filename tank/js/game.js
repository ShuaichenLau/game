/* =====================================================================
 * 模块：Game — 状态机、实体与碰撞、更新循环、输入、渲染编排、主循环
 * ===================================================================== */
(function(){
"use strict";

const NB = window.NB;
const Config = NB.Config;
const Renderer = NB.Renderer;
const AudioEngine = NB.AudioEngine;
const MapSystem = NB.Map;

NB.Game = class Game {
  constructor(){
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.audio = new AudioEngine();
    this.map = new MapSystem();

    this.state='title'; this.mode=1; this.paused=false; this.scanlines=false;
    this.frame=0; this.score=0; this.hiscore=0;
    try{ this.hiscore=parseInt(localStorage.getItem('battlecity_hiscore')||'0')||0; }catch(e){}
    this.stage=1; this.freezeTimer=0;
    this.players=[]; this.enemies=[]; this.bullets=[]; this.powerups=[]; this.particles=[];
    this.enemiesSpawned=0; this.enemiesKilled=0; this.pendingSpawn=null; this.spawnTimer=30;
    this.stageKills={scout:0,phantom:0,striker:0,titan:0};
    this.introT=0; this.clearT=0; this.overT=0; this.gameOverDelay=0; this.menuSel=0;
    this.shakeT=0; this.shakeMag=0;
    this.keys={};

    this.applyScale();
    window.addEventListener('resize', ()=>this.applyScale());
    window.addEventListener('keydown', (e)=>this.onKeyDown(e));
    window.addEventListener('keyup', (e)=>this.onKeyUp(e));
    this.canvas.addEventListener('mousedown', (e)=>this.onMouseDown(e));
    this.canvas.addEventListener('contextmenu', (e)=>e.preventDefault());

    this.map.loadLevel(1);
    this.state='title';
    window.focus();
    this.last=performance.now();
    requestAnimationFrame((n)=>this.loop(n));
  }
  applyScale(){
    const {CW,CH}=Config;
    const w=window.innerWidth||CW, h=(window.innerHeight||CH)-40;
    let s=Math.floor(Math.min(w/CW, h/CH));
    if(!isFinite(s)||s<1) s=1; if(s>4) s=4;
    this.scale=s;
    this.canvas.width=CW*s; this.canvas.height=CH*s;
    if(this.canvas.style){ this.canvas.style.width=(CW*s)+'px'; this.canvas.style.height=(CH*s)+'px'; }
  }
  shake(m){ this.shakeMag=Math.max(this.shakeMag,m); this.shakeT=Math.max(this.shakeT,10); }

  /* ---- 实体 ---- */
  makePlayer(idx){ const sx=idx===0?144:288; return { isPlayer:true, index:idx, x:sx, y:432, dir:0, speed:1.5, level:0, cooldown:0, fireCooldown:0, shield:180, alive:true, out:false, lives:2, respawnTimer:0, slideDir:-1, moving:false }; }
  makeEnemy(type,red,x,y){ const d=Config.ENEMY_DEF[type]; return { isPlayer:false, type, red, x, y, dir:2, speed:d.speed, fireRate:d.fireRate, bulletSpeed:d.bulletSpeed, hp:d.hp, maxHp:d.hp, points:d.points, alive:true, cooldown:40, aiTimer:0, flash:0, fireChance: type==='striker'?0.75:(type==='phantom'?0.5:0.38) }; }
  aliveEnemies(){ return this.enemies.filter(e=>e.alive).length; }
  alivePlayers(){ return this.players.filter(p=>p.alive && !p.out); }

  /* ---- 移动碰撞 ---- */
  tankOverlap(a,b){ const {TANK}=Config; return this.map.rectsOverlap(a.x,a.y,TANK,TANK,b.x,b.y,TANK,TANK); }
  rectBlocks(nx,ny,w,h){
    const b=this.map.boxCells(nx,ny,w,h);
    for(let r=b.r0;r<=b.r1;r++) for(let c=b.c0;c<=b.c1;c++){
      const t=this.map.solidAt(c,r);
      if(t===1||t===2||t===3||t===5) return true;
      if(t===-1) return true;
    }
    return false;
  }
  canMoveAt(t,nx,ny){
    const {HIT}=Config;
    if(this.rectBlocks(nx+2,ny+2,HIT,HIT)) return false;
    const tmp={x:nx,y:ny};
    if(t.isPlayer){ for(const e of this.enemies) if(e.alive && this.tankOverlap(tmp,e)) return false; for(const p of this.players) if(p!==t && p.alive && !p.out && this.tankOverlap(tmp,p)) return false; }
    else { for(const p of this.players) if(p.alive && !p.out && this.tankOverlap(tmp,p)) return false; }
    return true;
  }
  moveTank(t,dt){
    const sp=t.speed*dt; let nx=t.x, ny=t.y;
    if(t.dir===0) ny-=sp; else if(t.dir===1) nx+=sp; else if(t.dir===2) ny+=sp; else nx-=sp;
    if(this.canMoveAt(t,nx,ny)){ t.x=nx; t.y=ny; return true; }
    return false;
  }

  /* 吸附对齐：将指定轴平滑吸附到 18px 网格线（amount=每帧最大校正量） */
  snapAxis(p, axis, amount){
    const cur = p[axis];
    const target = Math.round(cur/18)*18;
    const diff = target - cur;
    if(Math.abs(diff) < 0.01) return;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), amount);
    const nx = axis==='x' ? p.x + step : p.x;
    const ny = axis==='y' ? p.y + step : p.y;
    if(this.canMoveAt(p, nx, ny)) p[axis] += step;
  }
  /* 停止时对齐到网格矩阵 */
  snapToGrid(p){
    this.snapAxis(p, (p.dir===0 || p.dir===2) ? 'x' : 'y', 9);
  }

  /* ---- 敌坦调度 ---- */
  findSpawnPoint(){
    const {SPAWN_PTS,TANK}=Config, pts=SPAWN_PTS.slice();
    for(let i=pts.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pts[i],pts[j]]=[pts[j],pts[i]]; }
    for(const pt of pts){
      let free=true;
      for(const e of this.enemies) if(e.alive && this.map.rectsOverlap(e.x,e.y,TANK,TANK,pt.x,pt.y,TANK,TANK)){ free=false; break; }
      if(free) for(const p of this.players) if(p.alive && !p.out && this.map.rectsOverlap(p.x,p.y,TANK,TANK,pt.x,pt.y,TANK,TANK)){ free=false; break; }
      if(free) return pt;
    }
    return null;
  }
  updateSpawns(dt){
    if(this.pendingSpawn){
      this.pendingSpawn.t-=dt;
      if(this.pendingSpawn.t<=0){
        const idx=this.enemiesSpawned, type=Config.ENEMY_PLAN[idx%Config.ENEMY_PLAN.length], red=Config.RED_IDX.has(idx);
        this.enemies.push(this.makeEnemy(type,red,this.pendingSpawn.x,this.pendingSpawn.y));
        this.enemiesSpawned++; this.audio.warp(); this.pendingSpawn=null;
      }
      return;
    }
    if(this.enemiesSpawned<20 && this.aliveEnemies()<4){
      this.spawnTimer-=dt;
      if(this.spawnTimer<=0){ const pt=this.findSpawnPoint(); if(pt) this.pendingSpawn={x:pt.x,y:pt.y,t:32}; this.spawnTimer=30; }
    }
  }

  /* ---- 子弹 ---- */
  shootPlayer(p){
    const max=p.level>=2?2:1; let cnt=0;
    for(const b of this.bullets) if(!b.dead && b.owner==='p'+p.index) cnt++;
    if(cnt>=max) return;
    const speed=p.level>=3?10:(p.level>=1?8:5);
    const cx=p.x+18, cy=p.y+18; let bx,by;
    if(p.dir===0){ bx=cx-3; by=p.y-8; } else if(p.dir===1){ bx=p.x+36; by=cy-3; } else if(p.dir===2){ bx=cx-3; by=p.y+36; } else { bx=p.x-8; by=cy-3; }
    this.bullets.push({x:bx,y:by,dir:p.dir,speed,owner:'p'+p.index,power:p.level,size:6,dead:false,color:p.index===0?'#00f3ff':'#fcee09',trail:[]});
    p.fireCooldown=p.level>=3?10:15; this.audio.laser();
  }
  enemyShoot(e){
    const cx=e.x+18, cy=e.y+18; let bx,by;
    if(e.dir===0){ bx=cx-3; by=e.y-8; } else if(e.dir===1){ bx=e.x+36; by=cy-3; } else if(e.dir===2){ bx=cx-3; by=e.y+36; } else { bx=e.x-8; by=cy-3; }
    this.bullets.push({x:bx,y:by,dir:e.dir,speed:e.bulletSpeed,owner:'e',power:0,size:6,dead:false,color:'#ff2a6a',trail:[]});
    this.audio.laser();
  }
  updateBullet(b,dt){
    const {BATTLE}=Config;
    let remaining=b.speed*dt;
    while(remaining>0 && !b.dead){
      const step=Math.min(remaining,7); remaining-=step;
      let nx=b.x, ny=b.y;
      if(b.dir===0) ny-=step; else if(b.dir===1) nx+=step; else if(b.dir===2) ny+=step; else nx-=step;
      b.x=nx; b.y=ny;
      b.trail.push({x:b.x,y:b.y}); if(b.trail.length>8) b.trail.shift();
      if(b.x<-8||b.x>BATTLE+8||b.y<-8||b.y>BATTLE+8){ b.dead=true; return; }
      if(this.bulletHitBullet(b)) return;   // 对撞抵消（优先判定，双方对称）
      if(this.bulletHitMap(b)) return;
      if(this.bulletHitTank(b)) return;
    }
  }
  bulletHitMap(b){
    const {SUB}=Config;
    const c0=Math.floor(b.x/SUB), c1=Math.floor((b.x+b.size-1)/SUB);
    const r0=Math.floor(b.y/SUB), r1=Math.floor((b.y+b.size-1)/SUB);
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
      if(!this.map.inRange(c,r)) continue;
      const t=this.map.solid[r][c];
      if(t===1){ this.destroyBrick(c,r); b.dead=true; return true; }
      if(t===2){ if(b.power>=3) this.destroySteel(c,r); else { this.audio.shieldBounce(); this.spark(b.x,b.y); } b.dead=true; return true; }
      if(t===5){ this.hitEagle(b); b.dead=true; return true; }
    }
    return false;
  }
  /* 主脑核心：前 N 关免疫保护，之后可被击毁 */
  hitEagle(b){
    if(this.map.eagleDead) return;
    if(this.stage <= Config.BASE_IMMUNE_STAGES){
      this.audio.shieldBounce();
      this.spark(b.x+3, b.y+3);
      return;
    }
    this.destroyEagle();
  }
  /* 砖墙：一枪一层，逐层剥开（仅消除受击面单个 18px 子格） */
  destroyBrick(c,r){
    if(this.map.inRange(c,r) && this.map.solid[r][c]===1){
      this.map.solid[r][c]=0;
      this.digitalDebris(c*18+9, r*18+9);
    }
    this.audio.dataShatter();
  }
  destroySteel(c,r){
    const lc=Math.floor(c/2)*2, lr=Math.floor(r/2)*2;
    for(let rr=lr;rr<lr+2;rr++) for(let cc=lc;cc<lc+2;cc++){
      if(this.map.inRange(cc,rr) && this.map.solid[rr][cc]===2){ this.map.solid[rr][cc]=0; this.digitalDebris(cc*18+9,rr*18+9); }
    }
    this.audio.emp();
  }
  bulletHitTank(b){
    const {HIT}=Config;
    if(b.owner!=='e'){ for(const e of this.enemies) if(e.alive && this.map.rectsOverlap(b.x,b.y,b.size,b.size,e.x+2,e.y+2,HIT,HIT)){ this.damageEnemy(e); b.dead=true; return true; } }
    else { for(const p of this.players) if(p.alive && !p.out && this.map.rectsOverlap(b.x,b.y,b.size,b.size,p.x+2,p.y+2,HIT,HIT)){ this.damagePlayer(p); b.dead=true; return true; } }
    return false;
  }
  /* 子弹对撞：仅玩家与敌方子弹相互抵消，同阵营子弹不互相抵消 */
  bulletHitBullet(b){
    const bPlayer = b.owner !== 'e';
    for(const o of this.bullets){
      if(o.dead || o===b) continue;
      if((o.owner !== 'e') === bPlayer) continue;
      if(this.map.rectsOverlap(b.x,b.y,b.size,b.size,o.x,o.y,o.size,o.size)){
        b.dead=true; o.dead=true;
        this.spark((b.x+o.x)/2, (b.y+o.y)/2);
        this.audio.spark();
        return true;
      }
    }
    return false;
  }

  /* ---- 伤害 ---- */
  damageEnemy(e){ if(e.hp>1){ e.hp--; e.flash=10; this.audio.shieldBounce(); this.spark(e.x+18,e.y+18); return; } this.destroyEnemy(e); }
  destroyEnemy(e){
    if(!e.alive) return;
    e.alive=false; this.explosion(e.x+18,e.y+18);
    this.score+=e.points; this.stageKills[e.type]=(this.stageKills[e.type]||0)+1; this.enemiesKilled++;
    if(e.red) this.spawnPowerup();
  }
  damagePlayer(p){
    if(p.shield>0){ this.spark(p.x+18,p.y+18); return; }
    p.alive=false; this.explosion(p.x+18,p.y+18); this.shake(6);
    if(p.lives>0){ p.lives--; p.respawnTimer=60; } else { p.out=true; }
    this.checkGameOver();
  }
  doRespawn(p){ p.x=p.index===0?144:288; p.y=432; p.dir=0; p.level=0; p.shield=180; p.cooldown=0; p.fireCooldown=0; p.slideDir=-1; p.alive=true; }
  destroyEagle(){
    if(this.map.eagleDead) return;
    this.map.eagleDead=true;
    for(let r=24;r<=25;r++) for(let c=12;c<=13;c++) this.map.solid[r][c]=0;
    this.explosion(234,450); this.shake(14); this.gameOverDelay=40;
  }

  /* ---- 道具 ---- */
  spawnPowerup(){
    const {TANK}=Config, type=Renderer.PU_NAMES[(Math.random()*Renderer.PU_NAMES.length)|0];
    for(let i=0;i<60;i++){
      const lc=(Math.random()*13)|0, lr=(Math.random()*13)|0, x=lc*36, y=lr*36; let ok=true;
      for(let r=lr*2;r<lr*2+2;r++) for(let c=lc*2;c<lc*2+2;c++){ if(!this.map.inRange(c,r)||this.map.solid[r][c]!==0){ ok=false; break; } }
      if(!ok) continue;
      for(const e of this.enemies) if(e.alive && this.map.rectsOverlap(x,y,TANK,TANK,e.x,e.y,TANK,TANK)){ ok=false; break; }
      if(!ok) continue;
      for(const p of this.players) if(p.alive && !p.out && this.map.rectsOverlap(x,y,TANK,TANK,p.x,p.y,TANK,TANK)){ ok=false; break; }
      if(ok){ this.powerups.push({type,x,y,taken:false}); return; }
    }
  }
  applyPowerup(p,pu){
    pu.taken=true; this.score+=500; this.audio.powerup();
    switch(pu.type){
      case 'overclock': p.level=Math.min(3,p.level+1); break;
      case 'emp': for(const e of this.enemies) if(e.alive) this.destroyEnemy(e); this.audio.emp(); break;
      case 'stasis': this.freezeTimer=600; break;
      case 'aegis': this.map.baseSteelTimer=900; this.map.setBaseSteel(); break;
      case 'nano': p.shield=600; break;
      case 'backup': p.lives=Math.min(9,p.lives+1); this.audio.life(); break;
    }
  }

  /* ---- 粒子 / 震屏（敌人爆炸不震屏） ---- */
  explosion(x,y){
    this.particles.push({type:'ring',x,y,life:22,maxLife:22,r0:4,maxR:48,color:'#00f3ff'});
    const colors=['#00f3ff','#ff0055','#b829ff','#fcee09','#00ff66','#ffffff'];
    for(let i=0;i<32;i++){ const a=Math.random()*Math.PI*2, sp=1+Math.random()*4; this.particles.push({type:'debris',x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:20+Math.random()*18,maxLife:38,color:colors[(Math.random()*colors.length)|0],size:2+Math.random()*3}); }
    this.audio.subBass();
  }
  spark(x,y){ for(let i=0;i<6;i++){ const a=Math.random()*Math.PI*2, sp=1+Math.random()*2; this.particles.push({type:'spark',x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:8+Math.random()*6,maxLife:14,color:'#ffffff',size:1.5+Math.random()*1.5}); } }
  digitalDebris(x,y){ for(let i=0;i<6;i++){ const a=Math.random()*Math.PI*2, sp=0.5+Math.random()*2; this.particles.push({type:'debris',x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,life:12+Math.random()*10,maxLife:22,color:(Math.random()<0.5?'#ff5a2a':'#ffb020'),size:1.5+Math.random()*2}); } }
  spawnThruster(t){
    const {TANK,DIRS}=Config;
    if(Math.random()<0.7){ const [dx,dy]=DIRS[t.dir], cx=t.x+TANK/2, cy=t.y+TANK/2; this.particles.push({type:'thrust',x:cx-dx*(TANK/2),y:cy-dy*(TANK/2),vx:-dx*(0.6+Math.random()*0.8),vy:-dy*(0.6+Math.random()*0.8),life:8+Math.random()*8,maxLife:16,color:this.renderer.tankPalette(t).glow,size:2}); }
  }
  updateParticles(dt){
    for(const pt of this.particles){
      if(pt.type==='ring'){ pt.life-=dt; continue; }
      pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vx*=Math.pow(0.9,dt); pt.vy*=Math.pow(0.9,dt); pt.life-=dt;
    }
    this.particles=this.particles.filter(p=>p.life>0);
  }

  /* ---- 输入 ---- */
  onKeyDown(e){
    this.audio.ensure();
    const k=e.key ? e.key.toLowerCase() : '';
    const isEnter = k==='enter' || e.code==='Enter' || e.code==='NumpadEnter';
    if(k===' ' || k.startsWith('arrow')) e.preventDefault();
    if(k==='arrowup') this.keys['arrowup']=true;
    else if(k==='arrowdown') this.keys['arrowdown']=true;
    else if(k==='arrowleft') this.keys['arrowleft']=true;
    else if(k==='arrowright') this.keys['arrowright']=true;
    else this.keys[k]=true;
    if(k==='c') this.scanlines=!this.scanlines;
    if(k==='m') this.audio.muted=!this.audio.muted;
    if(k==='g') this.renderer.glowScale = this.renderer.glowScale===1?0.35:1;
    if(this.state==='title'){
      if(k==='arrowup'||k==='w'||k==='arrowdown'||k==='s'){ this.menuSel=(this.menuSel+1)%2; this.audio.cursor(); }
      else if(isEnter){ this.selectMenu(); }
    } else if(this.state==='playing'){
      if(k==='p') this.paused=!this.paused;
    } else if(this.state==='over'||this.state==='clear'){
      if(isEnter) this.state='title';
    }
  }
  onKeyUp(e){
    const k=e.key ? e.key.toLowerCase() : '';
    if(k==='arrowup') this.keys['arrowup']=false;
    else if(k==='arrowdown') this.keys['arrowdown']=false;
    else if(k==='arrowleft') this.keys['arrowleft']=false;
    else if(k==='arrowright') this.keys['arrowright']=false;
    else this.keys[k]=false;
  }
  readDir(p){
    let up,down,left,right;
    if(p.index===0){
      if(this.mode===1){ up=this.keys['w']||this.keys['arrowup']; down=this.keys['s']||this.keys['arrowdown']; left=this.keys['a']||this.keys['arrowleft']; right=this.keys['d']||this.keys['arrowright']; }
      else { up=this.keys['w']; down=this.keys['s']; left=this.keys['a']; right=this.keys['d']; }
    } else { up=this.keys['arrowup']; down=this.keys['arrowdown']; left=this.keys['arrowleft']; right=this.keys['arrowright']; }
    if(up) return 0; if(down) return 2; if(left) return 3; if(right) return 1;
    return -1;
  }
  readFire(p){ return p.index===0 ? (this.keys['j']||this.keys[' ']) : this.keys['k']; }
  canvasPos(e){
    const {CW,CH}=Config, rect=this.canvas.getBoundingClientRect();
    return { x:(e.clientX-rect.left)*(CW/rect.width), y:(e.clientY-rect.top)*(CH/rect.height) };
  }
  onMouseDown(e){
    this.audio.ensure(); window.focus();
    const pos=this.canvasPos(e);
    if(this.state==='title' && e.button===0){
      const hit=this.titleHitTest(pos.x,pos.y);
      if(hit>=0){ this.menuSel=hit; this.selectMenu(); }
    }
  }
  titleHitTest(x,y){
    const {CW}=Config, ys=[270,330];
    for(let i=0;i<2;i++) if(y>=ys[i]-22 && y<=ys[i]+22 && x>=CW/2-130 && x<=CW/2+130) return i;
    return -1;
  }

  /* ---- 状态切换 ---- */
  initPlayers(){ this.players=[this.makePlayer(0)]; if(this.mode===2) this.players.push(this.makePlayer(1)); for(const p of this.players){ p.lives=2; p.out=false; } }
  selectMenu(){ this.audio.select(); this.mode=this.menuSel===0?1:2; this.initPlayers(); this.score=0; this.startStage(1); }
  startStage(n){
    this.stage=n; this.map.loadLevel(n);
    this.enemies=[]; this.bullets=[]; this.powerups=[]; this.particles=[];
    this.enemiesSpawned=0; this.enemiesKilled=0; this.pendingSpawn=null; this.spawnTimer=30;
    this.freezeTimer=0; this.map.baseSteelTimer=0; this.map.setBaseBrick();
    this.stageKills={scout:0,phantom:0,striker:0,titan:0};
    for(const p of this.players){ if(!p.out){ p.x=p.index===0?144:288; p.y=432; p.dir=0; p.level=0; p.shield=180; p.cooldown=0; p.fireCooldown=0; p.slideDir=-1; p.alive=true; p.respawnTimer=0; } }
    this.state='intro'; this.introT=0; this.audio.stageStart();
  }
  checkGameOver(){ if(this.players.every(p=>p.out)){ this.gameOverDelay=40; } }

  /* ---- 更新 ---- */
  update(dt){
    this.frame++;
    this.updateParticles(dt);
    if(this.state==='playing' && !this.paused) this.updatePlaying(dt);
    else if(this.state==='intro'){ this.introT+=dt; if(this.introT>95) this.state='playing'; }
    else if(this.state==='clear'){ this.clearT+=dt; if(this.clearT>420){ this.stage++; this.startStage(this.stage); } }
    else if(this.state==='over'){ this.overT+=dt; if(this.overT>320) this.state='title'; }
    let moving=false;
    if(this.state==='playing') for(const p of this.players) if(p.alive && p.moving) moving=true;
    this.audio.engineSet(moving);
  }
  updatePlaying(dt){
    if(this.gameOverDelay>0){ this.gameOverDelay-=dt; if(this.gameOverDelay<=0){ this.state='over'; this.overT=0; this.audio.gameOver(); } return; }
    if(this.freezeTimer>0) this.freezeTimer-=dt;
    if(this.map.baseSteelTimer>0){ this.map.baseSteelTimer-=dt; if(this.map.baseSteelTimer<=0) this.map.setBaseBrick(); }
    for(const p of this.players) this.updatePlayer(p,dt);
    this.updateSpawns(dt);
    for(const e of this.enemies) this.updateEnemy(e,dt);
    for(const b of this.bullets) if(!b.dead) this.updateBullet(b,dt);
    for(const p of this.players){ if(!p.alive || p.out) continue; for(const pu of this.powerups) if(!pu.taken && this.map.rectsOverlap(p.x+2,p.y+2,Config.HIT,Config.HIT,pu.x,pu.y,36,36)) this.applyPowerup(p,pu); }
    this.enemies=this.enemies.filter(e=>e.alive);
    this.bullets=this.bullets.filter(b=>!b.dead);
    this.powerups=this.powerups.filter(p=>!p.taken);
    if(this.enemiesSpawned>=20 && this.aliveEnemies()===0 && this.state==='playing'){ this.state='clear'; this.clearT=0; }
  }
  updatePlayer(p,dt){
    if(p.out) return;
    if(p.respawnTimer>0){ p.respawnTimer-=dt; if(p.respawnTimer<=0) this.doRespawn(p); return; }
    if(!p.alive) return;
    if(p.shield>0) p.shield-=dt;
    if(p.fireCooldown>0) p.fireCooldown-=dt;
    const dir=this.readDir(p);
    p.moving=false;
    if(dir>=0){
      p.moving=true;
      if(dir===0||dir===2) this.snapAxis(p, 'x', 2.5);
      else this.snapAxis(p, 'y', 2.5);
      p.dir=dir; this.moveTank(p,dt); p.slideDir=dir; this.spawnThruster(p);
    } else {
      this.snapToGrid(p);
      if(this.map.onIce(p) && p.slideDir>=0){ p.dir=p.slideDir; if(!this.moveTank(p,dt)) p.slideDir=-1; p.moving=true; this.spawnThruster(p); }
      else p.slideDir=-1;
    }
    if(this.readFire(p) && p.fireCooldown<=0) this.shootPlayer(p);
  }
  updateEnemy(e,dt){
    if(e.flash>0) e.flash-=dt;
    if(this.freezeTimer>0) return;
    e.aiTimer-=dt;
    if(e.aiTimer<=0){ e.aiTimer=50+Math.random()*110; e.dir=this.chooseDir(e); }
    if(!this.moveTank(e,dt)) e.aiTimer=0;
    else if(e.type==='phantom' && Math.random()<0.5) this.spawnThruster(e);
    e.cooldown-=dt;
    if(e.cooldown<=0){ if(Math.random()<e.fireChance) this.enemyShoot(e); e.cooldown=e.fireRate*(0.6+Math.random()*0.8); }
  }
  chooseDir(e){
    const r=Math.random(); let tx,ty; const ap=this.alivePlayers();
    if(r<0.45 && ap.length){ tx=ap[0].x+18; ty=ap[0].y+18; }
    else if(r<0.85){ tx=234; ty=450; }
    else return (Math.random()*4)|0;
    const dx=tx-(e.x+18), dy=ty-(e.y+18);
    if(Math.abs(dx)>Math.abs(dy)) return dx>0?1:3;
    return dy>0?2:0;
  }

  /* ---- 渲染 ---- */
  render(){
    const {CW,CH}=Config, r=this.renderer, c=r.ctx;
    c.setTransform(this.scale,0,0,this.scale,0,0);
    c.fillStyle='#06050e'; c.fillRect(0,0,CW,CH);
    let sx=0,sy=0;
    if(this.shakeT>0){ sx=(Math.random()*2-1)*this.shakeMag; sy=(Math.random()*2-1)*this.shakeMag; this.shakeT-=0.016; this.shakeMag*=0.86; if(this.shakeT<=0){this.shakeT=0;this.shakeMag=0;} }
    c.translate(sx,sy);
    c.fillStyle='#0a0918'; c.fillRect(-12,-12,CW+24,CH+24);
    r.setGlow('#b829ff',8); c.strokeStyle='rgba(184,41,255,0.45)'; c.lineWidth=2; c.strokeRect(3,3,CW-6,CH-6); c.shadowBlur=0;
    r.frame=this.frame;
    r.baseImmune = this.stage <= Config.BASE_IMMUNE_STAGES;
    r.drawPanel(this);
    this.drawBattlefield();
    if(this.state==='title') r.drawTitle(this);
    else if(this.state==='intro') r.drawIntro(this);
    else if(this.state==='clear') r.drawClear(this);
    else if(this.state==='over') r.drawGameOver(this);
    else if(this.state==='playing' && this.paused) r.drawPause();
    if(this.scanlines) r.drawScanlines();
  }
  drawBattlefield(){
    const {OX,OY,BATTLE}=Config, r=this.renderer, c=r.ctx;
    c.save();
    r.setGlow('#00f3ff',8); c.strokeStyle='rgba(0,243,255,0.5)'; c.lineWidth=1.5; c.strokeRect(OX,OY,BATTLE,BATTLE); c.shadowBlur=0;
    c.beginPath(); c.rect(OX,OY,BATTLE,BATTLE); c.clip();
    const g=c.createRadialGradient(OX+BATTLE/2,OY+BATTLE/2,0, OX+BATTLE/2,OY+BATTLE/2,BATTLE*0.75);
    g.addColorStop(0,'#0b0a24'); g.addColorStop(1,'#06050e'); c.fillStyle=g; c.fillRect(OX,OY,BATTLE,BATTLE);
    r.drawGrid();
    r.drawTerrain(this.map);
    r.drawPowerups(this.powerups);
    r.drawTanks(this.players, this.enemies);
    r.drawBullets(this.bullets);
    r.drawBush(this.map);
    r.drawParticles(this.particles);
    r.drawSpawnPortal(this.pendingSpawn);
    c.restore();
  }
  loop(now){
    let dt=(now-this.last)/16.667; this.last=now;
    if(dt>2.5) dt=2.5; if(dt<0.2) dt=0.2;
    this.update(dt);
    this.render();
    requestAnimationFrame((n)=>this.loop(n));
  }
};

/* ============================ 启动 ============================ */
window.__game = new NB.Game();
})();

/* =====================================================================
 * 模块：Renderer — 全部矢量绘制（几何工具 / 地形 / 战车 / 粒子 / HUD / 界面）
 * ===================================================================== */
(function(){
"use strict";

const NB = window.NB;
const Config = NB.Config;

NB.Renderer = class Renderer {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.glowScale = 1;
    this.frame = 0;
    this.baseImmune = false;   // 老鹰基地免疫保护状态（前5关）
  }

  /* ---- 几何工具 ---- */
  setGlow(color, blur){ this.ctx.shadowColor=color; this.ctx.shadowBlur=blur*this.glowScale; }
  roundRect(x,y,w,h,r){
    const c=this.ctx;
    c.beginPath(); c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
  }
  hexPath(cx,cy,r){
    const c=this.ctx; c.beginPath();
    for(let i=0;i<6;i++){ const a=-Math.PI/2+i*Math.PI/3; const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r; i?c.lineTo(x,y):c.moveTo(x,y); }
    c.closePath();
  }
  diamond(x,y,r,color){ const c=this.ctx; c.fillStyle=color; c.beginPath(); c.moveTo(x,y-r); c.lineTo(x+r,y); c.lineTo(x,y+r); c.lineTo(x-r,y); c.closePath(); c.fill(); }
  text(t,x,y,size,color,align,glow,baseline){
    const c=this.ctx; c.save();
    c.font='700 '+size+'px "Segoe UI","Arial Black",sans-serif';
    c.textAlign=align||'left'; c.textBaseline=baseline||'top';
    if(glow){ c.shadowColor=glow; c.shadowBlur=12*this.glowScale; }
    c.fillStyle=color; c.fillText(t,x,y);
    c.restore();
  }
  glowTitle(t,x,y,size,c1,c2){
    const c=this.ctx; c.save();
    c.font='900 '+size+'px "Arial Black","Segoe UI",sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.shadowColor=c1; c.shadowBlur=28*this.glowScale;
    const g=c.createLinearGradient(x-size*3,y,x+size*3,y);
    g.addColorStop(0,c1); g.addColorStop(0.5,c2); g.addColorStop(1,c1);
    c.fillStyle=g; c.fillText(t,x,y); c.restore();
  }

  /* ---- 战车配色 ---- */
  static TANK_PAL = {
    p1:{main:'#00f3ff',dark:'#053a44',wing:'#00a8bf',core:'#c8fdff',glow:'#00f3ff'},
    p2:{main:'#fcee09',dark:'#3d3205',wing:'#c9b500',core:'#fff9c0',glow:'#fcee09'},
    scout:{main:'#ff0055',dark:'#380512',wing:'#b0003c',core:'#ffa3be',glow:'#ff0055'},
    phantom:{main:'#b829ff',dark:'#26063c',wing:'#841bd1',core:'#e8b8ff',glow:'#b829ff'},
    striker:{main:'#ff7a00',dark:'#3a1c00',wing:'#c65f00',core:'#ffd9a3',glow:'#ff7a00'},
    titan:{main:'#8fb4cc',dark:'#16202c',wing:'#54708a',core:'#e8f6ff',glow:'#5cd8ff'},
    red:{main:'#ff2040',dark:'#38080f',wing:'#cc1030',core:'#ffd0d6',glow:'#ff2040'},
    redflash:{main:'#ffffff',dark:'#333333',wing:'#cccccc',core:'#ffffff',glow:'#ffffff'},
    white:{main:'#ffffff',dark:'#2a2a2a',wing:'#bbbbbb',core:'#ffffff',glow:'#ffffff'}
  };
  static PU_COLOR = { overclock:'#fcee09', emp:'#00f3ff', stasis:'#4da6ff', aegis:'#00ff66', nano:'#b829ff', backup:'#ff0055' };
  static PU_LABEL = { overclock:'U', emp:'E', stasis:'T', aegis:'A', nano:'N', backup:'B' };
  static PU_NAMES = ['overclock','emp','stasis','aegis','nano','backup'];
  titanPalette(hp){
    if(hp===4) return Renderer.TANK_PAL.titan;
    if(hp===3) return {main:'#ffd84a',dark:'#3d3005',wing:'#c9a400',core:'#fff3c0',glow:'#ffd84a'};
    if(hp===2) return {main:'#00ff66',dark:'#063c1a',wing:'#00c24a',core:'#c0ffdc',glow:'#00ff66'};
    return Renderer.TANK_PAL.white;
  }
  tankPalette(t){
    if(t.isPlayer) return Renderer.TANK_PAL[t.index===0?'p1':'p2'];
    if(t.red && ((this.frame>>3)&1)) return Renderer.TANK_PAL.redflash;
    if(t.type==='titan') return this.titanPalette(t.hp);
    if(t.flash>0) return Renderer.TANK_PAL.white;
    return Renderer.TANK_PAL[t.type];
  }

  /* ---- 地形 ---- */
  drawGrid(){
    const {OX,OY,BATTLE,COLS,ROWS}=Config, c=this.ctx;
    const pulse=0.5+0.5*Math.sin(this.frame*0.03);
    c.strokeStyle='rgba(30,24,72,'+(0.3+0.25*pulse)+')'; c.lineWidth=1;
    for(let i=0;i<=COLS;i++){ const x=OX+i*18; c.beginPath(); c.moveTo(x,OY); c.lineTo(x,OY+BATTLE); c.stroke(); }
    for(let i=0;i<=ROWS;i++){ const y=OY+i*18; c.beginPath(); c.moveTo(OX,y); c.lineTo(OX+BATTLE,y); c.stroke(); }
  }
  drawNanoWall(x,y){
    const c=this.ctx;
    c.fillStyle='rgba(120,18,42,0.35)'; this.roundRect(x+1,y+1,16,16,4); c.fill();
    this.setGlow('#ff5a2a',6); c.strokeStyle='rgba(255,90,42,0.9)'; c.lineWidth=1.2;
    this.hexPath(x+9,y+9,5.5); c.stroke(); c.shadowBlur=0;
    c.fillStyle='rgba(255,120,60,0.8)'; c.fillRect(x+4,y+4,2,2); c.fillRect(x+13,y+12,2,2);
    c.fillStyle='rgba(255,60,30,0.35)'; c.fillRect(x+1,y+14,16,3);
  }
  drawTitanArmor(x,y){
    const c=this.ctx;
    const g=c.createLinearGradient(x,y,x+16,y+16);
    g.addColorStop(0,'#dceaf5'); g.addColorStop(0.5,'#8fa6bf'); g.addColorStop(1,'#5a6b80');
    c.fillStyle=g; this.roundRect(x+1,y+1,16,16,2); c.fill();
    c.fillStyle='rgba(255,255,255,0.5)'; c.fillRect(x+2,y+2,14,2); c.fillRect(x+2,y+2,2,14);
    c.fillStyle='rgba(30,40,56,0.5)'; c.fillRect(x+2,y+15,14,2); c.fillRect(x+15,y+2,2,14);
    this.setGlow('#5cd8ff',6); c.strokeStyle='rgba(92,216,255,0.9)'; c.lineWidth=1.2;
    this.roundRect(x+1.5,y+1.5,15,15,2); c.stroke(); c.shadowBlur=0;
    c.fillStyle='#4a5a6a'; c.fillRect(x+7,y+7,4,4);
  }
  drawPlasma(x,y){
    const c=this.ctx;
    const g=c.createLinearGradient(x,y,x,y+18);
    g.addColorStop(0,'#081a4a'); g.addColorStop(1,'#06102e'); c.fillStyle=g; c.fillRect(x,y,18,18);
    c.save(); c.globalCompositeOperation='lighter'; this.setGlow('#3aa0ff',6);
    c.strokeStyle='rgba(120,190,255,0.8)'; c.lineWidth=1;
    const seed=(x*7+y*13+((this.frame>>2)*3))%97;
    c.beginPath(); c.moveTo(x+2,y+16);
    for(let i=1;i<5;i++) c.lineTo(x+2+i*3.5, y+16-i*4+((seed+i*17)%5-2));
    c.stroke(); c.shadowBlur=0; c.restore();
  }
  drawIceStrip(x,y){
    const c=this.ctx;
    c.fillStyle='#0a2a38'; c.fillRect(x,y,18,18);
    c.save(); c.globalCompositeOperation='lighter';
    const off=(this.frame>>2)%18;
    c.strokeStyle='rgba(90,240,255,0.5)'; c.lineWidth=2;
    c.beginPath(); c.moveTo(x-4+off,y+16); c.lineTo(x+off,y); c.stroke();
    c.beginPath(); c.moveTo(x+10+off,y+16); c.lineTo(x+14+off,y); c.stroke();
    c.restore();
    c.fillStyle='rgba(0,243,255,0.12)'; c.fillRect(x,y,18,18);
  }
  drawBush(map){
    const {OX,OY,BATTLE,COLS,ROWS}=Config, c=this.ctx;
    c.fillStyle='rgba(0,255,102,0.12)';
    for(let r=0;r<ROWS;r++) for(let col=0;col<COLS;col++) if(map.bush[r][col]) c.fillRect(OX+col*18,OY+r*18,18,18);
    c.save(); c.globalCompositeOperation='lighter'; this.setGlow('#00ff66',5);
    c.strokeStyle='rgba(0,255,102,0.35)'; c.lineWidth=1;
    for(let r=0;r<ROWS;r++) for(let col=0;col<COLS;col++) if(map.bush[r][col]){ this.hexPath(OX+col*18+9,OY+r*18+9,6); c.stroke(); }
    c.shadowBlur=0; c.restore();
    c.save(); c.beginPath();
    for(let r=0;r<ROWS;r++) for(let col=0;col<COLS;col++) if(map.bush[r][col]) c.rect(OX+col*18,OY+r*18,18,18);
    c.clip();
    const sy=OY+((this.frame*1.5)%BATTLE);
    const gg=c.createLinearGradient(0,sy-10,0,sy+10);
    gg.addColorStop(0,'rgba(0,255,102,0)'); gg.addColorStop(0.5,'rgba(0,255,102,0.25)'); gg.addColorStop(1,'rgba(0,255,102,0)');
    c.fillStyle=gg; c.fillRect(OX,sy-10,BATTLE,20); c.restore();
  }
  drawEagle(){
    const {OX,OY}=Config, cx=OX+234, cy=OY+450, c=this.ctx;
    c.save(); c.globalCompositeOperation='lighter';
    for(let k=0;k<2;k++){
      const ph=(this.frame*0.05+k*0.5)%1; c.globalAlpha=1-ph; this.setGlow('#00f3ff',10);
      c.strokeStyle='rgba(0,243,255,0.8)'; c.lineWidth=1.5; c.beginPath(); c.arc(cx,cy,8+ph*22,0,7); c.stroke();
    }
    c.globalAlpha=1;
    for(let k=0;k<3;k++){
      c.save(); c.translate(cx,cy); c.rotate(this.frame*0.015*(k+1)+k); this.setGlow('#b829ff',14);
      c.fillStyle = k===0?'rgba(184,41,255,0.5)':(k===1?'rgba(0,243,255,0.4)':'rgba(252,238,9,0.5)');
      const s=15-k*4; c.beginPath(); c.moveTo(0,-s); c.lineTo(s,0); c.lineTo(0,s); c.lineTo(-s,0); c.closePath(); c.fill(); c.restore();
    }
    this.setGlow('#ffffff',16); c.fillStyle='#eaffff'; c.beginPath(); c.arc(cx,cy,4,0,7); c.fill(); c.shadowBlur=0;
    // 免疫保护护盾环（前5关）
    if(this.baseImmune){
      this.setGlow('#fcee09',12);
      c.strokeStyle='rgba(252,238,9,0.75)'; c.lineWidth=1.5;
      this.hexPath(cx,cy, 20+Math.sin(this.frame*0.06)*2); c.stroke();
      c.shadowBlur=0;
    }
    c.restore();
  }
  drawEagleRubble(){
    const {OX,OY}=Config, cx=OX+234, cy=OY+450, c=this.ctx;
    c.fillStyle='rgba(40,20,40,0.6)';
    c.fillRect(cx-12,cy-4,8,8); c.fillRect(cx+2,cy-8,6,6); c.fillRect(cx-4,cy+4,7,7);
    this.setGlow('#ff0055',8); c.fillStyle='rgba(255,0,85,0.7)'; c.fillRect(cx-6,cy-2,12,4); c.shadowBlur=0;
  }
  drawTerrain(map){
    const {OX,OY,ROWS,COLS}=Config;
    for(let r=0;r<ROWS;r++) for(let col=0;col<COLS;col++){
      const t=map.solid[r][col], x=OX+col*18, y=OY+r*18;
      if(t===1) this.drawNanoWall(x,y);
      else if(t===2){ if(map.baseSteel && map.baseSteelTimer>0 && map.baseSteelTimer<180 && ((this.frame>>3)&1) && map.baseCellSet.has(r+','+col)) this.drawNanoWall(x,y); else this.drawTitanArmor(x,y); }
      else if(t===3) this.drawPlasma(x,y);
      else if(t===4) this.drawIceStrip(x,y);
    }
    if(!map.eagleDead) this.drawEagle(); else this.drawEagleRubble();
  }

  /* ---- 战车 / 子弹 / 粒子 ---- */
  drawHoverTank(t){
    const {OX,OY,TANK}=Config, c=this.ctx;
    const cx=OX+t.x+TANK/2, cy=OY+t.y+TANK/2;
    c.save(); c.translate(cx,cy); c.rotate(t.dir*Math.PI/2);
    const pal=this.tankPalette(t);
    this.setGlow(pal.glow,9); c.fillStyle=pal.wing;
    this.roundRect(-17,-13,6,26,3); c.fill(); this.roundRect(11,-13,6,26,3); c.fill();
    const bg=c.createLinearGradient(-14,0,14,0);
    bg.addColorStop(0,pal.dark); bg.addColorStop(0.5,pal.main); bg.addColorStop(1,pal.dark);
    c.fillStyle=bg; this.roundRect(-14,-12,28,24,6); c.fill();
    this.setGlow(pal.glow,16); c.fillStyle=pal.core; c.beginPath(); c.arc(0,0,6,0,7); c.fill();
    c.strokeStyle=pal.glow; c.lineWidth=1.5; c.beginPath(); c.arc(0,0,9,this.frame*0.1,this.frame*0.1+1.2); c.stroke();
    c.fillStyle=pal.main; this.roundRect(-2.5,-21,5,12,2); c.fill(); c.shadowBlur=0;
    if(t.isPlayer && t.shield>0 && ((this.frame>>2)&1)){ this.setGlow('#00ff66',14); c.strokeStyle='#00ff66'; c.lineWidth=1.5; this.hexPath(0,0,18); c.stroke(); }
    if(!t.isPlayer && t.type==='titan'){ for(let i=0;i<t.hp;i++){ this.setGlow(pal.glow,6); c.strokeStyle=pal.glow; c.lineWidth=1.2; c.beginPath(); c.arc(0,0,13+i*3,0,7); c.stroke(); } }
    c.shadowBlur=0; c.restore();
  }
  drawTanks(players, enemies){
    const {OX,OY,TANK,DIRS}=Config, c=this.ctx;
    for(const e of enemies) if(e.alive && e.type==='phantom'){
      const pal=Renderer.TANK_PAL.phantom, [dx,dy]=DIRS[e.dir];
      c.save(); c.globalCompositeOperation='lighter';
      for(let k=1;k<=3;k++){ c.globalAlpha=0.13*(4-k)/3; c.fillStyle=pal.main; this.roundRect(OX+e.x-dx*6*k+2, OY+e.y-dy*6*k+2, TANK-4, TANK-4, 6); c.fill(); }
      c.restore();
    }
    c.globalAlpha=1;
    for(const p of players) if(p.alive && !p.out) this.drawHoverTank(p);
    for(const e of enemies) if(e.alive) this.drawHoverTank(e);
  }
  drawBullets(bullets){
    const {OX,OY}=Config, c=this.ctx;
    c.save(); c.globalCompositeOperation='lighter';
    for(const b of bullets){
      if(b.dead) continue;
      for(let i=0;i<b.trail.length;i++){
        const p=b.trail[i]; c.globalAlpha=(i+1)/b.trail.length*0.55; c.fillStyle=b.color;
        const s=b.size*(0.4+0.6*(i+1)/b.trail.length);
        c.fillRect(OX+p.x+(b.size-s)/2, OY+p.y+(b.size-s)/2, s, s);
      }
      c.globalAlpha=1; this.setGlow(b.color,12);
      c.fillStyle=b.color; c.fillRect(OX+b.x,OY+b.y,b.size,b.size);
      c.fillStyle='#ffffff'; c.fillRect(OX+b.x+b.size/2-1, OY+b.y+b.size/2-1, 2,2);
    }
    c.shadowBlur=0; c.restore(); c.globalAlpha=1;
  }
  drawPowerups(powerups){
    const {OX,OY}=Config, c=this.ctx;
    for(const pu of powerups){
      if(pu.taken || (this.frame>>4)&1) continue;
      const cx=OX+pu.x+18, cy=OY+pu.y+18, col=Renderer.PU_COLOR[pu.type];
      c.save(); c.translate(cx,cy); c.rotate(this.frame*0.02);
      this.setGlow(col,14); this.hexPath(0,0,14);
      c.fillStyle='rgba(6,5,14,0.6)'; c.fill(); c.strokeStyle=col; c.lineWidth=2; c.stroke(); c.shadowBlur=0;
      c.rotate(-this.frame*0.02);
      this.text(Renderer.PU_LABEL[pu.type], 0, 0, 13, col, 'center', col, 'middle');
      c.restore();
    }
  }
  drawParticles(particles){
    const {OX,OY}=Config, c=this.ctx;
    c.save(); c.globalCompositeOperation='lighter';
    for(const pt of particles){
      const a=Math.max(0, pt.life/pt.maxLife);
      if(pt.type==='ring'){
        const r=pt.r0+(1-a)*pt.maxR; c.globalAlpha=a; this.setGlow(pt.color,12);
        c.strokeStyle=pt.color; c.lineWidth=2; c.beginPath(); c.arc(OX+pt.x,OY+pt.y,r,0,7); c.stroke();
      } else {
        c.globalAlpha=a; c.fillStyle=pt.color; const s=pt.size*(0.5+0.5*a);
        c.fillRect(OX+pt.x-s/2, OY+pt.y-s/2, s, s);
      }
    }
    c.shadowBlur=0; c.globalAlpha=1; c.restore();
  }
  drawSpawnPortal(pendingSpawn){
    if(!pendingSpawn) return;
    const {OX,OY}=Config, cx=OX+pendingSpawn.x+18, cy=OY+pendingSpawn.y+18, c=this.ctx;
    const p=1-pendingSpawn.t/32;
    c.save(); c.globalCompositeOperation='lighter'; this.setGlow('#b829ff',16);
    c.strokeStyle='rgba(184,41,255,0.9)'; c.lineWidth=2;
    c.beginPath(); c.arc(cx,cy,10+p*10,this.frame*0.15,this.frame*0.15+2.5); c.stroke();
    c.beginPath(); c.arc(cx,cy,10+p*10,this.frame*0.15+3.14,this.frame*0.15+3.14+2.5); c.stroke();
    c.fillStyle='rgba(184,41,255,0.5)'; c.beginPath(); c.arc(cx,cy,3+p*6,0,7); c.fill(); c.restore();
  }

  /* ---- HUD / 界面 ---- */
  drawPanel(game){
    const {PANEL_X,OY,PANEL_W,BATTLE}=Config, c=this.ctx;
    const px=PANEL_X, py=OY, w=PANEL_W, h=BATTLE;
    c.save(); c.beginPath();
    c.moveTo(px+16,py); c.lineTo(px+w,py); c.lineTo(px+w,py+h-16); c.lineTo(px+w-16,py+h); c.lineTo(px,py+h); c.lineTo(px,py+16); c.closePath();
    const g=c.createLinearGradient(px,py,px+w,py+h);
    g.addColorStop(0,'rgba(18,15,44,0.95)'); g.addColorStop(1,'rgba(8,6,22,0.95)'); c.fillStyle=g; c.fill();
    this.setGlow('#00f3ff',8); c.strokeStyle='rgba(0,243,255,0.55)'; c.lineWidth=1.5; c.stroke(); c.shadowBlur=0;
    this.text('NEON BATTLE', px+10, py+12, 15, '#00f3ff', 'left', '#00f3ff');
    this.text('2077', px+w-12, py+12, 15, '#ff0055', 'right', '#ff0055');
    this.text('SECTOR '+String(game.stage).padStart(2,'0'), px+10, py+38, 13, '#fcee09', 'left', '#fcee09');
    this.text('SCORE', px+10, py+64, 11, '#8a93b0');
    this.text(String(game.score), px+10, py+80, 18, '#eaffff', 'left', '#00f3ff');
    this.text('HI '+String(game.hiscore), px+10, py+106, 11, '#8a93b0');
    this.text('HOSTILES', px+10, py+130, 11, '#8a93b0');
    const remain=Math.max(0,20-game.enemiesKilled);
    for(let i=0;i<20;i++){
      const col=i%2, row=(i/2)|0, x=px+14+col*26, y=py+148+row*19;
      if(i<remain){ this.setGlow('#ff0055',5); this.hexPath(x+6,y+6,5.5); c.fillStyle='rgba(255,0,85,0.8)'; c.fill(); }
      else { this.hexPath(x+6,y+6,5.5); c.fillStyle='rgba(60,60,90,0.3)'; c.fill(); }
    }
    c.shadowBlur=0;
    let ly=py+342;
    for(const p of game.players){
      const pc=p.index===0?'#00f3ff':'#fcee09';
      this.text(p.index===0?'P1':'P2', px+10, ly, 14, pc, 'left', pc);
      for(let k=0;k<3;k++) this.diamond(px+50+k*16, ly+8, 5, k<p.level?pc:'rgba(80,90,120,0.5)');
      if(p.level>=3) this.text('OVERDRIVE', px+104, ly, 9, '#ff0055');
      if(p.shield>0){ c.fillStyle='rgba(0,255,102,0.15)'; c.fillRect(px+10,ly+18,130,4); c.fillStyle='#00ff66'; c.fillRect(px+10,ly+18,130*Math.min(1,p.shield/600),4); }
      this.text('LIVES x'+Math.max(0,p.lives), px+10, ly+26, 11, '#c8d0e8');
      ly+=54;
    }
    this.text('C:CRT  M:SND  G:GLOW', px+10, py+h-20, 9, '#5a6480');
    c.restore();
  }
  drawTitle(game){
    const {CW,CH}=Config, c=this.ctx;
    const g=c.createLinearGradient(0,0,0,CH);
    g.addColorStop(0,'#0a0820'); g.addColorStop(1,'#06050e'); c.fillStyle=g; c.fillRect(0,0,CW,CH);
    this.glowTitle('NEON BATTLE', CW/2, 150, 58, '#00f3ff', '#b829ff');
    this.glowTitle('2077', CW/2, 220, 40, '#ff0055', '#fcee09');
    const items=['1 PLAYER','2 PLAYERS'], ys=[270,330];
    for(let i=0;i<2;i++){
      const sel=game.menuSel===i;
      this.text(items[i], CW/2, ys[i], 26, sel?'#00f3ff':'#5a6480', 'center', sel?'#00f3ff':null);
      if(sel){ c.fillStyle='#fcee09'; const tx=CW/2-140; c.beginPath(); c.moveTo(tx,ys[i]+8); c.lineTo(tx+16,ys[i]+8); c.lineTo(tx+8,ys[i]+20); c.closePath(); c.fill(); }
    }
    this.text('CLICK OR PRESS ENTER', CW/2, 380, 14, '#8a93b0', 'center');
    this.text('WASD / ARROWS MOVE · J / SPACE FIRE · P PAUSE', CW/2, 420, 12, '#5a6480', 'center');
  }
  drawIntro(game){
    const {OX,OY,BATTLE,CW}=Config, c=this.ctx;
    const close=game.introT<30; let topH,botH;
    if(close){ topH=botH=BATTLE/2; }
    else { const p=Math.min(1,(game.introT-30)/65), o=this.ease(p); topH=botH=(BATTLE/2)*(1-o); }
    c.fillStyle='#0b0a20'; c.fillRect(OX,OY,BATTLE,topH); c.fillRect(OX,OY+BATTLE-botH,BATTLE,botH);
    this.setGlow('#00f3ff',8); c.fillStyle='#00f3ff'; c.fillRect(OX,OY+topH-1,BATTLE,2); c.fillRect(OX,OY+BATTLE-botH-1,BATTLE,2); c.shadowBlur=0;
    if(game.introT<85) this.glowTitle('SECTOR '+String(game.stage).padStart(2,'0'), CW/2, OY+BATTLE/2, 40, '#00f3ff', '#b829ff');
  }
  drawClear(game){
    const {OX,OY,BATTLE,CW}=Config, c=this.ctx;
    c.fillStyle='rgba(4,3,14,0.82)'; c.fillRect(OX,OY,BATTLE,BATTLE);
    this.glowTitle('SECTOR '+String(game.stage).padStart(2,'0')+' CLEARED', CW/2, OY+60, 28, '#00ff66', '#00f3ff');
    const rows=[['SCOUT',100],['PHANTOM',200],['STRIKER',300],['TITAN',400]];
    const prog=Math.min(1,game.clearT/120); let total=0, y=OY+120;
    for(const [name,pts] of rows){
      const count=game.stageKills[name.toLowerCase()], shown=Math.floor(count*prog), sub=shown*pts; total+=sub;
      this.text(name, OX+40, y, 14, '#8a93b0'); this.text(String(shown), OX+180, y, 14, '#c8d0e8');
      this.text('x'+pts, OX+240, y, 14, '#5a6480'); this.text(String(sub), OX+340, y, 14, '#00ff66'); y+=30;
    }
    c.fillStyle='rgba(0,243,255,0.3)'; c.fillRect(OX+40,y,330,1); y+=8;
    this.text('TOTAL', OX+40, y, 14, '#fcee09'); this.text(String(total), OX+340, y, 14, '#fcee09');
    if(game.clearT>180) this.text('NEXT SECTOR INCOMING...', CW/2, OY+400, 14, '#8a93b0', 'center');
  }
  drawGameOver(game){
    const {OX,OY,BATTLE,CW}=Config, c=this.ctx;
    c.fillStyle='rgba(4,3,14,0.6)'; c.fillRect(OX,OY,BATTLE,BATTLE);
    const rise=Math.min(1,game.overT/150), y=OY+BATTLE-20-rise*240;
    if((this.frame>>3)&1){ c.fillStyle='rgba(255,0,85,0.08)'; for(let i=0;i<5;i++){ const gy=OY+Math.random()*BATTLE; c.fillRect(OX,gy,BATTLE,2+Math.random()*4); } }
    const tx=CW/2;
    this.text('SYSTEM FAILURE', tx-3, y, 34, '#ff0055', 'center');
    this.text('SYSTEM FAILURE', tx+3, y, 34, '#00f3ff', 'center');
    this.text('SYSTEM FAILURE', tx, y, 34, '#ffffff', 'center', '#ffffff');
    this.glowTitle('GAME OVER', CW/2, y+52, 28, '#ff0055', '#b829ff');
    if(game.overT>200) this.text('PRESS ENTER', CW/2, y+100, 14, '#8a93b0', 'center');
  }
  drawPause(){
    const {OX,OY,BATTLE,CW}=Config, c=this.ctx;
    c.fillStyle='rgba(4,3,14,0.7)'; c.fillRect(OX,OY,BATTLE,BATTLE);
    this.glowTitle('PAUSED', CW/2, OY+BATTLE/2, 36, '#00f3ff', '#fcee09');
  }
  drawScanlines(){
    const {CW,CH}=Config, c=this.ctx;
    c.save(); c.fillStyle='rgba(0,0,0,0.18)';
    for(let y=0;y<CH;y+=3) c.fillRect(0,y,CW,1);
    const g=c.createRadialGradient(CW/2,CH/2,CH*0.3, CW/2,CH/2,CH*0.8);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.4)'); c.fillStyle=g; c.fillRect(0,0,CW,CH); c.restore();
  }
  ease(t){ return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; }
};
})();

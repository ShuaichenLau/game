/* =====================================================================
 * 模块：AudioEngine — 赛博合成器音效（Web Audio API）
 * ===================================================================== */
(function(){
"use strict";

const NB = window.NB;

NB.AudioEngine = class AudioEngine {
  constructor(){
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
  }
  ensure(){
    if(!this.ctx){ try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
    if(this.ctx && this.ctx.state==='suspended') this.ctx.resume();
  }
  beep(freq,dur,type,vol,slide,delay){
    if(this.muted || !this.ctx) return;
    type=type||'square'; vol=(vol==null?0.16:vol); slide=slide||0; delay=delay||0;
    const t0=this.ctx.currentTime+delay;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(Math.max(20,freq),t0);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t0+dur);
    g.gain.setValueAtTime(vol,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t0); o.stop(t0+dur+0.03);
  }
  noise(dur,vol,delay,freq){
    if(this.muted || !this.ctx) return;
    vol=(vol==null?0.22:vol); delay=delay||0; freq=freq||1000;
    const t0=this.ctx.currentTime+delay;
    const len=Math.max(1,Math.floor(this.ctx.sampleRate*dur));
    const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=freq;
    const g=this.ctx.createGain(); g.gain.value=vol;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start(t0);
  }
  engineSet(on){
    if(!this.ctx || this.muted) return;
    if(!this.engineOsc){
      this.engineOsc=this.ctx.createOscillator(); this.engineOsc.type='sawtooth'; this.engineOsc.frequency.value=72;
      this.engineGain=this.ctx.createGain(); this.engineGain.gain.value=0;
      this.engineOsc.connect(this.engineGain); this.engineGain.connect(this.ctx.destination); this.engineOsc.start();
    }
    this.engineGain.gain.setTargetAtTime(on?0.035:0, this.ctx.currentTime, 0.06);
  }
  laser(){ this.beep(1400,0.12,'sawtooth',0.10,220); }
  shieldBounce(){ this.beep(2200,0.05,'square',0.10); this.noise(0.03,0.08,0,7000); }
  dataShatter(){ this.noise(0.10,0.20,0,1100); }
  subBass(){ this.beep(120,0.5,'sine',0.28,30); this.noise(0.4,0.18,0,420); }
  emp(){ this.noise(0.3,0.22,0,2000); this.beep(900,0.3,'sawtooth',0.09,120); }
  spark(){ this.beep(800,0.04,'square',0.06,300); }
  powerup(){ [660,880,1100].forEach((f,i)=>this.beep(f,0.07,'square',0.13,0,i*0.06)); }
  life(){ [523,659,784,1047].forEach((f,i)=>this.beep(f,0.09,'square',0.14,0,i*0.07)); }
  warp(){ this.beep(300,0.16,'triangle',0.14,900); }
  cursor(){ this.beep(500,0.05,'square',0.09); }
  select(){ this.beep(660,0.08,'square',0.12,0,0); this.beep(990,0.10,'square',0.12,0,0.08); }
  gameOver(){ [659,523,392,262,196].forEach((f,i)=>this.beep(f,0.28,'square',0.14,0,i*0.26)); }
  stageStart(){ [392,523,659,784,659,784,1047].forEach((f,i)=>this.beep(f,0.09,'square',0.13,0,i*0.09)); }
};
})();

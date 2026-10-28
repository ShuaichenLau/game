// ============================================================
//  audio.js — WebAudio 简易音效（无需外部资源）
// ============================================================
"use strict";

const AudioSys = {
  ctx: null,
  muted: false,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.ctx = null;
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
  },

  _tone(freq, dur, type = "square", vol = 0.06, slide = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  },

  jump() { this._tone(260, 0.18, "square", 0.05, 320); },
  coin() { this._tone(988, 0.07, "square", 0.05); setTimeout(() => this._tone(1319, 0.16, "square", 0.05), 70); },
  stomp() { this._tone(180, 0.12, "triangle", 0.08, -120); },
  bump() { this._tone(120, 0.08, "square", 0.05); },
  break_() { this._tone(300, 0.1, "sawtooth", 0.05, -200); },
  powerup() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.1, "square", 0.05), i * 60)); },
  die() { [660, 523, 392, 262].forEach((f, i) => setTimeout(() => this._tone(f, 0.14, "square", 0.06), i * 90)); },
  win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => this._tone(f, 0.12, "square", 0.05), i * 80)); },
};

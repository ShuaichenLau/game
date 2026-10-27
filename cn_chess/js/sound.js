/**
 * 音效：用 WebAudio 合成短促的走子 / 吃子 / 将军提示音，无需外部音频文件
 *
 * 每个音效是若干音符：[起始偏移(秒), 频率(Hz), 时长(秒)]
 */
(function (global) {
  'use strict';

  const TONES = {
    move: { type: 'sine', gain: 0.12, notes: [[0, 330, 0.12]] },
    capture: { type: 'sine', gain: 0.12, notes: [[0, 170, 0.12]] },
    // 将军：错开一点，避开走子/吃子声，两声上行更像“警示”
    check: { type: 'triangle', gain: 0.10, notes: [[0.14, 660, 0.10], [0.24, 990, 0.18]] },
    // 悔棋：两声下行，像倒带
    undo: { type: 'sine', gain: 0.10, notes: [[0, 440, 0.09], [0.08, 300, 0.14]] },
  };

  let audioContext = null;
  let enabled = true;

  function getContext() {
    if (!audioContext) {
      const AudioCtor = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtor) return null;
      audioContext = new AudioCtor();
    }
    return audioContext;
  }

  function playNote(ctx, start, frequency, duration, type, volume) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function play(kind) {
    const tone = TONES[kind];
    if (!enabled || !tone) return;
    try {
      const ctx = getContext();
      if (!ctx) return;
      const start = ctx.currentTime;
      for (const [offset, frequency, duration] of tone.notes) {
        playNote(ctx, start + offset, frequency, duration, tone.type, tone.gain);
      }
    } catch (err) {
      // 音效失败不影响对局
    }
  }

  function setEnabled(value) {
    enabled = !!value;
  }

  const Sound = { play, setEnabled };

  global.XQ = global.XQ || {};
  global.XQ.Sound = Sound;
})(typeof globalThis !== 'undefined' ? globalThis : window);

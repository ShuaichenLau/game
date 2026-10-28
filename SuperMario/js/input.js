// ============================================================
//  input.js — 键盘输入处理
// ============================================================
"use strict";

const Input = {
  left: false,
  right: false,
  jump: false,
  down: false,
  jumpPressed: false,   // 单次按下（用于起跳）
  jumpHeld: false,      // 持续按住（用于长跳）
  anyJump: false,

  init() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) {
        e.preventDefault();
      }
      if (k === "arrowleft" || k === "a") this.left = true;
      if (k === "arrowright" || k === "d") this.right = true;
      if (k === "arrowdown" || k === "s") this.down = true;
      if (k === "arrowup" || k === "w" || k === " ") {
        if (!this.jumpHeld) {
          this.jumpPressed = true;
          this.anyJump = true;
        }
        this.jumpHeld = true;
        this.jump = true;
      }
      if (k === "r" && window.Game) Game.restart();
      if (k === "p" && window.Game) Game.togglePause();
      if (k === "m" && window.AudioSys) AudioSys.toggleMute();
    });

    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") this.left = false;
      if (k === "arrowright" || k === "d") this.right = false;
      if (k === "arrowdown" || k === "s") this.down = false;
      if (k === "arrowup" || k === "w" || k === " ") {
        this.jumpHeld = false;
        this.jump = false;
      }
    });
  },

  // 每帧末尾调用，消费一次性状态
  endFrame() {
    this.jumpPressed = false;
    this.anyJump = false;
  },
};

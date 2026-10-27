/**
 * 对局结束弹窗：遮罩淡入 + 卡片弹性缩放 + 印章呼吸光晕
 *
 * 用法：
 *   const dialog = new ResultDialog({ onNewGame });
 *   dialog.show({ outcome: 'win' | 'lose' | 'draw', title, message });
 *   dialog.hide();
 */
(function (global) {
  'use strict';

  const SEAL_TEXT = { win: '胜', lose: '负', draw: '和' };

  class ResultDialog {
    constructor({ onNewGame, host } = {}) {
      this.onNewGame = onNewGame || (() => {});
      this.visible = false;
      this.hideTimer = null;

      this.overlay = this.build();
      (host || document.body).appendChild(this.overlay);
      this.bindEvents();
    }

    build() {
      const overlay = document.createElement('div');
      overlay.className = 'result-overlay';
      overlay.hidden = true;

      const card = document.createElement('div');
      card.className = 'result-card';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-labelledby', 'result-title');

      this.sealEl = document.createElement('div');
      this.sealEl.className = 'result-seal';
      this.sealEl.setAttribute('aria-hidden', 'true');

      this.titleEl = document.createElement('h2');
      this.titleEl.className = 'result-title';
      this.titleEl.id = 'result-title';

      this.messageEl = document.createElement('p');
      this.messageEl.className = 'result-message';

      const actions = document.createElement('div');
      actions.className = 'result-actions';

      this.newButton = document.createElement('button');
      this.newButton.type = 'button';
      this.newButton.className = 'primary';
      this.newButton.dataset.action = 'new';
      this.newButton.textContent = '再来一局';

      this.closeButton = document.createElement('button');
      this.closeButton.type = 'button';
      this.closeButton.dataset.action = 'close';
      this.closeButton.textContent = '看看棋盘';

      actions.append(this.newButton, this.closeButton);
      card.append(this.sealEl, this.titleEl, this.messageEl, actions);
      overlay.appendChild(card);
      return overlay;
    }

    bindEvents() {
      this.overlay.addEventListener('click', (event) => {
        const trigger = event.target.closest && event.target.closest('[data-action]');
        const action = trigger && trigger.dataset.action;
        if (action === 'new') return this.handleNewGame();
        if (action === 'close' || event.target === this.overlay) this.hide();
      });

      document.addEventListener('keydown', (event) => {
        if (this.visible && event.key === 'Escape') this.hide();
      });
    }

    handleNewGame() {
      this.hide();
      this.onNewGame();
    }

    show({ outcome = 'win', title = '', message = '' } = {}) {
      this.sealEl.textContent = SEAL_TEXT[outcome] || SEAL_TEXT.win;
      this.overlay.classList.toggle('is-win', outcome === 'win');
      this.overlay.classList.toggle('is-lose', outcome === 'lose');
      this.titleEl.textContent = title;
      this.messageEl.textContent = message;
      this.messageEl.hidden = !message;

      clearTimeout(this.hideTimer);
      this.overlay.hidden = false;
      this.overlay.classList.remove('is-closing', 'is-open');
      void this.overlay.offsetWidth; // 强制回流，让入场过渡每次都能重播
      this.overlay.classList.add('is-open');
      this.visible = true;

      if (this.newButton.focus) this.newButton.focus({ preventScroll: true });
    }

    hide() {
      if (!this.visible) return;
      this.visible = false;
      this.overlay.classList.remove('is-open');
      this.overlay.classList.add('is-closing');

      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        this.overlay.hidden = true;
        this.overlay.classList.remove('is-closing');
      }, 200);
    }
  }

  global.XQ = global.XQ || {};
  global.XQ.ResultDialog = ResultDialog;
})(typeof globalThis !== 'undefined' ? globalThis : window);

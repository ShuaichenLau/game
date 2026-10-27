/**
 * InputController.js — 键盘输入控制器
 *
 * 负责：
 *  - 监听 keydown 事件
 *  - 把方向键 / WASD 映射为方向向量，通过回调传递给 Game
 *  - 把空格键 / Enter 映射为"动作"回调（暂停 / 继续 / 重启）
 *
 * 不持有游戏状态；可被 destroy() 清理事件监听。
 */

/** 方向键与 WASD 映射表 */
const DIR_MAP = {
  ArrowUp:    { x:  0, y: -1 },
  ArrowDown:  { x:  0, y:  1 },
  ArrowLeft:  { x: -1, y:  0 },
  ArrowRight: { x:  1, y:  0 },
  w: { x:  0, y: -1 },
  s: { x:  0, y:  1 },
  a: { x: -1, y:  0 },
  d: { x:  1, y:  0 },
  W: { x:  0, y: -1 },
  S: { x:  0, y:  1 },
  A: { x: -1, y:  0 },
  D: { x:  1, y:  0 },
};

/** 触发动作（暂停 / 继续 / 重启）的按键集合 */
const ACTION_KEYS = new Set([' ', 'Enter']);

export class InputController {
  /**
   * @param {{ onDirection: Function, onAction: Function }} callbacks
   *   onDirection({ x, y }) — 玩家请求改变方向
   *   onAction()            — 玩家请求暂停 / 继续 / 重启
   */
  constructor({ onDirection, onAction }) {
    this._onDirection = onDirection;
    this._onAction    = onAction;
    this._handler     = this._handleKey.bind(this);

    window.addEventListener('keydown', this._handler);
  }

  /** 处理单次按键 */
  _handleKey(event) {
    const key = event.key;

    if (DIR_MAP[key]) {
      // 方向键：阻止页面滚动
      event.preventDefault();
      this._onDirection(DIR_MAP[key]);
      return;
    }

    if (ACTION_KEYS.has(key)) {
      event.preventDefault();
      this._onAction();
    }
  }

  /** 移除事件监听（页面卸载或重建控制器时调用） */
  destroy() {
    window.removeEventListener('keydown', this._handler);
  }
}

# 贪吃蛇 Snake

原生 HTML + CSS + JavaScript（ES Module）实现的浏览器版贪吃蛇游戏。零依赖、零构建，双击 `index.html` 即可运行。

---

## 功能

- 蛇移动、吃食物、身体增长
- 随机食物（避开蛇身）
- 撞墙 / 撞自身判死
- 得分显示，吃一颗 +10 分
- 最高分 localStorage 持久化
- 每 5 分自动加速（最快 60ms/格）
- 暂停 / 继续 / 重新开始
- 蛇头眼睛，随方向朝向

## 操作

| 按键 | 功能 |
| --- | --- |
| `↑` `↓` `←` `→` | 控制方向 |
| `W` `A` `S` `D` | 控制方向 |
| `Space` / `Enter` | 暂停 / 继续 / 重启 |

## 目录结构

```text
snake/
├── index.html              # 页面入口
├── style.css               # 页面样式
└── js/
    ├── main.js             # 应用入口，挂载 Game
    ├── config.js           # 全局配置常量
    ├── Game.js             # 游戏状态机与主循环
    ├── Snake.js            # 蛇的数据模型
    ├── Food.js             # 食物数据模型
    ├── Collision.js        # 碰撞检测（纯函数）
    ├── Renderer.js         # Canvas 渲染器
    └── InputController.js  # 键盘输入控制器
```

## 运行方式

直接打开：

```bash
# 双击 index.html 即可（部分浏览器对 file:// 限制 ES Module，建议用本地服务器）
```

本地服务器（推荐）：

```bash
cd snake
python -m http.server 8000
# 访问 http://localhost:8000
```

## 模块职责

| 模块 | 职责 |
| --- | --- |
| `config.js` | 所有魔法数字（画布尺寸、速度、颜色等），修改参数只需改这一个文件 |
| `Snake.js` | 蛇身节点列表、方向缓冲、`move()` / `grow()` / `reset()` |
| `Food.js` | 食物坐标、`randomize(excludeCells)` 避开蛇身随机放置 |
| `Collision.js` | `hitWall()` / `hitSelf()` / `isDead()`，纯函数，无副作用 |
| `Renderer.js` | 接收 `scene` 快照一次性绘制，不持有逻辑状态 |
| `InputController.js` | 监听 `keydown`，映射方向 / 动作回调，`destroy()` 清理监听 |
| `Game.js` | 状态机（idle / running / paused / over），协调所有子系统 |
| `main.js` | 等待 DOM 就绪，实例化 `Game`，管理旧实例销毁 |

## 游戏状态机

```text
idle ──[方向键]──→ running ──[Space]──→ paused
 ↑                    │                    │
 └────[Space/Enter]───┘◄──[Space/Enter]───┘
                      │
                  [死亡]
                      ↓
                    over ──[Space/Enter]──→ idle → running
```

## 自定义配置

编辑 `js/config.js`：

```js
CANVAS_SIZE:    480,   // 画布像素大小
GRID_COUNT:     20,    // 格子数（越大格子越小）
INITIAL_SPEED:  150,   // 初始移动间隔 ms
MIN_SPEED:      60,    // 最快间隔 ms
SPEED_STEP:     5,     // 每次加速减少的 ms
SPEED_EVERY:    5,     // 每隔多少分加速一次
SCORE_PER_FOOD: 10,    // 每颗食物的分值
```

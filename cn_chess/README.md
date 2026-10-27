# 中国象棋 · 人机对战

一个用原生 JavaScript 与 Canvas 2D 实现的网页版中国象棋。玩家可选择执红或执黑，与内置 AI 对弈；支持难度调整、悔棋、认输、棋谱记录、走子动画和合成音效。

项目零构建、零第三方依赖，双击 `index.html` 即可运行。

---

## 功能特性

- **完整中国象棋规则**：马蹩腿、象塞眼、炮翻山、过河兵横走、九宫限制、飞将、将帅照面，以及“不能送将”的合法性过滤。
- **人机对战**：AI 使用 negamax + alpha-beta 剪枝，配合子力评估、位置奖励和走法排序。
- **三档难度**：简单 / 中等 / 困难，对应搜索深度 2 / 3 / 4。
- **选择执子**：执红先手或执黑后手。
- **悔棋**：一次撤回“玩家 + 电脑”的完整回合，并播放棋子飞回动画。
- **认输 / 新游戏**：随时结束或重开对局。
- **棋谱面板**：记录每一手棋、吃子信息、每手用时，以及电脑最近一次搜索耗时。
- **视觉反馈**：选中光环、合法落点提示、上一步标记、走子残影、吃子扩散环、将军冲击波与“将军！”文字。
- **合成音效**：走子、吃子、将军、悔棋均由 Web Audio 实时合成，无外部音频文件。
- **响应式布局**：宽屏时棋谱浮在棋盘左侧，窄屏时自动移到棋盘下方。
- **结果弹窗**：胜 / 负印章、弹性入场动画、再来一局或关闭查看棋盘。
- **可调试**：浏览器控制台暴露 `window.xiangqi`，可直接操作对局状态。

---

## 快速开始

### 直接打开

双击 `cn_chess/index.html`，用现代浏览器打开即可。

### 通过本地服务器（可选）

某些浏览器对 `file://` 下的字体或音频策略较严格，也可以启动一个静态服务器：

```bash
cd cn_chess
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

无需安装任何依赖。

### 环境要求

- 支持 Canvas 2D、`requestAnimationFrame`、ES6+ 的现代浏览器。
- 音效依赖 Web Audio API；不支持时游戏逻辑仍可正常运行，只是没有声音。
- 首次发声需要一次用户交互（点击棋盘或按钮），符合浏览器自动播放策略。

---

## 操作说明

| 操作 | 方式 |
| --- | --- |
| 选中棋子 | 点击己方棋子 |
| 落子 | 点击绿色圆点（空位）或红色圆环（可吃子位置） |
| 取消选中 | 点击空白处或其他非落点区域 |
| 新游戏 | 点击「新游戏」 |
| 悔棋 | 点击「悔棋」 |
| 认输 | 点击「认输」 |
| 选择难度 | 顶部「难度」下拉框，立即生效（下一次电脑走棋使用新深度） |
| 选择执子 | 顶部「执子」下拉框，下一局生效 |
| 关闭结果弹窗 | 点击「看看棋盘」、点击遮罩或按 `Esc` |

> 电脑思考、动画播放、对局结束时，棋盘会暂时锁定，不接受落子操作。

---

## 规则实现说明

### 坐标系统

- 棋盘为 `10 行 × 9 列`。
- `row 0` 是上方黑方底线，`row 9` 是下方红方底线。
- `col 0` 在最左侧，`col 8` 在最右侧。
- 红方前进方向为 `row - 1`，黑方前进方向为 `row + 1`。
- 走法统一表示为：

```js
{ fr, fc, tr, tc } // from row/col → to row/col
```

棋子表示为：

```js
{ type: 'chariot', color: 'red' } // 空格为 null
```

### 棋子走法

| 棋子 | 走法 |
| --- | --- |
| 帅 / 将 `general` | 九宫内上下左右一步；支持飞将（同列且中间无子时可直接吃对方将） |
| 仕 / 士 `advisor` | 九宫内斜走一步 |
| 相 / 象 `elephant` | 斜走两格，不能过河，象眼被占时不可走 |
| 马 `horse` | 日字走法，马腿被占时不可走 |
| 车 `chariot` | 横竖任意距离，路径上不能有棋子 |
| 炮 `cannon` | 不吃子时同车；吃子时必须恰好翻过一个炮架 |
| 兵 / 卒 `pawn` | 向前一步；过河后可左右横走，不能后退 |

### 将军与合法性

1. 先生成“伪合法走法”（只考虑棋子自身走法）。
2. 对每个走法执行 `makeMove`，检查走后己方将/帅是否被攻击。
3. 若被攻击，则该走法非法。
4. 攻击判断覆盖兵、马、车、炮、仕、象、将，以及飞将。
5. 当前行棋方无任何合法走法时对局结束，另一方获胜。

### 初始局面

- 黑方在上，红方在下。
- 底线顺序：车、马、象、士、将、士、象、马、车。
- 炮位于两侧第二线，兵/卒位于第三线，每隔一列一个。
- 红方先行。

### 未实现的规则

当前版本没有实现：

- 长将 / 长捉判负；
- 重复局面和棋；
- 自然限着（如 60 回合无吃子）；
- 正式比赛的棋钟。

对局只会在“某一方无合法走法”或玩家认输时结束。

---

## AI 设计

### 难度

| 难度 | 配置值 | 搜索深度 | 参考耗时（Node.js 24，开局） |
| --- | --- | --- | --- |
| 简单 | `easy` | 2 层 | 约 25 ms |
| 中等 | `medium` | 3 层 | 约 140 ms |
| 困难 | `hard` | 4 层 | 约 1.5 s |

耗时随局面复杂度、设备性能和剪枝效率变化，以上仅为参考。

### 局面评估

评估函数从指定一方视角计算分值，正数表示该方占优：

```text
分值 = Σ 己方棋子价值 - Σ 对方棋子价值 + 位置奖励
```

子力基础分值：

| 棋子 | 分值 |
| --- | --- |
| 将 / 帅 | 100000 |
| 车 | 900 |
| 炮 | 450 |
| 马 | 400 |
| 象 / 相 | 200 |
| 士 / 仕 | 200 |
| 兵 / 卒 | 100 |

位置奖励：

- **兵 / 卒**：红兵到达 `row <= 2` 加 50，`row <= 4` 加 20；黑卒到达 `row >= 7` 加 50，`row >= 5` 加 20。
- **马**：越靠近中路越灵活，按到中心 `(4, 4.5)` 的曼哈顿距离计算，最高加 15。

### 搜索

- 使用 **negamax**（负极大值）形式，返回值始终站在当前行棋方视角。
- 使用 **alpha-beta 剪枝**。
- 无合法走法时返回 `-(MATE - depth)`，保证“越晚被将死越好”。
- 达到搜索深度后调用静态评估。
- 走法排序：吃子走法优先，按被吃棋子价值 + 100 排序，以提高剪枝效率。
- 根节点收集所有同分最佳走法，随机选择一个，避免每局开局完全相同。

### 已知限制

- 搜索是同步的，运行在浏览器主线程；深度 4 时界面可能短暂卡顿。
- 没有静态搜索（quiescence search），深度边界处的吃子交换可能评估不准。
- 没有开局库、置换表、迭代加深或历史启发。
- 评估函数较简单，棋力有限，适合休闲对弈。

---

## 对局流程

### 状态

控制器维护以下核心状态：

| 字段 | 含义 |
| --- | --- |
| `board` | 当前棋盘二维数组 |
| `turn` | 当前行棋方 |
| `humanColor` | 玩家执子颜色 |
| `selected` / `legalMoves` | 当前选中格与合法落点 |
| `lastMove` | 上一步走法 |
| `checkSquare` | 当前被将军的将/帅格，否则为 `null` |
| `history` | 历史快照，用于悔棋 |
| `moveLog` | 棋谱条目 |
| `thinking` | 电脑是否正在思考 |
| `gameOver` | 对局是否结束 |
| `animations` / `effects` | 当前动画与特效 |

### 一手棋的流程

1. 玩家点击落点，`commitMove` 校验并执行。
2. 保存历史快照（棋盘、行棋方、上一步、棋谱长度、思考耗时）。
3. 生成棋谱条目并更新棋盘。
4. 切换行棋方，检测是否将军。
5. 播放走子动画、吃子特效、将军特效与音效。
6. 若对方无合法走法，结束对局；否则轮到对方。
7. 若轮到电脑，延迟 320 ms 后开始搜索。

### 悔棋

- 从历史中向前寻找最近一次“轮到玩家”的快照。
- 回退到该快照，同时撤销玩家这一步和电脑的应手。
- 恢复棋盘、行棋方、上一步、棋谱长度和电脑思考耗时。
- 为被撤销的棋子生成“飞回”动画，多个棋子按 80 ms 间隔错开。
- 电脑思考中、动画播放中、没有历史，或找不到可回退的玩家回合时，悔棋无效。

### 结束与弹窗

- 无合法走法：根据胜方显示“你赢了！”或“你输了”。
- 玩家认输：直接判负。
- 对局结束后延迟 480 ms 再弹窗，先让最后一步动画和将军特效播完。
- 弹窗支持 `win` / `lose` / `draw` 三种印章样式，但当前规则不会产生和棋。
- 弹窗关闭后棋盘仍可查看，但不会再接受落子；点击「悔棋」可以撤销历史并恢复对局。

### 时间常量

| 常量 | 时长 | 用途 |
| --- | --- | --- |
| `moveAnimation` | 280 ms | 走子动画 |
| `undoAnimation` | 260 ms | 悔棋飞回动画 |
| `undoStagger` | 80 ms | 多子回退错开 |
| `captureEffect` | 420 ms | 吃子扩散环 |
| `checkEffect` | 1000 ms | 将军冲击波与文字 |
| `resultDelay` | 480 ms | 结束后延迟弹窗 |
| `aiThinkDelay` | 320 ms | 电脑“思考”延迟 |

---

## 界面与交互

### 布局

- 主卡片最大宽度 600 px，居中显示。
- 棋盘 Canvas 内部分辨率固定为 `624 × 688`，CSS 最大宽度 560 px，自适应缩放。
- 棋谱面板宽 236 px，宽屏时绝对定位在棋盘左侧。
- 视口宽度 ≤ 1120 px 时，棋谱改为棋盘下方的独立面板，最大高度 210 px，内部滚动。
- 结果弹窗使用固定遮罩层，卡片带弹性缩放和印章呼吸光晕。
- 支持 `prefers-reduced-motion`，关闭过渡和印章动画。

### 棋谱面板

每条记录格式类似：

```text
红 马 (9,1)→(7,2) 吃卒     120ms
```

- 红方记录为暖红色，黑方为米白色。
- 右侧显示该手用时。
- 面板顶部显示总手数和电脑最近一次搜索耗时。
- 电脑思考时耗时文字闪烁；搜索完成后数值弹一下。
- 新记录自动滚动到底部。

### 视觉反馈

| 效果 | 说明 |
| --- | --- |
| 选中 | 金色呼吸光环 + 内圈亮环 |
| 空位落点 | 绿色实心圆点 |
| 可吃子落点 | 红色圆环 |
| 上一步 | 起点和终点淡黄色圆盘 |
| 走子 | 缓出移动 + 残影拖尾 + 中段轻微放大 |
| 吃子 | 红色圆环向外扩散消散 |
| 将军 | 双层冲击波 + 上浮“将军！”文字 |
| 被将军 | 将/帅格红色脉冲光环，持续到解除将军 |

### 音效

使用 Web Audio 振荡器合成，不加载音频文件：

| 音效 | 波形 | 音符 |
| --- | --- | --- |
| 走子 | sine | 330 Hz / 0.12 s |
| 吃子 | sine | 170 Hz / 0.12 s |
| 将军 | triangle | 660 Hz + 990 Hz 上行 |
| 悔棋 | sine | 440 → 300 Hz 下行 |

音效失败会被捕获，不影响对局。

---

## 渲染流程

`BoardView.draw(scene)` 按以下顺序绘制：

1. 木质渐变背景与外框
2. 棋盘网格（中间列在楚河汉界处断开）
3. “楚河 / 汉界”文字
4. 上下九宫斜线
5. 炮位与兵位的传统角标
6. 上一步标记
7. 选中棋子的合法落点
8. 所有静止棋子
9. 被将军的将/帅高亮
10. 选中光环
11. 走子 / 悔棋动画
12. 吃子 / 将军特效

细节：

- 内部坐标通过 `margin + index × cell` 计算，默认 `margin = 56`、`cell = 64`。
- 屏幕坐标先按 `getBoundingClientRect()` 换算到画布坐标，再四舍五入到最近交叉点。
- 点击位置与交叉点距离超过半个格宽时视为无效点击。
- 正在飞行的棋子不会在终点重复绘制，避免重影。
- 使用 `requestAnimationFrame` 按需续帧：只有选中、将军、动画或特效存在时才持续重绘。

---

## 文件结构

```text
cn_chess/
├── index.html            # 页面结构、控制区、棋盘与脚本加载顺序
├── game.js               # Node 兼容入口，聚合导出常量 / 规则 / AI
├── css/
│   └── style.css         # 布局、棋谱面板、弹窗与动画样式
└── js/
    ├── constants.js      # 棋盘尺寸、棋子、分值、难度、几何常量
    ├── rules.js          # 走法生成、将军判断、合法走法
    ├── ai.js             # 评估函数、走法排序、negamax + alpha-beta
    ├── sound.js          # Web Audio 合成音效
    ├── renderer.js       # Canvas 棋盘、棋子、动画与特效
    ├── dialog.js         # 对局结果弹窗
    ├── game.js           # 对局控制器：回合、历史、悔棋、AI 调度
    └── main.js           # DOM 装配与启动入口
```

脚本按依赖顺序加载：

```text
constants → rules → ai → sound → dialog → renderer → game → main
```

> 目录中还包含少量与当前玩法无关的历史资源文件，不影响游戏运行；上面的结构只列出与游戏逻辑相关的文件。

---

## 模块与 API

所有浏览器端模块挂在 `window.XQ` 命名空间下。

### `XQ.Constants`

| 成员 | 说明 |
| --- | --- |
| `RED` / `BLACK` | 颜色常量 |
| `ROWS` / `COLS` | `10` / `9` |
| `PIECE` | 棋子类型枚举 |
| `CHARS` | 红黑双方的棋子汉字 |
| `PIECE_VALUES` | 子力分值 |
| `MATE` | 将死分值 |
| `DIFFICULTY` | 难度与搜索深度 |
| `BOARD_METRICS` | 边距、格宽及推导出的画布尺寸 |

### `XQ.Rules`

纯函数模块，不依赖 DOM：

```js
initBoard()                       // 初始棋盘
cloneBoard(board)                 // 浅拷贝棋盘
makeMove(board, move)             // 返回走子后的新棋盘
findKing(board, color)            // 找将/帅
generatePseudoMoves(board, color) // 伪合法走法
getLegalMoves(board, color)       // 合法走法
getLegalMovesFrom(board, color, r, c)
isLegalMove(board, move, color)
isInCheck(board, color)
isSquareAttacked(board, r, c, byColor)
```

### `XQ.AI`

```js
evaluateFor(board, color)         // 从 color 视角评估
orderMoves(moves, board)          // 吃子优先排序
negamax(board, depth, alpha, beta, color)
getBestMove(board, color, depth)  // 返回最佳走法或 null
```

### `XQ.BoardView`

```js
new BoardView(canvas)
view.draw(scene)                  // 绘制一帧
view.pointToCell(clientX, clientY) // 屏幕坐标 → {r, c} 或 null
```

`scene` 包含 `board`、`selected`、`legalMoves`、`lastMove`、`check`、`animations`、`effects`、`now`。

### `XQ.GameController`

```js
new GameController({ view, statusEl, logEl, difficultyEl, sideEl, dialog, thinkTimeEl, moveCountEl })
game.newGame()
game.undo()
game.resign()
game.handleBoardClick(event)
game.render()
```

### `XQ.ResultDialog`

```js
new ResultDialog({ onNewGame })
dialog.show({ outcome, title, message })
dialog.hide()
```

### `XQ.Sound`

```js
Sound.play('move' | 'capture' | 'check' | 'undo')
Sound.setEnabled(false)
```

### Node.js 兼容

`constants.js`、`rules.js`、`ai.js` 同时支持 CommonJS 导出；根目录 `game.js` 聚合三者：

```js
const XQ = require('./game.js');

const board = XQ.initBoard();
console.log(XQ.getLegalMoves(board, 'red').length); // 44

const move = XQ.getBestMove(board, 'red', 3);
console.log(move);
```

渲染、音效、弹窗和控制器依赖浏览器环境，不能在 Node 中直接使用。

---

## 开发与调试

### 控制台入口

页面加载后可通过 `window.xiangqi` 访问控制器：

```js
xiangqi.board                 // 当前棋盘
xiangqi.turn                  // 当前行棋方
xiangqi.undo()                // 悔棋
xiangqi.newGame()             // 新游戏
xiangqi.resign()              // 认输
XQ.Rules.getLegalMoves(xiangqi.board, xiangqi.turn) // 当前合法走法
```

### 调整难度

修改 `js/constants.js`：

```js
const DIFFICULTY = {
  easy:   { label: '简单', depth: 2 },
  medium: { label: '中等', depth: 3 },
  hard:   { label: '困难', depth: 4 },
};
```

深度每增加 1 层，搜索量会显著上升。继续加深前建议先引入静态搜索、置换表或 Web Worker。

### 调整配色与尺寸

- 棋盘配色：`js/renderer.js` 中的 `PALETTE`。
- 页面配色与卡片布局：`css/style.css` 顶部的 CSS 变量和 `.card`。
- 棋盘几何：`js/constants.js` 中的 `BOARD_METRICS`；`BoardView` 会根据常量重新设置 Canvas 内部分辨率。

### 改造评估函数

在 `js/ai.js` 的 `positionBonus` 中加入更多位置项，或调整 `PIECE_VALUES`。修改后建议用固定局面回归测试，避免出现明显的送子行为。

### 调试建议

- 用 `XQ.Rules.getLegalMoves` 检查规则是否符合预期。
- 用 `XQ.AI.evaluateFor` 对比走子前后的分值变化。
- 在 `commitMove` 前后打印棋盘，定位非法走法。
- 注意 `makeMove` 返回新棋盘，不修改原棋盘。

---

## 性能说明

- 棋盘只有 90 个交叉点，规则计算和渲染开销都很小。
- 主要耗时来自 AI 搜索，复杂度随深度指数增长。
- 历史快照每步保存一份棋盘引用；由于 `makeMove` 采用不可变更新，旧棋盘不会被后续走子修改，内存占用很小。
- 渲染按需续帧，对局结束且无动画时不会持续占用 `requestAnimationFrame`。

---

## 已知限制

- AI 同步搜索，深度较高时会阻塞界面。
- 没有和棋、长将、重复局面等竞赛规则。
- 没有棋谱导入 / 导出、存档、复盘、提示、让子、双人对战。
- 没有移动端触控专用布局，窄屏依赖页面缩放。
- Canvas 使用固定内部分辨率，未按 `devicePixelRatio` 做高清适配。
- 没有自动化测试；规则与 AI 目前依靠手工验证和 Node 脚本检查。

---

## 兼容性

- Chrome / Edge / Firefox / Safari 的较新版本均可运行。
- `file://` 直接打开即可；若浏览器限制本地资源，可改用本地静态服务器。
- 音效不可用时不影响棋局逻辑。

---

## 许可

仓库内未附带许可证文件；如需对外分发，请先补充 LICENSE。

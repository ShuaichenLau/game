# 中国象棋 · 人机对战（Chrome 扩展）

原「中国象棋 · 人机对战」网页小游戏打包成的 Chrome 浏览器插件（Manifest V3）。

## 安装方法

1. 解压 `xiangqi-extension.zip`（或直接使用本项目根目录）。
2. 打开 Chrome，地址栏输入 `chrome://extensions` 回车。
3. 打开右上角的 **「开发者模式」** 开关。
4. 点击 **「加载已解压的扩展程序」**，选择包含 `manifest.json` 的目录（即项目根目录）。
5. 工具栏出现「中国象棋」图标，点击即可在新标签页开始对局。

## 文件结构

```
manifest.json         扩展清单（MV3）
background.js         后台 Service Worker：点击图标 → 新标签页打开游戏
index.html            游戏页面
css/style.css         样式
js/*.js               游戏逻辑（常量/规则/AI/音效/弹窗/渲染/流程/启动）
icons/                扩展图标（16/48/128）
tools/make_icons.py   图标生成脚本（纯标准库，可重新生成）
```

> 说明：根目录 `game.js` 是 Node 兼容入口，仅用于本地脚本/测试，扩展运行不依赖它，
> 因此未打包进 zip。

## 重新生成图标

```bash
python tools/make_icons.py
```

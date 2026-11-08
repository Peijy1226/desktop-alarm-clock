# 贡献指南

## 开发环境

- Node.js 18+
- Python 3.9+（仅用于生成图标和同步桌面版页面，可选）

## 本地运行

```bash
cd desktop
npm install
npm start
```

## 项目约定

### 单文件优先

网页版 `index.html` 是**单文件**——HTML、CSS、JS、音频合成引擎全在里面。

改的时候保持在单文件内，不拆 CSS/JS 到独立文件。理由：

- 双击即用，不需要起本地服务器
- 发给别人只需一个文件
- 桌面版也复用它（通过 `make_desktop_app.py` 注入桌面适配层）

### 桌面版页面是生成物

`desktop/app/index.html` **不要直接改**。它由 `desktop/build/make_desktop_app.py` 从根目录 `index.html` 生成。

改完网页版后必须同步：

```bash
cd desktop
python build/make_desktop_app.py
```

### 字型改动

改字型定义（`ClockFace.STYLES`）时注意：

- 每种字型有 `font`、`weight`、`track`、`glow`
- 尺寸由 `measureCapHeight()` 自动归一化，不用手写 font-size
- 新增字型后跑一遍验证，确保 9 种字型渲染高度一致

### 性能

改渲染逻辑时注意：

- 主循环 1 秒一次，不要加更密的定时器
- 窗口不可见时不碰 DOM
- 文本没变就不要重写 innerHTML

## 提交

```
feat: 新增整点报时自定义音量
fix: 修复黑屏退出后窗口尺寸不正确
docs: 补充构建说明
refactor: 简化时间轴换算
```

## 打包

```bash
cd desktop

# 绿色版
npm run dist

# 安装程序
npm run dist:installer

# 两个都打
npm run dist:all
```

Windows 上首次打包若报 `winCodeSign` 解压失败（符号链接权限问题），先设环境变量跳过签名：

```bash
set CSC_IDENTITY_AUTO_DISCOVERY=false
```

或 PowerShell：

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
```

## 报告问题

提 issue 时请附上：

- Windows 版本
- 程序版本（关于页或文件名）
- 复现步骤
- 截图（如果涉及界面）

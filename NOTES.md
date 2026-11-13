# alarm-clock

纯本地桌面闹钟。网页版 + Electron 桌面版。

## 文件地图

| 路径 | 说明 |
|---|---|
| `index.html` | 网页版，单文件，含全部逻辑（2953 行） |
| `desktop/main.js` | Electron 主进程（488 行） |
| `desktop/preload.js` | 预加载脚本，暴露受限 API |
| `desktop/app/index.html` | **生成物**，由 `build/make_desktop_app.py` 从根 `index.html` 转出 |
| `desktop/build/make_desktop_app.py` | 网页版 → 桌面版转换脚本 |
| `desktop/build/make_icon.py` | 图标生成脚本（Pillow） |
| `desktop/package.json` | 打包配置，双目标 nsis + portable |

## 改代码的正确姿势

**改 `index.html`（根目录），不要改 `desktop/app/index.html`。**

改完必须同步：

```bash
cd desktop
python build/make_desktop_app.py
```

然后重新打包：

```bash
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"   # PowerShell
./node_modules/.bin/electron-builder --win nsis portable --x64 -c.directories.output=dist
```

产物在 `desktop/dist/`，复制到 `releases/`。

## 已完成的功能

- 多闹钟，6 种重复规则（单次/每天/指定日期/工作日/节假日/自定义星期）
- 17 个实时合成铃声（Web Audio，无音频文件）+ 自定义音频上传
- 9 种数字字型，canvas 像素扫描归一化到同一视觉高度
- 七段数码管 / 点阵屏用 SVG 现场绘制
- 北京时间 / 设备时间切换
- 整点报时（24 时点 + 独立音量）
- 黑屏倒计时：全屏铺满、宽度自适应、12s 自动调暗、6s 隐藏按钮、Esc 单次退出
- 托盘常驻、开机自启、阻止休眠、响铃置顶 + 通知
- 关闭 GPU 加速（挡 NVIDIA/Steam overlay）
- 无滚动条（`::-webkit-scrollbar{width:0}`）

## 踩过的坑（重要）

### 1. 关 GPU 加速 → setFullScreen 失效

为挡 NVIDIA overlay 调了 `app.disableHardwareAcceleration()`。副作用：`setFullScreen(true)` **只改状态标志，窗口实际尺寸不变**。

所以黑屏不用系统全屏，改成 `setBounds(display.bounds)` 直接铺屏 + `screen-saver` 层级。

### 2. background-clip:text + SVG

主时钟用 `background-clip:text; color:transparent` 做渐变。SVG 里 `fill="currentColor"` 会继承 transparent → 七段数码管/点阵屏**完全看不见**。

修法：SVG 字型显式指定 `fill`，不依赖 `currentColor`。

### 3. 字体高度测量

`measureText().actualBoundingBoxAscent` 对手写体不准（Gabriola 量到 71px，实际渲染 47px）。

改成 **canvas 实际绘制 + 逐行扫描像素**。Gabriola 是 OpenType 变体字体，canvas 与 DOM 仍不一致，直接换成 Segoe Script。

### 4. 全屏退出后窗口变大

`setFullScreen(false)` 是异步的，紧接着 `setBounds` 会被系统还原动作覆盖。且不要在 fullscreen 状态下 `setBounds`——会破坏 Windows 记录的原尺寸。

修法：进入时先 `setBounds` 挪屏，再进全屏；退出时等 `leave-full-screen` 事件 + 多次校验。

### 5. 黑屏要按两次 Esc

桌面版同时开了 HTML fullscreen（`documentElement.requestFullscreen`）和主进程 `setFullScreen`。第一次 Esc 被 Chromium 截胡退出 HTML 全屏。

修法：桌面版不调 HTML fullscreen API（判断 `window.desktop.isDesktop`）。

### 6. 黑屏字型溢出

点阵屏和手写体字幅天生宽，固定字号会超出屏幕。

修法：`Night.autoFit()`—先按满配渲染一帧，量 `scrollWidth`，超屏宽 92% 就按比例缩回。

### 7. 文件被占用无法删除

Windows 上 Electron 打包后 `app.asar` 会被进程锁定。清理中间产物时如果遇到 `Error during a trash operation`，重启进程或重启系统后再删，或直接在 `.gitignore` 里忽略。

### 8. 自定义音频不能再存 localStorage（v1.1）

原来 1.5MB 以下把音频转成 base64 塞 localStorage。上限提到 100MB 后这条路彻底走不通：

- localStorage 配额约 5MB，50MB 的 base64 字符串（约 67MB）直接写失败
- 即使写得进，主线程要一次性处理几十 MB 字符串，界面会冻住

改成 **Blob 存 IndexedDB**，localStorage 只留 `{name, size, type}` 索引。播放时 `URL.createObjectURL` 生成临时地址。

配套三个东西：

- `migrateLegacyTones()` —— 启动时把旧版 dataUrl 搬进 IndexedDB，然后清掉 localStorage 里的大字符串
- `probeDecodable()` —— 上传后立刻试着解码，解不了当场提示（Chromium 不支持 WMA / APE / AIFF / AMR）
- `playCustom` 的 error 兜底 —— 万一解码失败回落 `digital_beep`，不能到点没声音

实测：95.9MB WAV 一秒入库，IndexedDB 存满 95.9MB，试听 `playing` 事件正常。

### 9. electron-builder winCodeSign 解压失败

报 `Cannot create symbolic link ... 客户端没有所需的特权`。

修法：设 `CSC_IDENTITY_AUTO_DISCOVERY=false` 跳过签名。本项目未签名，Windows 会提示"未知发布者"。

## 开发环境

- Node.js 18+
- Python 3.9+（可选，仅图标/同步脚本用）
- Pillow（可选，`pip install pillow`）

```bash
cd desktop
npm install
npm start
```

## 待办

- [ ] GitHub Actions 自动构建发布
- [ ] 截图补充到 README
- [ ] 节假日表支持自动更新（当前手写 2026 年）
- [ ] 代码签名（需要证书）

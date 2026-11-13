# 备忘

怕自己过两周就忘了，随手记点东西。写得乱，凑合看。

## 目录

```
index.html            网页版，全部逻辑都在这一个文件里
desktop/main.js       主进程，488 行
desktop/preload.js    给渲染进程开的口子
desktop/app/          生成的，别手改
desktop/build/        图标 + 网页版转桌面版
```

改代码只改根目录那个 `index.html`。改完要

```
cd desktop && python build/make_desktop_app.py
```

不然桌面版还是旧的。这个我踩过好几次了，改完忘了同步，打包出来一看还是老界面，还以为是没保存。

打包：

```powershell
cd desktop
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
npx electron-builder --win nsis portable --x64
```

不设那个环境变量会报错，说是创建符号链接没权限（`Cannot create symbolic link ... 客户端没有所需的特权`）。反正也没打算签名，跳过就跳过了。没签名的坏处是 Windows 会弹"未知发布者"。

## 几个坑

### 关掉 GPU 加速之后，全屏就废了

一开始是为了挡 NVIDIA 那个 overlay。游戏加加的 FPS 数字老是盖在闹钟上面，看着烦。

结果 `app.disableHardwareAcceleration()` 一开，`setFullScreen(true)` 就只改状态不改尺寸了，窗口纹丝不动。查了半天以为是自己调用顺序不对，又怀疑是 Electron 版本问题，最后才想到可能是因为没有 GPU 上下文，全屏那套走不通。

后来不用系统全屏了，直接 `setBounds(display.bounds)` 把窗口拉到整屏，层级设 `screen-saver`。反正视觉上没区别，用户也看不出来。

顺便说，这个方法有个额外好处：不用处理全屏状态机，省一堆事。

### background-clip 和 SVG 打架

主时钟那个渐变字是用 `background-clip:text` 加 `color:transparent` 做的。

后来加七段数码管，SVG 里写了 `fill="currentColor"`，结果整个字型**完全不见**。

一开始以为路径写错了，把 path 单独拿出来渲染是好的。又怀疑 viewBox 不对。折腾了快一小时，偶然把 `currentColor` 换成写死的红色，一下就出来了。

才反应过来 `currentColor` 继承的就是那个 `transparent`。

所以现在 SVG 字型全部写死 fill，一个都不留 currentColor。

### 量字体高度千万别用 measureText

`actualBoundingBoxAscent` 对手写体完全不准。Gabriola 量出来 71px，实际画到屏幕上只有 47px，差了三分之一。

按量出来的算字号，手写体小一大圈，站在旁边一眼就能看出来不对。

改成真的画一遍再扫像素：

```
画到 canvas → 逐行扫 alpha → 第一行到最后一行的高度
```

这个准。但 Gabriola 还有别的问题，它是 OpenType 变体字体，canvas 里画出来的和 DOM 里渲染的根本不是同一个字形。这个没法修，直接换成 Segoe Script 了。少一个字体，但至少九种的高度能对齐。

### 退出全屏窗口会变大

`setFullScreen(false)` 是异步的。你在它后面马上 `setBounds`，系统自己那个"恢复到全屏前尺寸"的动作会把你覆盖掉，窗口就变成最大化了。

还有个坑：别在 fullscreen 状态下设 bounds，会把 Windows 记着的原尺寸冲掉，之后就再也恢复不回去。

现在是等 `leave-full-screen` 事件，然后设一次，再加上一个校验兜底。绕是绕了点，但能跑。

### 黑屏要按两次 Esc

桌面版里 HTML fullscreen 和主进程的 `setFullScreen` 同时在跑，第一下 Esc 被 Chromium 拿去退 HTML 全屏了，得再按一次才退得出来。

判断 `window.desktop.isDesktop`，桌面版就不调 HTML 那套。

### 点阵屏和手写体会超出屏幕

这两个字幅天生比数字宽，按正常字号铺满屏幕，右边会被切掉一截。

加了个 autoFit：先按满配渲染一帧（反正这时候黑屏没人看见），量 `scrollWidth`，超过屏幕 92% 就按比例缩。

92% 这个数是试出来的。100% 有时候边缘会压线，95% 还是有点紧，92% 看着舒服。

### 打出来的包删不掉

Electron 跑起来之后 `app.asar` 是被锁住的。清理 dist 时老报 `Error during a trash operation`。

重启进程没用，必须重启电脑。后来干脆全加 .gitignore 了，眼不见为净，反正也不占仓库。

### 100MB 音频差点把 localStorage 撑爆

原来限制 1.5MB，直接转 base64 塞 localStorage。

把上限提到 100MB 的时候才想起来，localStorage 一共才 5MB 配额。而且是字符串，100MB 在主线程里处理，界面直接卡死。

改成 IndexedDB 了，原生就能存 Blob，不用转码。localStorage 只留个名字和大小当索引。

播放的时候 `URL.createObjectURL` 生成临时地址给 `<audio>`。用完记得 revoke，不然内存里会攒一堆。

顺手加了三个东西：

- `migrateLegacyTones()` 开机自动把旧版那些 base64 搬过去，不然老用户升级上来铃声全没了
- `probeDecodable()` 上传完立刻试着解一下码。FLAC 在老 Chromium 上不行，APE、WMA 这些根本别想。解不了当场告诉用户，别等到闹钟响了才发现没声音
- `playCustom` 里加了个 error 兜底，解不了就回落到 `digital_beep`。宁可响个不好听的，也不能不响

测过 95MB 的 WAV，一秒入库。

### 那个 CSP 警告

控制台一直有个 "Electron Security Warning (Insecure Content-Security-Policy)"。

查了，说是没设 CSP。想加但网页版要单独打开，加了之后有些内联的 SVG data URI 会被拦。

就这么放着了。本地程序不联网，风险不大。

## 想改但没改

- 节假日表现在是手写的 2026 年，明年得补。本来想接个接口自动拉，但那跟"不联网"这个卖点矛盾，就算了。做个本地 json 也行，懒得弄。
- 想加窗口透明，让闹钟能浮在桌面上。试了一下，关掉 GPU 加速之后 transparent 好像不管用，就放弃了。
- 代码签名太贵，一年好几百刀，一个免费小工具不值当。
- 试过用 CSS 的 `font-variant-numeric` 统一数字宽度，对系统字体管用，对 SVG 那两种没用。两种方案混着更乱，还是回到扫像素。
- 想加个"闹钟声音渐强"，响了之后音量慢慢升上来。但 Web Audio 那个 masterGain 和自定义音频的 `<audio>` 是两套东西，得分别处理，嫌麻烦先没做。

## 一堆魔数

代码里到处是 0.92、180 这种数字，隔久了肯定看不懂，记一下：

- **0.92** 黑屏 autoFit 的阈值，超过屏宽 92% 就开始缩
- **180** 音频调度器的前瞻窗口，毫秒。太小学 setTimeout 会抖，太大循环排不满
- **0.8** 调度时往前看多远，秒
- **12** 秒自动调暗
- **6** 秒藏按钮
- **2** 秒到点判定容差，被挂起过就按实际间隔放宽，最多 3 分钟
- **0.72em** SVG 字型的尺寸系数，对应文本数字的 cap height

## 环境

Node 18 以上。Python 只是跑图标和同步脚本用的，不装也能开发，只是改不了图标。

```bash
cd desktop
npm install
npm start
```

## 还没弄的

- 节假日表更新（前面说过）
- 代码签名
- 音效渐强

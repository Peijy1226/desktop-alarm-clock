# 桌面闹钟

[![release](https://img.shields.io/github/v/release/Peijy1226/desktop-alarm-clock)](https://github.com/Peijy1226/desktop-alarm-clock/releases)
[![license](https://img.shields.io/github/license/Peijy1226/desktop-alarm-clock)](LICENSE)

**中文** · [English](README.en.md)

一个不联网的 Windows 桌面闹钟。关掉窗口还在后台待命，到点强制弹到最前。

**[在线试用网页版 →](https://peijy1226.github.io/desktop-alarm-clock/)**（不用装任何东西，浏览器里直接跑）

![演示](docs/demo.gif)

## 装一个

去 [Releases](https://github.com/Peijy1226/desktop-alarm-clock/releases) 下载后双击：

- `DesktopAlarmClock-x.x.x-setup.exe` —— 装到系统里，带开始菜单和桌面快捷方式
- `DesktopAlarmClock-x.x.x-portable.exe` —— 免安装，放哪都能跑

两个都是单文件，不用装运行库。

不想装软件的话，[网页版在这](https://peijy1226.github.io/desktop-alarm-clock/)，用浏览器直接开。或者把仓库里的 `index.html` 下载下来双击也行。

## 三件做得比较认真的事

**1. 黑屏倒计时**

晚上想知道还能睡多久，开电脑看时间太刺眼。这个模式铺满全屏纯黑，只留红色数字，12 秒不动自动再暗一档。放床头看刚好。

数字随屏幕宽度自适应，点左上角能就地换字型。`Esc` 退出，窗口尺寸原样还回来。

**2. 九种数字字型，大小是真的对齐的**

现代无衬线、科幻 HUD、终端等宽、极简细体、古典衬线、手写艺术、冲击粗黑，外加两种手绘的：七段数码管和点阵屏。

换字型时常见问题是数字忽大忽小——因为不同字体的数字天生高矮不一（Impact 矮，数码管占满全高）。这里用 canvas 把每种字体的数字真画一遍、逐行扫像素量出高度，再反算字号，实测九种渲染高度差不超过 2 像素。

七段数码管和点阵屏没有用字体，是 SVG 现场画的，所以任何电脑上都是同一个样子。

**3. 铃声：17 个内置是算出来的，也可以放自己的歌**

内置 17 个全部用 Web Audio 现场合成——振荡器加包络，该清脆的清脆，该闷的闷。程序里不带一个 mp3，所以装完就 76MB（几乎全被 Electron 占着）。

想用自己喜欢的歌，直接拖进来。**单曲上限 100MB**，无损 FLAC、高解析母带都塞得下。MP3 / WAV / FLAC / AAC / M4A / OGG / OPUS 都认，不认识的也照收——存得下，只是播放时会退回默认提示音，当场就提示你。

音频以二进制存本地数据库，不转码、不压缩，95MB 的文件一秒入库，播放不带卡的。

## 其他

闹钟支持单次、每天、指定日期、工作日、法定节假日、自选星期六种重复方式。重复闹钟临时不想响，可以只跳过这一次，不用关掉再打开。

桌面版还管着几件事：关窗口收到托盘、开机自动启、有闹钟时不让电脑睡、到点弹到最前并闪任务栏。数据只落在本机 `%APPDATA%` 里，一个字节都不往外发。

## 一个刻意的取舍

程序**关掉了 GPU 加速**。

NVIDIA、Steam、Discord 那些 FPS 浮层不是普通窗口，是把内容直接画进显卡渲染管线里的，任何窗口置顶都压不住它。本程序不创建 GPU 画面，它们就无处可画——代价是界面改由 CPU 合成。

实测代价可以忽略：窗口开着时占单核 1.7% 左右，最小化后约 2%，内存约 400MB。这个内存是 Electron 的底价，跟 GPU 无关。

## 从源码跑

```bash
cd desktop
npm install
npm start
```

打包（需要 PowerShell）：

```powershell
cd desktop
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win nsis portable --x64
```

产物在 `desktop/release/`。

## 代码在哪

```
index.html            网页版全部内容，单文件
desktop/main.js       Electron 主进程：窗口、托盘、通知、休眠
desktop/preload.js    渲染进程能调的受限接口
desktop/app/          桌面版页面（生成物，别手改）
desktop/build/        图标生成 + 网页版转桌面版
```

`desktop/app/index.html` 是从根目录 `index.html` 转出来的，改了网页版记得同步：

```bash
cd desktop && python build/make_desktop_app.py
```

转换脚本干四件事：套上自绘标题栏、去掉浏览器音频授权提示、把响铃事件报给主进程、插入桌面设置面板。

开发中踩过的坑单独记在 [NOTES.md](NOTES.md)，涉及全屏尺寸、SVG 填充、字体测量几个容易反复栽的地方。

## 已知毛病

开机自启没开的话，重启后闹钟不会响——程序没在跑。深度休眠期间也不响，唤醒后会补上（3 分钟内）。节假日表是手写的 2026 年数据，跨年得自己补。

## License

MIT

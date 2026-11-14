# 桌面闹钟

[![release](https://img.shields.io/github/v/release/Peijy1226/desktop-alarm-clock?cacheSeconds=3600)](https://github.com/Peijy1226/desktop-alarm-clock/releases)
[![license](https://img.shields.io/github/license/Peijy1226/desktop-alarm-clock)](LICENSE)

**中文** · [English](README.en.md)

一个不联网的 Windows 桌面闹钟。关掉窗口它还在托盘里待着，到点了自己跳出来。

**[在线试用 →](https://peijy1226.github.io/desktop-alarm-clock/)** 不用装，浏览器里能跑

![演示](docs/demo.gif)

## 装

[Releases](https://github.com/Peijy1226/desktop-alarm-clock/releases) 里两个 exe，双击就行：

`-setup.exe` 装到系统里，带开始菜单和桌面快捷方式；`-portable.exe` 免安装，U 盘里也能放着。

都是单文件，不用装 Node.js，不用装运行库。装完 76MB，基本全是 Electron 自己。

不想装软件的话，[网页版](https://peijy1226.github.io/desktop-alarm-clock/) 打开就能用，或者把仓库里的 `index.html` 下载下来双击。

## 为什么会有这个

我晚上躺床上想问电脑"还能睡多久"，睁眼看屏幕太刺眼，摸手机会彻底醒。就想要一个纯黑背景上只有数字的东西。

所以黑屏倒计时做得最久，其他都是围着它顺手加的。

铺满全屏、纯黑、红色数字，12 秒不动自己再暗一档——暗到刚好能看见但不照亮房间。数字跟着屏幕宽度缩，换任何字型都不会被切掉右边。点左上角能就地换字型，`Esc` 一按回去，窗口还是原来那个大小。

## 字型

九种，本来只有一种，越加越多：

现代无衬线、科幻 HUD、终端等宽、极简细体、古典衬线、手写艺术、冲击粗黑，还有两个不是字体的——七段数码管和点阵屏，SVG 画的，任何电脑上长得一模一样。

麻烦在于换了字型数字大小全乱。字体本身的数字高度就不一样，Impact 特别矮，数码管直接顶满字身框，同一个字号能差快一倍。

现在用 canvas 把每种字体的数字真画一遍，逐行扫像素找实际高度，再反推该给多大字号。九种高度差控制在 2 像素以内，肉眼看不出来。

`measureText` 那个 `actualBoundingBoxAscent` 完全没法用，手写体量出来差三分之一。

## 铃声

内置 17 个，全部 Web Audio 现场合成，振荡器加包络，一个音频文件都没有。所以程序小，换铃声也不用等下载。

17 个分五类：经典、劲爆、清新、舒缓、其它。清脆的清脆，闷的闷，都是调出来的。

也可以放自己的歌，最大 **100MB**，无损整轨放得下。MP3、WAV、FLAC、AAC、M4A、OGG、OPUS 都支持。音频原样存，不转码不压缩，95MB 的 WAV 大概一秒入库，播放不带卡。

上传完会立刻验证能不能解码，确保响铃的时候一定有声。

## 闹钟

六种重复方式：单次、每天、指定日期、工作日、法定节假日、自选星期。

重复的闹钟临时不想响，可以只跳过这一次，不用关掉再打开。

时间精确到秒，支持标签、贪睡 5 分钟、响铃时长（一直响 / 10 秒 / 30 秒 / 1 分 / 5 分 / 10 分）。

整点报时可选，24 个时点任意勾，音量单独调。

## 桌面版比网页版多什么

**关窗口不退出。** 点叉收进托盘，闹钟照响。网页版必须留着标签页，这个区别很大。

**开机自启。** 勾上之后重启电脑也不用管，闹钟一直在。

**有闹钟的时候不让电脑睡。** 这条挺关键——笔记本合盖休眠了，闹钟到点也没人叫。

**到点强制弹到最前**，同时闪任务栏、发系统通知。你在别的窗口打字也会被打断，这才是闹钟该有的样子。

数据全在本机 `%APPDATA%`，一个字节都不往外发。卸载也不会自动删数据，重装还在。

## GPU 加速是关掉的

NVIDIA、Steam、Discord 那些 FPS 浮层不是窗口，是直接往显卡渲染管线里塞东西的，窗口置顶一万层也压不住。

所以干脆让程序不创建任何 GPU 画面，没东西可注入就没东西能盖上来。代价是界面改用 CPU 合成。

量过：开着占单核 1.7% 左右，最小化约 2%，内存 400MB 上下。这个内存是 Electron 的底价，跟这个开关没关系。风扇不会转，笔记本电池也感觉不出来。

## 自己编译

```bash
cd desktop
npm install
npm start
```

打包（PowerShell）：

```powershell
cd desktop
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win nsis portable --x64
```

产物在 `desktop/release/`。

## 代码结构

```
index.html            网页版全部内容，单文件
desktop/main.js       Electron 主进程：窗口、托盘、通知、休眠
desktop/preload.js    渲染进程能调的受限接口
desktop/app/          桌面版页面（生成的，别手改）
desktop/build/        图标 + 网页版转桌面版
```

改代码只改根目录的 `index.html`，改完要同步：

```bash
cd desktop && python build/make_desktop_app.py
```

脚本干四件事：套自绘标题栏、去掉浏览器的音频授权提示、把响铃事件报给主进程、插桌面设置面板。

开发中踩过的坑记在 [NOTES.md](NOTES.md)，涉及全屏尺寸、SVG 填充、字体测量、大文件存储几个容易反复栽的地方。

## License

MIT

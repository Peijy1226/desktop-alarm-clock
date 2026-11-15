const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, powerSaveBlocker, shell, Notification, screen } = require('electron');
const path = require('path');
const fs = require('fs');

/* 只允许运行一个实例，第二次启动时聚焦已有窗口 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

/* 放行自动播放：桌面程序不需要用户先点一下才能出声 */
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
app.setAppUserModelId('com.peicheng.yl.naobiao');

/* ---- 资源占用优化 ----
   这是一个几乎不动的窗口，没必要给 Chromium 留那么大的内存池 */
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=64 --max-semi-space-size=1');
app.commandLine.appendSwitch('disable-http-cache');          // 没有网络请求，缓存目录纯占空间
app.commandLine.appendSwitch('disk-cache-size', '1');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('no-first-run');
app.commandLine.appendSwitch('disable-features', 'MediaRouter,OptimizationHints,Translate,BackForwardCache');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('disable-features', 'MediaRouter,OptimizationHints,Translate,BackForwardCache,CalculateNativeWinOcclusion,InterestFeedContentSuggestions,AcceptCHFrame,AutofillServerCommunication,SegmentationPlatform');
app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('no-default-browser-check');
app.commandLine.appendSwitch('no-pings');
app.commandLine.appendSwitch('metrics-recording-only');
app.commandLine.appendSwitch('password-store', 'basic');
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess');  // 网络服务合进主进程
app.commandLine.appendSwitch('disable-gpu-compositing');      // 强制 CPU 合成，不给 overlay 注入口

/* 关掉 GPU 加速。
   原因：NVIDIA / Steam / Discord 的 overlay 都是往 GPU 交换链里注入绘制的，
   本程序不创建交换链 → 没有注入点 → 那些浮层无法覆盖到本窗口。
   副作用：界面用 CPU 合成，但这个程序几乎不动，实测开销可以忽略。 */
app.disableHardwareAcceleration();

const APP_DIR = path.join(__dirname, 'app');
const ICON_ICO = path.join(__dirname, 'build', 'icon.ico');
const CONFIG_FILE = () => path.join(app.getPath('userData'), 'desktop-config.json');

let mainWindow = null;
let tray = null;
let quitting = false;
let sleepBlockerId = null;
let displayBlockerId = null;
let nightKiosk = false;
let lastTrayTip = -1;
let nightReassertTimer = null;

/* ---------------- 桌面配置持久化 ---------------- */
function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE(), 'utf8');
    const c = JSON.parse(raw);
    return {
      closeToTray: c.closeToTray !== false,
      autoLaunch: !!c.autoLaunch,
      preventSleep: c.preventSleep !== false,
      popupOnRing: c.popupOnRing !== false,
      nightKeepAwake: c.nightKeepAwake !== false,
      startMinimized: !!c.startMinimized,
    };
  } catch (e) {
    return { closeToTray: true, autoLaunch: false, preventSleep: true, popupOnRing: true, nightKeepAwake: true, startMinimized: false };
  }
}
function writeConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
    fs.writeFileSync(CONFIG_FILE(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {}
}
let desktopConfig = readConfig();

/* ---------------- 休眠阻止 ---------------- */
function syncSleepBlocker(shouldBlock) {
  /* 只阻止"系统挂起"，不阻止息屏 —— 屏幕可以关，定时器不能停 */
  if (shouldBlock) {
    if (sleepBlockerId === null) {
      try { sleepBlockerId = powerSaveBlocker.start('prevent-app-suspension'); } catch (e) {}
    }
  } else if (sleepBlockerId !== null) {
    try { powerSaveBlocker.stop(sleepBlockerId); } catch (e) {}
    sleepBlockerId = null;
  }
}

/* ---------------- 显示常亮（夜间黑屏倒计时用） ---------------- */
function syncDisplayBlocker(on){
  if(on && desktopConfig.nightKeepAwake !== false){
    if(displayBlockerId === null){
      try { displayBlockerId = powerSaveBlocker.start('prevent-display-sleep'); } catch(e){}
    }
  } else if(displayBlockerId !== null){
    try { powerSaveBlocker.stop(displayBlockerId); } catch(e){}
    displayBlockerId = null;
  }
}

/* ---------------- 主窗口 ---------------- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 750,
    minWidth: 720,
    minHeight: 520,
    show: false,
    frame: false,
    backgroundColor: '#f1f4e7',
    icon: ICON_ICO,
    title: '桌面闹钟',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      /* 窗口收到托盘后渲染进程会被节流到一分钟一次，闹钟判定和响铃的
         排拍都会跟着拖，所以这里必须关掉，不能省这点电 */
      backgroundThrottling: false,
      offscreen: false,
      webgl: false,                  // 不用 3D，关掉省内存
      enableWebSQL: false,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(APP_DIR, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (!desktopConfig.startMinimized) mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (quitting) return;
    if (desktopConfig.closeToTray) {
      e.preventDefault();
      mainWindow.hide();
      notifyTrayOnce();
    } else {
      quitting = true;
      app.quit();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  /* 窗口最小化/隐藏时通知渲染层进入"省电模式" */
  const sendVisibility = (visible) => {
    if(mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('desktop:visibility', visible);
  };
  mainWindow.on('minimize', () => sendVisibility(false));
  mainWindow.on('restore', () => sendVisibility(true));
  mainWindow.on('hide', () => sendVisibility(false));
  mainWindow.on('show', () => sendVisibility(true));
  mainWindow.on('focus', () => sendVisibility(true));
  mainWindow.on('blur', () => { if(!desktopConfig.nightKeepAwake || !nightKiosk) sendVisibility(true); });

  /* 外部链接一律用系统浏览器打开，不在应用内跳走 */
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

let trayHinted = false;
function notifyTrayOnce() {
  if (trayHinted) return;
  trayHinted = true;
  if (Notification.isSupported()) {
    new Notification({
      title: '桌面闹钟仍在运行',
      body: '窗口已收到托盘，闹钟照常响铃。右键托盘图标可退出。',
      icon: ICON_ICO,
    }).show();
  }
}

/* ---------------- 黑屏倒计时：压过一切窗口 ---------------- */
/* 说明：
   - setKiosk(true)      Windows 下全屏并盖住任务栏、开始菜单
   - alwaysOnTop level   'screen-saver' 是最高常规层级，压住普通置顶窗口
   - relativeLevel 1     在同层级里再抬一级
   - moveTop()           周期性把自己提到 topmost 组最前，防止被别的置顶程序抢走
   - setSkipTaskbar      不显示任务栏预览缩略图
   唯一盖不住的是「任务管理器」和显卡驱动在游戏画面内部注入的 overlay
   （NVIDIA / Steam / Discord 的 overlay 是注入到程序渲染管线里画的，不是独立窗口，
    任何窗口层级都无法遮住它，只能在那家软件自己的设置里关掉）。 */
let nightPrevBounds = null;
let nightPrevMaximized = false;

function enterNightMode(){
  if(!mainWindow || mainWindow.isDestroyed()) return;

  nightKiosk = true;
  nightPrevBounds = mainWindow.getBounds();
  nightPrevMaximized = mainWindow.isMaximized();

  /* 注意：这台机器关了 GPU 加速（为了挡 NVIDIA overlay），
     setFullScreen(true) 只改了状态、窗口实际尺寸不变（停在 1120×820）。
     所以这里不用系统全屏，改成「直接把窗口铺到整块屏幕」——
     窗口本身无边框，配上 screen-saver 层级就能盖住任务栏。 */
  try {
    mainWindow.setSkipTaskbar(true);
    if(mainWindow.isMaximized()) mainWindow.unmaximize();
    mainWindow.setResizable(false);
    mainWindow.setMenuBarVisibility(false);

    const disp = screen.getDisplayMatching(nightPrevBounds) || screen.getPrimaryDisplay();
    mainWindow.setBounds(disp.bounds);

    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.moveTop();
    mainWindow.show();
    mainWindow.focus();
  } catch(e){}

  /* 周期重压 + 尺寸校验：别的置顶程序可能抢走 topmost，
     个别情况下窗口还会被系统缩回去，每 1.2 秒校正一次 */
  if(nightReassertTimer) clearInterval(nightReassertTimer);
  nightReassertTimer = setInterval(function(){
    if(!mainWindow || !nightKiosk || mainWindow.isDestroyed()) return;
    try {
      const disp = screen.getPrimaryDisplay();
      const b = mainWindow.getBounds();
      if(Math.abs(b.width - disp.bounds.width) > 4 || Math.abs(b.height - disp.bounds.height) > 4){
        mainWindow.setBounds(disp.bounds);
      }
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      mainWindow.moveTop();
    } catch(e){}
  }, 1200);

  try { mainWindow.setContentProtection(true); } catch(e){}

  syncDisplayBlocker(true);
  if(tray) tray.setToolTip('桌面闹钟 · 黑屏倒计时中');
}

function exitNightMode(){
  nightKiosk = false;
  if(nightReassertTimer){ clearInterval(nightReassertTimer); nightReassertTimer = null; }

  const savedBounds = nightPrevBounds;
  const savedMaximized = nightPrevMaximized;
  nightPrevBounds = null;
  nightPrevMaximized = false;

  syncDisplayBlocker(false);
  if(tray) tray.setToolTip('桌面闹钟');

  if(!mainWindow || mainWindow.isDestroyed()) return;

  try {
    mainWindow.setContentProtection(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    mainWindow.setSkipTaskbar(false);
    mainWindow.setResizable(true);
    mainWindow.show();
    mainWindow.focus();
  } catch(e){}

  /* 还原尺寸：多次校验，防止被系统的窗口调整覆盖 */
  let tries = 0;
  const restore = function(){
    if(!mainWindow || mainWindow.isDestroyed()) return;
    try {
      if(savedMaximized){
        if(!mainWindow.isMaximized()) mainWindow.maximize();
        return;
      }
      if(mainWindow.isMaximized()) mainWindow.unmaximize();
      if(savedBounds) mainWindow.setBounds(savedBounds);
    } catch(e){}

    if(tries++ < 6){
      setTimeout(function(){
        if(!mainWindow || mainWindow.isDestroyed()) return;
        if(savedMaximized) return;
        const b = mainWindow.getBounds();
        if(savedBounds && (Math.abs(b.width - savedBounds.width) > 4 || Math.abs(b.height - savedBounds.height) > 4)){
          try { mainWindow.unmaximize(); mainWindow.setBounds(savedBounds); } catch(e){}
        }
      }, 90);
    }
  };
  setTimeout(restore, 40);
}

/* ---------------- 托盘 ---------------- */
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: '打开闹钟',
      click: () => { showWindow(); },
    },
    {
      label: '暂停 / 恢复响铃测试',
      visible: false,
    },
    { type: 'separator' },
    {
      label: '开机自动启动',
      type: 'checkbox',
      checked: desktopConfig.autoLaunch,
      click: (item) => {
        desktopConfig.autoLaunch = item.checked;
        writeConfig(desktopConfig);
        applyAutoLaunch();
        if (mainWindow) mainWindow.webContents.send('desktop:config', desktopConfig);
      },
    },
    {
      label: '关闭窗口时最小化到托盘',
      type: 'checkbox',
      checked: desktopConfig.closeToTray,
      click: (item) => {
        desktopConfig.closeToTray = item.checked;
        writeConfig(desktopConfig);
        if (mainWindow) mainWindow.webContents.send('desktop:config', desktopConfig);
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => { quitting = true; app.quit(); },
    },
  ]);
}

function createTray() {
  let img = nativeImage.createFromPath(ICON_ICO);
  if (img.isEmpty()) {
    img = nativeImage.createEmpty();
  } else {
    img = img.resize({ width: 16, height: 16 });
  }
  tray = new Tray(img);
  tray.setToolTip('桌面闹钟');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
  tray.on('double-click', () => showWindow());
}

function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
}

/* ---------------- 开机自启 ---------------- */
function applyAutoLaunch() {
  try {
    app.setLoginItemSettings({
      openAtLogin: desktopConfig.autoLaunch,
      path: process.execPath,
      args: desktopConfig.startMinimized ? ['--minimized'] : [],
    });
  } catch (e) {}
}

/* ---------------- IPC ---------------- */
ipcMain.handle('desktop:getConfig', () => desktopConfig);

ipcMain.handle('desktop:setConfig', (e, patch) => {
  desktopConfig = Object.assign({}, desktopConfig, patch || {});
  writeConfig(desktopConfig);
  if ('autoLaunch' in (patch || {})) { applyAutoLaunch(); refreshTray(); }
  if ('closeToTray' in (patch || {})) refreshTray();
  if ('nightKeepAwake' in (patch || {})) syncDisplayBlocker(nightKiosk);
  return desktopConfig;
});

ipcMain.handle('desktop:version', () => {
  /* 开发模式下 app.getVersion() 返回的是 Electron 版本，这里读 package.json 保证一致 */
  try {
    return require(path.join(__dirname, 'package.json')).version;
  } catch (e) {
    return app.getVersion();
  }
});

ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });

/* 响铃时把窗口拉到最前 + 任务栏闪烁 */
ipcMain.on('alarm:ringing', (e, payload) => {
  if (!mainWindow) return;
  const shouldPopup = desktopConfig.popupOnRing !== false;
  if (shouldPopup) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.moveTop();
    mainWindow.focus();
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.flashFrame(true);
      }
    }, 6000);
  } else {
    mainWindow.flashFrame(true);
  }
  if (tray) tray.setToolTip('⏰ 闹钟响铃中 —— ' + (payload && payload.time ? payload.time : ''));
  if (Notification.isSupported()) {
    new Notification({
      title: '⏰ ' + ((payload && payload.title) || '时间到了'),
      body: (payload && payload.body) || '打开桌面闹钟处理提醒',
      icon: ICON_ICO,
      silent: true,
    }).show();
  }
});

ipcMain.on('night:enter', () => enterNightMode());
ipcMain.on('night:exit', () => exitNightMode());

ipcMain.on('alarm:idle', () => {
  if (mainWindow) mainWindow.flashFrame(false);
  if (tray) tray.setToolTip('桌面闹钟');
});

/* 是否有启用中的闹钟 → 决定是否阻止系统挂起 */
ipcMain.on('alarm:state', (e, { enabledCount }) => {
  const block = desktopConfig.preventSleep !== false && enabledCount > 0;
  syncSleepBlocker(block);
  if (tray && lastTrayTip !== enabledCount) {
    lastTrayTip = enabledCount;
    tray.setToolTip(enabledCount > 0 ? `桌面闹钟 · ${enabledCount} 个已启用` : '桌面闹钟 · 无启用中的闹钟');
  }
});

/* ---------------- 生命周期 ---------------- */
app.on('second-instance', () => { showWindow(); });

app.on('before-quit', () => {
  quitting = true;
  if(nightReassertTimer){ clearInterval(nightReassertTimer); nightReassertTimer = null; }
  syncDisplayBlocker(false);
  syncSleepBlocker(false);
});

app.whenReady().then(() => {
  if (process.argv.includes('--minimized')) desktopConfig.startMinimized = true;
  createWindow();
  createTray();
  applyAutoLaunch();
  syncSleepBlocker(desktopConfig.preventSleep !== false);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

/* 关掉所有窗口不退出（托盘常驻）；真正退出走托盘菜单 */
app.on('window-all-closed', (e) => {
  if (quitting) app.quit();
});

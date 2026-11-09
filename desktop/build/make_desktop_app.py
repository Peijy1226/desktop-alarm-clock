"""把网页版 index.html 转成 Electron 桌面版：
1. 注入自定义标题栏（无边框窗口需要）
2. 桌面环境隐藏「浏览器音频授权」横幅（Electron 已允许自动播放）
3. 响铃/状态事件同步给主进程（托盘提示、窗口置顶、阻止休眠）
4. 增加「桌面设置」区域
"""
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)          # desktop/
SRC = os.path.join(os.path.dirname(ROOT), "index.html")   # alarm-clock/index.html
DST = os.path.join(ROOT, "app", "index.html")
os.makedirs(os.path.join(ROOT, "app"), exist_ok=True)

s = io.open(SRC, encoding="utf-8").read()

# ---------------------------------------------------------------- 1. 样式
desktop_css = """
/* ================= 桌面版专属样式 ================= */
:root{--titlebar-h:38px}
html,body{padding-top:0}
body.desktop{padding-top:var(--titlebar-h)}

.titlebar{
  position:fixed;top:0;left:0;right:0;height:var(--titlebar-h);z-index:200;
  display:flex;align-items:center;gap:10px;padding:0 0 0 12px;
  background:rgba(14,19,12,.90);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border-bottom:1px solid rgba(126,217,87,.10);
  -webkit-app-region:drag;user-select:none;
}
.titlebar-icon{width:18px;height:18px;flex:none;border-radius:5px;background:linear-gradient(150deg,#8fdc6f,#4f9e35);
  display:grid;place-items:center}
.titlebar-icon svg{width:11px;height:11px;display:block}
.titlebar-title{font-size:12.5px;font-weight:600;color:#c3d4b4;letter-spacing:.2px;flex:1;min-width:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.titlebar-sub{font-size:11px;color:#6b7d5d;font-weight:400;margin-left:6px}

/* 桌面版把字型下拉收成紧凑尺寸，别拉满整行 */
.style-select{
  width:auto !important;min-width:112px;max-width:150px;
  font-size:12px !important;padding:7px 28px 7px 12px !important;
}
.win-controls{display:flex;-webkit-app-region:no-drag;flex:none;height:100%}
.win-btn{
  width:46px;height:100%;border:none;background:transparent;cursor:pointer;
  display:grid;place-items:center;color:#93a684;transition:background .14s ease,color .14s ease;
}
.win-btn:hover{background:rgba(126,217,87,.10);color:#dff0d0}
.win-btn.close:hover{background:#e5484d;color:#fff}
.win-btn svg{width:11px;height:11px;display:block}
.win-btn.max svg{width:10px;height:10px}

/* 托盘提示小图标 */
.desktop-badge{
  display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;
  color:#9dd97c;background:rgba(126,217,87,.12);border:1px solid rgba(126,217,87,.24);border-radius:999px;padding:3px 9px;
}

/* 桌面设置面板 */
.settings-panel{margin-top:20px}
.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:14px}
.setting-item{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:13px 15px;background:rgba(126,217,87,.035);border:1px solid var(--line);border-radius:var(--radius-md);
}
.setting-copy{min-width:0}
.setting-name{font-size:13px;font-weight:600;color:#d6e6c8;margin:0 0 2px}
.setting-desc{font-size:11.5px;color:var(--muted);margin:0;line-height:1.5}
.settings-foot{
  display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
  margin-top:14px;padding-top:12px;border-top:1px solid var(--line-2);
  font-size:11.5px;color:#5e6d52;
}

@media (max-width:820px){
  body.desktop{padding-top:var(--titlebar-h)}
  .titlebar-sub{display:none}
  .settings-grid{grid-template-columns:1fr}
}
"""

s = s.replace("</style>", desktop_css + "</style>")

# ---------------------------------------------------------------- 2. 标题栏 + 设置面板 HTML
titlebar = """
<div class="titlebar" id="titlebar">
  <div class="titlebar-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round">
      <circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2.4 1.6"/>
    </svg>
  </div>
  <div class="titlebar-title">桌面闹钟<span class="titlebar-sub" id="titlebarSub">托盘常驻 · 关机前一直守着</span></div>
  <div class="win-controls">
    <button class="win-btn" id="btnMin" title="最小化" aria-label="最小化">
      <svg viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
    <button class="win-btn max" id="btnMax" title="最大化" aria-label="最大化">
      <svg viewBox="0 0 12 12"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
    <button class="win-btn close" id="btnClose" title="关闭到托盘" aria-label="关闭">
      <svg viewBox="0 0 12 12"><path d="M2.6 2.6l6.8 6.8M9.4 2.6l-6.8 6.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
  </div>
</div>
"""
s = s.replace("<body>", "<body>\n" + titlebar, 1)

settings_panel = """
  <section class="workspace settings-panel" id="desktopSettingsSection">
    <div class="panel">
      <div class="panel-head">
        <div class="panel-title-row">
          <p class="section-kicker">Desktop</p>
          <div class="panel-title-inline">
            <h2>桌面设置</h2>
            <p class="list-meta">仅在桌面程序里可用</p>
          </div>
        </div>
        <div class="panel-head-actions">
          <span class="desktop-badge" id="desktopStateBadge">运行中</span>
        </div>
      </div>
      <div class="settings-grid">
        <div class="setting-item">
          <div class="setting-copy">
            <p class="setting-name">开机自动启动</p>
            <p class="setting-desc">开机后自动在托盘待命，闹钟照常响</p>
          </div>
          <label class="choice-item" style="margin:0">
            <input type="checkbox" id="setAutoLaunch">
            <span></span>
            <span class="switch-ui" aria-hidden="true"></span>
          </label>
        </div>
        <div class="setting-item">
          <div class="setting-copy">
            <p class="setting-name">关闭时收到托盘</p>
            <p class="setting-desc">点关闭不退出程序，闹钟继续生效</p>
          </div>
          <label class="choice-item" style="margin:0">
            <input type="checkbox" id="setCloseToTray">
            <span></span>
            <span class="switch-ui" aria-hidden="true"></span>
          </label>
        </div>
        <div class="setting-item">
          <div class="setting-copy">
            <p class="setting-name">阻止系统休眠</p>
            <p class="setting-desc">有启用中的闹钟时不让电脑睡着（屏幕仍可关闭）</p>
          </div>
          <label class="choice-item" style="margin:0">
            <input type="checkbox" id="setPreventSleep">
            <span></span>
            <span class="switch-ui" aria-hidden="true"></span>
          </label>
        </div>
        <div class="setting-item">
          <div class="setting-copy">
            <p class="setting-name">黑屏时不熄屏</p>
            <p class="setting-desc">黑屏倒计时期间阻止屏幕关闭</p>
          </div>
          <label class="choice-item" style="margin:0">
            <input type="checkbox" id="setNightKeepAwake">
            <span></span>
            <span class="switch-ui" aria-hidden="true"></span>
          </label>
        </div>
        <div class="setting-item">
          <div class="setting-copy">
            <p class="setting-name">响铃时弹到最前</p>
            <p class="setting-desc">窗口被遮挡也强制显示，同时闪烁任务栏</p>
          </div>
          <label class="choice-item" style="margin:0">
            <input type="checkbox" id="setPopupOnRing">
            <span></span>
            <span class="switch-ui" aria-hidden="true"></span>
          </label>
        </div>
      </div>
      <div class="settings-foot">
        <span id="desktopVersionText">桌面闹钟</span>
        <span>数据保存在本机 · 无需联网</span>
      </div>
    </div>
  </section>
"""
s = s.replace("</main>", settings_panel + "\n</main>", 1)

# ---------------------------------------------------------------- 3. 桌面启动脚本
desktop_js = r"""
/* =========================================================
   桌面版适配层（仅在 Electron 中生效）
   ========================================================= */
(function(){
  if(!window.desktop) return;
  const D = window.desktop;

  document.body.classList.add("desktop");

  /* ---- 窗口按钮 ---- */
  const bind = function(id, fn){ const el = document.getElementById(id); if(el) el.addEventListener("click", fn); };
  bind("btnMin", function(){ D.minimize(); });
  bind("btnMax", function(){ D.maximize(); });
  bind("btnClose", function(){ D.close(); });

  /* ---- 标题栏显示当前状态 ---- */
  const sub = document.getElementById("titlebarSub");
  const badge = document.getElementById("desktopStateBadge");

  /* ---- 桌面设置 ---- */
  const map = {
    setAutoLaunch: "autoLaunch",
    setCloseToTray: "closeToTray",
    setPreventSleep: "preventSleep",
    setNightKeepAwake: "nightKeepAwake",
    setPopupOnRing: "popupOnRing"
  };

  function fillConfig(cfg){
    Object.keys(map).forEach(function(id){
      const el = document.getElementById(id);
      if(el) el.checked = !!cfg[map[id]];
    });
  }

  D.getConfig().then(function(cfg){ fillConfig(cfg); }).catch(function(){});
  D.onConfig(fillConfig);

  Object.keys(map).forEach(function(id){
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener("change", function(){
      const patch = {};
      patch[map[id]] = el.checked;
      D.setConfig(patch).then(function(cfg){ fillConfig(cfg); }).catch(function(){});
    });
  });

  D.version().then(function(v){
    const t = document.getElementById("desktopVersionText");
    if(t) t.textContent = "桌面闹钟 v" + v + " · Electron";
  }).catch(function(){});

  /* ---- 桌面环境：浏览器音频授权横幅无意义，直接隐藏 ---- */
  const hideBanner = function(){
    const a = document.getElementById("startupOverlay");
    if(a) a.classList.add("hidden");
    const b = document.getElementById("audioPermissionSuccess");
    if(b) b.classList.add("hidden");
  };
  hideBanner();
  setInterval(hideBanner, 800);

  /* ---- 阻止休眠需要知道有几个启用中的闹钟 ---- */
  function reportState(){
    const list = document.querySelectorAll("#alarmList .alarm-toggle");
    let n = 0;
    Array.prototype.forEach.call(list, function(t){ if(t.checked) n++; });
    D.alarmState({ enabledCount: n });
  }

  const badgeTimer = setInterval(reportState, 1500);
  setTimeout(reportState, 300);

  /* ---- 响铃时通知主进程：置顶 + 托盘提示 + 系统通知 ---- */
  const ringOverlay = document.getElementById("ringOverlay");
  let wasRinging = false;
  const ringWatch = setInterval(function(){
    if(!ringOverlay) return;
    const isRinging = !ringOverlay.classList.contains("hidden");
    if(isRinging && !wasRinging){
      wasRinging = true;
      const timeEl = document.getElementById("ringTime");
      const titleEl = document.getElementById("ringTitle");
      const descEl = document.getElementById("ringDescription");
      D.alarmRinging({
        time: timeEl ? timeEl.textContent : "",
        title: titleEl ? titleEl.textContent : "时间到了",
        body: descEl ? descEl.textContent : ""
      });
      if(sub) sub.textContent = "⏰ 响铃中";
      if(badge){ badge.textContent = "响铃中"; badge.style.color = "#a8452a"; badge.style.background = "#fdeceb"; badge.style.borderColor = "#f6cfc9"; }
    } else if(!isRinging && wasRinging){
      wasRinging = false;
      D.alarmIdle();
      if(sub) sub.textContent = "托盘常驻 · 关机前一直守着";
      if(badge){ badge.textContent = "运行中"; badge.style.color = ""; badge.style.background = ""; badge.style.borderColor = ""; }
      reportState();
    }
  }, 400);

  /* ---- 双击标题栏最大化 ---- */
  const tb = document.getElementById("titlebar");
  if(tb){
    tb.addEventListener("dblclick", function(e){
      if(e.target.closest(".win-controls")) return;
      D.maximize();
    });
  }
})();
"""

s = s.replace("boot();\n})();", "boot();\n})();\n" + desktop_js, 1)

# ---------------------------------------------------------------- 4. 桌面版标题微调
s = s.replace("<title>在线闹钟 · 整点报时</title>", "<title>桌面闹钟</title>", 1)

io.open(DST, "w", encoding="utf-8").write(s)
print("desktop app written:", DST, len(s), "chars")

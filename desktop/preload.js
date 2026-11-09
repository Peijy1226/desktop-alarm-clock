const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,

  getConfig: () => ipcRenderer.invoke('desktop:getConfig'),
  setConfig: (patch) => ipcRenderer.invoke('desktop:setConfig', patch),
  version: () => ipcRenderer.invoke('desktop:version'),

  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  onConfig: (cb) => {
    const h = (e, cfg) => cb(cfg);
    ipcRenderer.on('desktop:config', h);
    return () => ipcRenderer.removeListener('desktop:config', h);
  },

  onVisibility: (cb) => {
    const h = (e, visible) => cb(visible);
    ipcRenderer.on('desktop:visibility', h);
    return () => ipcRenderer.removeListener('desktop:visibility', h);
  },

  nightEnter: () => ipcRenderer.send('night:enter'),
  nightExit: () => ipcRenderer.send('night:exit'),

  alarmRinging: (payload) => ipcRenderer.send('alarm:ringing', payload),
  alarmIdle: () => ipcRenderer.send('alarm:idle'),
  alarmState: (state) => ipcRenderer.send('alarm:state', state),
});

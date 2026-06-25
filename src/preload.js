const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tomorrowDesk", {
  loadNote: () => ipcRenderer.invoke("note:load"),
  saveNote: (content) => ipcRenderer.invoke("note:save", content),
  archiveNote: () => ipcRenderer.invoke("note:archive"),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  setAlwaysOnTop: (enabled) =>
    ipcRenderer.invoke("preferences:setAlwaysOnTop", enabled),
  setLaunchAtLogin: (enabled) =>
    ipcRenderer.invoke("preferences:setLaunchAtLogin", enabled),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  hideToTray: () => ipcRenderer.invoke("window:hideToTray"),
});

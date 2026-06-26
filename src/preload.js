const { contextBridge, ipcRenderer } = require("electron");

ipcRenderer.on("note:archived", (_event, archivedNote) => {
  window.dispatchEvent(
    new CustomEvent("tomorrow-desk:note-archived", { detail: archivedNote })
  );
});

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

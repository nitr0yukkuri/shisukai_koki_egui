const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jobuhan", {
  runtime: {
    electron: process.versions.electron ?? "unknown",
    node: process.versions.node,
    platform: process.platform,
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
    close: () => ipcRenderer.invoke("window:close"),
  },
});

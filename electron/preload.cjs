const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("jobuhan", {
  runtime: {
    electron: process.versions.electron ?? "unknown",
    node: process.versions.node,
    platform: process.platform,
  },
});

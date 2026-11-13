const { contextBridge, ipcRenderer } = require("electron");

// sandbox: true の preload ではアプリのモジュールを require できないため、
// チャンネル名はここに直接書く。src/shared/ipc.ts との一致はテストで確認する。
const INVOKE = {
  esList: "es:list",
  esGet: "es:get",
  esSave: "es:save",
  esDuplicate: "es:duplicate",
  esDelete: "es:delete",
  practiceStart: "practice:start",
  practiceBeginAnswer: "practice:beginAnswer",
  practiceEndAnswer: "practice:endAnswer",
  practiceNext: "practice:next",
  practiceFinish: "practice:finish",
  historyList: "history:list",
  historyGet: "history:get",
  historyDelete: "history:delete",
  settingsGet: "settings:get",
  settingsSet: "settings:set",
  consentGet: "consent:get",
  consentSet: "consent:set",
};

const AUDIO_CHUNK = "audio:chunk";
const STT_PARTIAL = "stt:partial";
const STT_FINAL = "stt:final";
const METRICS_UPDATE = "metrics:update";
const STT_ERROR = "stt:error";

function subscribe(channel, listener) {
  const handler = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

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
  es: {
    list: () => ipcRenderer.invoke(INVOKE.esList),
    get: (esSetId) => ipcRenderer.invoke(INVOKE.esGet, { esSetId }),
    save: (esSet) => ipcRenderer.invoke(INVOKE.esSave, esSet),
    duplicate: (esSetId) => ipcRenderer.invoke(INVOKE.esDuplicate, { esSetId }),
    delete: (esSetId) => ipcRenderer.invoke(INVOKE.esDelete, { esSetId }),
  },
  practice: {
    start: (input) => ipcRenderer.invoke(INVOKE.practiceStart, input ?? {}),
    beginAnswer: (sessionId) => ipcRenderer.invoke(INVOKE.practiceBeginAnswer, { sessionId }),
    endAnswer: (sessionId, turnId) =>
      ipcRenderer.invoke(INVOKE.practiceEndAnswer, { sessionId, turnId }),
    next: (sessionId) => ipcRenderer.invoke(INVOKE.practiceNext, { sessionId }),
    finish: (sessionId, keep) => ipcRenderer.invoke(INVOKE.practiceFinish, { sessionId, keep }),
  },
  history: {
    list: () => ipcRenderer.invoke(INVOKE.historyList),
    get: (sessionId) => ipcRenderer.invoke(INVOKE.historyGet, { sessionId }),
    delete: (sessionId) => ipcRenderer.invoke(INVOKE.historyDelete, { sessionId }),
  },
  settings: {
    get: (key) => ipcRenderer.invoke(INVOKE.settingsGet, { key }),
    set: (key, value) => ipcRenderer.invoke(INVOKE.settingsSet, { key, value }),
  },
  consent: {
    get: () => ipcRenderer.invoke(INVOKE.consentGet),
    set: (externalAi) => ipcRenderer.invoke(INVOKE.consentSet, { externalAi }),
  },
  audio: {
    sendChunk: (message) => ipcRenderer.send(AUDIO_CHUNK, message),
  },
  speech: {
    onPartial: (listener) => subscribe(STT_PARTIAL, listener),
    onFinal: (listener) => subscribe(STT_FINAL, listener),
    onMetrics: (listener) => subscribe(METRICS_UPDATE, listener),
    onError: (listener) => subscribe(STT_ERROR, listener),
  },
});

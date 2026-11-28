const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain, session } = require("electron");

if (require("electron-squirrel-startup")) return;

app.setAppUserModelId("com.squirrel.jobuhan.jobuhan");

let mainWindow;
let joinWindow;
let backendHandle;

function createWindow(isJoin = false) {
  const devServerUrl = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL;
  const trustedDevUrl = devServerUrl ? new URL(devServerUrl) : undefined;
  if (trustedDevUrl && (
    trustedDevUrl.protocol !== "http:"
    || trustedDevUrl.hostname !== "127.0.0.1"
    || trustedDevUrl.port !== "5173"
    || trustedDevUrl.pathname !== "/"
    || trustedDevUrl.username
    || trustedDevUrl.password
  )) {
    throw new Error("開発サーバーは http://127.0.0.1:5173/ のみ利用できます。");
  }
  const entryPath = path.join(__dirname, isJoin ? "../dist/join.html" : "../dist/index.html");
  const window = new BrowserWindow({
    width: isJoin ? 1100 : 1320,
    height: isJoin ? 780 : 800,
    minWidth: 640,
    minHeight: 560,
    frame: false,
    backgroundColor: "#eaf4f1",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (isJoin) joinWindow = window;
  else mainWindow = window;

  const route = isJoin ? "/join.html" : "/";
  const trustedFileUrl = pathToFileURL(entryPath);
  const isTrustedDestination = (url) => {
    try {
      const destination = new URL(url);
      if (devServerUrl) return destination.origin === new URL(devServerUrl).origin && destination.pathname === route;
      destination.search = "";
      destination.hash = "";
      return destination.href === trustedFileUrl.href;
    } catch { return false; }
  };

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    if (!isTrustedDestination(event.url)) event.preventDefault();
  });

  const pageLoad = devServerUrl
    ? window.loadURL(new URL(route, devServerUrl).toString())
    : window.loadFile(entryPath);

  pageLoad.catch((error) => {
    console.error(isJoin ? "面接相手用画面を読み込めませんでした。" : "じょぶはんの画面を読み込めませんでした。", error);
  });

  window.on("closed", () => {
    if (isJoin && joinWindow === window) joinWindow = undefined;
    if (!isJoin && mainWindow === window) mainWindow = undefined;
  });
  return window;
}

function isTrustedAppContents(contents) {
  return [mainWindow, joinWindow].some((window) => window && !window.isDestroyed() && contents === window.webContents);
}

function mayUseMedia(contents, permission, details) {
  if (!isTrustedAppContents(contents) || !["media", "camera", "microphone"].includes(permission)) return false;
  const requestedUrl = details?.requestingUrl;
  if (requestedUrl) {
    try {
      const url = new URL(requestedUrl);
      if (app.isPackaged ? url.protocol !== "file:" : url.origin !== "http://127.0.0.1:5173") return false;
    } catch { return false; }
  }
  const mediaTypes = details?.mediaTypes;
  return !Array.isArray(mediaTypes) || mediaTypes.length === 0 || mediaTypes.every((type) => type === "audio" || type === "video");
}

function getTrustedWindow(event) {
  const window = [mainWindow, joinWindow].find((candidate) => candidate && !candidate.isDestroyed() && event.sender === candidate.webContents && event.senderFrame === candidate.webContents.mainFrame);
  return window ?? null;
}

function openJoinWindow(event) {
  const requester = getTrustedWindow(event);
  if (!requester || requester !== mainWindow) return;
  if (joinWindow && !joinWindow.isDestroyed()) {
    joinWindow.show();
    joinWindow.focus();
    return;
  }
  createWindow(true);
}

function registerMediaPermissionHandlers() {
  const appSession = session.defaultSession;
  appSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(mayUseMedia(contents, permission, details));
  });
  appSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => {
    if (!mayUseMedia(contents, permission, details)) return false;
    if (requestingOrigin) {
      try {
        const origin = new URL(requestingOrigin);
        return app.isPackaged ? origin.protocol === "file:" : origin.origin === "http://127.0.0.1:5173";
      } catch { return false; }
    }
    return true;
  });
}

ipcMain.handle("window:minimize", (event) => getTrustedWindow(event)?.minimize());

ipcMain.handle("window:toggle-maximize", (event) => {
  const window = getTrustedWindow(event);
  if (!window) return;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
});

ipcMain.handle("window:close", (event) => getTrustedWindow(event)?.close());
ipcMain.handle("window:open-join", (event) => openJoinWindow(event));

// 処理側(main)の本体は TypeScript で書き、dist-electron へビルドしたものを読み込む。
async function startBackend() {
  try {
    const { startBackend: start } = await import("../dist-electron/main/start.js");
    backendHandle = start({
      userDataDir: app.getPath("userData"),
      getWindow: () => mainWindow,
    });
    if (backendHandle.error) {
      console.error("練習ログの保存を準備できませんでした。", backendHandle.error);
    }
  } catch (error) {
    console.error(
      "バックエンドを読み込めませんでした。npm run build:main を実行してください。",
      error,
    );
  }
}

app.whenReady().then(async () => {
  registerMediaPermissionHandlers();
  await startBackend();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  backendHandle?.close();
  backendHandle = undefined;
});

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, ipcMain } = require("electron");

let mainWindow;

function createWindow() {
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
  const indexPath = path.join(__dirname, "../dist/index.html");
  const trustedFileUrl = pathToFileURL(indexPath);

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    backgroundColor: "#eaf4f1",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    try {
      const destination = new URL(navigationUrl);
      if (trustedDevUrl) {
        if (destination.origin === trustedDevUrl.origin && destination.pathname === trustedDevUrl.pathname) return;
      } else {
        destination.search = "";
        destination.hash = "";
        if (destination.href === trustedFileUrl.href) return;
      }
    } catch {
      // Block malformed and non-URL navigation attempts.
    }
    event.preventDefault();
  });

  const pageLoad = devServerUrl
    ? mainWindow.loadURL(devServerUrl)
    : mainWindow.loadFile(indexPath);

  pageLoad.catch((error) => {
    console.error("じょぶはんの画面を読み込めませんでした。", error);
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

function getTrustedWindow(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) return null;
  return mainWindow;
}

ipcMain.handle("window:minimize", (event) => getTrustedWindow(event)?.minimize());

ipcMain.handle("window:toggle-maximize", (event) => {
  const window = getTrustedWindow(event);
  if (!window) return;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
});

ipcMain.handle("window:close", (event) => getTrustedWindow(event)?.close());

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

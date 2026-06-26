const path = require("node:path");
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  screen,
  nativeImage,
} = require("electron");
const { createStorage } = require("./storage");
const { createPreferencesStore } = require("./preferences");
const {
  archiveNoteFromMain,
  createTrayIcon,
  finishRendererFlush,
  requestRendererFlush,
  resolveWindowBounds,
} = require("./shell");

let mainWindow = null;
let tray = null;
let isQuitting = false;
let storage = null;
let preferencesStore = null;
const pendingFlushes = new Map();

function defaultBounds(preferences) {
  const display = screen.getPrimaryDisplay();
  return resolveWindowBounds(preferences, display.workArea);
}

async function applyLaunchAtLogin(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false,
  });
}

async function saveWindowBounds() {
  if (!mainWindow || !preferencesStore) {
    return;
  }

  await preferencesStore.save({ bounds: mainWindow.getBounds() });
}

function showWindow() {
  if (!mainWindow) {
    return;
  }

  mainWindow.show();
  mainWindow.focus();
}

async function archiveFromMain() {
  return archiveNoteFromMain({ storage, preferencesStore, mainWindow });
}

function flushRendererNote() {
  return requestRendererFlush({ mainWindow, pendingFlushes });
}

function createTray() {
  const image = createTrayIcon(nativeImage);
  tray = new Tray(image);
  tray.setToolTip("Tomorrow Desk");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show", click: showWindow },
      { label: "Archive", click: () => archiveFromMain().catch(console.error) },
      { type: "separator" },
      {
        label: "Quit",
        click: async () => {
          try {
            await flushRendererNote();
            isQuitting = true;
            await saveWindowBounds();
            app.quit();
          } catch (error) {
            console.error(error);
            showWindow();
          }
        },
      },
    ])
  );
  tray.on("double-click", showWindow);
}

async function createWindow() {
  const preferences = await preferencesStore.load();
  const bounds = defaultBounds(preferences);

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 420,
    minHeight: 480,
    show: false,
    frame: false,
    resizable: true,
    alwaysOnTop: preferences.alwaysOnTop,
    backgroundColor: "#080806",
    title: "Tomorrow Desk",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", showWindow);
  await mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  mainWindow.on("close", async (event) => {
    if (isQuitting) {
      await saveWindowBounds();
      return;
    }

    event.preventDefault();
    try {
      await flushRendererNote();
      await saveWindowBounds();
      mainWindow.hide();
    } catch (error) {
      console.error(error);
      showWindow();
    }
  });

  mainWindow.on("resize", () => {
    saveWindowBounds().catch(console.error);
  });
  mainWindow.on("move", () => {
    saveWindowBounds().catch(console.error);
  });
}

function registerIpcHandlers() {
  ipcMain.handle("note:load", () => storage.readNote());
  ipcMain.handle("note:save", (_event, content) =>
    storage.writeNote(String(content ?? ""))
  );
  ipcMain.handle("note:archive", () => archiveFromMain());
  ipcMain.handle("note:flush-complete", (_event, requestId, result) =>
    finishRendererFlush(pendingFlushes, requestId, result)
  );
  ipcMain.handle("preferences:get", () => preferencesStore.load());
  ipcMain.handle("preferences:setAlwaysOnTop", async (_event, enabled) => {
    const next = await preferencesStore.save({ alwaysOnTop: Boolean(enabled) });
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(next.alwaysOnTop);
    }
    return next;
  });
  ipcMain.handle("preferences:setLaunchAtLogin", async (_event, enabled) => {
    const next = await preferencesStore.save({ launchAtLogin: Boolean(enabled) });
    await applyLaunchAtLogin(next.launchAtLogin);
    return next;
  });
  ipcMain.handle("window:minimize", () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });
  ipcMain.handle("window:hideToTray", async () => {
    await flushRendererNote();
    await saveWindowBounds();
    if (mainWindow) {
      mainWindow.hide();
    }
  });
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath("userData");
  storage = createStorage(userDataPath);
  preferencesStore = createPreferencesStore(userDataPath);
  const preferences = await preferencesStore.load();

  await storage.ensureReady();
  await applyLaunchAtLogin(preferences.launchAtLogin);
  registerIpcHandlers();
  createTray();
  await createWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(console.error);
  } else {
    showWindow();
  }
});

app.on("window-all-closed", () => {});

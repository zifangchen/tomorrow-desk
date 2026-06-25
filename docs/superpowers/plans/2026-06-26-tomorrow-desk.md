# Tomorrow Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows Electron desktop app that lets the user write tomorrow's handoff note before shutdown and automatically shows that note in a floating black-and-gold window after login.

**Architecture:** Use a small Electron app with a main process for window lifecycle, launch-at-login, tray, and IPC; focused CommonJS modules for local storage and preferences; and a plain HTML/CSS/JS renderer for the black-and-gold editor. Store all user data in Electron's `app.getPath("userData")` directory so the app works offline and survives restart.

**Tech Stack:** Electron, Node.js CommonJS modules, plain HTML/CSS/JavaScript renderer, Node's built-in `node:test` runner, local Markdown/text files.

## Global Constraints

- Build v1 as an Electron desktop app with local file storage.
- Store `tomorrow.md`, `archives/YYYY-MM-DD-HHmm.md`, and `preferences.json` under Electron's user data directory.
- Autosave after the user stops typing briefly; do not rely on the user remembering to save.
- Default window size is around 520 by 640 pixels and starts near the right side of the primary display.
- Always-on-top is enabled by default and toggleable from the UI.
- Close hides the window to the system tray; tray menu provides Show, Archive, and Quit actions.
- The app registers itself to start after Windows login by default, with a visible setting to disable this behavior later.
- UI must be simple, black-and-gold, uncluttered, and focused on one primary document surface.
- If archiving fails, do not clear the active note.

---

## File Structure

- `package.json`: npm metadata, app entry, scripts, and dependencies.
- `.gitignore`: ignore dependencies, build output, coverage, and local runtime data.
- `src/main/index.js`: Electron app lifecycle, window creation, IPC handlers, tray, launch-at-login setup.
- `src/main/storage.js`: local note read/write/archive behavior.
- `src/main/preferences.js`: preferences load/save and corrupt-file fallback.
- `src/preload.js`: safe bridge exposing note, archive, window, and settings APIs to the renderer.
- `src/renderer/index.html`: app shell loaded by the Electron window.
- `src/renderer/styles.css`: black-and-gold visual design and responsive window layout.
- `src/renderer/renderer.js`: editor state, autosave debounce, status messages, UI actions.
- `test/storage.test.js`: unit tests for note creation, persistence, archive, and archive failure safety.
- `test/preferences.test.js`: unit tests for default preferences and corrupt preference fallback.
- `README.md`: run instructions, verification notes, and launch-at-login caveat.

---

### Task 1: Project Scaffold And Test Harness

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Consumes: approved design spec in `docs/superpowers/specs/2026-06-26-tomorrow-desk-design.md`.
- Produces: npm scripts `npm test` and `npm start` used by all later tasks.

- [ ] **Step 1: Create npm metadata and scripts**

Create `package.json`:

```json
{
  "name": "tomorrow-desk",
  "version": "0.1.0",
  "description": "A black-and-gold desktop handoff note that floats back after login.",
  "main": "src/main/index.js",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "electron .",
    "test": "node --test"
  },
  "devDependencies": {
    "electron": "^31.7.7"
  }
}
```

- [ ] **Step 2: Create ignored paths**

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.nyc_output/
npm-debug.log*
*.local
runtime-data/
```

- [ ] **Step 3: Create initial README**

Create `README.md`:

```markdown
# Tomorrow Desk

Tomorrow Desk is a small Windows Electron app for writing tomorrow's handoff note before shutdown and showing it again as a floating desktop window after login.

## Commands

- `npm install`
- `npm test`
- `npm start`

## v1 Behavior

- Notes are stored locally in Electron's user data directory.
- The app autosaves while typing.
- The main window is black-and-gold, always-on-top by default, draggable, and resizable.
- Closing the window hides it to the system tray.
- Launch-at-login is enabled by default through Electron when the app starts.
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `node_modules/` and `package-lock.json` are created, and npm exits with code 0.

- [ ] **Step 5: Run initial test command**

Run: `npm test`

Expected: the command exits with code 0 and reports no matching tests yet or no executed suites, depending on the installed Node version.

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add package.json package-lock.json .gitignore README.md
git commit -m "chore: scaffold Electron app"
```

Expected: commit succeeds.

---

### Task 2: Local Note Storage

**Files:**
- Create: `src/main/storage.js`
- Create: `test/storage.test.js`

**Interfaces:**
- Consumes: a base directory string.
- Produces:
  - `createStorage(baseDir: string): StorageApi`
  - `StorageApi.ensureReady(): Promise<void>`
  - `StorageApi.readNote(): Promise<string>`
  - `StorageApi.writeNote(content: string): Promise<void>`
  - `StorageApi.archiveNote(now?: Date): Promise<{ archivedPath: string, archivedContent: string }>`

- [ ] **Step 1: Write failing storage tests**

Create `test/storage.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createStorage } = require("../src/main/storage");

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "tomorrow-desk-"));
}

test("readNote creates an empty active note when missing", async () => {
  const dir = await tempDir();
  const storage = createStorage(dir);

  const note = await storage.readNote();
  const saved = await fs.readFile(path.join(dir, "tomorrow.md"), "utf8");

  assert.equal(note, "");
  assert.equal(saved, "");
});

test("writeNote persists the active note", async () => {
  const dir = await tempDir();
  const storage = createStorage(dir);

  await storage.writeNote("Wake up and continue the Electron window.");

  assert.equal(await storage.readNote(), "Wake up and continue the Electron window.");
});

test("archiveNote copies note to timestamped archive and clears active note", async () => {
  const dir = await tempDir();
  const storage = createStorage(dir);
  await storage.writeNote("Archive this handoff.");

  const result = await storage.archiveNote(new Date("2026-06-26T07:08:00+08:00"));

assert.match(result.archivedPath, /archives[\\/]+2026-06-26-0708\.md$/);
  assert.equal(result.archivedContent, "Archive this handoff.");
  assert.equal(await fs.readFile(result.archivedPath, "utf8"), "Archive this handoff.");
  assert.equal(await storage.readNote(), "");
});

test("archiveNote leaves active note intact if archive write fails", async () => {
  const dir = await tempDir();
  const storage = createStorage(dir);
  await storage.writeNote("Do not lose this.");

  await fs.writeFile(path.join(dir, "archives"), "not a directory", "utf8");

  await assert.rejects(
    () => storage.archiveNote(new Date("2026-06-26T07:08:00+08:00")),
    /ENOTDIR|EEXIST|not a directory/i
  );
  assert.equal(await storage.readNote(), "Do not lose this.");
});
```

- [ ] **Step 2: Run storage tests to verify they fail**

Run: `npm test -- test/storage.test.js`

Expected: FAIL because `../src/main/storage` does not exist.

- [ ] **Step 3: Implement storage module**

Create `src/main/storage.js`:

```js
const fs = require("node:fs/promises");
const path = require("node:path");

function pad(value) {
  return String(value).padStart(2, "0");
}

function timestampFor(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + "-" + pad(date.getHours()) + pad(date.getMinutes());
}

function createStorage(baseDir) {
  const notePath = path.join(baseDir, "tomorrow.md");
  const archivesDir = path.join(baseDir, "archives");

  async function ensureReady() {
    await fs.mkdir(baseDir, { recursive: true });
  }

  async function readNote() {
    await ensureReady();
    try {
      return await fs.readFile(notePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await fs.writeFile(notePath, "", "utf8");
      return "";
    }
  }

  async function writeNote(content) {
    await ensureReady();
    await fs.writeFile(notePath, content, "utf8");
  }

  async function archiveNote(now = new Date()) {
    await ensureReady();
    const archivedContent = await readNote();
    await fs.mkdir(archivesDir, { recursive: true });
    const archivedPath = path.join(archivesDir, `${timestampFor(now)}.md`);
    await fs.writeFile(archivedPath, archivedContent, "utf8");
    await writeNote("");
    return { archivedPath, archivedContent };
  }

  return { ensureReady, readNote, writeNote, archiveNote };
}

module.exports = { createStorage, timestampFor };
```

- [ ] **Step 4: Run storage tests to verify they pass**

Run: `npm test -- test/storage.test.js`

Expected: PASS for all storage tests.

- [ ] **Step 5: Commit storage module**

Run:

```bash
git add src/main/storage.js test/storage.test.js
git commit -m "feat: add local note storage"
```

Expected: commit succeeds.

---

### Task 3: Preferences Storage

**Files:**
- Create: `src/main/preferences.js`
- Create: `test/preferences.test.js`

**Interfaces:**
- Consumes: a base directory string.
- Produces:
  - `DEFAULT_PREFERENCES`
  - `createPreferencesStore(baseDir: string): PreferencesStore`
  - `PreferencesStore.load(): Promise<Preferences>`
  - `PreferencesStore.save(nextPreferences: Partial<Preferences>): Promise<Preferences>`

- [ ] **Step 1: Write failing preference tests**

Create `test/preferences.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DEFAULT_PREFERENCES, createPreferencesStore } = require("../src/main/preferences");

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "tomorrow-desk-prefs-"));
}

test("load returns default preferences when preferences file is missing", async () => {
  const dir = await tempDir();
  const store = createPreferencesStore(dir);

  assert.deepEqual(await store.load(), DEFAULT_PREFERENCES);
});

test("save merges preferences and persists them", async () => {
  const dir = await tempDir();
  const store = createPreferencesStore(dir);

  const saved = await store.save({
    alwaysOnTop: false,
    launchAtLogin: false,
    bounds: { width: 600, height: 700, x: 20, y: 30 }
  });

  assert.equal(saved.alwaysOnTop, false);
  assert.equal(saved.launchAtLogin, false);
  assert.deepEqual(saved.bounds, { width: 600, height: 700, x: 20, y: 30 });
  assert.deepEqual(await store.load(), saved);
});

test("load falls back to defaults when preferences JSON is corrupt", async () => {
  const dir = await tempDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "preferences.json"), "{broken", "utf8");

  const store = createPreferencesStore(dir);

  assert.deepEqual(await store.load(), DEFAULT_PREFERENCES);
});
```

- [ ] **Step 2: Run preference tests to verify they fail**

Run: `npm test -- test/preferences.test.js`

Expected: FAIL because `../src/main/preferences` does not exist.

- [ ] **Step 3: Implement preferences module**

Create `src/main/preferences.js`:

```js
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_PREFERENCES = Object.freeze({
  alwaysOnTop: true,
  launchAtLogin: true,
  bounds: {
    width: 520,
    height: 640,
    x: null,
    y: null
  },
  lastArchiveAt: null
});

function normalizePreferences(value) {
  const input = value && typeof value === "object" ? value : {};
  const bounds = input.bounds && typeof input.bounds === "object" ? input.bounds : {};

  return {
    alwaysOnTop: typeof input.alwaysOnTop === "boolean" ? input.alwaysOnTop : DEFAULT_PREFERENCES.alwaysOnTop,
    launchAtLogin: typeof input.launchAtLogin === "boolean" ? input.launchAtLogin : DEFAULT_PREFERENCES.launchAtLogin,
    bounds: {
      width: Number.isFinite(bounds.width) ? bounds.width : DEFAULT_PREFERENCES.bounds.width,
      height: Number.isFinite(bounds.height) ? bounds.height : DEFAULT_PREFERENCES.bounds.height,
      x: Number.isFinite(bounds.x) ? bounds.x : DEFAULT_PREFERENCES.bounds.x,
      y: Number.isFinite(bounds.y) ? bounds.y : DEFAULT_PREFERENCES.bounds.y
    },
    lastArchiveAt: typeof input.lastArchiveAt === "string" ? input.lastArchiveAt : DEFAULT_PREFERENCES.lastArchiveAt
  };
}

function createPreferencesStore(baseDir) {
  const preferencesPath = path.join(baseDir, "preferences.json");

  async function load() {
    try {
      const raw = await fs.readFile(preferencesPath, "utf8");
      return normalizePreferences(JSON.parse(raw));
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) {
        return { ...DEFAULT_PREFERENCES, bounds: { ...DEFAULT_PREFERENCES.bounds } };
      }
      throw error;
    }
  }

  async function save(nextPreferences) {
    await fs.mkdir(baseDir, { recursive: true });
    const current = await load();
    const merged = normalizePreferences({
      ...current,
      ...nextPreferences,
      bounds: {
        ...current.bounds,
        ...(nextPreferences && nextPreferences.bounds ? nextPreferences.bounds : {})
      }
    });
    await fs.writeFile(preferencesPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    return merged;
  }

  return { load, save };
}

module.exports = { DEFAULT_PREFERENCES, createPreferencesStore, normalizePreferences };
```

- [ ] **Step 4: Run preference tests to verify they pass**

Run: `npm test -- test/preferences.test.js`

Expected: PASS for all preference tests.

- [ ] **Step 5: Commit preferences module**

Run:

```bash
git add src/main/preferences.js test/preferences.test.js
git commit -m "feat: add app preferences storage"
```

Expected: commit succeeds.

---

### Task 4: Electron Main Process, IPC, Tray, And Launch At Login

**Files:**
- Create: `src/main/index.js`
- Create: `src/preload.js`

**Interfaces:**
- Consumes:
  - `createStorage(baseDir)` from `src/main/storage.js`
  - `createPreferencesStore(baseDir)` from `src/main/preferences.js`
- Produces renderer bridge APIs:
  - `window.tomorrowDesk.loadNote(): Promise<string>`
  - `window.tomorrowDesk.saveNote(content: string): Promise<void>`
  - `window.tomorrowDesk.archiveNote(): Promise<{ archivedPath: string, archivedContent: string }>`
  - `window.tomorrowDesk.getPreferences(): Promise<Preferences>`
  - `window.tomorrowDesk.setAlwaysOnTop(enabled: boolean): Promise<Preferences>`
  - `window.tomorrowDesk.setLaunchAtLogin(enabled: boolean): Promise<Preferences>`
  - `window.tomorrowDesk.minimize(): Promise<void>`
  - `window.tomorrowDesk.hideToTray(): Promise<void>`

- [ ] **Step 1: Create preload bridge**

Create `src/preload.js`:

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tomorrowDesk", {
  loadNote: () => ipcRenderer.invoke("note:load"),
  saveNote: (content) => ipcRenderer.invoke("note:save", content),
  archiveNote: () => ipcRenderer.invoke("note:archive"),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("preferences:setAlwaysOnTop", enabled),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke("preferences:setLaunchAtLogin", enabled),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  hideToTray: () => ipcRenderer.invoke("window:hideToTray")
});
```

- [ ] **Step 2: Create main process**

Create `src/main/index.js`:

```js
const path = require("node:path");
const { app, BrowserWindow, Menu, Tray, ipcMain, screen, nativeImage } = require("electron");
const { createStorage } = require("./storage");
const { createPreferencesStore } = require("./preferences");

let mainWindow = null;
let tray = null;
let isQuitting = false;
let storage = null;
let preferencesStore = null;

function defaultBounds(preferences) {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const width = preferences.bounds.width;
  const height = preferences.bounds.height;
  const x = Number.isFinite(preferences.bounds.x)
    ? preferences.bounds.x
    : Math.round(workArea.x + workArea.width - width - 32);
  const y = Number.isFinite(preferences.bounds.y)
    ? preferences.bounds.y
    : Math.round(workArea.y + 48);

  return { width, height, x, y };
}

async function applyLaunchAtLogin(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false
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
  const result = await storage.archiveNote(new Date());
  await preferencesStore.save({ lastArchiveAt: new Date().toISOString() });
  if (mainWindow) {
    mainWindow.webContents.send("note:archived", result);
  }
  return result;
}

function createTray() {
  const image = nativeImage.createEmpty();
  tray = new Tray(image);
  tray.setToolTip("Tomorrow Desk");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show", click: showWindow },
    { label: "Archive", click: () => archiveFromMain().catch(console.error) },
    { type: "separator" },
    {
      label: "Quit",
      click: async () => {
        isQuitting = true;
        await saveWindowBounds();
        app.quit();
      }
    }
  ]));
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
      nodeIntegration: false
    }
  });

  await mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.once("ready-to-show", showWindow);

  mainWindow.on("close", async (event) => {
    if (isQuitting) {
      await saveWindowBounds();
      return;
    }
    event.preventDefault();
    await saveWindowBounds();
    mainWindow.hide();
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
  ipcMain.handle("note:save", (_event, content) => storage.writeNote(String(content ?? "")));
  ipcMain.handle("note:archive", () => archiveFromMain());
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
```

- [ ] **Step 3: Run all unit tests**

Run: `npm test`

Expected: PASS for storage and preferences suites.

- [ ] **Step 4: Run Electron syntax checks**

Run:

```bash
node -c src/main/index.js
node -c src/preload.js
```

Expected: both commands exit with code 0.

- [ ] **Step 5: Commit main process**

Run:

```bash
git add src/main/index.js src/preload.js
git commit -m "feat: add Electron shell and native lifecycle"
```

Expected: commit succeeds.

---

### Task 5: Renderer UI And Autosave

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/styles.css`
- Create: `src/renderer/renderer.js`

**Interfaces:**
- Consumes: `window.tomorrowDesk` APIs from `src/preload.js`.
- Produces: visible editor, autosave status, archive button, always-on-top toggle, launch-at-login toggle, minimize, and hide-to-tray controls.

- [ ] **Step 1: Create renderer HTML**

Create `src/renderer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tomorrow Desk</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="app-shell">
      <header class="titlebar">
        <section class="brand">
          <span class="brand-mark">TD</span>
          <div>
            <h1>Tomorrow Desk</h1>
            <p id="todayLabel">Morning handoff</p>
          </div>
        </section>
        <nav class="window-actions" aria-label="Window actions">
          <button id="topToggle" class="icon-button" type="button" title="Toggle always on top">Top</button>
          <button id="loginToggle" class="icon-button" type="button" title="Toggle launch at login">Login</button>
          <button id="minimizeButton" class="icon-button" type="button" title="Minimize">_</button>
          <button id="closeButton" class="icon-button" type="button" title="Hide to tray">x</button>
        </nav>
      </header>

      <section id="errorBanner" class="error-banner" hidden></section>

      <textarea
        id="noteEditor"
        class="note-editor"
        spellcheck="true"
        placeholder="Write the first thing your future self should see tomorrow morning..."
      ></textarea>

      <footer class="statusbar">
        <span id="saveStatus">Loading...</span>
        <div class="footer-actions">
          <span id="wordCount">0 words</span>
          <button id="archiveButton" class="archive-button" type="button">Archive and clear</button>
        </div>
      </footer>
    </main>
    <script src="./renderer.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create black-and-gold styles**

Create `src/renderer/styles.css`:

```css
:root {
  --black: #080806;
  --panel: #11100c;
  --panel-soft: #17150f;
  --gold: #d8b45d;
  --gold-soft: #f0d891;
  --gold-muted: #8f7741;
  --text: #f5edda;
  --muted: #a79b80;
  --danger: #ffb3a7;
}

* {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: var(--black);
  color: var(--text);
  font-family: "Segoe UI", "Microsoft YaHei UI", Arial, sans-serif;
}

body {
  border: 1px solid rgba(216, 180, 93, 0.55);
}

.app-shell {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  height: 100vh;
  min-width: 360px;
  background:
    linear-gradient(180deg, rgba(216, 180, 93, 0.08), transparent 36%),
    var(--black);
}

.titlebar {
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgba(216, 180, 93, 0.22);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(216, 180, 93, 0.7);
  border-radius: 8px;
  color: var(--gold-soft);
  font-weight: 700;
  letter-spacing: 0.04em;
  background: rgba(216, 180, 93, 0.08);
}

h1,
p {
  margin: 0;
}

h1 {
  color: var(--gold-soft);
  font-size: 17px;
  font-weight: 650;
}

.brand p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
}

.window-actions {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 8px;
}

button {
  font: inherit;
}

.icon-button,
.archive-button {
  border: 1px solid rgba(216, 180, 93, 0.32);
  border-radius: 8px;
  color: var(--text);
  background: rgba(216, 180, 93, 0.08);
  cursor: pointer;
}

.icon-button {
  min-width: 36px;
  height: 30px;
  padding: 0 8px;
  font-size: 11px;
}

.icon-button.is-active {
  color: var(--black);
  border-color: var(--gold-soft);
  background: var(--gold);
}

.icon-button:hover,
.archive-button:hover {
  border-color: var(--gold-soft);
}

.error-banner {
  margin: 12px 18px 0;
  padding: 10px 12px;
  border: 1px solid rgba(255, 179, 167, 0.45);
  border-radius: 8px;
  color: var(--danger);
  background: rgba(255, 179, 167, 0.08);
  font-size: 13px;
}

.note-editor {
  width: calc(100% - 36px);
  height: calc(100% - 24px);
  margin: 14px 18px 10px;
  padding: 20px;
  resize: none;
  border: 1px solid rgba(216, 180, 93, 0.28);
  border-radius: 8px;
  outline: none;
  color: var(--text);
  background: rgba(17, 16, 12, 0.9);
  font-size: 16px;
  line-height: 1.65;
}

.note-editor:focus {
  border-color: rgba(240, 216, 145, 0.8);
  box-shadow: 0 0 0 3px rgba(216, 180, 93, 0.12);
}

.note-editor::placeholder {
  color: rgba(167, 155, 128, 0.66);
}

.statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px 16px;
  color: var(--muted);
  font-size: 12px;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.archive-button {
  padding: 8px 11px;
  color: var(--gold-soft);
}
```

- [ ] **Step 3: Create renderer behavior**

Create `src/renderer/renderer.js`:

```js
const editor = document.querySelector("#noteEditor");
const saveStatus = document.querySelector("#saveStatus");
const wordCount = document.querySelector("#wordCount");
const archiveButton = document.querySelector("#archiveButton");
const topToggle = document.querySelector("#topToggle");
const loginToggle = document.querySelector("#loginToggle");
const minimizeButton = document.querySelector("#minimizeButton");
const closeButton = document.querySelector("#closeButton");
const errorBanner = document.querySelector("#errorBanner");
const todayLabel = document.querySelector("#todayLabel");

let saveTimer = null;
let lastSavedContent = "";

function setStatus(message) {
  saveStatus.textContent = message;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.textContent = "";
  errorBanner.hidden = true;
}

function updateWordCount() {
  const trimmed = editor.value.trim();
  const count = trimmed ? trimmed.split(/\s+/).length : 0;
  wordCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
}

function updateDateLabel() {
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  todayLabel.textContent = formatter.format(new Date());
}

async function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (editor.value === lastSavedContent) {
    setStatus("Saved");
    return;
  }

  try {
    setStatus("Saving...");
    await window.tomorrowDesk.saveNote(editor.value);
    lastSavedContent = editor.value;
    clearError();
    setStatus("Saved");
  } catch (error) {
    showError("Could not save. Keep this window open and try again.");
    setStatus("Save failed");
  }
}

function scheduleSave() {
  setStatus("Unsaved changes");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveNow();
  }, 450);
}

function applyPreferenceButtons(preferences) {
  topToggle.classList.toggle("is-active", preferences.alwaysOnTop);
  loginToggle.classList.toggle("is-active", preferences.launchAtLogin);
}

async function boot() {
  updateDateLabel();
  try {
    const [note, preferences] = await Promise.all([
      window.tomorrowDesk.loadNote(),
      window.tomorrowDesk.getPreferences()
    ]);
    editor.value = note;
    lastSavedContent = note;
    updateWordCount();
    applyPreferenceButtons(preferences);
    setStatus("Saved");
    editor.focus();
  } catch (error) {
    showError("Could not load your handoff note.");
    setStatus("Load failed");
  }
}

editor.addEventListener("input", () => {
  updateWordCount();
  scheduleSave();
});

archiveButton.addEventListener("click", async () => {
  const shouldArchive = window.confirm("Archive this handoff and clear the editor?");
  if (!shouldArchive) {
    return;
  }
  try {
    await saveNow();
    setStatus("Archiving...");
    await window.tomorrowDesk.archiveNote();
    editor.value = "";
    lastSavedContent = "";
    updateWordCount();
    clearError();
    setStatus("Archived");
  } catch (error) {
    showError("Archive failed. The active note was not cleared.");
    setStatus("Archive failed");
  }
});

topToggle.addEventListener("click", async () => {
  try {
    const nextEnabled = !topToggle.classList.contains("is-active");
    const preferences = await window.tomorrowDesk.setAlwaysOnTop(nextEnabled);
    applyPreferenceButtons(preferences);
  } catch (error) {
    showError("Could not update always-on-top.");
  }
});

loginToggle.addEventListener("click", async () => {
  try {
    const nextEnabled = !loginToggle.classList.contains("is-active");
    const preferences = await window.tomorrowDesk.setLaunchAtLogin(nextEnabled);
    applyPreferenceButtons(preferences);
  } catch (error) {
    showError("Could not update launch-at-login.");
  }
});

minimizeButton.addEventListener("click", () => {
  window.tomorrowDesk.minimize();
});

closeButton.addEventListener("click", async () => {
  await saveNow();
  window.tomorrowDesk.hideToTray();
});

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    window.tomorrowDesk.saveNote(editor.value);
  }
});

boot();
```

- [ ] **Step 4: Run all unit tests**

Run: `npm test`

Expected: PASS for storage and preferences suites.

- [ ] **Step 5: Run Electron UI smoke test**

Run: `npm start`

Expected:

- A black-and-gold frameless window opens.
- The editor is visible and focused.
- Typing changes the footer to "Unsaved changes" and then "Saved".
- Top and Login buttons visually toggle.
- Minimize works.
- Close hides the window instead of quitting.

- [ ] **Step 6: Commit renderer**

Run:

```bash
git add src/renderer/index.html src/renderer/styles.css src/renderer/renderer.js
git commit -m "feat: add black and gold handoff editor"
```

Expected: commit succeeds.

---

### Task 6: End-To-End Verification And Documentation Polish

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: complete Electron app from previous tasks.
- Produces: final run instructions and a verified checklist for v1 acceptance criteria.

- [ ] **Step 1: Update README with verification checklist**

Modify `README.md` so it contains:

```markdown
# Tomorrow Desk

Tomorrow Desk is a small Windows Electron app for writing tomorrow's handoff note before shutdown and showing it again as a floating desktop window after login.

## Commands

- `npm install`
- `npm test`
- `npm start`

## v1 Behavior

- Notes are stored locally in Electron's user data directory as `tomorrow.md`.
- Archives are stored under `archives/YYYY-MM-DD-HHmm.md`.
- The app autosaves while typing.
- The main window is black-and-gold, always-on-top by default, draggable, and resizable.
- Closing the window hides it to the system tray.
- Launch-at-login is enabled by default through Electron when the app starts.

## Manual Verification

1. Run `npm test` and confirm all tests pass.
2. Run `npm start` and confirm the black-and-gold floating editor opens.
3. Type a note, wait for the status to show `Saved`, quit from the tray, then run `npm start` again and confirm the note returns.
4. Click `Archive and clear`, confirm the editor clears, and confirm no active note content is lost if an archive error occurs in unit tests.
5. Confirm `Top` toggles always-on-top styling and `Login` toggles launch-at-login preference.
```

- [ ] **Step 2: Run full automated tests**

Run: `npm test`

Expected: PASS for all test suites.

- [ ] **Step 3: Run app restart persistence check**

Run: `npm start`

Expected:

- App opens without main-process errors.
- Type `Continue Tomorrow Desk polish`.
- Wait until the status says `Saved`.
- Quit from the tray menu.
- Run `npm start` again.
- The editor still contains `Continue Tomorrow Desk polish`.

- [ ] **Step 4: Run acceptance checklist**

Check these items manually against the running app:

- The user can type tomorrow's tasks into a visible document area.
- The note autosaves locally and survives app restart.
- The app registers itself to start after Windows login by default, with a visible setting to disable this behavior later.
- On startup, the app opens a floating window showing the saved note.
- The window supports drag, resize, minimize, and always-on-top.
- The UI uses a simple black-and-gold theme and avoids dense task-management complexity.
- The user can archive the current note and start a fresh handoff.

- [ ] **Step 5: Commit final polish**

Run:

```bash
git add README.md
git commit -m "docs: document Tomorrow Desk verification"
```

Expected: commit succeeds.

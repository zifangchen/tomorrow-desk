const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function makeElement() {
  const classes = new Set();
  return {
    value: "",
    textContent: "",
    hidden: false,
    focused: false,
    handlers: {},
    classList: {
      toggle(name, force) {
        if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      },
      contains(name) {
        return classes.has(name);
      },
    },
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    },
    focus() {
      this.focused = true;
    },
  };
}

async function runRenderer(overrides = {}) {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "renderer.js"),
    "utf8"
  );
  const elements = new Map([
    ["#noteEditor", makeElement()],
    ["#saveStatus", makeElement()],
    ["#wordCount", makeElement()],
    ["#archiveButton", makeElement()],
    ["#topToggle", makeElement()],
    ["#loginToggle", makeElement()],
    ["#minimizeButton", makeElement()],
    ["#closeButton", makeElement()],
    ["#errorBanner", makeElement()],
    ["#todayLabel", makeElement()],
  ]);
  const windowHandlers = {};
  const savedNotes = [];
  const archiveCalls = [];
  const completedFlushes = [];
  const hiddenToTray = [];
  const saveNote =
    overrides.saveNote ||
    (async (content) => {
      savedNotes.push(content);
    });

  const sandbox = {
    document: {
      querySelector(selector) {
        return elements.get(selector);
      },
    },
    window: {
      tomorrowDesk: {
        loadNote: async () => "Keep this only until archived",
        getPreferences: async () => ({ alwaysOnTop: true, launchAtLogin: true }),
        saveNote,
        archiveNote: async () => {
          archiveCalls.push(true);
          return {
            archivedPath: "archive.md",
            archivedContent: "Keep this only until archived",
          };
        },
        setAlwaysOnTop: async (enabled) => ({
          alwaysOnTop: enabled,
          launchAtLogin: true,
        }),
        setLaunchAtLogin: async (enabled) => ({
          alwaysOnTop: true,
          launchAtLogin: enabled,
        }),
        minimize: async () => {},
        hideToTray: async () => {
          hiddenToTray.push(true);
        },
        completeFlush: async (requestId, result) => {
          completedFlushes.push({ requestId, result });
        },
      },
      confirm: () => true,
      addEventListener(type, handler) {
        windowHandlers[type] = handler;
      },
    },
    Intl,
    Date,
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(code, sandbox, { filename: "src/renderer/renderer.js" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { elements, windowHandlers, savedNotes, archiveCalls, completedFlushes, hiddenToTray };
}

test("renderer clears the visible note when the main process archives from tray", async () => {
  const { elements, windowHandlers } = await runRenderer();
  const editor = elements.get("#noteEditor");
  const saveStatus = elements.get("#saveStatus");
  const wordCount = elements.get("#wordCount");

  assert.equal(editor.value, "Keep this only until archived");
  assert.equal(typeof windowHandlers["tomorrow-desk:note-archived"], "function");

  windowHandlers["tomorrow-desk:note-archived"]({
    detail: {
      archivedPath: "archive.md",
      archivedContent: "Keep this only until archived",
    },
  });

  assert.equal(editor.value, "");
  assert.equal(saveStatus.textContent, "Archived");
  assert.equal(wordCount.textContent, "0 words");
});

test("renderer keeps unsaved text and skips archive when pre-archive save fails", async () => {
  const { elements, archiveCalls } = await runRenderer({
    saveNote: async () => {
      throw new Error("disk full");
    },
  });
  const editor = elements.get("#noteEditor");
  const archiveButton = elements.get("#archiveButton");
  const saveStatus = elements.get("#saveStatus");

  editor.value = "This must stay visible";
  await archiveButton.handlers.click();

  assert.equal(editor.value, "This must stay visible");
  assert.equal(archiveCalls.length, 0);
  assert.equal(saveStatus.textContent, "Archive failed");
});

test("renderer saves pending text before acknowledging a main-process flush request", async () => {
  const { elements, windowHandlers, savedNotes, completedFlushes } = await runRenderer();
  const editor = elements.get("#noteEditor");

  editor.value = "Flush this before quitting";
  editor.handlers.input();
  await windowHandlers["tomorrow-desk:flush-request"]({
    detail: { requestId: "flush-1" },
  });

  assert.deepEqual(savedNotes, ["Flush this before quitting"]);
  assert.equal(completedFlushes.length, 1);
  assert.equal(completedFlushes[0].requestId, "flush-1");
  assert.equal(completedFlushes[0].result.ok, true);
});

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

async function runRenderer() {
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
        saveNote: async (content) => {
          savedNotes.push(content);
        },
        archiveNote: async () => ({
          archivedPath: "archive.md",
          archivedContent: "Keep this only until archived",
        }),
        setAlwaysOnTop: async (enabled) => ({
          alwaysOnTop: enabled,
          launchAtLogin: true,
        }),
        setLaunchAtLogin: async (enabled) => ({
          alwaysOnTop: true,
          launchAtLogin: enabled,
        }),
        minimize: async () => {},
        hideToTray: async () => {},
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

  return { elements, windowHandlers, savedNotes };
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

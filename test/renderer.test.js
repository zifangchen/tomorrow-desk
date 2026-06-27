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
    innerHTML: "",
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
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    dataset: {},
  };
}

async function runRenderer(overrides = {}) {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "renderer.js"),
    "utf8"
  );
  const elements = new Map([
    [".app-shell", makeElement()],
    ["#noteEditor", makeElement()],
    ["#linkInput", makeElement()],
    ["#saveStatus", makeElement()],
    ["#wordCount", makeElement()],
    ["#archiveButton", makeElement()],
    ["#taskList", makeElement()],
    ["#topToggle", makeElement()],
    ["#loginToggle", makeElement()],
    ["#themeToggle", makeElement()],
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
      body: makeElement(),
      querySelector(selector) {
        return elements.get(selector);
      },
    },
    window: {
      tomorrowDesk: {
        loadNote: overrides.loadNote || (async () => "Keep this only until archived"),
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

test("renderer clears the visible note and refocuses editor when the main process archives from tray", async () => {
  const { elements, windowHandlers } = await runRenderer();
  const editor = elements.get("#noteEditor");
  const saveStatus = elements.get("#saveStatus");
  const wordCount = elements.get("#wordCount");

  assert.equal(editor.value, "Keep this only until archived");
  assert.equal(typeof windowHandlers["tomorrow-desk:note-archived"], "function");

  editor.focused = false;
  windowHandlers["tomorrow-desk:note-archived"]({
    detail: {
      archivedPath: "archive.md",
      archivedContent: "Keep this only until archived",
    },
  });

  assert.equal(editor.value, "");
  assert.equal(saveStatus.textContent, "Archived");
  assert.equal(wordCount.textContent, "0 words");
  assert.equal(editor.focused, true);
});

test("renderer clear button clears without archiving and places cursor in editor", async () => {
  const { elements, archiveCalls, savedNotes } = await runRenderer();
  const editor = elements.get("#noteEditor");
  const archiveButton = elements.get("#archiveButton");

  editor.value = "Clear this draft";
  editor.focused = false;
  await archiveButton.handlers.click();

  assert.equal(editor.value, "");
  assert.equal(archiveCalls.length, 0);
  assert.equal(savedNotes.at(-1), "");
  assert.equal(editor.focused, true);
  assert.equal(editor.selectionStart, 0);
  assert.equal(editor.selectionEnd, 0);
});

test("renderer keeps unsaved text when clear save fails", async () => {
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
  assert.equal(saveStatus.textContent, "Clear failed");
});

test("renderer commits Enter input as a saved task item below the editor", async () => {
  const { elements, savedNotes } = await runRenderer({ loadNote: async () => "" });
  const editor = elements.get("#noteEditor");
  const taskList = elements.get("#taskList");

  editor.value = "完成论文初稿";
  editor.focused = false;
  await editor.handlers.keydown({
    key: "Enter",
    shiftKey: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  });

  assert.equal(editor.value, "");
  assert.equal(editor.focused, true);
  assert.match(taskList.textContent, /完成论文初稿/);
  assert.match(savedNotes.at(-1), /- 完成论文初稿/);
});

test("renderer commits an optional related link as a clickable task link", async () => {
  const { elements, savedNotes } = await runRenderer({ loadNote: async () => "" });
  const editor = elements.get("#noteEditor");
  const linkInput = elements.get("#linkInput");
  const taskList = elements.get("#taskList");

  editor.value = "Read the project page";
  linkInput.value = "example.com";
  await editor.handlers.keydown({
    key: "Enter",
    shiftKey: false,
    preventDefault() {},
  });

  assert.equal(editor.value, "");
  assert.equal(linkInput.value, "");
  assert.match(taskList.innerHTML, /href="https:\/\/example\.com"/);
  assert.match(taskList.innerHTML, /target="_blank"/);
  assert.match(savedNotes.at(-1), /相关链接: \[example\.com\]\(https:\/\/example\.com\)/);
});

test("renderer deletes one saved task without clearing the others", async () => {
  const { elements, savedNotes } = await runRenderer({ loadNote: async () => "" });
  const editor = elements.get("#noteEditor");
  const taskList = elements.get("#taskList");

  editor.value = "第一件事";
  await editor.handlers.keydown({
    key: "Enter",
    shiftKey: false,
    preventDefault() {},
  });
  editor.value = "第二件事";
  await editor.handlers.keydown({
    key: "Enter",
    shiftKey: false,
    preventDefault() {},
  });

  await taskList.handlers.click({
    target: {
      closest(selector) {
        assert.equal(selector, ".task-delete-button");
        return { dataset: { taskIndex: "0" } };
      },
    },
  });

  assert.doesNotMatch(taskList.textContent, /第一件事/);
  assert.match(taskList.textContent, /第二件事/);
  assert.doesNotMatch(savedNotes.at(-1), /第一件事/);
  assert.match(savedNotes.at(-1), /- 第二件事/);
});

test("renderer keeps Shift+Enter available for multiline input", async () => {
  const { elements, savedNotes } = await runRenderer({ loadNote: async () => "" });
  const editor = elements.get("#noteEditor");
  const taskList = elements.get("#taskList");
  const event = {
    key: "Enter",
    shiftKey: true,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };

  editor.value = "第一行";
  await editor.handlers.keydown(event);

  assert.equal(event.defaultPrevented, false);
  assert.equal(editor.value, "第一行");
  assert.equal(taskList.textContent, "");
  assert.deepEqual(savedNotes, []);
});

test("renderer focuses editor when the writing background is clicked", async () => {
  const { elements } = await runRenderer({ loadNote: async () => "" });
  const appShell = elements.get(".app-shell");
  const editor = elements.get("#noteEditor");

  editor.focused = false;
  appShell.handlers.click({
    target: {
      closest(selector) {
        assert.equal(selector, "button, textarea, input, .titlebar");
        return null;
      },
    },
  });

  assert.equal(editor.focused, true);
});

test("renderer cycles through visual themes from the title bar", async () => {
  const { elements } = await runRenderer({ loadNote: async () => "" });
  const themeToggle = elements.get("#themeToggle");

  assert.equal(themeToggle.textContent, "Theme");
  assert.equal(themeToggle.title, "Theme: Black Gold");

  themeToggle.handlers.click();

  assert.equal(themeToggle.textContent, "Ocean");
  assert.equal(themeToggle.title, "Theme: Ocean Gold");
});

test("renderer saves pending text before acknowledging a main-process flush request", async () => {
  const { elements, windowHandlers, savedNotes, completedFlushes } = await runRenderer();
  const editor = elements.get("#noteEditor");
  const linkInput = elements.get("#linkInput");

  editor.value = "Flush this before quitting";
  linkInput.value = "https://example.com/reference";
  editor.handlers.input();
  await windowHandlers["tomorrow-desk:flush-request"]({
    detail: { requestId: "flush-1" },
  });

  assert.equal(savedNotes.length, 1);
  assert.match(savedNotes[0], /## 当前输入/);
  assert.match(savedNotes[0], /Flush this before quitting/);
  assert.match(savedNotes[0], /## 相关链接/);
  assert.match(savedNotes[0], /https:\/\/example\.com\/reference/);
  assert.equal(completedFlushes.length, 1);
  assert.equal(completedFlushes[0].requestId, "flush-1");
  assert.equal(completedFlushes[0].result.ok, true);
});

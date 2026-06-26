const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function runPreload() {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "preload.js"), "utf8");
  const exposed = {};
  const ipcHandlers = new Map();
  const dispatched = [];

  const sandbox = {
    require(moduleName) {
      if (moduleName !== "electron") {
        throw new Error(`Unexpected module: ${moduleName}`);
      }

      return {
        contextBridge: {
          exposeInMainWorld(name, api) {
            exposed[name] = api;
          },
        },
        ipcRenderer: {
          invoke(channel, ...args) {
            return Promise.resolve({ channel, args });
          },
          on(channel, handler) {
            ipcHandlers.set(channel, handler);
          },
        },
      };
    },
    window: {
      dispatchEvent(event) {
        dispatched.push(event);
      },
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
  };

  vm.runInNewContext(code, sandbox, { filename: "src/preload.js" });

  return { exposed, ipcHandlers, dispatched };
}

test("preload exposes the planned renderer API", () => {
  const { exposed } = runPreload();

  assert.deepEqual(Object.keys(exposed.tomorrowDesk).sort(), [
    "archiveNote",
    "completeFlush",
    "getPreferences",
    "hideToTray",
    "loadNote",
    "minimize",
    "saveNote",
    "setAlwaysOnTop",
    "setLaunchAtLogin",
  ]);
});

test("preload forwards flush requests to the renderer window", () => {
  const { ipcHandlers, dispatched } = runPreload();

  const handler = ipcHandlers.get("note:flush-request");
  assert.equal(typeof handler, "function");

  handler({}, { requestId: "flush-1" });

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, "tomorrow-desk:flush-request");
  assert.deepEqual(dispatched[0].detail, { requestId: "flush-1" });
});

test("preload forwards note archive events to the renderer window", () => {
  const { ipcHandlers, dispatched } = runPreload();
  const archived = {
    archivedPath: "C:\\temp\\archives\\2026-06-26-0708.md",
    archivedContent: "Done",
  };

  const handler = ipcHandlers.get("note:archived");
  assert.equal(typeof handler, "function");

  handler({}, archived);

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, "tomorrow-desk:note-archived");
  assert.deepEqual(dispatched[0].detail, archived);
});

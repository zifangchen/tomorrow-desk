const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("main window registers ready-to-show before loading renderer", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "index.js"),
    "utf8"
  );

  const readyToShowIndex = source.indexOf('mainWindow.once("ready-to-show"');
  const loadFileIndex = source.indexOf("await mainWindow.loadFile");

  assert.ok(readyToShowIndex > -1, "ready-to-show listener should exist");
  assert.ok(loadFileIndex > -1, "loadFile call should exist");
  assert.ok(
    readyToShowIndex < loadFileIndex,
    "ready-to-show listener must be registered before loadFile so startup cannot miss the event"
  );
});

test("main window opens external links in the system browser", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "index.js"),
    "utf8"
  );

  const handlerIndex = source.indexOf("mainWindow.webContents.setWindowOpenHandler");
  const loadFileIndex = source.indexOf("await mainWindow.loadFile");

  assert.ok(handlerIndex > -1, "window open handler should exist");
  assert.ok(source.includes("shell.openExternal(url)"));
  assert.ok(source.includes("return { action: \"deny\" };"));
  assert.ok(
    handlerIndex < loadFileIndex,
    "external link handler should be registered before renderer loads"
  );
});

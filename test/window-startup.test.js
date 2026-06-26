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

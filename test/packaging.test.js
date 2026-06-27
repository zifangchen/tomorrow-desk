const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("package metadata defines Windows packaging scripts and builder config", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );

  assert.equal(packageJson.scripts["prepare:assets"], "node scripts/create-icon.js");
  assert.equal(packageJson.scripts.pack, "npm run prepare:assets && electron-builder --dir");
  assert.equal(
    packageJson.scripts["dist:win"],
    "npm run prepare:assets && electron-builder --win nsis portable"
  );
  assert.equal(packageJson.build.productName, "Tomorrow Desk");
  assert.equal(packageJson.build.appId, "local.tomorrow-desk.app");
  assert.equal(packageJson.build.win.icon, "build/icon.ico");
  assert.deepEqual(packageJson.build.win.target, ["nsis", "portable"]);
});

test("generated package icon is a Windows ICO file", () => {
  const { createIconBuffer } = require("../scripts/create-icon");
  const icon = createIconBuffer();

  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  assert.equal(icon.readUInt16LE(4), 1);
  assert.equal(icon[6], 0);
  assert.equal(icon[7], 0);
  assert.ok(icon.length > 256 * 256 * 4);
});

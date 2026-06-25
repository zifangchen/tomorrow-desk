const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  DEFAULT_PREFERENCES,
  createPreferencesStore,
} = require("../src/main/preferences");

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
    bounds: { width: 600, height: 700, x: 20, y: 30 },
  });

  assert.equal(saved.alwaysOnTop, false);
  assert.equal(saved.launchAtLogin, false);
  assert.deepEqual(saved.bounds, { width: 600, height: 700, x: 20, y: 30 });
  assert.deepEqual(await store.load(), saved);
});

test("save preserves existing bounds fields when only one field is updated", async () => {
  const dir = await tempDir();
  const store = createPreferencesStore(dir);

  const firstSave = await store.save({
    bounds: { width: 600, height: 700, x: 20, y: 30 },
  });
  const secondSave = await store.save({
    bounds: { x: 99 },
  });

  assert.deepEqual(firstSave.bounds, { width: 600, height: 700, x: 20, y: 30 });
  assert.deepEqual(secondSave.bounds, { width: 600, height: 700, x: 99, y: 30 });
  assert.deepEqual(await store.load(), secondSave);
});

test("load falls back to defaults when preferences JSON is corrupt", async () => {
  const dir = await tempDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "preferences.json"), "{broken", "utf8");

  const store = createPreferencesStore(dir);

  assert.deepEqual(await store.load(), DEFAULT_PREFERENCES);
});

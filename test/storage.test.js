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

  assert.equal(
    await storage.readNote(),
    "Wake up and continue the Electron window."
  );
});

test("archiveNote copies note to timestamped archive and clears active note", async () => {
  const dir = await tempDir();
  const storage = createStorage(dir);
  await storage.writeNote("Archive this handoff.");

  const result = await storage.archiveNote(new Date("2026-06-26T07:08:00+08:00"));

  assert.match(result.archivedPath, /archives[\\/]+2026-06-26-0708\.md$/);
  assert.equal(result.archivedContent, "Archive this handoff.");
  assert.equal(
    await fs.readFile(result.archivedPath, "utf8"),
    "Archive this handoff."
  );
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

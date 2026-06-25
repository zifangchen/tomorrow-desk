const fs = require("node:fs/promises");
const path = require("node:path");

function pad(value) {
  return String(value).padStart(2, "0");
}

function timestampFor(date) {
  return (
    [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join("-") + "-" + pad(date.getHours()) + pad(date.getMinutes())
  );
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

module.exports = { createStorage };

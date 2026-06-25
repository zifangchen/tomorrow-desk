const assert = require("node:assert/strict");
const test = require("node:test");

const {
  archiveNoteFromMain,
  createTrayIcon,
  TRAY_ICON_DATA_URL,
} = require("../src/main/shell");

test("archiveNoteFromMain resolves after archiving even if lastArchiveAt save fails", async () => {
  const archived = {
    archivedPath: "C:\\temp\\archives\\2026-06-26-0708.md",
    archivedContent: "Ship the tray fix.",
  };
  const storage = {
    archiveNote: async () => archived,
  };
  const preferencesStore = {
    save: async () => {
      throw new Error("disk full");
    },
  };
  const sent = [];
  const mainWindow = {
    webContents: {
      send: (channel, payload) => {
        sent.push({ channel, payload });
      },
    },
  };
  const logged = [];
  const logger = {
    error: (...args) => {
      logged.push(args);
    },
  };
  const now = new Date("2026-06-26T07:08:00.000Z");

  const result = await archiveNoteFromMain({
    storage,
    preferencesStore,
    mainWindow,
    now,
    logger,
  });

  assert.deepEqual(result, archived);
  assert.deepEqual(sent, [{ channel: "note:archived", payload: archived }]);
  assert.equal(logged.length, 1);
  assert.match(String(logged[0][0]), /lastArchiveAt/i);
  assert.equal(logged[0][1].message, "disk full");
});

test("archiveNoteFromMain rejects and skips follow-up work if archiving fails", async () => {
  const error = new Error("archive failed");
  let saveCalls = 0;
  let sendCalls = 0;

  await assert.rejects(
    () =>
      archiveNoteFromMain({
        storage: {
          archiveNote: async () => {
            throw error;
          },
        },
        preferencesStore: {
          save: async () => {
            saveCalls += 1;
          },
        },
        mainWindow: {
          webContents: {
            send: () => {
              sendCalls += 1;
            },
          },
        },
        logger: console,
      }),
    /archive failed/
  );

  assert.equal(saveCalls, 0);
  assert.equal(sendCalls, 0);
});

test("createTrayIcon builds a visible PNG-backed tray image", () => {
  const calls = [];
  const nativeImage = {
    createFromDataURL: (value) => {
      calls.push(value);
      return { value };
    },
  };

  const trayIcon = createTrayIcon(nativeImage);

  assert.deepEqual(trayIcon, { value: TRAY_ICON_DATA_URL });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^data:image\/png;base64,/);

  const pngBytes = Buffer.from(calls[0].split(",")[1], "base64");
  assert.equal(pngBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(pngBytes.length > 100);
});

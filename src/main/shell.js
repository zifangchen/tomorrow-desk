const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAxSURBVDhPY+DgYPtPCWZAFyAVww04udiTJDzIDYCJoWNsakYNoJUBxOBBaAC5mGIDAJ2dxCSlxNxbAAAAAElFTkSuQmCC";

async function archiveNoteFromMain({
  storage,
  preferencesStore,
  mainWindow,
  now = new Date(),
  logger = console,
}) {
  const result = await storage.archiveNote(now);

  try {
    await preferencesStore.save({ lastArchiveAt: now.toISOString() });
  } catch (error) {
    logger.error("Failed to save lastArchiveAt after archiving note", error);
  }

  if (mainWindow) {
    mainWindow.webContents.send("note:archived", result);
  }

  return result;
}

function createTrayIcon(nativeImage) {
  return nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
}

module.exports = {
  archiveNoteFromMain,
  createTrayIcon,
  TRAY_ICON_DATA_URL,
};

const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAxSURBVDhPY+DgYPtPCWZAFyAVww04udiTJDzIDYCJoWNsakYNoJUBxOBBaAC5mGIDAJ2dxCSlxNxbAAAAAElFTkSuQmCC";
let nextFlushId = 1;

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

function resolveWindowBounds(preferences, workArea) {
  const width = preferences.bounds.width;
  const height = preferences.bounds.height;
  const minX = workArea.x + 32;
  const minY = workArea.y + 32;
  const maxX = workArea.x + workArea.width - width - 32;
  const maxY = workArea.y + workArea.height - height - 32;
  const defaultX = Math.round(maxX);
  const defaultY = Math.round(workArea.y + 48);
  const savedX = preferences.bounds.x;
  const savedY = preferences.bounds.y;
  const x = Number.isFinite(savedX)
    ? Math.min(Math.max(savedX, minX), maxX)
    : defaultX;
  const y = Number.isFinite(savedY)
    ? Math.min(Math.max(savedY, minY), maxY)
    : defaultY;

  return {
    width,
    height,
    x: Math.round(x),
    y: Math.round(y),
  };
}

function requestRendererFlush({
  mainWindow,
  pendingFlushes,
  timeoutMs = 5000,
  requestId = `flush-${nextFlushId++}`,
}) {
  if (!mainWindow || (mainWindow.isDestroyed && mainWindow.isDestroyed())) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingFlushes.delete(requestId);
      reject(new Error("Timed out waiting for renderer flush"));
    }, timeoutMs);

    pendingFlushes.set(requestId, { resolve, reject, timer });
    mainWindow.webContents.send("note:flush-request", { requestId });
  });
}

function finishRendererFlush(pendingFlushes, requestId, result) {
  const pending = pendingFlushes.get(requestId);
  if (!pending) {
    return false;
  }

  clearTimeout(pending.timer);
  pendingFlushes.delete(requestId);

  if (result && result.ok) {
    pending.resolve();
  } else {
    pending.reject(new Error((result && result.error) || "Renderer flush failed"));
  }

  return true;
}

module.exports = {
  archiveNoteFromMain,
  createTrayIcon,
  finishRendererFlush,
  requestRendererFlush,
  resolveWindowBounds,
  TRAY_ICON_DATA_URL,
};

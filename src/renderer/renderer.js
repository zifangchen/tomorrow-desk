const editor = document.querySelector("#noteEditor");
const saveStatus = document.querySelector("#saveStatus");
const wordCount = document.querySelector("#wordCount");
const archiveButton = document.querySelector("#archiveButton");
const topToggle = document.querySelector("#topToggle");
const loginToggle = document.querySelector("#loginToggle");
const minimizeButton = document.querySelector("#minimizeButton");
const closeButton = document.querySelector("#closeButton");
const errorBanner = document.querySelector("#errorBanner");
const todayLabel = document.querySelector("#todayLabel");

let saveTimer = null;
let lastSavedContent = "";

function setStatus(message) {
  saveStatus.textContent = message;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.textContent = "";
  errorBanner.hidden = true;
}

function updateWordCount() {
  const trimmed = editor.value.trim();
  const count = trimmed ? trimmed.split(/\s+/).length : 0;
  wordCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
}

function updateDateLabel() {
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  todayLabel.textContent = formatter.format(new Date());
}

async function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (editor.value === lastSavedContent) {
    setStatus("Saved");
    return;
  }

  try {
    setStatus("Saving...");
    await window.tomorrowDesk.saveNote(editor.value);
    lastSavedContent = editor.value;
    clearError();
    setStatus("Saved");
  } catch (error) {
    showError("Could not save. Keep this window open and try again.");
    setStatus("Save failed");
    throw error;
  }
}

function scheduleSave() {
  setStatus("Unsaved changes");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveNow();
  }, 450);
}

function applyPreferenceButtons(preferences) {
  topToggle.classList.toggle("is-active", preferences.alwaysOnTop);
  loginToggle.classList.toggle("is-active", preferences.launchAtLogin);
}

async function boot() {
  updateDateLabel();
  try {
    const [note, preferences] = await Promise.all([
      window.tomorrowDesk.loadNote(),
      window.tomorrowDesk.getPreferences()
    ]);
    editor.value = note;
    lastSavedContent = note;
    updateWordCount();
    applyPreferenceButtons(preferences);
    setStatus("Saved");
    editor.focus();
  } catch (error) {
    showError("Could not load your handoff note.");
    setStatus("Load failed");
  }
}

editor.addEventListener("input", () => {
  updateWordCount();
  scheduleSave();
});

archiveButton.addEventListener("click", async () => {
  const shouldArchive = window.confirm("Archive this handoff and clear the editor?");
  if (!shouldArchive) {
    return;
  }
  try {
    await saveNow();
    setStatus("Archiving...");
    await window.tomorrowDesk.archiveNote();
    editor.value = "";
    lastSavedContent = "";
    updateWordCount();
    clearError();
    setStatus("Archived");
  } catch (error) {
    showError("Archive failed. The active note was not cleared.");
    setStatus("Archive failed");
  }
});

topToggle.addEventListener("click", async () => {
  try {
    const nextEnabled = !topToggle.classList.contains("is-active");
    const preferences = await window.tomorrowDesk.setAlwaysOnTop(nextEnabled);
    applyPreferenceButtons(preferences);
  } catch (error) {
    showError("Could not update always-on-top.");
  }
});

loginToggle.addEventListener("click", async () => {
  try {
    const nextEnabled = !loginToggle.classList.contains("is-active");
    const preferences = await window.tomorrowDesk.setLaunchAtLogin(nextEnabled);
    applyPreferenceButtons(preferences);
  } catch (error) {
    showError("Could not update launch-at-login.");
  }
});

minimizeButton.addEventListener("click", () => {
  window.tomorrowDesk.minimize();
});

closeButton.addEventListener("click", async () => {
  try {
    await saveNow();
    await window.tomorrowDesk.hideToTray();
  } catch (error) {
    showError("Could not save. Keep this window open and try again.");
  }
});

window.addEventListener("tomorrow-desk:note-archived", () => {
  clearTimeout(saveTimer);
  saveTimer = null;
  editor.value = "";
  lastSavedContent = "";
  updateWordCount();
  clearError();
  setStatus("Archived");
});

window.addEventListener("tomorrow-desk:flush-request", async (event) => {
  const requestId = event.detail && event.detail.requestId;
  try {
    await saveNow();
    await window.tomorrowDesk.completeFlush(requestId, { ok: true });
  } catch (error) {
    await window.tomorrowDesk.completeFlush(requestId, {
      ok: false,
      error: error.message || "Save failed",
    });
  }
});

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    window.tomorrowDesk.saveNote(editor.value);
  }
});

boot();

const editor = document.querySelector("#noteEditor");
const appShell = document.querySelector(".app-shell");
const saveStatus = document.querySelector("#saveStatus");
const wordCount = document.querySelector("#wordCount");
const archiveButton = document.querySelector("#archiveButton");
const taskList = document.querySelector("#taskList");
const topToggle = document.querySelector("#topToggle");
const loginToggle = document.querySelector("#loginToggle");
const minimizeButton = document.querySelector("#minimizeButton");
const closeButton = document.querySelector("#closeButton");
const errorBanner = document.querySelector("#errorBanner");
const todayLabel = document.querySelector("#todayLabel");

let saveTimer = null;
let lastSavedContent = "";
let taskItems = [];

const TASKS_HEADING = "## 待完成事项";
const DRAFT_HEADING = "## 当前输入";

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

function focusEditor() {
  editor.focus();
  setTimeout(() => {
    editor.focus();
  }, 0);
}

function updateWordCount() {
  const trimmed = editor.value.trim();
  const count = trimmed ? trimmed.split(/\s+/).length : 0;
  wordCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeTaskItem(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function renderTaskList() {
  taskList.textContent = taskItems.join("\n");
  taskList.innerHTML = taskItems
    .map((item) => `<li>${escapeHtml(item).replace(/\n/g, "<br>")}</li>`)
    .join("");
}

function parseMarkdownTasks(markdown) {
  const items = [];
  let current = null;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("- ")) {
      if (current) {
        items.push(normalizeTaskItem(current.join("\n")));
      }
      current = [line.slice(2)];
      continue;
    }

    if (current && (line.startsWith("  ") || line.trim() === "")) {
      current.push(line.replace(/^  /, ""));
    }
  }

  if (current) {
    items.push(normalizeTaskItem(current.join("\n")));
  }

  return items.filter(Boolean);
}

function parseNoteState(content) {
  const note = String(content || "");
  const tasksIndex = note.indexOf(TASKS_HEADING);
  const draftIndex = note.indexOf(DRAFT_HEADING);

  if (tasksIndex >= 0 && draftIndex >= 0 && draftIndex > tasksIndex) {
    const tasksMarkdown = note.slice(tasksIndex + TASKS_HEADING.length, draftIndex);
    return {
      items: parseMarkdownTasks(tasksMarkdown),
      draft: note.slice(draftIndex + DRAFT_HEADING.length).trim(),
    };
  }

  return { items: [], draft: note };
}

function formatTaskItem(item) {
  const lines = item.split(/\r?\n/);
  const [first, ...rest] = lines;
  return [`- ${first}`, ...rest.map((line) => `  ${line}`)].join("\n");
}

function serializeNote() {
  const tasksMarkdown = taskItems.map(formatTaskItem).join("\n");
  const draft = editor.value.trim();
  return `${TASKS_HEADING}\n\n${tasksMarkdown}\n\n${DRAFT_HEADING}\n\n${draft}`.trimEnd();
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
  const nextContent = serializeNote();
  if (nextContent === lastSavedContent) {
    setStatus("Saved");
    return;
  }

  try {
    setStatus("Saving...");
    await window.tomorrowDesk.saveNote(nextContent);
    lastSavedContent = nextContent;
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
    const noteState = parseNoteState(note);
    taskItems = noteState.items;
    editor.value = noteState.draft;
    renderTaskList();
    lastSavedContent = serializeNote();
    updateWordCount();
    applyPreferenceButtons(preferences);
    setStatus("Saved");
    focusEditor();
  } catch (error) {
    showError("Could not load your handoff note.");
    setStatus("Load failed");
  }
}

editor.addEventListener("input", () => {
  updateWordCount();
  scheduleSave();
});

appShell.addEventListener("click", (event) => {
  if (event.target.closest("button, textarea, .titlebar")) {
    return;
  }

  focusEditor();
});

editor.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  const item = normalizeTaskItem(editor.value);
  if (!item) {
    return;
  }

  event.preventDefault();
  taskItems.push(item);
  editor.value = "";
  renderTaskList();
  updateWordCount();

  try {
    await saveNow();
    focusEditor();
  } catch (error) {
    taskItems.pop();
    editor.value = item;
    renderTaskList();
    updateWordCount();
    focusEditor();
  }
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
    taskItems = [];
    editor.value = "";
    lastSavedContent = "";
    renderTaskList();
    updateWordCount();
    clearError();
    setStatus("Archived");
    focusEditor();
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
  taskItems = [];
  editor.value = "";
  lastSavedContent = "";
  renderTaskList();
  updateWordCount();
  clearError();
  setStatus("Archived");
  focusEditor();
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

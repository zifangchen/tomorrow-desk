const editor = document.querySelector("#noteEditor");
const appShell = document.querySelector(".app-shell");
const saveStatus = document.querySelector("#saveStatus");
const wordCount = document.querySelector("#wordCount");
const archiveButton = document.querySelector("#archiveButton");
const taskList = document.querySelector("#taskList");
const topToggle = document.querySelector("#topToggle");
const loginToggle = document.querySelector("#loginToggle");
const themeToggle = document.querySelector("#themeToggle");
const minimizeButton = document.querySelector("#minimizeButton");
const closeButton = document.querySelector("#closeButton");
const errorBanner = document.querySelector("#errorBanner");
const todayLabel = document.querySelector("#todayLabel");

let saveTimer = null;
let lastSavedContent = "";
let taskItems = [];
let themeIndex = 0;

const THEMES = [
  { id: "black-gold", label: "Theme", title: "Theme: Black Gold" },
  { id: "ocean", label: "Ocean", title: "Theme: Ocean Gold" },
  { id: "forest", label: "Forest", title: "Theme: Forest Gold" },
  { id: "violet", label: "Violet", title: "Theme: Violet Copper" },
];

const TASKS_HEADING = "## 待完成事项";
const DRAFT_HEADING = "## 当前输入";

function setStatus(message) {
  saveStatus.textContent = message;
}

function applyTheme(nextIndex) {
  themeIndex = ((nextIndex % THEMES.length) + THEMES.length) % THEMES.length;
  const theme = THEMES[themeIndex];
  document.body.dataset.theme = theme.id;
  themeToggle.textContent = theme.label;
  themeToggle.title = theme.title;
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
  editor.setSelectionRange(editor.value.length, editor.value.length);
  setTimeout(() => {
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
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
    .map(
      (item, index) => `
        <li>
          <span class="task-item-text">${escapeHtml(item).replace(/\n/g, "<br>")}</span>
          <button
            class="task-delete-button"
            type="button"
            data-task-index="${index}"
            title="删除这条任务"
            aria-label="删除这条任务"
          >×</button>
        </li>
      `
    )
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
  if (!tasksMarkdown && !draft) {
    return "";
  }

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

applyTheme(0);

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

taskList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".task-delete-button");
  if (!deleteButton) {
    return;
  }

  const taskIndex = Number(deleteButton.dataset.taskIndex);
  if (!Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= taskItems.length) {
    return;
  }

  const [removedTask] = taskItems.splice(taskIndex, 1);
  renderTaskList();
  clearError();
  focusEditor();

  try {
    setStatus("Deleting...");
    await saveNow();
    setStatus("Deleted");
    focusEditor();
  } catch (error) {
    taskItems.splice(taskIndex, 0, removedTask);
    renderTaskList();
    showError("Delete failed. The task was restored.");
    setStatus("Delete failed");
    focusEditor();
  }
});

archiveButton.addEventListener("click", async () => {
  const previousItems = [...taskItems];
  const previousDraft = editor.value;
  const previousSavedContent = lastSavedContent;

  taskItems = [];
  editor.value = "";
  renderTaskList();
  updateWordCount();
  clearError();
  focusEditor();

  try {
    setStatus("Clearing...");
    await saveNow();
    setStatus("Cleared");
    focusEditor();
  } catch (error) {
    taskItems = previousItems;
    editor.value = previousDraft;
    lastSavedContent = previousSavedContent;
    renderTaskList();
    updateWordCount();
    showError("Clear failed. The active note was not cleared.");
    setStatus("Clear failed");
    focusEditor();
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

themeToggle.addEventListener("click", () => {
  applyTheme(themeIndex + 1);
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

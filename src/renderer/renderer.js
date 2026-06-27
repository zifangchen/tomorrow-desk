const editor = document.querySelector("#noteEditor");
const linkInput = document.querySelector("#linkInput");
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
const DRAFT_LINK_HEADING = "## 相关链接";
const TASK_LINK_LABEL = "相关链接:";

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

async function commitCurrentTask() {
  const item = normalizeTaskItem(editor.value);
  if (!item) {
    return;
  }

  const links = normalizeRelatedLinks(linkInput.value);
  taskItems.push({ text: item, links });
  editor.value = "";
  linkInput.value = "";
  renderTaskList();
  updateWordCount();

  try {
    await saveNow();
    focusEditor();
  } catch (error) {
    taskItems.pop();
    editor.value = item;
    linkInput.value = links.map((link) => link.label).join(" ");
    renderTaskList();
    updateWordCount();
    focusEditor();
  }
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

function normalizeTaskRecord(item) {
  if (typeof item === "string") {
    return { text: normalizeTaskItem(item), links: [] };
  }

  return {
    text: normalizeTaskItem(item.text || ""),
    links: Array.isArray(item.links) ? item.links : [],
  };
}

function normalizeLinkHref(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(www\.|[a-z0-9.-]+\.[a-z]{2,})([/?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return "";
}

function normalizeRelatedLinks(value) {
  return String(value || "")
    .split(/[\s,，]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((label) => ({ label, href: normalizeLinkHref(label) }))
    .filter((link) => link.href);
}

function formatPlainTask(item) {
  const task = normalizeTaskRecord(item);
  const links = task.links.map((link) => link.label || link.href).filter(Boolean);
  return [task.text, ...links].filter(Boolean).join("\n");
}

function formatMarkdownLink(link) {
  const label = String(link.label || link.href).replace(/]/g, "\\]");
  const href = String(link.href).replace(/\)/g, "%29");
  return `[${label}](${href})`;
}

function parseRelatedLinks(value) {
  const markdownLinks = [];
  const linkPattern = /\[([^\]]+)]\(([^)]+)\)/g;
  let match = linkPattern.exec(value);
  while (match) {
    const href = normalizeLinkHref(match[2]);
    if (href) {
      markdownLinks.push({ label: match[1], href });
    }
    match = linkPattern.exec(value);
  }

  if (markdownLinks.length) {
    return markdownLinks;
  }

  return normalizeRelatedLinks(value.replace(TASK_LINK_LABEL, ""));
}

function renderTaskList() {
  taskList.textContent = taskItems.map(formatPlainTask).join("\n");
  taskList.innerHTML = taskItems
    .map(
      (item, index) => {
        const task = normalizeTaskRecord(item);
        const linksHtml = task.links.length
          ? `
            <div class="task-links" aria-label="相关链接">
              ${task.links
                .map(
                  (link) => `
                    <a href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">
                      ${escapeHtml(link.label || link.href)}
                    </a>
                  `
                )
                .join("")}
            </div>
          `
          : "";

        return `
        <li>
          <div class="task-content">
            <span class="task-item-text">${escapeHtml(task.text).replace(/\n/g, "<br>")}</span>
            ${linksHtml}
          </div>
          <button
            class="task-delete-button"
            type="button"
            data-task-index="${index}"
            title="删除这条任务"
            aria-label="删除这条任务"
          >×</button>
        </li>
      `;
      }
    )
    .join("");
}

function parseMarkdownTasks(markdown) {
  const items = [];
  let current = null;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("- ")) {
      if (current) {
        items.push({
          text: normalizeTaskItem(current.textLines.join("\n")),
          links: current.links,
        });
      }
      current = { textLines: [line.slice(2)], links: [] };
      continue;
    }

    if (current && (line.startsWith("  ") || line.trim() === "")) {
      const content = line.replace(/^  /, "");
      if (content.trim().startsWith(TASK_LINK_LABEL)) {
        current.links = parseRelatedLinks(content);
      } else {
        current.textLines.push(content);
      }
    }
  }

  if (current) {
    items.push({
      text: normalizeTaskItem(current.textLines.join("\n")),
      links: current.links,
    });
  }

  return items.filter((item) => item.text);
}

function parseNoteState(content) {
  const note = String(content || "");
  const tasksIndex = note.indexOf(TASKS_HEADING);
  const draftIndex = note.indexOf(DRAFT_HEADING);
  const draftLinkIndex = note.indexOf(DRAFT_LINK_HEADING);

  if (tasksIndex >= 0 && draftIndex >= 0 && draftIndex > tasksIndex) {
    const tasksMarkdown = note.slice(tasksIndex + TASKS_HEADING.length, draftIndex);
    const draftEnd = draftLinkIndex > draftIndex ? draftLinkIndex : note.length;
    return {
      items: parseMarkdownTasks(tasksMarkdown),
      draft: note.slice(draftIndex + DRAFT_HEADING.length, draftEnd).trim(),
      linkDraft: draftLinkIndex > draftIndex
        ? note.slice(draftLinkIndex + DRAFT_LINK_HEADING.length).trim()
        : "",
    };
  }

  return { items: [], draft: note, linkDraft: "" };
}

function formatTaskItem(item) {
  const task = normalizeTaskRecord(item);
  const lines = task.text.split(/\r?\n/);
  const [first, ...rest] = lines;
  const taskLines = [`- ${first}`, ...rest.map((line) => `  ${line}`)];
  if (task.links.length) {
    taskLines.push(`  ${TASK_LINK_LABEL} ${task.links.map(formatMarkdownLink).join(" ")}`);
  }

  return taskLines.join("\n");
}

function serializeNote() {
  const tasksMarkdown = taskItems.map(formatTaskItem).join("\n");
  const draft = editor.value.trim();
  const draftLink = linkInput.value.trim();
  if (!tasksMarkdown && !draft && !draftLink) {
    return "";
  }

  return `${TASKS_HEADING}\n\n${tasksMarkdown}\n\n${DRAFT_HEADING}\n\n${draft}\n\n${DRAFT_LINK_HEADING}\n\n${draftLink}`.trimEnd();
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
    linkInput.value = noteState.linkDraft;
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

linkInput.addEventListener("input", () => {
  scheduleSave();
});

appShell.addEventListener("click", (event) => {
  if (event.target.closest("button, textarea, input, .titlebar")) {
    return;
  }

  focusEditor();
});

editor.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();
  await commitCurrentTask();
});

linkInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  await commitCurrentTask();
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
  const previousLink = linkInput.value;
  const previousSavedContent = lastSavedContent;

  taskItems = [];
  editor.value = "";
  linkInput.value = "";
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
    linkInput.value = previousLink;
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
  linkInput.value = "";
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
    window.tomorrowDesk.saveNote(serializeNote());
  }
});

boot();

# Tomorrow Desk Design

## Overview

Tomorrow Desk is a small Windows desktop app for carrying work context across shutdowns. Before shutting down, the user writes the next morning's handoff notes in a focused document. On the next Windows login, the app starts automatically and shows the same document as a floating desktop window.

The first version intentionally stays narrow: it is not a full task manager, calendar, project board, or cloud note app. It is a polished local "tomorrow handoff" surface.

## Goals

- Let the user write tomorrow's wake-up tasks before shutdown.
- Persist the document locally without requiring network access.
- Show the document automatically after Windows login.
- Keep the window visible as a calm floating reminder.
- Present a simple, premium black-and-gold interface.
- Support daily reset through an archive action.

## Non-Goals

- Multi-user sync, mobile apps, account login, reminders, calendar integration, and team collaboration are outside v1.
- Rich project management features such as labels, dependencies, recurring tasks, kanban boards, and timelines are outside v1.
- Markdown preview is optional for later versions; v1 prioritizes direct writing and reading.

## Recommended Implementation

Build v1 as an Electron desktop app with local file storage.

Reasons:

- Electron supports a polished desktop UI with normal web tooling.
- It can create a frameless or lightly framed floating window.
- It can register launch-at-login behavior on Windows.
- It can read and write local files without a backend service.
- It keeps the first version easy to package and iterate.

## Application Structure

The app will have three main layers:

1. Main process
   - Creates and restores the floating window.
   - Enables launch-at-login.
   - Manages native app lifecycle events.
   - Provides safe IPC handlers for reading, writing, and archiving notes.

2. Renderer UI
   - Displays the black-and-gold document surface.
   - Provides editing, save status, archive, and window controls.
   - Keeps the first screen focused on the note content.

3. Local data module
   - Stores the active handoff document as plain text or Markdown.
   - Stores archives by date.
   - Stores lightweight UI preferences such as window size and position.

## Data Storage

Use Electron's user data directory for app-owned state:

- `tomorrow.md`: current handoff note.
- `archives/YYYY-MM-DD-HHmm.md`: archived notes.
- `preferences.json`: window bounds, always-on-top setting, and last archive timestamp.

The active document autosaves after the user stops typing briefly. Manual save can also be exposed through a keyboard shortcut or compact status control, but the app should not rely on the user remembering to save.

## User Flow

### Evening Handoff

1. User opens Tomorrow Desk.
2. User writes what they should do after waking up.
3. App autosaves locally.
4. User shuts down normally.

### Morning Resume

1. Windows login starts Tomorrow Desk automatically.
2. App reads `tomorrow.md`.
3. Floating window appears with the saved content.
4. User resumes work from the visible handoff note.

### End of Day Reset

1. User clicks Archive.
2. App copies the current note into `archives/` with a timestamped filename.
3. App clears the active editor after confirmation.
4. User writes the next handoff when ready.

## Window Behavior

- Default size: compact but readable, around 520 by 640 pixels.
- Default position: near the right side of the primary display, with a margin from screen edges.
- Always-on-top: enabled by default, toggleable from the UI.
- Resizable: enabled.
- Draggable: enabled through a custom title area if the window is frameless.
- Minimize: available through a visible control.
- Close behavior: close hides the window to the system tray. The tray menu provides Show, Archive, and Quit actions. Quit exits the app after the latest content has been saved.

## Visual Design

The UI should feel like a quiet premium desktop note, not a busy productivity dashboard.

Visual direction:

- Background: near-black, using subtle contrast instead of heavy gradients.
- Accent: gold for borders, title text, focused controls, and small highlights.
- Typography: clean sans-serif UI font with generous line height.
- Layout: one primary document surface, small top bar, compact bottom status row.
- Shape: modest border radius, no nested cards, no decorative clutter.

Main screen:

- Top bar: app title, date, always-on-top toggle, minimize, close.
- Editor: large multiline writing area with black background and soft gold focus ring.
- Footer: autosave status, archive action, optional character/word count.

## Error Handling

- If `tomorrow.md` does not exist, create it with an empty string.
- If reading fails, show a clear inline error and keep the app open.
- If saving fails, show persistent save error status and preserve the editor content in memory.
- If archiving fails, do not clear the active note.
- If preferences are corrupt, fall back to default window bounds and rewrite preferences on next successful save.

## Testing And Verification

v1 should be verified with:

- Unit tests for local data read, write, archive, and corrupt preference fallback.
- A smoke test that the renderer can load and edit a note.
- Manual Windows verification that launch-at-login registration is enabled.
- Manual verification that app restart restores the latest note.
- Manual visual verification that the black-and-gold UI is readable and uncluttered.

## Acceptance Criteria

- The user can type tomorrow's tasks into a visible document area.
- The note autosaves locally and survives app restart.
- The app registers itself to start after Windows login by default, with a visible setting to disable this behavior later.
- On startup, the app opens a floating window showing the saved note.
- The window supports basic desktop use: drag, resize, minimize, and always-on-top.
- The UI uses a simple black-and-gold theme and avoids dense task-management complexity.
- The user can archive the current note and start a fresh handoff.

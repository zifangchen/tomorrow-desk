const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("editor placeholder uses the requested Chinese prompt", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "index.html"),
    "utf8"
  );

  assert.match(html, /placeholder="请输入待完成事项"/);
});

test("clear button uses a direct Chinese label", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "index.html"),
    "utf8"
  );

  assert.match(html, /<button id="archiveButton"[^>]*>清空<\/button>/);
});

test("editor input and placeholder prefer KaiTi typography", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );

  assert.match(css, /\.note-editor\s*\{[^}]*font-family:\s*"KaiTi"/s);
  assert.match(css, /\.note-editor::placeholder\s*\{[^}]*font-family:\s*"KaiTi"/s);
});

test("editor stretches to fill the available writing row", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );

  assert.match(css, /grid-template-rows:\s*auto\s+auto\s+320px\s+minmax\(0,\s*1fr\)\s+auto/s);
  assert.match(css, /\.note-editor\s*\{[^}]*height:\s*calc\(100% - 24px\)/s);
});

test("title bar exposes a theme switch button", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "index.html"),
    "utf8"
  );

  assert.match(html, /id="themeToggle"/);
  assert.match(html, />Theme</);
});

test("main layout pins the status bar to the bottom grid area", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );

  assert.match(css, /grid-template-areas:[^;]*"titlebar"[^;]*"status"/s);
  assert.match(css, /\.titlebar\s*\{[^}]*grid-area:\s*titlebar/s);
  assert.match(css, /\.note-editor\s*\{[^}]*grid-area:\s*editor/s);
  assert.match(css, /\.task-list\s*\{[^}]*grid-area:\s*tasks/s);
  assert.match(css, /\.statusbar\s*\{[^}]*grid-area:\s*status/s);
});

test("window and task action buttons center their labels", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );

  assert.match(css, /\.icon-button\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.icon-button\s*\{[^}]*place-items:\s*center/s);
  assert.match(css, /\.icon-button\s*\{[^}]*font-weight:\s*700/s);
  assert.match(css, /\.task-delete-button\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.task-delete-button\s*\{[^}]*place-items:\s*center/s);
});

test("task item links use the app theme styling", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );

  assert.match(css, /\.task-item-link\s*\{[^}]*color:\s*var\(--gold-soft\)/s);
  assert.match(css, /\.task-item-link:hover\s*\{[^}]*background:\s*var\(--gold\)/s);
});

test("main shell includes a subtle animated gradient with reduced-motion fallback", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );

  assert.match(css, /\.app-shell::before\s*\{[^}]*animation:\s*aurora-drift/s);
  assert.match(css, /\.note-editor\s*\{[^}]*animation:\s*editor-glow/s);
  assert.match(css, /@keyframes\s+aurora-drift/);
  assert.match(css, /@keyframes\s+editor-glow/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("theme colors transition through CSS variables", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );

  assert.match(css, /body\s*\{[^}]*transition:[^}]*background-color/s);
  assert.match(css, /body\[data-theme="ocean"\]/);
  assert.match(css, /body\[data-theme="forest"\]/);
  assert.match(css, /body\[data-theme="violet"\]/);
});

test("top window symbols are visually larger than text toggles", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );

  assert.match(css, /#minimizeButton,\s*#closeButton\s*\{[^}]*font-size:\s*16px/s);
});

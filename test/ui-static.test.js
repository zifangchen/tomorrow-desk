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

  assert.match(css, /\.note-editor\s*\{[^}]*height:\s*calc\(100% - 24px\)/s);
});

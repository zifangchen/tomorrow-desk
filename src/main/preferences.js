const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_PREFERENCES = Object.freeze({
  alwaysOnTop: true,
  launchAtLogin: true,
  bounds: Object.freeze({
    width: 520,
    height: 640,
    x: null,
    y: null,
  }),
  lastArchiveAt: null,
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizePreferences(value) {
  const input = isPlainObject(value) ? value : {};
  const bounds = isPlainObject(input.bounds) ? input.bounds : {};

  return {
    alwaysOnTop:
      typeof input.alwaysOnTop === "boolean"
        ? input.alwaysOnTop
        : DEFAULT_PREFERENCES.alwaysOnTop,
    launchAtLogin:
      typeof input.launchAtLogin === "boolean"
        ? input.launchAtLogin
        : DEFAULT_PREFERENCES.launchAtLogin,
    bounds: {
      width: Number.isFinite(bounds.width)
        ? bounds.width
        : DEFAULT_PREFERENCES.bounds.width,
      height: Number.isFinite(bounds.height)
        ? bounds.height
        : DEFAULT_PREFERENCES.bounds.height,
      x: Number.isFinite(bounds.x) ? bounds.x : DEFAULT_PREFERENCES.bounds.x,
      y: Number.isFinite(bounds.y) ? bounds.y : DEFAULT_PREFERENCES.bounds.y,
    },
    lastArchiveAt:
      typeof input.lastArchiveAt === "string"
        ? input.lastArchiveAt
        : DEFAULT_PREFERENCES.lastArchiveAt,
  };
}

function cloneDefaultPreferences() {
  return {
    ...DEFAULT_PREFERENCES,
    bounds: { ...DEFAULT_PREFERENCES.bounds },
  };
}

function createPreferencesStore(baseDir) {
  const preferencesPath = path.join(baseDir, "preferences.json");

  async function load() {
    try {
      const raw = await fs.readFile(preferencesPath, "utf8");
      return normalizePreferences(JSON.parse(raw));
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) {
        return cloneDefaultPreferences();
      }

      throw error;
    }
  }

  async function save(nextPreferences) {
    await fs.mkdir(baseDir, { recursive: true });

    const current = await load();
    const merged = normalizePreferences({
      ...current,
      ...nextPreferences,
      bounds: {
        ...current.bounds,
        ...(isPlainObject(nextPreferences) && isPlainObject(nextPreferences.bounds)
          ? nextPreferences.bounds
          : {}),
      },
    });

    await fs.writeFile(
      preferencesPath,
      `${JSON.stringify(merged, null, 2)}\n`,
      "utf8"
    );

    return merged;
  }

  return { load, save };
}

module.exports = {
  DEFAULT_PREFERENCES,
  createPreferencesStore,
};

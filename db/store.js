/* =========================================================================
   db/store.js — оддитарин "база маълумот" дар асоси файлҳои JSON.
   Ҳадаф — то системаро БЕ ниёз ба npm install ва БЕ сервери беруна оид
   ба (Postgres/Mongo ва ғ.) фавран санҷем. Барои production тавсия
   медиҳем ба SQLite/Postgres гузарем (нукта дар README.md шарҳ дода шуд).
   ========================================================================= */
const fs = require("fs");
const path = require("path");

const DB_DIR = path.join(__dirname);

function filePath(name) {
  return path.join(DB_DIR, `${name}.json`);
}

// Хондани файл — агар набошад, fallback баргардонида мешавад
function readJSON(name, fallback = []) {
  try {
    const raw = fs.readFileSync(filePath(name), "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

// Навиштани файл — синхронӣ, барои соддагӣ (миқдори маълумот хурд аст)
function writeJSON(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf-8");
}

module.exports = { readJSON, writeJSON };

/* =========================================================================
   scripts/reseed.js — аз нав сохтани файлҳои db/*.json аз рӯи
   scripts/seed-source.js. ДИҚҚАТ: ин фармоишҳои мавҷударо (orders.json)
   дастнахӯрда мемонад — танҳо каталог (маҳсулот/категория/акция) иваз
   мешавад.

   Истифода:  npm run reseed
   ========================================================================= */
const fs = require("fs");
const path = require("path");
const data = require("./seed-source.js");

const DB_DIR = path.join(__dirname, "..", "db");

function write(name, value) {
  fs.writeFileSync(path.join(DB_DIR, `${name}.json`), JSON.stringify(value, null, 2), "utf-8");
  console.log(`  ✓ ${name}.json (${Array.isArray(value) ? value.length + " записей" : "объект"})`);
}

console.log("Пересборка каталога из scripts/seed-source.js...");
write("categories", data.CATEGORIES);
write("products", data.products);
write("addon-groups", data.ADDON_GROUPS);
write("promotions", data.promotions);
write("promo-codes", data.PROMO_CODES);
write("delivery-zones", data.DELIVERY_ZONES);
write("cities", data.CITIES);
console.log("Готово. Файл orders.json не тронут.");

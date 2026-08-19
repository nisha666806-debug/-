/* =========================================================================
   routes/promo.js — санҷиши промокод. Ҳамеша дар сервер такрор ҳисоб
   мешавад — ба қиматҳои аз фронтенд омада бовар намекунем.
   ========================================================================= */
const { readJSON } = require("../db/store");

function validatePromo(code, subtotal) {
  if (!code) return { valid: false, message: "Промокод ворид карда нашуд" };
  const codes = readJSON("promo-codes", {});
  const promo = codes[String(code).toUpperCase()];
  if (!promo) return { valid: false, message: "Промокод недействителен" };
  if (subtotal < promo.minSum) {
    return { valid: false, message: `Минимальная сумма для промокода — ${promo.minSum} ₽` };
  }
  const discount = promo.type === "percent"
    ? Math.round(subtotal * promo.value / 100)
    : Math.min(promo.value, subtotal);
  return {
    valid: true,
    code: String(code).toUpperCase(),
    type: promo.type,
    value: promo.value,
    minSum: promo.minSum,
    discount,
    message: promo.desc || "Промокод применён",
  };
}

module.exports = { validatePromo };

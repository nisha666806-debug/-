/* =========================================================================
   utils/userAuth.js — аутентификатсияи корбарони одӣ (на админ).

   Пароль ҲАРГИЗ ба таври кушод нигоҳ дошта намешавад: scrypt (аз модули
   crypto-и худи Node) + salt-и тасодуфӣ барои ҳар корбар. Ин ҳатто агар
   касе файли users.json-ро бинад, паролро надиҳад.
   ========================================================================= */
const crypto = require("crypto");

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 рӯз
const activeTokens = new Map(); // token -> { phone, expiresAt }

// ---- Пароль ---------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  // муқоисаи вақт-собит, то ҳамла бо ченкунии вақт имконнопазир бошад
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(candidate, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Токен ----------------------------------------------------------------
function issueToken(phone) {
  const token = crypto.randomBytes(32).toString("hex");
  activeTokens.set(token, { phone, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

function verifyToken(token) {
  if (!token) return null;
  const entry = activeTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { activeTokens.delete(token); return null; }
  return entry.phone;
}

function revokeToken(token) { activeTokens.delete(token); }

function extractToken(req) {
  const header = req.headers["authorization"] || "";
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

// ---- Телефон --------------------------------------------------------------
// Ҳамаи рақамҳоро ба як шакл меорем, то "+7 999 123-45-67" ва "89991234567"
// ҳамчун ЯК корбар шинохта шаванд.
function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  return digits;
}

module.exports = {
  hashPassword, verifyPassword,
  issueToken, verifyToken, revokeToken, extractToken,
  normalizePhone,
};

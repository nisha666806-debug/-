/* =========================================================================
   utils/auth.js — аутентификатсияи оддии админ.
   Барои демо/MVP кофист: парол → токен дар хотира (RAM). Баъд аз рестарти
   сервер токенҳо бекор мешаванд — барои production JWT ё сессияи доимӣ
   дар база тавсия мешавад (дар README шарҳ дода шуд).
   ========================================================================= */
const crypto = require("crypto");
const config = require("../config");

const activeTokens = new Map(); // token -> expiresAt (ms)
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 соат

function login(password) {
  if (password !== config.ADMIN_PASSWORD) return null;
  const token = crypto.randomBytes(24).toString("hex");
  activeTokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function verify(token) {
  if (!token) return false;
  const expiresAt = activeTokens.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) { activeTokens.delete(token); return false; }
  return true;
}

function extractToken(req) {
  const header = req.headers["authorization"] || "";
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

module.exports = { login, verify, extractToken };

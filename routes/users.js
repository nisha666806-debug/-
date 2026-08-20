/* =========================================================================
   routes/users.js — аккаунтҳои корбарон.
   Ҳар корбар бо рақами телефон муайян мешавад (нормализатсияшуда).
   ========================================================================= */
const { readJSON, writeJSON } = require("../db/store");
const auth = require("../utils/userAuth");

function findUser(phone) {
  const users = readJSON("users", []);
  return users.find(u => u.phone === auth.normalizePhone(phone)) || null;
}

// Маълумоти кушод — БЕ passwordHash, то ҳаргиз ба фронтенд наравад
function publicUser(user) {
  if (!user) return null;
  return {
    phone: user.phone,
    name: user.name,
    bonuses: user.bonuses || 0,
    addresses: user.addresses || [],
    favorites: user.favorites || [],
    createdAt: user.createdAt,
  };
}

function register({ phone, name, password }) {
  const errors = [];
  const normalized = auth.normalizePhone(phone);
  if (normalized.length < 10) errors.push("Введите корректный номер телефона");
  if (!name || !name.trim()) errors.push("Введите имя");
  if (!password || password.length < 4) errors.push("Пароль должен быть не короче 4 символов");
  if (errors.length) return { ok: false, errors };

  const users = readJSON("users", []);
  if (users.some(u => u.phone === normalized)) {
    return { ok: false, errors: ["Пользователь с таким номером уже зарегистрирован"] };
  }

  const user = {
    phone: normalized,
    name: name.trim(),
    passwordHash: auth.hashPassword(password),
    bonuses: 150, // бонуси хушомадгӯӣ
    addresses: [],
    favorites: [],
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeJSON("users", users);

  return { ok: true, user: publicUser(user), token: auth.issueToken(normalized) };
}

function login({ phone, password }) {
  const user = findUser(phone);
  // Ҳамон паём барои "корбар нест" ва "пароли нодуруст" — то касе натавонад
  // бифаҳмад, кадом рақамҳо сабти ном шудаанд.
  if (!user || !auth.verifyPassword(password || "", user.passwordHash)) {
    return { ok: false, errors: ["Неверный номер телефона или пароль"] };
  }
  return { ok: true, user: publicUser(user), token: auth.issueToken(user.phone) };
}

function getProfile(phone) {
  return publicUser(findUser(phone));
}

function updateProfile(phone, payload) {
  const users = readJSON("users", []);
  const idx = users.findIndex(u => u.phone === auth.normalizePhone(phone));
  if (idx === -1) return null;
  if (payload.name && payload.name.trim()) users[idx].name = payload.name.trim();
  writeJSON("users", users);
  return publicUser(users[idx]);
}

function changePassword(phone, { currentPassword, newPassword }) {
  const users = readJSON("users", []);
  const idx = users.findIndex(u => u.phone === auth.normalizePhone(phone));
  if (idx === -1) return { ok: false, errors: ["Пользователь не найден"] };
  if (!auth.verifyPassword(currentPassword || "", users[idx].passwordHash)) {
    return { ok: false, errors: ["Текущий пароль неверен"] };
  }
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, errors: ["Новый пароль должен быть не короче 4 символов"] };
  }
  users[idx].passwordHash = auth.hashPassword(newPassword);
  writeJSON("users", users);
  return { ok: true };
}

// ---- Адресҳои захирашуда ---------------------------------------------------
function saveAddress(phone, address) {
  const users = readJSON("users", []);
  const idx = users.findIndex(u => u.phone === auth.normalizePhone(phone));
  if (idx === -1) return null;
  const list = users[idx].addresses || [];
  const entry = {
    id: "addr-" + Date.now().toString().slice(-8),
    city: address.city || "", street: address.street || "", house: address.house || "",
    block: address.block || "", flat: address.flat || "", entrance: address.entrance || "",
    floor: address.floor || "", intercom: address.intercom || "", comment: address.comment || "",
  };
  // Агар чунин адрес аллакай бошад, дубора илова намекунем
  const duplicate = list.find(a => a.city===entry.city && a.street===entry.street && a.house===entry.house && a.flat===entry.flat);
  if (duplicate) return publicUser(users[idx]);
  list.unshift(entry);
  users[idx].addresses = list.slice(0, 10); // на бештар аз 10 адрес
  writeJSON("users", users);
  return publicUser(users[idx]);
}

function deleteAddress(phone, addressId) {
  const users = readJSON("users", []);
  const idx = users.findIndex(u => u.phone === auth.normalizePhone(phone));
  if (idx === -1) return null;
  users[idx].addresses = (users[idx].addresses || []).filter(a => a.id !== addressId);
  writeJSON("users", users);
  return publicUser(users[idx]);
}

// ---- Дӯстдоштаҳо (дар сервер, то аз ҳар дастгоҳ дастрас бошанд) ------------
function setFavorites(phone, favorites) {
  const users = readJSON("users", []);
  const idx = users.findIndex(u => u.phone === auth.normalizePhone(phone));
  if (idx === -1) return null;
  users[idx].favorites = Array.isArray(favorites) ? favorites.map(Number).filter(Boolean) : [];
  writeJSON("users", users);
  return publicUser(users[idx]);
}

// ---- Фармоишҳои корбар -----------------------------------------------------
function getUserOrders(phone) {
  const normalized = auth.normalizePhone(phone);
  return readJSON("orders", []).filter(o => auth.normalizePhone(o.phone) === normalized);
}

module.exports = {
  register, login, getProfile, updateProfile, changePassword,
  saveAddress, deleteAddress, setFavorites, getUserOrders, findUser, publicUser,
};

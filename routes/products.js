/* =========================================================================
   routes/products.js — маҳсулот, категория, акция, зонаҳои интиқол.
   ========================================================================= */
const { readJSON, writeJSON } = require("../db/store");

function listProducts({ category, search } = {}) {
  let products = readJSON("products", []);
  if (category === "popular") products = products.filter(p => p.popular);
  else if (category === "new") products = products.filter(p => p.isNew);
  else if (category) products = products.filter(p => p.category === category);

  if (search) {
    const needle = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(needle) ||
      (p.tags || "").toLowerCase().includes(needle) ||
      (p.ingredients || "").toLowerCase().includes(needle)
    );
  }
  return products;
}

function getProductById(id) {
  const products = readJSON("products", []);
  return products.find(p => p.id === Number(id)) || null;
}

function createProduct(payload) {
  const products = readJSON("products", []);
  const nextId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
  const product = {
    id: nextId,
    name: payload.name || "Новый товар",
    category: payload.category || "snacks",
    emoji: payload.emoji || "🍽️",
    description: payload.description || "",
    ingredients: payload.ingredients || "",
    weight: payload.weight || "",
    pieces: payload.pieces ?? null,
    price: Number(payload.price) || 0,
    oldPrice: payload.oldPrice ? Number(payload.oldPrice) : null,
    popular: !!payload.popular,
    isNew: !!payload.isNew,
    tags: payload.tags || "",
    photoBg: payload.photoBg || "linear-gradient(135deg,#ffe3d1,#ffb199)",
  };
  products.push(product);
  writeJSON("products", products);
  return product;
}

function updateProduct(id, payload) {
  const products = readJSON("products", []);
  const idx = products.findIndex(p => p.id === Number(id));
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...payload, id: products[idx].id };
  writeJSON("products", products);
  return products[idx];
}

function deleteProduct(id) {
  const products = readJSON("products", []);
  const next = products.filter(p => p.id !== Number(id));
  const removed = next.length !== products.length;
  if (removed) writeJSON("products", next);
  return removed;
}

function listCategories() { return readJSON("categories", []); }
function listAddonGroups() { return readJSON("addon-groups", []); }
function listPromotions() { return readJSON("promotions", []); }
function listDeliveryZones() { return readJSON("delivery-zones", []); }
function listCities() { return readJSON("cities", []); }

module.exports = {
  listProducts, getProductById, createProduct, updateProduct, deleteProduct,
  listCategories, listAddonGroups, listPromotions, listDeliveryZones, listCities,
};

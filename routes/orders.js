/* =========================================================================
   routes/orders.js — фармоишҳо. Нархи ниҳоӣ ҳамеша дар СЕРВЕР аз нав
   ҳисоб карда мешавад (аз рӯи products.json), то мизоҷи фиребанда
   натавонад нархро аз браузер тағйир диҳад.
   ========================================================================= */
const { readJSON, writeJSON } = require("../db/store");
const { validatePromo } = require("./promo");
const config = require("../config");

function addonUnitPrice(addons) {
  const groups = readJSON("addon-groups", []);
  let total = 0;
  const labels = [];
  groups.forEach(g => {
    (addons?.[g.id] || []).forEach(optId => {
      const opt = g.options.find(o => o.id === optId);
      if (opt) { total += opt.price; labels.push(opt.name); }
    });
  });
  return { total, labels };
}

function resolveDeliveryZone(city) {
  const zones = readJSON("delivery-zones", []);
  if (!zones.length) return { price: 0, freeFrom: Infinity, time: "" };
  return city === "Москва" ? zones[0] : (zones[2] || zones[zones.length - 1]);
}

function buildOrderItems(rawItems) {
  const products = readJSON("products", []);
  const items = [];
  let subtotal = 0;
  for (const raw of rawItems || []) {
    const product = products.find(p => p.id === Number(raw.productId));
    if (!product) continue;
    const qty = Math.max(1, Number(raw.qty) || 1);
    const { total: addonsTotal, labels } = addonUnitPrice(raw.addons || {});
    const unitPrice = product.price + addonsTotal;
    subtotal += unitPrice * qty;
    items.push({
      productId: product.id,
      name: product.name,
      qty,
      unitPrice,
      addons: labels,
      lineTotal: unitPrice * qty,
    });
  }
  return { items, subtotal };
}

function createOrder(payload) {
  const errors = [];
  const { items, subtotal } = buildOrderItems(payload.items);

  if (items.length === 0) errors.push("Добавьте хотя бы один товар");
  if (subtotal < config.MIN_ORDER_SUM) errors.push(`Минимальная сумма заказа — ${config.MIN_ORDER_SUM} ₽`);
  if (!payload.name) errors.push("Введите имя");
  if (!payload.phone || String(payload.phone).replace(/\D/g, "").length < 10) errors.push("Введите номер телефона");

  const fulfillment = payload.fulfillment === "pickup" ? "pickup" : "delivery";
  if (fulfillment === "delivery" && (!payload.address?.street || !payload.address?.house)) {
    errors.push("Введите адрес доставки");
  }

  if (errors.length) return { ok: false, errors };

  let discount = 0;
  let appliedPromo = null;
  if (payload.promoCode) {
    const result = validatePromo(payload.promoCode, subtotal);
    if (result.valid) { discount = result.discount; appliedPromo = result.code; }
  }

  let deliveryCost = 0;
  if (fulfillment === "delivery") {
    const zone = resolveDeliveryZone(payload.address?.city);
    const afterDiscount = subtotal - discount;
    deliveryCost = afterDiscount >= zone.freeFrom ? 0 : (zone.price || 0);
  }

  const total = Math.max(0, subtotal - discount) + deliveryCost;

  const orders = readJSON("orders", []);
  const order = {
    id: "SPT-" + Date.now().toString().slice(-6),
    date: new Date().toISOString(),
    items,
    subtotal,
    discount,
    promoCode: appliedPromo,
    deliveryCost,
    total,
    fulfillment,
    address: fulfillment === "delivery" ? payload.address : null,
    name: payload.name,
    phone: payload.phone,
    payment: payload.payment || "cash",
    comment: payload.address?.comment || "",
    status: "Новый",
  };
  orders.unshift(order);
  writeJSON("orders", orders);
  return { ok: true, order };
}

function listOrders() {
  return readJSON("orders", []);
}

function getOrderById(id) {
  return readJSON("orders", []).find(o => o.id === id) || null;
}

const VALID_STATUSES = ["Новый", "Принят", "Готовится", "Передан курьеру", "Доставлен", "Отменён"];

function updateOrderStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) return { ok: false, error: "Недопустимый статус" };
  const orders = readJSON("orders", []);
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return { ok: false, error: "Заказ не найден" };
  orders[idx].status = status;
  writeJSON("orders", orders);
  return { ok: true, order: orders[idx] };
}

module.exports = { createOrder, listOrders, getOrderById, updateOrderStatus, VALID_STATUSES };

/* =========================================================================
   server.js — сервери асосӣ. Танҳо Node.js core (http, fs, path, url) —
   БЕ npm install, БЕ вобастагӣ ба интернет. Оғоз:  node server.js
   ========================================================================= */
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const { sendJSON, corsHeaders, readBody } = require("./utils/http");
const auth = require("./utils/auth");
const productsApi = require("./routes/products");
const ordersApi = require("./routes/orders");
const promoApi = require("./routes/promo");

function requireAdmin(req, res) {
  const token = auth.extractToken(req);
  if (!auth.verify(token)) {
    sendJSON(res, 401, { error: "Требуется авторизация администратора" });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query;
  const method = req.method;

  // Preflight CORS
  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  try {
    // ---------------- Публичные каталоги ----------------
    if (pathname === "/api/products" && method === "GET") {
      return sendJSON(res, 200, productsApi.listProducts({ category: query.category, search: query.search }));
    }
    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (productMatch && method === "GET") {
      const product = productsApi.getProductById(productMatch[1]);
      return product ? sendJSON(res, 200, product) : sendJSON(res, 404, { error: "Товар не найден" });
    }
    if (pathname === "/api/categories" && method === "GET") {
      return sendJSON(res, 200, productsApi.listCategories());
    }
    if (pathname === "/api/addon-groups" && method === "GET") {
      return sendJSON(res, 200, productsApi.listAddonGroups());
    }
    if (pathname === "/api/promotions" && method === "GET") {
      return sendJSON(res, 200, productsApi.listPromotions());
    }
    if (pathname === "/api/delivery-zones" && method === "GET") {
      return sendJSON(res, 200, productsApi.listDeliveryZones());
    }
    if (pathname === "/api/cities" && method === "GET") {
      return sendJSON(res, 200, productsApi.listCities());
    }

    // ---------------- Промокод ----------------
    if (pathname === "/api/promo/validate" && method === "POST") {
      const body = await readBody(req);
      return sendJSON(res, 200, promoApi.validatePromo(body.code, Number(body.subtotal) || 0));
    }

    // ---------------- Заказы (клиент) ----------------
    if (pathname === "/api/orders" && method === "POST") {
      const body = await readBody(req);
      const result = ordersApi.createOrder(body);
      if (!result.ok) return sendJSON(res, 400, { errors: result.errors });
      return sendJSON(res, 201, result.order);
    }

    // Клиент может посмотреть статус СВОЕГО заказа по номеру — без авторизации
    const orderMatch = pathname.match(/^\/api\/orders\/([\w-]+)$/);
    if (orderMatch && method === "GET") {
      const order = ordersApi.getOrderById(orderMatch[1]);
      return order ? sendJSON(res, 200, order) : sendJSON(res, 404, { error: "Заказ не найден" });
    }

    // ---------------- Admin: вход ----------------
    if (pathname === "/api/admin/login" && method === "POST") {
      const body = await readBody(req);
      const token = auth.login(body.password);
      if (!token) return sendJSON(res, 401, { error: "Неверный пароль" });
      return sendJSON(res, 200, { token });
    }

    // ---------------- Admin: заказы ----------------
    if (pathname === "/api/admin/orders" && method === "GET") {
      if (!requireAdmin(req, res)) return;
      return sendJSON(res, 200, ordersApi.listOrders());
    }
    const adminOrderStatusMatch = pathname.match(/^\/api\/admin\/orders\/([\w-]+)$/);
    if (adminOrderStatusMatch && method === "PATCH") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const result = ordersApi.updateOrderStatus(adminOrderStatusMatch[1], body.status);
      if (!result.ok) return sendJSON(res, 400, { error: result.error });
      return sendJSON(res, 200, result.order);
    }

    // ---------------- Admin: маҳсулот (CRUD) ----------------
    if (pathname === "/api/admin/products" && method === "POST") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      return sendJSON(res, 201, productsApi.createProduct(body));
    }
    const adminProductMatch = pathname.match(/^\/api\/admin\/products\/(\d+)$/);
    if (adminProductMatch && method === "PUT") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const updated = productsApi.updateProduct(adminProductMatch[1], body);
      return updated ? sendJSON(res, 200, updated) : sendJSON(res, 404, { error: "Товар не найден" });
    }
    if (adminProductMatch && method === "DELETE") {
      if (!requireAdmin(req, res)) return;
      const removed = productsApi.deleteProduct(adminProductMatch[1]);
      return removed ? sendJSON(res, 200, { ok: true }) : sendJSON(res, 404, { error: "Товар не найден" });
    }

    // ---------------- Статика (не обязательно, но удобно) ----------------
    if (method === "GET" && !pathname.startsWith("/api/")) {
      return serveStatic(pathname, res);
    }

    sendJSON(res, 404, { error: "Маршрут не найден" });
  } catch (e) {
    sendJSON(res, 500, { error: "Внутренняя ошибка сервера", details: e.message });
  }
});

function serveStatic(pathname, res) {
  const publicDir = path.join(__dirname, "public");
  let filePath = path.join(publicDir, pathname === "/" ? "index.html" : pathname);
  if (!filePath.startsWith(publicDir)) { // защита от ../../
    res.writeHead(403); return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Файл не найден. API доступен на /api/*");
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json" };
    res.writeHead(200, { "Content-Type": (types[ext] || "application/octet-stream") + "; charset=utf-8" });
    res.end(data);
  });
}

server.listen(config.PORT, () => {
  console.log(`🍣 Суши Pizza Тайм — сервер запущен: http://localhost:${config.PORT}`);
  console.log(`   API: http://localhost:${config.PORT}/api/products`);
  console.log(`   Admin password: ${config.ADMIN_PASSWORD} (смените через переменную окружения ADMIN_PASSWORD)`);
});

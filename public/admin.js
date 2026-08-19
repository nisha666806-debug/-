/* =========================================================================
   admin.js — панели идора. Токен дар sessionStorage (танҳо барои ҳамин
   таб/сессия — баъд аз пӯшидани браузер бекор мешавад, мувофиқи он ки
   дар сервер низ токен дар хотира аст, на дар база).
   ========================================================================= */
const API_BASE = "";
const TOKEN_KEY = "spt_admin_token";

function getToken(){ return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t){ sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken(){ sessionStorage.removeItem(TOKEN_KEY); }

async function apiRequest(method, path, body, auth=false){
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) headers["Authorization"] = "Bearer " + getToken();
  const res = await fetch(API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch(e){}
  if (!res.ok){
    const err = new Error((data && data.error) || "Ошибка сервера");
    err.status = res.status;
    throw err;
  }
  return data;
}
const apiGet = (path, auth) => apiRequest("GET", path, undefined, auth);
const apiPost = (path, body, auth) => apiRequest("POST", path, body, auth);
const apiPut = (path, body, auth) => apiRequest("PUT", path, body, auth);
const apiPatch = (path, body, auth) => apiRequest("PATCH", path, body, auth);
const apiDelete = (path, auth) => apiRequest("DELETE", path, undefined, auth);

function money(n){ return Number(n).toLocaleString("ru-RU") + " ₽"; }
function toast(msg, kind=""){
  const host = document.getElementById("toastHost");
  const el = document.createElement("div");
  el.className = "toast" + (kind ? " toast-"+kind : "");
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(()=> el.classList.add("show"));
  setTimeout(()=>{ el.classList.remove("show"); setTimeout(()=> el.remove(), 300); }, 2600);
}

const STATUSES = ["Новый","Принят","Готовится","Передан курьеру","Доставлен","Отменён"];
function statusClass(s){
  if (s==="Новый") return "st-new";
  if (s==="Доставлен") return "st-done";
  if (s==="Отменён") return "st-cancelled";
  return "st-progress";
}

let CATEGORIES = [];

// ---------------------------------------------------------------------------
// AUTH / BOOTSTRAP
// ---------------------------------------------------------------------------
async function tryAutoLogin(){
  if (!getToken()) return showLogin();
  try{
    await apiGet("/api/admin/orders", true); // проверка токена
    showDashboard();
  } catch(e){
    clearToken();
    showLogin();
  }
}

function showLogin(){
  document.getElementById("loginScreen").hidden = false;
  document.getElementById("dashboard").hidden = true;
}

async function showDashboard(){
  document.getElementById("loginScreen").hidden = true;
  document.getElementById("dashboard").hidden = false;
  try{ CATEGORIES = await apiGet("/api/categories"); }catch(e){ CATEGORIES = []; }
  loadOrders();
  loadProducts();
}

document.getElementById("loginBtn").addEventListener("click", doLogin);
document.getElementById("adminPassword").addEventListener("keydown", (e)=>{ if(e.key==="Enter") doLogin(); });

async function doLogin(){
  const pass = document.getElementById("adminPassword").value;
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";
  if (!pass){ errEl.textContent = "Введите пароль"; return; }
  try{
    const { token } = await apiPost("/api/admin/login", { password: pass });
    setToken(token);
    showDashboard();
  } catch(e){
    errEl.textContent = e.status === 401 ? "Неверный пароль" : "Не удалось подключиться к серверу";
  }
}

document.getElementById("logoutBtn").addEventListener("click", ()=>{
  clearToken();
  showLogin();
});

// ---------------------------------------------------------------------------
// TABS
// ---------------------------------------------------------------------------
document.querySelectorAll(".admin-tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".admin-tab").forEach(b=> b.classList.toggle("active", b===btn));
    document.getElementById("tabOrders").hidden = btn.dataset.tab !== "orders";
    document.getElementById("tabProducts").hidden = btn.dataset.tab !== "products";
  });
});

// ---------------------------------------------------------------------------
// ORDERS
// ---------------------------------------------------------------------------
document.getElementById("refreshOrdersBtn").addEventListener("click", loadOrders);

async function loadOrders(){
  const list = document.getElementById("ordersList");
  try{
    const orders = await apiGet("/api/admin/orders", true);
    renderOrders(orders);
  } catch(e){
    if (e.status === 401){ clearToken(); showLogin(); return; }
    list.innerHTML = `<div class="admin-empty">Не удалось загрузить заказы. Проверьте соединение с сервером.</div>`;
  }
}

function renderOrders(orders){
  const list = document.getElementById("ordersList");
  if (orders.length === 0){
    list.innerHTML = `<div class="admin-empty">Заказов пока нет.</div>`;
    return;
  }
  list.innerHTML = orders.map(o => `
    <div class="admin-order-card">
      <div class="aoc-main">
        <div class="aoc-top">
          <strong>${o.id}</strong>
          <span class="aoc-date">${new Date(o.date).toLocaleString("ru-RU")}</span>
        </div>
        <div class="aoc-customer"><b>${escapeHtml(o.name||"—")}</b> · ${escapeHtml(o.phone||"—")}</div>
        <ul class="aoc-items">
          ${o.items.map(i=>`<li>${i.qty} × ${escapeHtml(i.name)}${i.addons && i.addons.length ? ` (${i.addons.join(", ")})` : ""}</li>`).join("")}
        </ul>
        <div class="aoc-addr">
          ${o.fulfillment === "pickup" ? "Самовывоз" : "Доставка: " + escapeHtml([o.address?.city, o.address?.street, o.address?.house, o.address?.flat ? "кв. "+o.address.flat : ""].filter(Boolean).join(", "))}
          ${o.comment ? ` · «${escapeHtml(o.comment)}»` : ""}
        </div>
        <div class="aoc-totals">
          <span>Товары: <b>${money(o.subtotal)}</b></span>
          ${o.discount ? `<span>Скидка: <b>−${money(o.discount)}</b>${o.promoCode ? " ("+o.promoCode+")" : ""}</span>` : ""}
          <span>Доставка: <b>${o.deliveryCost ? money(o.deliveryCost) : "Бесплатно"}</b></span>
          <span>Оплата: <b>${paymentLabel(o.payment)}</b></span>
        </div>
      </div>
      <div class="aoc-side">
        <span class="aoc-total-big">${money(o.total)}</span>
        <select class="aoc-status-select ${statusClass(o.status)}" data-id="${o.id}">
          ${STATUSES.map(s=>`<option value="${s}" ${s===o.status?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".aoc-status-select").forEach(sel=>{
    sel.addEventListener("change", async ()=>{
      const id = sel.dataset.id;
      const status = sel.value;
      sel.disabled = true;
      try{
        await apiPatch(`/api/admin/orders/${id}`, { status }, true);
        sel.className = "aoc-status-select " + statusClass(status);
        toast("Статус обновлён", "success");
      } catch(e){
        toast("Не удалось обновить статус");
      } finally {
        sel.disabled = false;
      }
    });
  });
}

function paymentLabel(p){
  if (p === "card-online") return "Картой онлайн";
  if (p === "cash") return "Наличными";
  if (p === "card-courier") return "Картой курьеру";
  return p || "—";
}

function escapeHtml(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

// ---------------------------------------------------------------------------
// PRODUCTS
// ---------------------------------------------------------------------------
let productsCache = [];

async function loadProducts(){
  const tbody = document.getElementById("productsTableBody");
  try{
    productsCache = await apiGet("/api/products");
    renderProductsTable();
  } catch(e){
    tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">Не удалось загрузить товары.</td></tr>`;
  }
}

function renderProductsTable(){
  const tbody = document.getElementById("productsTableBody");
  if (productsCache.length === 0){
    tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">Товаров нет.</td></tr>`;
    return;
  }
  tbody.innerHTML = productsCache.map(p => `
    <tr>
      <td><span class="admin-row-emoji">${p.emoji||"🍽️"}</span></td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(categoryName(p.category))}</td>
      <td class="admin-row-price">${money(p.price)}</td>
      <td>${p.oldPrice ? `<span class="admin-row-old-price">${money(p.oldPrice)}</span>` : "—"}</td>
      <td>
        <div class="admin-flags">
          ${p.popular ? `<span class="admin-flag flag-popular">хит</span>` : ""}
          ${p.isNew ? `<span class="admin-flag flag-new">новинка</span>` : ""}
          ${p.oldPrice ? `<span class="admin-flag flag-sale">скидка</span>` : ""}
        </div>
      </td>
      <td>
        <div class="admin-row-actions">
          <button class="admin-icon-btn" data-action="edit" data-id="${p.id}" title="Редактировать">✎</button>
          <button class="admin-icon-btn danger" data-action="delete" data-id="${p.id}" title="Удалить">✕</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn=>{
    btn.addEventListener("click", ()=> openProductForm(productsCache.find(p=>p.id===Number(btn.dataset.id))));
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn=>{
    btn.addEventListener("click", ()=> deleteProduct(Number(btn.dataset.id)));
  });
}

function categoryName(id){ const c = CATEGORIES.find(c=>c.id===id); return c ? c.name : id; }

async function deleteProduct(id){
  const product = productsCache.find(p=>p.id===id);
  if (!confirm(`Удалить «${product?.name || id}»? Это действие необратимо.`)) return;
  try{
    await apiDelete(`/api/admin/products/${id}`, true);
    toast("Товар удалён", "success");
    loadProducts();
  } catch(e){
    if (e.status === 401){ clearToken(); showLogin(); return; }
    toast("Не удалось удалить товар");
  }
}

document.getElementById("addProductBtn").addEventListener("click", ()=> openProductForm(null));

function openProductForm(product){
  const modal = document.getElementById("productFormModal");
  const isEdit = !!product;
  modal.innerHTML = `
    <button class="modal-close" data-close-form>✕</button>
    <h2>${isEdit ? "Редактировать товар" : "Новый товар"}</h2>
    <div class="admin-form-grid">
      <div class="field"><label>Название *</label><input id="pf_name" type="text" value="${escapeHtml(product?.name||"")}"></div>
      <div class="field field-sm"><label>Категория</label>
        <select id="pf_category">${CATEGORIES.filter(c=>c.id!=="popular"&&c.id!=="new").map(c=>`<option value="${c.id}" ${product?.category===c.id?"selected":""}>${c.name}</option>`).join("")}</select>
      </div>
      <div class="field field-sm"><label>Эмодзи</label><input id="pf_emoji" type="text" value="${escapeHtml(product?.emoji||"🍽️")}" maxlength="4"></div>
      <div class="field"><label>Описание</label><textarea id="pf_description" rows="2">${escapeHtml(product?.description||"")}</textarea></div>
      <div class="field"><label>Состав</label><input id="pf_ingredients" type="text" value="${escapeHtml(product?.ingredients||"")}"></div>
      <div class="field field-sm"><label>Вес</label><input id="pf_weight" type="text" value="${escapeHtml(product?.weight||"")}" placeholder="250 г"></div>
      <div class="field field-sm"><label>Кол-во шт.</label><input id="pf_pieces" type="number" value="${product?.pieces ?? ""}" placeholder="8"></div>
      <div class="field field-sm"><label>Цена *</label><input id="pf_price" type="number" value="${product?.price ?? ""}"></div>
      <div class="field field-sm"><label>Старая цена</label><input id="pf_oldPrice" type="number" value="${product?.oldPrice ?? ""}"></div>
      <div class="field"><label>Теги для поиска</label><input id="pf_tags" type="text" value="${escapeHtml(product?.tags||"")}" placeholder="лосось острый ролл"></div>
    </div>
    <div class="admin-checkbox-row">
      <label><input type="checkbox" id="pf_popular" ${product?.popular?"checked":""}> Популярное</label>
      <label><input type="checkbox" id="pf_isNew" ${product?.isNew?"checked":""}> Новинка</label>
    </div>
    <div id="pfError" class="field-error"></div>
    <div class="admin-form-actions">
      <button class="btn btn-ghost" data-close-form>Отмена</button>
      <button class="btn btn-primary" id="pfSubmit">${isEdit ? "Сохранить" : "Добавить"}</button>
    </div>
  `;
  document.getElementById("productFormOverlay").classList.add("show");
  document.body.classList.add("no-scroll");

  modal.querySelectorAll("[data-close-form]").forEach(b=> b.addEventListener("click", closeProductForm));
  document.getElementById("pfSubmit").addEventListener("click", ()=> submitProductForm(product?.id));
}

function closeProductForm(){
  document.getElementById("productFormOverlay").classList.remove("show");
  document.body.classList.remove("no-scroll");
}
document.getElementById("productFormOverlay").addEventListener("click", (e)=>{
  if (e.target.id === "productFormOverlay") closeProductForm();
});

async function submitProductForm(existingId){
  const errEl = document.getElementById("pfError");
  const payload = {
    name: document.getElementById("pf_name").value.trim(),
    category: document.getElementById("pf_category").value,
    emoji: document.getElementById("pf_emoji").value.trim() || "🍽️",
    description: document.getElementById("pf_description").value.trim(),
    ingredients: document.getElementById("pf_ingredients").value.trim(),
    weight: document.getElementById("pf_weight").value.trim(),
    pieces: document.getElementById("pf_pieces").value ? Number(document.getElementById("pf_pieces").value) : null,
    price: Number(document.getElementById("pf_price").value) || 0,
    oldPrice: document.getElementById("pf_oldPrice").value ? Number(document.getElementById("pf_oldPrice").value) : null,
    tags: document.getElementById("pf_tags").value.trim(),
    popular: document.getElementById("pf_popular").checked,
    isNew: document.getElementById("pf_isNew").checked,
  };
  if (!payload.name){ errEl.textContent = "Введите название"; return; }
  if (!payload.price){ errEl.textContent = "Укажите цену"; return; }

  try{
    if (existingId){
      await apiPut(`/api/admin/products/${existingId}`, payload, true);
      toast("Товар обновлён", "success");
    } else {
      await apiPost("/api/admin/products", payload, true);
      toast("Товар добавлен", "success");
    }
    closeProductForm();
    loadProducts();
  } catch(e){
    if (e.status === 401){ clearToken(); showLogin(); return; }
    errEl.textContent = "Не удалось сохранить товар";
  }
}

document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeProductForm(); });

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------
tryAutoLogin();

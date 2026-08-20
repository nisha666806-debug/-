/* =========================================================================
   СУШИ PIZZA ТАЙМ — ЛОГИКА ПРИЛОЖЕНИЯ (подключено к бэкенду)
   Vanilla JS SPA. Каталог (товары/категории/акции) загружается с API при
   старте. Корзина/избранное/адрес — в localStorage (это личные,
   черновые данные пользователя). Заказы создаются и хранятся на
   сервере — localStorage хранит только список ID для истории.
   ========================================================================= */

// ---------------------------------------------------------------------------
// API LAYER
// ---------------------------------------------------------------------------
// Пустая строка = запросы идут на тот же адрес, с которого отдан сайт
// (так и есть, когда сервер раздаёт фронтенд из папки public/).
// Если разместите фронтенд отдельно от бэкенда — укажите полный адрес,
// например: const API_BASE = "http://localhost:4000";
const API_BASE = "";

async function apiRequest(method, path, body, token){
  const headers = { };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API_BASE + path, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch(e){ /* пустой ответ */ }
  if (!res.ok){
    const err = new Error((data && (data.error || (data.errors && data.errors.join(", ")))) || "Ошибка сервера");
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}
const apiGet = (path) => apiRequest("GET", path);
const apiPost = (path, body, token) => apiRequest("POST", path, body, token);
const apiPatch = (path, body, token) => apiRequest("PATCH", path, body, token);
const apiPut = (path, body, token) => apiRequest("PUT", path, body, token);
const apiDelete = (path, token) => apiRequest("DELETE", path, undefined, token);

// ---- Токени корбар (аккаунти воқеӣ дар сервер) ----------------------------
function userToken(){ try{ return localStorage.getItem("spt_user_token"); }catch(e){ return null; } }
function setUserToken(t){ try{ localStorage.setItem("spt_user_token", t); }catch(e){} }
function clearUserToken(){ try{ localStorage.removeItem("spt_user_token"); }catch(e){} }
function isLoggedIn(){ return !!userToken(); }

// Дархостҳо аз номи корбари воридшуда
const meGet = (path) => apiRequest("GET", path, undefined, userToken());
const mePost = (path, body) => apiRequest("POST", path, body, userToken());
const mePatch = (path, body) => apiRequest("PATCH", path, body, userToken());
const mePut = (path, body) => apiRequest("PUT", path, body, userToken());
const meDelete = (path) => apiRequest("DELETE", path, undefined, userToken());

// ---------------------------------------------------------------------------
// КАТАЛОГ (заполняется с сервера при старте — см. boot())
// ---------------------------------------------------------------------------
let CATEGORIES = [];
let products = [];
let ADDON_GROUPS = [];
let promotions = [];
let DELIVERY_ZONES = [];
let CITIES = [];

async function loadCatalog(){
  const [categories, items, addons, promos, zones, cities] = await Promise.all([
    apiGet("/api/categories"),
    apiGet("/api/products"),
    apiGet("/api/addon-groups"),
    apiGet("/api/promotions"),
    apiGet("/api/delivery-zones"),
    apiGet("/api/cities"),
  ]);
  CATEGORIES = categories; products = items; ADDON_GROUPS = addons;
  promotions = promos; DELIVERY_ZONES = zones; CITIES = cities;
}

// ---------------------------------------------------------------------------
// STORAGE HELPERS
// ---------------------------------------------------------------------------
const LS = {
  get(key, fallback){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } },
  set(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} },
};

let state = {
  cart: LS.get("spt_cart", []),                 // [{uid, productId, qty, addons:{sauce:[],extra:[],drink:[]}}]
  favorites: LS.get("spt_favorites", []),        // [productId,...] — синхронизируется с сервером при входе
  address: LS.get("spt_address", { city:"Москва", street:"", house:"", block:"", flat:"", entrance:"", floor:"", intercom:"", comment:"" }),
  account: null,                                 // профиль с сервера (null = не вошёл)
  myOrders: [],                                  // заказы аккаунта (с сервера)
  guestOrderIds: LS.get("spt_order_ids", []),    // заказы, сделанные без входа в аккаунт
  ordersCache: {},                               // id -> заказ
  promo: LS.get("spt_promo", null),
  fulfillment: LS.get("spt_fulfillment", "delivery"), // delivery | pickup
};

function saveCart(){ LS.set("spt_cart", state.cart); renderBadges(); }
function saveFavoritesLocal(){ LS.set("spt_favorites", state.favorites); renderBadges(); }
function saveFavorites(){ saveFavoritesLocal(); syncFavoritesToServer(); }
function saveAddress(){ LS.set("spt_address", state.address); }
function saveGuestOrderIds(){ LS.set("spt_order_ids", state.guestOrderIds); }
function savePromo(){ LS.set("spt_promo", state.promo); }
function saveFulfillment(){ LS.set("spt_fulfillment", state.fulfillment); }

// ---------------------------------------------------------------------------
// ROUTING
// ---------------------------------------------------------------------------
let routeParams = {};
let checkoutStep = 1;

function navigate(view, params={}){
  routeParams = params;
  if (view === "checkout") checkoutStep = 1;
  location.hash = view;
  render();
  window.scrollTo({top:0, behavior:"instant" in window ? "instant":"auto"});
  closeSideMenu();
}

window.addEventListener("hashchange", ()=>{ render(); });

function currentView(){
  const h = location.hash.replace("#","").split("?")[0];
  return h || "home";
}

// ---------------------------------------------------------------------------
// UTIL
// ---------------------------------------------------------------------------
function money(n){ return n.toLocaleString("ru-RU") + " ₽"; }
function findProduct(id){ return products.find(p => p.id === Number(id)); }
function catName(id){ const c = CATEGORIES.find(c=>c.id===id); return c ? t(c.name) : id; }

function toast(msg, kind=""){
  const host = document.getElementById("toastHost");
  const el = document.createElement("div");
  el.className = "toast" + (kind ? " toast-"+kind : "");
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(()=> el.classList.add("show"));
  setTimeout(()=>{ el.classList.remove("show"); setTimeout(()=> el.remove(), 300); }, 2600);
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

// ---------------------------------------------------------------------------
// CART LOGIC
// ---------------------------------------------------------------------------
function addonUid(addons){
  const parts = [];
  ["sauce","extra","drink"].forEach(g=>{
    (addons[g]||[]).slice().sort().forEach(id=> parts.push(g+":"+id));
  });
  return parts.join("|");
}

function addonsPrice(addons){
  let total = 0;
  ADDON_GROUPS.forEach(g=>{
    (addons[g.id]||[]).forEach(optId=>{
      const opt = g.options.find(o=>o.id===optId);
      if (opt) total += opt.price;
    });
  });
  return total;
}

function addonsLabel(addons){
  const labels = [];
  ADDON_GROUPS.forEach(g=>{
    (addons[g.id]||[]).forEach(optId=>{
      const opt = g.options.find(o=>o.id===optId);
      if (opt) labels.push(opt.name);
    });
  });
  return labels.join(", ");
}

function cartItemUnitPrice(item){
  const p = findProduct(item.productId);
  if (!p) return 0;
  return p.price + addonsPrice(item.addons || {});
}

function cartCount(){ return state.cart.reduce((s,i)=>s+i.qty,0); }
function cartSubtotal(){ return state.cart.reduce((s,i)=> s + cartItemUnitPrice(i)*i.qty, 0); }

function activeDeliveryZone(){
  // Для демо всегда используем Зону 1, если выбран город Москва, иначе Зону 3
  if (state.address.city === "Москва") return DELIVERY_ZONES[0];
  return DELIVERY_ZONES[2];
}

function deliveryCost(){
  if (state.fulfillment === "pickup") return 0;
  const zone = activeDeliveryZone();
  const sub = cartSubtotal();
  if (sub === 0) return 0;
  if (sub >= zone.freeFrom) return 0;
  return zone.price;
}

function promoDiscount(){
  if (!state.promo) return 0;
  const sub = cartSubtotal();
  if (sub < state.promo.minSum) return 0;
  if (state.promo.type === "percent") return Math.round(sub * state.promo.value/100);
  return Math.min(state.promo.value, sub);
}

function cartTotal(){
  const sub = cartSubtotal();
  const disc = promoDiscount();
  const del = deliveryCost();
  return Math.max(0, sub - disc) + del;
}

function addToCart(productId, qty, addons){
  const uid = productId + "::" + addonUid(addons||{});
  const existing = state.cart.find(i=>i.uid===uid);
  if (existing){ existing.qty += qty; }
  else { state.cart.push({ uid, productId, qty, addons: addons||{} }); }
  saveCart();
  toast(t("Товар добавлен в корзину"), "success");
  bounceCartIcon();
}

function setCartQty(uid, qty){
  const item = state.cart.find(i=>i.uid===uid);
  if (!item) return;
  if (qty <= 0){ state.cart = state.cart.filter(i=>i.uid!==uid); }
  else { item.qty = qty; }
  saveCart();
  if (currentView()==="cart") renderApp();
  renderCartDrawerBody();
}

function removeCartItem(uid){
  state.cart = state.cart.filter(i=>i.uid!==uid);
  saveCart();
  toast("Товар удалён из корзины");
  if (currentView()==="cart") renderApp();
  renderCartDrawerBody();
}

function clearCart(){
  state.cart = [];
  state.promo = null;
  saveCart(); savePromo();
}

function bounceCartIcon(){
  const el = document.getElementById("cartBtnHeader");
  if (!el) return;
  el.classList.remove("bounce"); void el.offsetWidth; el.classList.add("bounce");
}

// ---------------------------------------------------------------------------
// FAVORITES
// ---------------------------------------------------------------------------
function isFavorite(id){ return state.favorites.includes(id); }
function toggleFavorite(id){
  if (isFavorite(id)) state.favorites = state.favorites.filter(f=>f!==id);
  else { state.favorites.push(id); toast(t("Добавлено в избранное"), "success"); }
  saveFavorites();
  document.querySelectorAll(`[data-fav-id="${id}"]`).forEach(btn=>{
    btn.classList.toggle("active", isFavorite(id));
  });
}

// ---------------------------------------------------------------------------
// BADGES / HEADER STATE
// ---------------------------------------------------------------------------
function renderBadges(){
  const count = cartCount();
  const total = cartSubtotal();
  const favCount = state.favorites.length;

  const cartBadge = document.getElementById("cartBadge");
  cartBadge.hidden = count===0; cartBadge.textContent = count;
  const bnCartBadge = document.getElementById("bnCartBadge");
  bnCartBadge.hidden = count===0; bnCartBadge.textContent = count;

  const cartBtnTotal = document.getElementById("cartBtnTotal");
  cartBtnTotal.hidden = count===0; cartBtnTotal.textContent = money(total);

  const favBadge = document.getElementById("favBadge");
  favBadge.hidden = favCount===0; favBadge.textContent = favCount;

  const sticky = document.getElementById("stickyCart");
  if (count > 0 && window.innerWidth <= 860){
    sticky.hidden = false;
    document.getElementById("stickyCartCount").textContent = count;
    document.getElementById("stickyCartTotal").textContent = money(total);
  } else {
    sticky.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// HEADER: CATEGORY STRIP + SEARCH + NAV
// ---------------------------------------------------------------------------
function buildCategoryStrip(){
  const strip = document.getElementById("categoryStrip");
  strip.innerHTML = CATEGORIES.map(c =>
    `<button class="cat-chip" data-action="go-category" data-cat="${c.id}">
       <span>${c.emoji}</span>${t(c.name)}
     </button>`
  ).join("");
}

function highlightActiveCategory(catId){
  document.querySelectorAll(".cat-chip").forEach(chip=>{
    chip.classList.toggle("active", chip.dataset.cat === catId);
  });
}

function bindSearch(){
  const inputs = [document.getElementById("searchInput"), document.getElementById("searchInputMobile")];
  inputs.forEach(inp=>{
    inp.addEventListener("input", (e)=>{
      const q = e.target.value.trim();
      inputs.forEach(i=>{ if(i!==e.target) i.value = q; });
      if (q.length === 0){ if(currentView()==="search") navigate("home"); return; }
      navigate("search", { q });
    });
    inp.addEventListener("keydown", (e)=>{ if(e.key==="Escape"){ inp.value=""; navigate("home"); } });
  });
}

function searchProducts(q){
  const needle = q.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(needle) ||
    p.tags.toLowerCase().includes(needle) ||
    p.ingredients.toLowerCase().includes(needle) ||
    catName(p.category).toLowerCase().includes(needle) ||
    (CATEGORIES.find(c=>c.id===p.category)?.name||"").toLowerCase().includes(needle)
  );
}

// ---------------------------------------------------------------------------
// SIDE MENU / MODALS / DRAWER open-close helpers
// ---------------------------------------------------------------------------
function openSideMenu(){ document.getElementById("sideMenu").classList.add("open"); document.getElementById("sideMenuOverlay").classList.add("show"); document.body.classList.add("no-scroll"); }
function closeSideMenu(){ document.getElementById("sideMenu").classList.remove("open"); document.getElementById("sideMenuOverlay").classList.remove("show"); syncBodyScrollLock(); }

function openCartDrawer(){ renderCartDrawerBody(); document.getElementById("cartDrawer").classList.add("open"); document.getElementById("cartOverlay").classList.add("show"); document.body.classList.add("no-scroll"); }
function closeCartDrawer(){ document.getElementById("cartDrawer").classList.remove("open"); document.getElementById("cartOverlay").classList.remove("show"); syncBodyScrollLock(); }

function openProductModal(id){
  const p = findProduct(id);
  if (!p) return;
  renderProductModal(p);
  document.getElementById("productModalOverlay").classList.add("show");
  document.body.classList.add("no-scroll");
}
function closeProductModal(){ document.getElementById("productModalOverlay").classList.remove("show"); syncBodyScrollLock(); }

function openPromoModal(promo){
  renderPromoModal(promo);
  document.getElementById("promoModalOverlay").classList.add("show");
  document.body.classList.add("no-scroll");
}
function closePromoModal(){ document.getElementById("promoModalOverlay").classList.remove("show"); syncBodyScrollLock(); }

function openAddressModal(){
  renderAddressModal();
  document.getElementById("addressModalOverlay").classList.add("show");
  document.body.classList.add("no-scroll");
}
function closeAddressModal(){ document.getElementById("addressModalOverlay").classList.remove("show"); syncBodyScrollLock(); }

function syncBodyScrollLock(){
  const anyOpen = document.getElementById("sideMenu").classList.contains("open")
    || document.getElementById("cartDrawer").classList.contains("open")
    || document.getElementById("productModalOverlay").classList.contains("show")
    || document.getElementById("promoModalOverlay").classList.contains("show")
    || document.getElementById("addressModalOverlay").classList.contains("show");
  document.body.classList.toggle("no-scroll", anyOpen);
}

// ---------------------------------------------------------------------------
// MASTER RENDER
// ---------------------------------------------------------------------------
function render(){
  renderApp();
  renderBadges();
  updateAddressPill();
  window.scrollTo(0,0);
}

function renderApp(){
  const view = currentView();
  const app = document.getElementById("app");
  highlightActiveCategory(view==="category" ? routeParams.catId : null);

  document.querySelectorAll('[data-nav]').forEach(a=>{
    a.classList.toggle("current", a.dataset.nav === view);
  });

  switch(view){
    case "home": app.innerHTML = viewHome(); afterRenderHome(); break;
    case "menu": app.innerHTML = viewMenu(routeParams.catId||"popular"); afterRenderMenu(); break;
    case "category": app.innerHTML = viewMenu(routeParams.catId||"popular"); afterRenderMenu(); break;
    case "search": app.innerHTML = viewSearch(routeParams.q||""); break;
    case "promotions": app.innerHTML = viewPromotions(); break;
    case "favorites": app.innerHTML = viewFavorites(); break;
    case "cart": app.innerHTML = viewCartPage(); break;
    case "checkout": app.innerHTML = viewCheckout(); afterRenderCheckout(); break;
    case "order-success": app.innerHTML = viewOrderSuccess(); break;
    case "delivery": app.innerHTML = viewDelivery(); break;
    case "about": app.innerHTML = viewAbout(); break;
    case "contacts": app.innerHTML = viewContacts(); break;
    case "profile": app.innerHTML = viewProfile(); afterRenderProfile(); break;
    case "orders": app.innerHTML = viewOrders(); afterRenderOrders(); break;
    default: app.innerHTML = viewHome(); afterRenderHome();
  }
  document.getElementById("siteHeader").classList.toggle("compact-strip", view!=="home");
}

// ---------------------------------------------------------------------------
// PRODUCT CARD (reusable)
// ---------------------------------------------------------------------------
function productCard(p){
  const discount = p.oldPrice ? Math.round((1 - p.price/p.oldPrice)*100) : 0;
  return `
  <article class="product-card" data-action="open-product" data-id="${p.id}">
    <div class="pc-photo" style="background:${p.photoBg}">
      ${p.image ? `<img class="pc-photo-img" src="${p.image}" alt="${escapeHtml(p.name)}">` : `<span class="pc-emoji">${p.emoji}</span>`}
      ${p.isNew ? `<span class="pc-flag pc-flag-new">${t("Новинка")}</span>` : ''}
      ${discount ? `<span class="pc-flag pc-flag-sale">−${discount}%</span>` : ''}
      <button class="pc-fav ${isFavorite(p.id)?'active':''}" data-fav-id="${p.id}" data-action="toggle-fav" aria-label="В избранное">
        <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2 5 5.6 5c2 0 3.3 1 4.4 2.4C11.1 6 12.4 5 14.4 5 18 5 19.5 8.6 22 11.9 19.5 16.4 12 21 12 21z"/></svg>
      </button>
    </div>
    <div class="pc-body">
      <h3 class="pc-title">${p.name}</h3>
      <p class="pc-desc">${p.description}</p>
      <div class="pc-meta">${p.pieces ? p.pieces+' шт. · ' : ''}${p.weight}</div>
      <div class="pc-bottom">
        <div class="pc-price">
          <span class="pc-price-now">${money(p.price)}</span>
          ${p.oldPrice ? `<span class="pc-price-old">${money(p.oldPrice)}</span>` : ''}
        </div>
        <button class="pc-add" data-action="quick-add" data-id="${p.id}">${t("Добавить")}</button>
      </div>
    </div>
  </article>`;
}

function productGrid(list){
  if (list.length===0){
    return `<div class="empty-state">
      <span class="empty-emoji">🔍</span>
      <h3>${t("Ничего не найдено")}</h3>
      <p>${t("Попробуйте изменить запрос или выберите другую категорию.")}</p>
    </div>`;
  }
  return `<div class="product-grid">${list.map(productCard).join("")}</div>`;
}

// ---------------------------------------------------------------------------
// VIEW: HOME
// ---------------------------------------------------------------------------
function viewHome(){
  const popular = products.filter(p=>p.popular).slice(0,8);
  const isNew = products.filter(p=>p.isNew).slice(0,8);
  return `
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-copy">
        <span class="eyebrow">${t("Москва и Московская область · от 35 минут")}</span>
        <h1>${t("Суши и пицца")}<br>${t("с&nbsp;доставкой")}</h1>
        <p class="hero-sub">${t("Свежие роллы, аппетитная пицца и любимые блюда — быстро доставим прямо к вам.")}</p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" data-action="go-menu">${t("Заказать сейчас")}</button>
          <button class="btn btn-ghost btn-lg" data-action="go-menu">${t("Посмотреть меню")}</button>
        </div>
        <ul class="hero-perks">
          <li>${t("🚀 Быстрая доставка")}</li>
          <li>${t("🌿 Свежие продукты")}</li>
          <li>${t("📖 Большой выбор")}</li>
          <li>${t("🏷️ Выгодные акции")}</li>
        </ul>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="hero-card hc-1">🍣</div>
        <div class="hero-card hc-2">🍕</div>
        <div class="hero-card hc-3">🍜</div>
        <div class="hero-ticket">
          <div class="ticket-row"><span>Филадельфия</span><span>799 ₽</span></div>
          <div class="ticket-row"><span>Пицца Пепперони</span><span>649 ₽</span></div>
          <div class="ticket-dash"></div>
          <div class="ticket-row ticket-total"><span>${t("Итого")}</span><span>1 448 ₽</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section promo-strip">
    <div class="section-head">
      <h2>${t("Акции")}</h2>
      <button class="link-more" data-action="go" data-view="promotions">${t("Все акции →")}</button>
    </div>
    <div class="promo-scroll">
      ${promotions.map(promo=>`
        <button class="promo-card ${promo.image?'promo-card-has-img':''}" style="--accent:${promo.color}" data-action="open-promo" data-id="${promo.id}">
          ${promo.image ? `<span class="promo-card-img"><img src="${promo.image}" alt="${escapeHtml(promo.title)}"></span>` : ""}
          <span class="promo-card-content">
            <span class="promo-tag">${promo.tag}</span>
            <strong>${promo.title}</strong>
            ${promo.code ? `<span class="promo-code">Промокод: ${promo.code}</span>` : `<span class="promo-code">${t("Автоматически")}</span>`}
          </span>
        </button>
      `).join("")}
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>🔥 ${t("Популярное")}</h2>
      <button class="link-more" data-action="go-category" data-cat="popular">${t("Всё меню →")}</button>
    </div>
    ${productGrid(popular)}
  </section>

  <section class="section">
    <div class="section-head">
      <h2>✨ ${t("Новинки")}</h2>
      <button class="link-more" data-action="go-category" data-cat="new">${t("Всё меню →")}</button>
    </div>
    ${productGrid(isNew)}
  </section>

  <section class="section categories-showcase">
    <div class="section-head"><h2>${t("Категории меню")}</h2></div>
    <div class="cat-showcase-grid">
      ${CATEGORIES.filter(c=>!["popular","new"].includes(c.id)).map(c=>`
        <button class="cat-showcase-card" data-action="go-category" data-cat="${c.id}">
          <span>${c.emoji}</span>${t(c.name)}
        </button>
      `).join("")}
    </div>
  </section>

  <section class="section delivery-teaser">
    <div class="dt-card">
      <div>
        <h2>${t("Доставим быстро и бережно")}</h2>
        <p>${t("Бесплатная доставка в пределах МКАД при заказе от 1500 ₽. Средний срок — 35–55 минут.")}</p>
        <button class="btn btn-primary" data-action="go" data-view="delivery">${t("Условия доставки")}</button>
      </div>
      <div class="dt-visual" aria-hidden="true">🛵</div>
    </div>
  </section>
  `;
}

function afterRenderHome(){}

// ---------------------------------------------------------------------------
// VIEW: MENU / CATEGORY
// ---------------------------------------------------------------------------
function productsForCategory(catId){
  if (catId === "popular") return products.filter(p=>p.popular);
  if (catId === "new") return products.filter(p=>p.isNew);
  return products.filter(p=>p.category===catId);
}

function viewMenu(catId){
  const list = productsForCategory(catId);
  return `
  <section class="section menu-page">
    <div class="menu-tabs" id="menuTabs">
      ${CATEGORIES.map(c=>`
        <button class="menu-tab ${c.id===catId?'active':''}" data-action="go-category" data-cat="${c.id}">
          <span>${c.emoji}</span>${t(c.name)}
        </button>`).join("")}
    </div>
    <div class="section-head">
      <h2>${CATEGORIES.find(c=>c.id===catId)?.emoji || ''} ${catName(catId)}</h2>
      <span class="count-pill">${list.length} блюд</span>
    </div>
    ${productGrid(list)}
  </section>`;
}

function afterRenderMenu(){
  const tabs = document.getElementById("menuTabs");
  if (tabs){
    const active = tabs.querySelector(".active");
    if (active) active.scrollIntoView({inline:"center", block:"nearest"});
  }
}

// ---------------------------------------------------------------------------
// VIEW: SEARCH
// ---------------------------------------------------------------------------
function viewSearch(q){
  const results = searchProducts(q);
  return `
  <section class="section">
    <div class="section-head">
      <h2>Результаты по запросу «${escapeHtml(q)}»</h2>
      <span class="count-pill">${results.length} найдено</span>
    </div>
    ${productGrid(results)}
  </section>`;
}

// ---------------------------------------------------------------------------
// VIEW: PROMOTIONS
// ---------------------------------------------------------------------------
function viewPromotions(){
  return `
  <section class="section">
    <div class="section-head"><h2>${t("Акции")}</h2></div>
    <div class="promo-grid">
      ${promotions.map(promo=>`
        <button class="promo-card promo-card-lg ${promo.image?'promo-card-has-img':''}" style="--accent:${promo.color}" data-action="open-promo" data-id="${promo.id}">
          ${promo.image ? `<span class="promo-card-img"><img src="${promo.image}" alt="${escapeHtml(promo.title)}"></span>` : ""}
          <span class="promo-card-content">
            <span class="promo-tag">${promo.tag}</span>
            <strong>${promo.title}</strong>
            <p>${promo.desc}</p>
            ${promo.code ? `<span class="promo-code">Промокод: ${promo.code}</span>` : `<span class="promo-code">${t("Скидка применяется автоматически")}</span>`}
          </span>
        </button>
      `).join("")}
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// PRODUCT MODAL
// ---------------------------------------------------------------------------
let modalQty = 1;
let modalAddons = { sauce:[], extra:[], drink:[] };

function renderProductModal(p){
  modalQty = 1;
  modalAddons = { sauce:[], extra:[], drink:[] };
  const modal = document.getElementById("productModal");
  const discount = p.oldPrice ? Math.round((1 - p.price/p.oldPrice)*100) : 0;
  modal.innerHTML = `
    <button class="modal-close" data-action="close-product">✕</button>
    <div class="pm-photo" style="background:${p.photoBg}">
      ${p.image ? `<img class="pm-photo-img" src="${p.image}" alt="${escapeHtml(p.name)}">` : `<span class="pm-emoji">${p.emoji}</span>`}
      ${discount ? `<span class="pc-flag pc-flag-sale">−${discount}%</span>` : ''}
    </div>
    <div class="pm-body">
      <div class="pm-head">
        <h2>${p.name}</h2>
        <button class="pc-fav ${isFavorite(p.id)?'active':''}" data-fav-id="${p.id}" data-action="toggle-fav" aria-label="В избранное">
          <svg viewBox="0 0 24 24" width="19" height="19"><path fill="currentColor" d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2 5 5.6 5c2 0 3.3 1 4.4 2.4C11.1 6 12.4 5 14.4 5 18 5 19.5 8.6 22 11.9 19.5 16.4 12 21 12 21z"/></svg>
        </button>
      </div>
      <p class="pm-desc">${p.description}</p>
      <div class="pm-facts">
        <div><span>${t("Состав")}</span><strong>${p.ingredients}</strong></div>
        <div><span>${t("Вес")}</span><strong>${p.weight}</strong></div>
        ${p.pieces ? `<div><span>${t("Количество")}</span><strong>${p.pieces} шт.</strong></div>` : ''}
        <div><span>${t("Аллергены")}</span><strong>${t("может содержать сою, глютен, кунжут")}</strong></div>
      </div>

      ${ADDON_GROUPS.map(g=>`
        <div class="pm-addons">
          <h4>${g.title}</h4>
          <div class="pm-addon-list">
            ${g.options.map(o=>`
              <label class="pm-addon-item">
                <input type="checkbox" data-action="toggle-addon" data-group="${g.id}" data-opt="${o.id}">
                <span>${o.name}</span>
                <em>+${money(o.price)}</em>
              </label>
            `).join("")}
          </div>
        </div>
      `).join("")}

      <div class="pm-footer">
        <div class="qty-stepper">
          <button data-action="qty-minus" aria-label="Уменьшить количество">−</button>
          <span id="modalQtyValue">1</span>
          <button data-action="qty-plus" aria-label="Увеличить количество">+</button>
        </div>
        <button class="btn btn-primary btn-lg pm-add-btn" data-action="add-to-cart-modal" data-id="${p.id}">
          Добавить в корзину · <span id="modalTotalPrice">${money(p.price)}</span>
        </button>
      </div>
    </div>
  `;
  updateModalTotal(p);
}

function updateModalTotal(p){
  const unit = p.price + addonsPrice(modalAddons);
  const el = document.getElementById("modalTotalPrice");
  if (el) el.textContent = money(unit * modalQty);
  const qv = document.getElementById("modalQtyValue");
  if (qv) qv.textContent = modalQty;
}

// ---------------------------------------------------------------------------
// PROMO MODAL
// ---------------------------------------------------------------------------
function renderPromoModal(promo){
  const modal = document.getElementById("promoModal");
  modal.innerHTML = `
    <button class="modal-close" data-action="close-promo">✕</button>
    ${promo.image
      ? `<div class="promo-modal-banner"><img src="${promo.image}" alt="${escapeHtml(promo.title)}"></div>`
      : `<div class="promo-modal-accent" style="background:${promo.color}"></div>`}
    <div class="promo-modal-body">
      <span class="promo-tag">${promo.tag}</span>
      <h2>${promo.title}</h2>
      <p>${promo.desc}</p>
      ${promo.code ? `
        <div class="promo-code-box">
          <span>${t("Промокод")}</span>
          <strong>${promo.code}</strong>
        </div>
        <button class="btn btn-primary btn-lg" data-action="use-promo" data-code="${promo.code}">${t("Применить и перейти в меню")}</button>
      ` : `<button class="btn btn-primary btn-lg" data-action="go-menu">${t("Перейти в меню")}</button>`}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// FAVORITES VIEW
// ---------------------------------------------------------------------------
function viewFavorites(){
  const items = products.filter(p=>state.favorites.includes(p.id));
  return `
  <section class="section">
    <div class="section-head"><h2>${t("❤️ Мои любимые блюда")}</h2></div>
    ${items.length ? productGrid(items) : `
      <div class="empty-state">
        <span class="empty-emoji">🤍</span>
        <h3>${t("Пока ничего нет в избранном")}</h3>
        <p>${t("Нажимайте на сердечко на карточке блюда, чтобы сохранить его сюда.")}</p>
        <button class="btn btn-primary" data-action="go-menu">${t("Перейти в меню")}</button>
      </div>`}
  </section>`;
}

// ---------------------------------------------------------------------------
// CART (drawer + full page share the same item markup)
// ---------------------------------------------------------------------------
function cartItemsMarkup(){
  return state.cart.map(item=>{
    const p = findProduct(item.productId);
    if (!p) return "";
    const unit = cartItemUnitPrice(item);
    const addonsTxt = addonsLabel(item.addons||{});
    return `
    <div class="cart-item">
      <div class="ci-photo" style="background:${p.photoBg}"><span>${p.emoji}</span></div>
      <div class="ci-body">
        <div class="ci-top">
          <h4>${p.name}</h4>
          <button class="ci-remove" data-action="remove-cart-item" data-uid="${item.uid}" aria-label="Удалить">✕</button>
        </div>
        ${addonsTxt ? `<p class="ci-addons">${addonsTxt}</p>` : ""}
        <div class="ci-bottom">
          <div class="qty-stepper qty-stepper-sm">
            <button data-action="cart-qty-minus" data-uid="${item.uid}" aria-label="Уменьшить">−</button>
            <span>${item.qty}</span>
            <button data-action="cart-qty-plus" data-uid="${item.uid}" aria-label="Увеличить">+</button>
          </div>
          <strong>${money(unit*item.qty)}</strong>
        </div>
      </div>
    </div>`;
  }).join("");
}

function cartSummaryMarkup(showCheckoutBtn){
  const sub = cartSubtotal();
  const disc = promoDiscount();
  const del = deliveryCost();
  const total = cartTotal();
  const zone = activeDeliveryZone();
  const remainForFree = state.fulfillment==="delivery" ? Math.max(0, zone.freeFrom - sub) : 0;
  return `
    ${remainForFree > 0 && sub > 0 ? `<p class="cart-free-hint">Добавьте ещё ${money(remainForFree)}, чтобы получить бесплатную доставку 🚀</p>` : ""}
    <div class="promo-input-row">
      <input type="text" id="promoInput" placeholder="${t('Промокод')}" value="${state.promo ? state.promo.code : ''}">
      <button class="btn btn-ghost" data-action="apply-promo">${t("Применить")}</button>
    </div>
    <div id="promoError" class="field-error"></div>
    <div class="cart-lines">
      <div class="cart-line"><span>${t("Товары")}</span><span>${money(sub)}</span></div>
      ${disc>0 ? `<div class="cart-line cart-line-discount"><span>Скидка${state.promo? ' ('+state.promo.code+')':''}</span><span>−${money(disc)}</span></div>` : ""}
      <div class="cart-line"><span>${t("Доставка")}</span><span>${del===0 ? t("Бесплатно") : money(del)}</span></div>
    </div>
    <div class="cart-total-row">
      <span>${t("Итого")}</span><span>${money(total)}</span>
    </div>
    ${showCheckoutBtn ? `<button class="btn btn-primary btn-lg btn-block" data-action="go-checkout">${t("Оформить заказ")}</button>` : ""}
  `;
}

function renderCartDrawerBody(){
  const body = document.getElementById("cartBody");
  const foot = document.getElementById("cartFoot");
  if (state.cart.length===0){
    body.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">🛒</span>
        <h3>${t("Ваша корзина пока пуста")}</h3>
        <p>${t("Добавьте что-нибудь вкусное из меню.")}</p>
        <button class="btn btn-primary" data-action="go-menu-close-cart">${t("Перейти в меню")}</button>
      </div>`;
    foot.innerHTML = "";
    return;
  }
  body.innerHTML = `<div class="cart-items">${cartItemsMarkup()}</div>`;
  foot.innerHTML = cartSummaryMarkup(true);
}

function viewCartPage(){
  if (state.cart.length===0){
    return `
    <section class="section">
      <div class="empty-state empty-state-lg">
        <span class="empty-emoji">🛒</span>
        <h3>${t("Ваша корзина пока пуста")}</h3>
        <p>${t("Добавьте что-нибудь вкусное из меню.")}</p>
        <button class="btn btn-primary btn-lg" data-action="go-menu">${t("Перейти в меню")}</button>
      </div>
    </section>`;
  }
  return `
  <section class="section cart-page">
    <div class="section-head"><h2>${t("Корзина")}</h2></div>
    <div class="cart-page-grid">
      <div class="cart-items">${cartItemsMarkup()}</div>
      <div class="cart-summary-card">${cartSummaryMarkup(true)}</div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// ADDRESS MODAL (quick city/zone picker used from header pill)
// ---------------------------------------------------------------------------
function renderAddressModal(){
  const modal = document.getElementById("addressModal");
  modal.innerHTML = `
    <button class="modal-close" data-action="close-address">✕</button>
    <h2>${t("Выберите город доставки")}</h2>
    <p class="modal-sub">${t("Мы подберём ближайший ресторан и рассчитаем время доставки.")}</p>
    <div class="city-grid">
      ${CITIES.map(c=>`<button class="city-chip ${state.address.city===c?'active':''}" data-action="pick-city" data-city="${c}">${c}</button>`).join("")}
    </div>
    <div class="field">
      <label>${t("Улица и дом")}</label>
      <input type="text" id="quickStreet" placeholder="Например, Тверская, 12" value="${escapeHtml(state.address.street||'')}${state.address.house? ', '+escapeHtml(state.address.house):''}">
    </div>
    <button class="btn btn-primary btn-lg btn-block" data-action="save-quick-address">${t("Сохранить адрес")}</button>
  `;
}

function updateAddressPill(){
  const text = document.getElementById("addressPillText");
  if (!text) return;
  text.textContent = state.address.street ? `${state.address.city}, ${state.address.street}` : `${state.address.city}, доставка`;
}

// ---------------------------------------------------------------------------
// CHECKOUT (multi-step)
// ---------------------------------------------------------------------------
let checkoutForm = {
  fulfillment: state.fulfillment,
  city: state.address.city, street: state.address.street, house: state.address.house,
  block: state.address.block, flat: state.address.flat, entrance: state.address.entrance,
  floor: state.address.floor, intercom: state.address.intercom, comment: state.address.comment,
  name: "", phone: "",
  payment: "card-online",
};
let checkoutError = "";

const CHECKOUT_STEPS = [t("Получение"),t("Адрес"),t("Контакты"),t("Оплата"),t("Подтверждение")];

function checkoutStepsMarkup(){
  const total = state.fulfillment==="pickup" ? [1,3,4,5] : [1,2,3,4,5];
  return `<div class="checkout-steps">
    ${total.map((s,i)=>`
      <div class="cs-step ${s===checkoutStep?'active':''} ${s<checkoutStep?'done':''}">
        <span class="cs-num">${i+1}</span>
        <span class="cs-label">${CHECKOUT_STEPS[s-1]}</span>
      </div>`).join('<span class="cs-sep"></span>')}
  </div>`;
}

function viewCheckout(){
  if (state.cart.length===0){
    return `<section class="section"><div class="empty-state"><span class="empty-emoji">🛒</span><h3>${t("Корзина пуста")}</h3><p>${t("Добавьте товары, чтобы оформить заказ.")}</p><button class="btn btn-primary" data-action="go-menu">${t("Перейти в меню")}</button></div></section>`;
  }
  checkoutForm.fulfillment = state.fulfillment;
  let stepHtml = "";
  if (checkoutStep===1) stepHtml = stepFulfillment();
  else if (checkoutStep===2) stepHtml = stepAddress();
  else if (checkoutStep===3) stepHtml = stepContacts();
  else if (checkoutStep===4) stepHtml = stepPayment();
  else if (checkoutStep===5) stepHtml = stepConfirm();

  return `
  <section class="section checkout-page">
    <div class="section-head"><h2>${t("Оформление заказа")}</h2></div>
    ${checkoutStepsMarkup()}
    <div class="checkout-layout">
      <div class="checkout-form">
        ${checkoutError ? `<div class="field-error field-error-block">${checkoutError}</div>` : ""}
        ${stepHtml}
        <div class="checkout-nav">
          ${checkoutStep>1 ? `<button class="btn btn-ghost" data-action="checkout-back">${t("Назад")}</button>` : `<span></span>`}
          ${checkoutStep<5 ? `<button class="btn btn-primary" data-action="checkout-next">${t("Продолжить")}</button>` : `<button class="btn btn-primary btn-lg" data-action="checkout-confirm" ${orderSubmitting?'disabled':''}>${orderSubmitting?'Оформляем…':'Подтвердить заказ'}</button>`}
        </div>
      </div>
      <div class="cart-summary-card checkout-summary">
        <h4>${t("Ваш заказ")}</h4>
        <div class="cart-items cart-items-compact">${cartItemsMarkup()}</div>
        ${cartSummaryMarkup(false)}
      </div>
    </div>
  </section>`;
}

function stepFulfillment(){
  return `
  <div class="checkout-block">
    <h3>${t("Способ получения")}</h3>
    <div class="fulfillment-toggle">
      <button class="ft-option ${checkoutForm.fulfillment==='delivery'?'active':''}" data-action="pick-fulfillment" data-val="delivery">
        <span>🛵</span>${t("Доставка")}
      </button>
      <button class="ft-option ${checkoutForm.fulfillment==='pickup'?'active':''}" data-action="pick-fulfillment" data-val="pickup">
        <span>🏠</span>${t("Самовывоз")}
      </button>
    </div>
    ${checkoutForm.fulfillment==='pickup' ? `<p class="modal-sub">${t("Заберите заказ по адресу: Москва, ул. Примерная, д. 10. Готовность — через 25–35 минут.")}</p>` : ""}
  </div>`;
}

function stepAddress(){
  const f = checkoutForm;
  const saved = state.account?.addresses || [];
  return `
  <div class="checkout-block">
    <h3>${t("Адрес доставки")}</h3>
    ${saved.length ? `
      <div class="saved-address-picker">
        <span class="saved-address-label">${t("Сохранённые адреса:")}</span>
        <div class="saved-address-chips">
          ${saved.map(a=>`<button class="saved-address-chip" data-action="use-saved-address" data-id="${a.id}">${escapeHtml([a.street,a.house,a.flat?'кв. '+a.flat:''].filter(Boolean).join(', '))}</button>`).join("")}
        </div>
      </div>` : ""}
    <div class="field-grid">
      <div class="field"><label>${t("Город")}</label>
        <select id="f_city">${CITIES.map(c=>`<option ${f.city===c?'selected':''}>${c}</option>`).join("")}</select>
      </div>
      <div class="field"><label>${t("Улица *")}</label><input id="f_street" type="text" value="${escapeHtml(f.street||'')}" placeholder="Улица"></div>
      <div class="field field-sm"><label>${t("Дом *")}</label><input id="f_house" type="text" value="${escapeHtml(f.house||'')}" placeholder="12"></div>
      <div class="field field-sm"><label>${t("Корпус")}</label><input id="f_block" type="text" value="${escapeHtml(f.block||'')}" placeholder="1"></div>
      <div class="field field-sm"><label>${t("Квартира")}</label><input id="f_flat" type="text" value="${escapeHtml(f.flat||'')}" placeholder="45"></div>
      <div class="field field-sm"><label>${t("Подъезд")}</label><input id="f_entrance" type="text" value="${escapeHtml(f.entrance||'')}" placeholder="2"></div>
      <div class="field field-sm"><label>${t("Этаж")}</label><input id="f_floor" type="text" value="${escapeHtml(f.floor||'')}" placeholder="5"></div>
      <div class="field field-sm"><label>${t("Домофон")}</label><input id="f_intercom" type="text" value="${escapeHtml(f.intercom||'')}" placeholder="45К"></div>
    </div>
    <div class="field"><label>${t("Комментарий курьеру")}</label><textarea id="f_comment" rows="2" placeholder="Позвонить за 5 минут, код на воротах и т.д.">${escapeHtml(f.comment||'')}</textarea></div>
  </div>`;
}

function stepContacts(){
  const f = checkoutForm;
  // Агар корбар воридшуда бошад ва майдонҳо холӣ — аз аккаунт пур мекунем
  const name = f.name || state.account?.name || "";
  const phone = f.phone || (state.account ? formatPhone(state.account.phone) : "");
  return `
  <div class="checkout-block">
    <h3>${t("Контактные данные")}</h3>
    ${!isLoggedIn() ? `<p class="checkout-login-hint">${t("Есть аккаунт? ")}<button class="link-more" data-action="go" data-view="profile">${t("Войдите")}</button> ${t("— данные подставятся автоматически.")}</p>` : ""}
    <div class="field"><label>${t("Имя *")}</label><input id="f_name" type="text" value="${escapeHtml(name)}" placeholder="Как к вам обращаться"></div>
    <div class="field"><label>${t("Телефон *")}</label><input id="f_phone" type="tel" value="${escapeHtml(phone)}" placeholder="+7 (___) ___-__-__"></div>
  </div>`;
}

function stepPayment(){
  const f = checkoutForm;
  const opts = [
    {id:"card-online", label:t("Картой онлайн"), emoji:"💳"},
    {id:"cash", label:t("Наличными курьеру"), emoji:"💵"},
    {id:"card-courier", label:t("Картой курьеру"), emoji:"📲"},
  ];
  return `
  <div class="checkout-block">
    <h3>${t("Оплата")}</h3>
    <div class="payment-options">
      ${opts.map(o=>`
        <button class="payment-option ${f.payment===o.id?'active':''}" data-action="pick-payment" data-val="${o.id}">
          <span>${o.emoji}</span>${o.label}
        </button>`).join("")}
    </div>
  </div>`;
}

function stepConfirm(){
  const f = checkoutForm;
  return `
  <div class="checkout-block">
    <h3>${t("Подтверждение заказа")}</h3>
    <div class="confirm-grid">
      <div><span>${t("Получение")}</span><strong>${f.fulfillment==='delivery' ? 'Доставка' : 'Самовывоз'}</strong></div>
      ${f.fulfillment==='delivery' ? `<div><span>${t("Адрес")}</span><strong>${escapeHtml(f.city)}, ${escapeHtml(f.street||'')} ${escapeHtml(f.house||'')}${f.flat? ', кв. '+escapeHtml(f.flat):''}</strong></div>` : ""}
      <div><span>${t("Имя")}</span><strong>${escapeHtml(f.name||'')}</strong></div>
      <div><span>${t("Телефон")}</span><strong>${escapeHtml(f.phone||'')}</strong></div>
      <div><span>${t("Оплата")}</span><strong>${f.payment==='card-online'?'Картой онлайн':f.payment==='cash'?'Наличными курьеру':'Картой курьеру'}</strong></div>
    </div>
  </div>`;
}

function afterRenderCheckout(){}

function validateStep(step){
  checkoutError = "";
  if (step===2 && checkoutForm.fulfillment==='delivery'){
    if (!checkoutForm.street || !checkoutForm.house){ checkoutError = t("Введите адрес доставки"); return false; }
  }
  if (step===3){
    if (!checkoutForm.name){ checkoutError = t("Введите имя"); return false; }
    if (!checkoutForm.phone || checkoutForm.phone.replace(/\D/g,"").length < 10){ checkoutError = t("Введите номер телефона"); return false; }
  }
  return true;
}

function pullStepInputs(step){
  if (step===2){
    checkoutForm.city = document.getElementById("f_city")?.value || checkoutForm.city;
    checkoutForm.street = document.getElementById("f_street")?.value || "";
    checkoutForm.house = document.getElementById("f_house")?.value || "";
    checkoutForm.block = document.getElementById("f_block")?.value || "";
    checkoutForm.flat = document.getElementById("f_flat")?.value || "";
    checkoutForm.entrance = document.getElementById("f_entrance")?.value || "";
    checkoutForm.floor = document.getElementById("f_floor")?.value || "";
    checkoutForm.intercom = document.getElementById("f_intercom")?.value || "";
    checkoutForm.comment = document.getElementById("f_comment")?.value || "";
  }
  if (step===3){
    checkoutForm.name = document.getElementById("f_name")?.value || "";
    checkoutForm.phone = document.getElementById("f_phone")?.value || "";
  }
}

function goCheckoutNext(){
  pullStepInputs(checkoutStep);
  if (!validateStep(checkoutStep)){ renderApp(); return; }
  const seq = checkoutForm.fulfillment==='pickup' ? [1,3,4,5] : [1,2,3,4,5];
  const idx = seq.indexOf(checkoutStep);
  checkoutStep = seq[idx+1] || 5;
  renderApp();
}

function goCheckoutBack(){
  pullStepInputs(checkoutStep);
  const seq = checkoutForm.fulfillment==='pickup' ? [1,3,4,5] : [1,2,3,4,5];
  const idx = seq.indexOf(checkoutStep);
  checkoutStep = seq[idx-1] || 1;
  checkoutError = "";
  renderApp();
}

let orderSubmitting = false;

async function confirmOrder(){
  if (orderSubmitting) return;
  if (state.cart.length===0){ checkoutError = t("Добавьте хотя бы один товар"); renderApp(); return; }
  if (checkoutForm.fulfillment==='delivery' && (!checkoutForm.street || !checkoutForm.house)){ checkoutError = t("Введите адрес доставки"); checkoutStep=2; renderApp(); return; }
  if (!checkoutForm.name || !checkoutForm.phone){ checkoutError = t("Заполните контактные данные"); checkoutStep=3; renderApp(); return; }

  const payload = {
    items: state.cart.map(i => ({ productId: i.productId, qty: i.qty, addons: i.addons || {} })),
    fulfillment: checkoutForm.fulfillment,
    address: checkoutForm.fulfillment === 'delivery' ? {
      city: checkoutForm.city, street: checkoutForm.street, house: checkoutForm.house,
      block: checkoutForm.block, flat: checkoutForm.flat, entrance: checkoutForm.entrance,
      floor: checkoutForm.floor, intercom: checkoutForm.intercom, comment: checkoutForm.comment,
    } : null,
    name: checkoutForm.name,
    phone: checkoutForm.phone,
    payment: checkoutForm.payment,
    promoCode: state.promo ? state.promo.code : null,
  };

  orderSubmitting = true; checkoutError = ""; renderApp();
  try{
    const order = await apiPost("/api/orders", payload);

    state.address = { city:checkoutForm.city, street:checkoutForm.street, house:checkoutForm.house, block:checkoutForm.block, flat:checkoutForm.flat, entrance:checkoutForm.entrance, floor:checkoutForm.floor, intercom:checkoutForm.intercom, comment:checkoutForm.comment };
    state.fulfillment = checkoutForm.fulfillment;
    saveAddress(); saveFulfillment();

    if (isLoggedIn()){
      state.myOrders.unshift(order);
      // Адреси доставкаро ба аккаунт захира мекунем, то дафъаи оянда зуд интихоб шавад
      if (checkoutForm.fulfillment === "delivery"){
        try{ state.account = await mePost("/api/me/addresses", state.address); }catch(e){}
      }
    } else {
      state.guestOrderIds.unshift(order.id);
      saveGuestOrderIds();
    }
    state.ordersCache[order.id] = order;
    clearCart();
    checkoutStep = 1;
    orderSubmitting = false;
    navigate("order-success", { order });
  } catch(e){
    orderSubmitting = false;
    checkoutError = (e.data && e.data.errors && e.data.errors.join(". ")) || e.message || t("Не удалось оформить заказ. Проверьте соединение с сервером.");
    renderApp();
  }
}

function viewOrderSuccess(){
  const order = routeParams.order;
  if (!order) return `<section class="section"><div class="empty-state"><h3>${t("Заказ не найден")}</h3><button class="btn btn-primary" data-action="go-menu">${t("В меню")}</button></div></section>`;
  return `
  <section class="section order-success">
    <div class="os-card">
      <span class="os-emoji">✅</span>
      <h2>Заказ №${order.id} принят!</h2>
      <p>${t("Мы уже готовим ваш заказ. Статус можно отслеживать в личном кабинете.")}</p>
      <div class="os-status">${t("Статус: ")}<strong>${order.status}</strong></div>
      <div class="os-total">${t("Сумма заказа: ")}<strong>${money(order.total)}</strong></div>
      <div class="os-actions">
        <button class="btn btn-primary" data-action="go" data-view="orders">${t("Мои заказы")}</button>
        <button class="btn btn-ghost" data-action="go-menu">${t("Вернуться в меню")}</button>
      </div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// VIEW: DELIVERY
// ---------------------------------------------------------------------------
function viewDelivery(){
  return `
  <section class="section">
    <div class="section-head"><h2>${t("Доставка и оплата")}</h2></div>
    <div class="delivery-zones">
      ${DELIVERY_ZONES.map(z=>`
        <div class="zone-card">
          <h3>${z.name}</h3>
          <ul>
            <li><span>${t("Минимальный заказ")}</span><strong>${money(z.minOrder)}</strong></li>
            <li><span>${t("Стоимость доставки")}</span><strong>${z.price===0? 'Бесплатно' : money(z.price)}</strong></li>
            <li><span>${t("Бесплатно от")}</span><strong>${money(z.freeFrom)}</strong></li>
            <li><span>${t("Среднее время")}</span><strong>${z.time}</strong></li>
          </ul>
        </div>`).join("")}
    </div>
    <div class="delivery-map" aria-hidden="true">
      <div class="dm-ring dm-ring-1"></div>
      <div class="dm-ring dm-ring-2"></div>
      <div class="dm-ring dm-ring-3"></div>
      <div class="dm-pin">🏠</div>
    </div>
    <div class="payment-info">
      <h3>${t("Способы оплаты")}</h3>
      <div class="payment-badges">
        <span>💳 ${t("Картой онлайн")}</span>
        <span>💵 ${t("Наличными курьеру")}</span>
        <span>📲 ${t("Картой курьеру")}</span>
      </div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// VIEW: ABOUT / CONTACTS
// ---------------------------------------------------------------------------
function viewAbout(){
  return `
  <section class="section about-page">
    <div class="section-head"><h2>${t("О компании")}</h2></div>
    <p class="about-lead">${t("«Суши Pizza Тайм» — служба доставки, которая объединила два любимых города вкуса: свежие японские роллы и итальянскую пиццу на тонком тесте. Мы работаем в Москве и Московской области и каждый день собираем заказы так, будто готовим для своей семьи.")}</p>
    <div class="about-grid">
      <div class="about-card"><span>🌿</span><h4>${t("Свежесть")}</h4><p>${t("Рыбу и овощи закупаем ежедневно, тесто для пиццы готовим по классической рецептуре.")}</p></div>
      <div class="about-card"><span>⏱️</span><h4>${t("Скорость")}</h4><p>${t("Среднее время доставки по Москве — от 35 минут благодаря сети локальных кухонь.")}</p></div>
      <div class="about-card"><span>🤝</span><h4>${t("Честность")}</h4><p>${t("Вес и состав в карточке товара всегда соответствуют тому, что приедет в коробке.")}</p></div>
    </div>
  </section>`;
}

function viewContacts(){
  return `
  <section class="section contacts-page">
    <div class="section-head"><h2>${t("Контакты")}</h2></div>
    <div class="contacts-grid">
      <div class="contact-card">
        <h4>${t("Телефон")}</h4>
        <a href="tel:+74951234567">+7 (495) 123-45-67</a>
      </div>
      <div class="contact-card">
        <h4>Email</h4>
        <a href="mailto:hello@sushipizzatime.ru">hello@sushipizzatime.ru</a>
      </div>
      <div class="contact-card">
        <h4>${t("Режим работы")}</h4>
        <span>${t("Ежедневно 10:00–23:00")}</span>
      </div>
      <div class="contact-card">
        <h4>${t("Зона обслуживания")}</h4>
        <span>${t("Москва и Московская область")}</span>
      </div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// VIEW: PROFILE (аккаунти воқеӣ — маълумот аз сервер)
// ---------------------------------------------------------------------------
let authMode = "login"; // login | register

function viewProfile(){
  if (!isLoggedIn()){
    const isRegister = authMode === "register";
    return `
    <section class="section profile-page">
      <div class="section-head"><h2>${t("Личный кабинет")}</h2></div>
      <div class="login-card">
        <div class="auth-switch">
          <button class="auth-switch-btn ${!isRegister?'active':''}" data-action="auth-mode" data-mode="login">${t("Вход")}</button>
          <button class="auth-switch-btn ${isRegister?'active':''}" data-action="auth-mode" data-mode="register">${t("Регистрация")}</button>
        </div>
        <p class="auth-lead">${isRegister
          ? t("Создайте аккаунт — сохраняйте адреса, повторяйте заказы и копите бонусы.")
          : t("Войдите, чтобы видеть свои заказы с любого устройства.")}</p>
        ${isRegister ? `<div class="field"><label>${t("Имя")}</label><input id="authName" type="text" placeholder="${t('Ваше имя')}"></div>` : ""}
        <div class="field"><label>${t("Телефон")}</label><input id="authPhone" type="tel" placeholder="+7 (___) ___-__-__"></div>
        <div class="field"><label>${t("Пароль")}</label><input id="authPassword" type="password" placeholder="${isRegister?'Придумайте пароль':'Ваш пароль'}"></div>
        <div id="authError" class="field-error"></div>
        <button class="btn btn-primary btn-lg btn-block" data-action="${isRegister?'do-register':'do-login'}">
          ${isRegister ? t("Зарегистрироваться") : t("Войти")}
        </button>
      </div>
    </section>`;
  }

  const p = state.account;
  if (!p){
    return `<section class="section profile-page"><div class="empty-state"><span class="empty-emoji">⏳</span><h3>${t("Загружаем профиль…")}</h3></div></section>`;
  }
  return `
  <section class="section profile-page">
    <div class="section-head"><h2>${t("Личный кабинет")}</h2></div>
    <div class="profile-card">
      <div class="profile-avatar">👤</div>
      <div>
        <h3>${escapeHtml(p.name||'Гость')}</h3>
        <span>${formatPhone(p.phone)}</span>
      </div>
      <button class="btn btn-ghost" data-action="do-logout">${t("Выйти")}</button>
    </div>
    <div class="profile-stats">
      <div class="stat-card"><span>${p.bonuses||0}</span>${t("Бонусов")}</div>
      <div class="stat-card"><span>${state.myOrders.length}</span>${t("Заказов")}</div>
      <div class="stat-card"><span>${state.favorites.length}</span>${t("В избранном")}</div>
    </div>

    <div class="profile-section">
      <h4>${t("Сохранённые адреса")}</h4>
      ${(p.addresses||[]).length ? `
        <div class="saved-addresses">
          ${p.addresses.map(a=>`
            <div class="saved-address">
              <span>${escapeHtml([a.city,a.street,a.house,a.flat?'кв. '+a.flat:''].filter(Boolean).join(', '))}</span>
              <button class="ci-remove" data-action="delete-address" data-id="${a.id}" aria-label="Удалить">✕</button>
            </div>`).join("")}
        </div>` : `<p class="profile-hint">${t("Адреса появятся здесь после первого заказа с доставкой.")}</p>`}
    </div>

    <div class="profile-links">
      <button class="profile-link" data-action="go" data-view="orders">${t("📦 История заказов")}</button>
      <button class="profile-link" data-action="go" data-view="favorites">${t("❤️ Любимые блюда")}</button>
      <button class="profile-link" data-action="open-change-password">${t("🔒 Сменить пароль")}</button>
    </div>
  </section>`;
}

function formatPhone(digits){
  const d = String(digits||"");
  if (d.length === 11) return `+${d[0]} (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9)}`;
  return d;
}

async function afterRenderProfile(){
  if (!isLoggedIn()) return;
  try{
    const [account, orders] = await Promise.all([ meGet("/api/me"), meGet("/api/me/orders") ]);
    state.account = account;
    state.myOrders = orders;
    state.favorites = account.favorites || state.favorites;
    saveFavoritesLocal();
    if (currentView()==="profile") renderApp();
    renderBadges();
  } catch(e){
    if (e.status === 401){ clearUserToken(); state.account = null; renderApp(); }
  }
}

async function doRegister(){
  const name = document.getElementById("authName").value.trim();
  const phone = document.getElementById("authPhone").value.trim();
  const password = document.getElementById("authPassword").value;
  const err = document.getElementById("authError");
  err.textContent = "";
  try{
    const { user, token } = await apiPost("/api/auth/register", { name, phone, password });
    setUserToken(token);
    state.account = user;
    await syncFavoritesToServer();
    await afterRenderProfile();
    toast("Добро пожаловать! Вам начислено " + (user.bonuses||0) + " бонусов", "success");
    renderApp();
  } catch(e){
    err.textContent = (e.data && e.data.errors && e.data.errors.join(". ")) || t("Не удалось зарегистрироваться");
  }
}

async function doLogin(){
  const phone = document.getElementById("authPhone").value.trim();
  const password = document.getElementById("authPassword").value;
  const err = document.getElementById("authError");
  err.textContent = "";
  try{
    const { user, token } = await apiPost("/api/auth/login", { phone, password });
    setUserToken(token);
    state.account = user;
    if (user.favorites && user.favorites.length){
      state.favorites = user.favorites;
      saveFavoritesLocal();
    } else {
      await syncFavoritesToServer();
    }
    await afterRenderProfile();
    toast("С возвращением, " + user.name + "!", "success");
    renderApp();
  } catch(e){
    err.textContent = (e.data && e.data.errors && e.data.errors.join(". ")) || t("Не удалось войти");
  }
}

async function doLogout(){
  try{ await mePost("/api/auth/logout", {}); }catch(e){}
  clearUserToken();
  state.account = null;
  state.myOrders = [];
  toast("Вы вышли из аккаунта");
  renderApp();
}

async function deleteSavedAddress(id){
  try{
    state.account = await meDelete(`/api/me/addresses/${id}`);
    toast("Адрес удалён");
    renderApp();
  }catch(e){ toast("Не удалось удалить адрес"); }
}

function openChangePassword(){
  const modal = document.getElementById("productFormModalHost") || document.getElementById("addressModal");
  renderChangePasswordModal();
  document.getElementById("addressModalOverlay").classList.add("show");
  document.body.classList.add("no-scroll");
}

function renderChangePasswordModal(){
  document.getElementById("addressModal").innerHTML = `
    <button class="modal-close" data-action="close-address">✕</button>
    <h2>${t("Смена пароля")}</h2>
    <div class="field"><label>${t("Текущий пароль")}</label><input id="cpCurrent" type="password"></div>
    <div class="field"><label>${t("Новый пароль")}</label><input id="cpNew" type="password"></div>
    <div id="cpError" class="field-error"></div>
    <button class="btn btn-primary btn-lg btn-block" data-action="submit-change-password">${t("Сохранить")}</button>
  `;
}

async function submitChangePassword(){
  const currentPassword = document.getElementById("cpCurrent").value;
  const newPassword = document.getElementById("cpNew").value;
  const err = document.getElementById("cpError");
  err.textContent = "";
  try{
    await mePost("/api/me/password", { currentPassword, newPassword });
    closeAddressModal();
    toast(t("Пароль изменён"), "success");
  }catch(e){
    err.textContent = (e.data && e.data.errors && e.data.errors.join(". ")) || "Не удалось изменить пароль";
  }
}

// Дӯстдоштаҳоро ба сервер мефиристем (агар корбар воридшуда бошад)
async function syncFavoritesToServer(){
  if (!isLoggedIn()) return;
  try{ await mePut("/api/me/favorites", { favorites: state.favorites }); }catch(e){}
}

// ---------------------------------------------------------------------------
// VIEW: ORDERS (аз аккаунт агар воридшуда бошад, вагарна аз рӯйхати меҳмон)
// ---------------------------------------------------------------------------
function ordersToShow(){
  if (isLoggedIn()) return state.myOrders;
  return state.guestOrderIds.map(id => state.ordersCache[id]).filter(Boolean);
}

function viewOrders(){
  const orders = ordersToShow();
  const pendingGuest = !isLoggedIn() && state.guestOrderIds.length > orders.length;

  if (orders.length === 0 && !pendingGuest){
    return `<section class="section">
      <div class="empty-state"><span class="empty-emoji">📦</span><h3>${t("Заказов пока нет")}</h3>
      <p>${isLoggedIn() ? t("Оформите первый заказ — он появится здесь.") : t("Войдите в аккаунт, чтобы видеть заказы с любого устройства.")}</p>
      <button class="btn btn-primary" data-action="go-menu">${t("Перейти в меню")}</button>
      ${!isLoggedIn() ? `<button class="btn btn-ghost" data-action="go" data-view="profile">${t("Войти в аккаунт")}</button>` : ""}
      </div></section>`;
  }

  return `
  <section class="section">
    <div class="section-head"><h2>${t("История заказов")}</h2></div>
    ${!isLoggedIn() ? `<p class="orders-guest-hint">${t("Вы просматриваете заказы этого устройства. ")}<button class="link-more" data-action="go" data-view="profile">${t("Войдите в аккаунт")}</button>${t(", чтобы видеть их везде.")}</p>` : ""}
    <div class="orders-list">
      ${pendingGuest ? `<div class="order-card order-card-loading">${t("Загружаем заказы…")}</div>` : ""}
      ${orders.map(o=>`
        <div class="order-card">
          <div class="order-card-head">
            <strong>Заказ ${o.id}</strong>
            <span class="order-status order-status-${o.status==='Новый'?'new':'done'}">${o.status}</span>
          </div>
          <span class="order-date">${new Date(o.date).toLocaleString("ru-RU")}</span>
          <ul class="order-items-list">
            ${o.items.map(i=>`<li>${i.qty} × ${i.name}</li>`).join("")}
          </ul>
          <div class="order-card-foot">
            <span>${money(o.total)}</span>
            <button class="btn btn-ghost btn-sm" data-action="repeat-order" data-id="${o.id}">${t("Повторить заказ")}</button>
          </div>
        </div>`).join("")}
    </div>
  </section>`;
}

async function afterRenderOrders(){
  if (isLoggedIn()){
    try{
      state.myOrders = await meGet("/api/me/orders");
      if (currentView()==="orders") renderApp();
    }catch(e){
      if (e.status === 401){ clearUserToken(); state.account = null; renderApp(); }
    }
    return;
  }
  const results = await Promise.allSettled(state.guestOrderIds.map(id => apiGet(`/api/orders/${id}`)));
  let changed = false;
  results.forEach((r, idx) => {
    if (r.status === "fulfilled"){ state.ordersCache[state.guestOrderIds[idx]] = r.value; changed = true; }
  });
  if (changed && currentView()==="orders") renderApp();
}

function repeatOrder(orderId){
  const order = ordersToShow().find(o=>o.id===orderId);
  if (!order){ toast("Заказ ещё загружается, попробуйте ещё раз"); return; }
  order.items.forEach(i=>{
    if (i.productId && findProduct(i.productId)) addToCart(i.productId, i.qty, {});
  });
  navigate("cart");
}

// ---------------------------------------------------------------------------
// GLOBAL CLICK DELEGATION
// ---------------------------------------------------------------------------
document.addEventListener("click", (e)=>{
  const t = e.target.closest("[data-action]");

  // nav links (header, footer, side menu, bottom nav)
  const navLink = e.target.closest("[data-nav]");
  if (navLink && navLink.tagName === "A"){
    e.preventDefault();
    const view = navLink.dataset.nav;
    if (view === "category"){ navigate("category", { catId: navLink.dataset.cat }); }
    else { navigate(view); }
    return;
  }

  if (!t) return;
  const action = t.dataset.action;

  switch(action){
    case "go": navigate(t.dataset.view); break;
    case "go-menu": navigate("category", { catId:"popular" }); break;
    case "go-menu-close-cart": closeCartDrawer(); navigate("category", { catId:"popular" }); break;
    case "go-category": navigate("category", { catId: t.dataset.cat }); break;
    case "go-checkout": closeCartDrawer(); navigate("checkout"); break;

    case "open-product": openProductModal(Number(t.dataset.id)); break;
    case "close-product": closeProductModal(); break;
    case "quick-add": {
      const p = findProduct(Number(t.dataset.id));
      if (p) addToCart(p.id, 1, {});
      break;
    }
    case "add-to-cart-modal": {
      const p = findProduct(Number(t.dataset.id));
      if (p){ addToCart(p.id, modalQty, modalAddons); closeProductModal(); }
      break;
    }
    case "qty-plus": modalQty++; updateModalTotal(findProduct(Number(document.querySelector('[data-action="add-to-cart-modal"]').dataset.id))); break;
    case "qty-minus": modalQty = Math.max(1, modalQty-1); updateModalTotal(findProduct(Number(document.querySelector('[data-action="add-to-cart-modal"]').dataset.id))); break;

    case "toggle-fav": toggleFavorite(Number(t.dataset.favId)); break;

    case "open-promo": {
      const promo = promotions.find(p=>p.id===t.dataset.id);
      if (promo) openPromoModal(promo);
      break;
    }
    case "close-promo": closePromoModal(); break;
    case "use-promo": {
      const code = t.dataset.code;
      applyPromoCode(code);
      closePromoModal();
      navigate("category", { catId:"popular" });
      break;
    }

    case "cart-qty-plus": {
      const item = state.cart.find(i=>i.uid===t.dataset.uid);
      if (item) setCartQty(item.uid, item.qty+1);
      break;
    }
    case "cart-qty-minus": {
      const item = state.cart.find(i=>i.uid===t.dataset.uid);
      if (item) setCartQty(item.uid, item.qty-1);
      break;
    }
    case "remove-cart-item": removeCartItem(t.dataset.uid); break;
    case "apply-promo": {
      const val = document.getElementById("promoInput").value.trim();
      applyPromoCode(val);
      break;
    }

    case "checkout-next": goCheckoutNext(); break;
    case "checkout-back": goCheckoutBack(); break;
    case "checkout-confirm": pullStepInputs(checkoutStep); confirmOrder(); break;
    case "pick-fulfillment": checkoutForm.fulfillment = t.dataset.val; state.fulfillment = t.dataset.val; saveFulfillment(); renderApp(); break;
    case "pick-payment": checkoutForm.payment = t.dataset.val; renderApp(); break;

    case "auth-mode": authMode = t.dataset.mode; renderApp(); break;
    case "do-login": doLogin(); break;
    case "do-register": doRegister(); break;
    case "do-logout": doLogout(); break;
    case "delete-address": deleteSavedAddress(t.dataset.id); break;
    case "open-change-password": openChangePassword(); break;
    case "submit-change-password": submitChangePassword(); break;
    case "use-saved-address": {
      const addr = (state.account?.addresses||[]).find(a=>a.id===t.dataset.id);
      if (addr){
        Object.assign(checkoutForm, {
          city: addr.city, street: addr.street, house: addr.house, block: addr.block,
          flat: addr.flat, entrance: addr.entrance, floor: addr.floor,
          intercom: addr.intercom, comment: addr.comment,
        });
        renderApp();
      }
      break;
    }
    case "edit-address": openAddressModal(); break;
    case "repeat-order": repeatOrder(t.dataset.id); break;

    case "pick-city": state.address.city = t.dataset.city; saveAddress(); renderAddressModal(); break;
    case "save-quick-address": {
      const val = document.getElementById("quickStreet").value.trim();
      const parts = val.split(",");
      state.address.street = parts[0]?.trim() || "";
      state.address.house = parts[1]?.trim() || state.address.house;
      saveAddress();
      closeAddressModal();
      updateAddressPill();
      toast(t("Адрес сохранён"), "success");
      renderApp();
      break;
    }
    case "close-address": closeAddressModal(); break;

    case "toggle-addon": {
      const group = t.dataset.group, opt = t.dataset.opt;
      const arr = modalAddons[group];
      if (t.checked){ if(!arr.includes(opt)) arr.push(opt); }
      else { modalAddons[group] = arr.filter(o=>o!==opt); }
      const idAttr = document.querySelector('[data-action="add-to-cart-modal"]').dataset.id;
      updateModalTotal(findProduct(Number(idAttr)));
      break;
    }
  }
});

async function applyPromoCode(code){
  const errEl = document.getElementById("promoError");
  if (!code){ if(errEl) errEl.textContent = ""; return; }
  try{
    const result = await apiPost("/api/promo/validate", { code, subtotal: cartSubtotal() });
    if (!result.valid){
      if (errEl) errEl.textContent = result.message || t("Промокод недействителен");
      return;
    }
    state.promo = { code: result.code, type: result.type, value: result.value, minSum: result.minSum, discount: result.discount };
    savePromo();
    if (errEl) errEl.textContent = "";
    toast(t("Промокод применён"), "success");
  } catch(e){
    if (errEl) errEl.textContent = "Не удалось проверить промокод — проверьте соединение с сервером";
  }
  renderCartDrawerBody();
  if (currentView()==="cart" || currentView()==="checkout") renderApp();
}

// ---------------------------------------------------------------------------
// STATIC UI EVENTS
// ---------------------------------------------------------------------------
document.getElementById("burgerBtn").addEventListener("click", openSideMenu);
document.getElementById("closeSideMenu").addEventListener("click", closeSideMenu);
document.getElementById("sideMenuOverlay").addEventListener("click", closeSideMenu);

document.getElementById("cartBtnHeader").addEventListener("click", openCartDrawer);
document.getElementById("stickyCart").addEventListener("click", openCartDrawer);
document.getElementById("closeCart").addEventListener("click", closeCartDrawer);
document.getElementById("cartOverlay").addEventListener("click", closeCartDrawer);

document.getElementById("productModalOverlay").addEventListener("click", (e)=>{ if(e.target.id==="productModalOverlay") closeProductModal(); });
document.getElementById("promoModalOverlay").addEventListener("click", (e)=>{ if(e.target.id==="promoModalOverlay") closePromoModal(); });
document.getElementById("addressModalOverlay").addEventListener("click", (e)=>{ if(e.target.id==="addressModalOverlay") closeAddressModal(); });

document.getElementById("langBtn").addEventListener("click", (e)=>{ e.stopPropagation(); toggleLangMenu(); });
document.getElementById("langMenu").addEventListener("click", (e)=>{
  const opt = e.target.closest("[data-lang]");
  if (opt) switchLanguage(opt.dataset.lang);
});
document.addEventListener("click", (e)=>{
  if (!e.target.closest("#langMenu") && !e.target.closest("#langBtn")) closeLangMenu();
});

document.getElementById("addressPill").addEventListener("click", openAddressModal);
document.getElementById("favBtnHeader").addEventListener("click", ()=> navigate("favorites"));
document.getElementById("profileBtnHeader").addEventListener("click", ()=> navigate("profile"));

document.addEventListener("keydown", (e)=>{
  if (e.key === "Escape"){ closeProductModal(); closePromoModal(); closeAddressModal(); closeCartDrawer(); closeSideMenu(); }
});

window.addEventListener("resize", renderBadges);

// ---------------------------------------------------------------------------
// ИНТИХОБИ ЗАБОН
// ---------------------------------------------------------------------------
function buildLangMenu(){
  const menu = document.getElementById("langMenu");
  menu.innerHTML = LANGUAGES.map(l=>`
    <button class="lang-option ${l.code===getLang()?'active':''}" data-lang="${l.code}" role="menuitem">
      <span class="lang-option-short">${l.short}</span>
      <span>${l.label}</span>
      ${l.code===getLang() ? '<span class="lang-check">✓</span>' : ''}
    </button>`).join("");
  document.getElementById("langBtnCode").textContent =
    (LANGUAGES.find(l=>l.code===getLang())||LANGUAGES[0]).short;
}

function toggleLangMenu(){
  const menu = document.getElementById("langMenu");
  const btn = document.getElementById("langBtn");
  const open = menu.classList.toggle("show");
  if (open){
    const rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 8) + "px";
    // Ба тарафи чап мекушоем, то аз экран набарояд
    menu.style.right = Math.max(8, window.innerWidth - rect.right) + "px";
  }
}
function closeLangMenu(){ document.getElementById("langMenu").classList.remove("show"); }

// Тарҷумаи он қисмҳои HTML, ки дар index.html навишта шудаанд (на аз JS)
function translateStaticHTML(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  const addressPill = document.getElementById("addressPillText");
  if (addressPill) updateAddressPill();
}

function switchLanguage(code){
  setLang(code);
  buildLangMenu();
  closeLangMenu();
  translateStaticHTML();
  buildCategoryStrip();
  render();
  renderCartDrawerBody();
}

// ---------------------------------------------------------------------------
// INIT — сначала загружаем каталог с сервера, потом строим интерфейс
// ---------------------------------------------------------------------------
async function boot(){
  const screen = document.getElementById("loadingScreen");
  const text = document.getElementById("loadingText");
  try{
    await loadCatalog();
    // Агар токени корбар бошад, профилро аз сервер мегирем
    if (isLoggedIn()){
      try{
        const [account, orders] = await Promise.all([ meGet("/api/me"), meGet("/api/me/orders") ]);
        state.account = account;
        state.myOrders = orders;
        if (account.favorites && account.favorites.length){
          state.favorites = account.favorites;
          saveFavoritesLocal();
        }
      }catch(e){ clearUserToken(); }
    }
    buildCategoryStrip();
    buildLangMenu();
    translateStaticHTML();
    bindSearch();
    render();
    screen.classList.add("hidden");
    setTimeout(()=> screen.remove(), 350);
  } catch(e){
    screen.classList.add("error");
    text.innerHTML = `Не удалось подключиться к серверу.<br>Убедитесь, что бэкенд запущен (<code>node server.js</code>) и страница открыта с того же адреса (например http://localhost:4000).<br><br><button class="btn btn-primary loading-retry" onclick="location.reload()">${t("Повторить попытку")}</button>`;
  }
}
boot();

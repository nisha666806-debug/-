/* =========================================================================
   СУШИ PIZZA ТАЙМ — СЛОЙ ДАННЫХ
   Здесь и только здесь редактируется ассортимент, цены, акции и зоны
   доставки. Ничего из этого не "зашито" в HTML — все карточки, категории
   и фильтры строятся из этих структур в app.js.
   ========================================================================= */

// ---- Категории меню (порядок = порядок отображения) ----------------------
const CATEGORIES = [
  { id: "popular",  name: "Популярное",         emoji: "🔥" },
  { id: "new",      name: "Новинки",            emoji: "✨" },
  { id: "sets",     name: "Сеты",               emoji: "🍱" },
  { id: "rolls",    name: "Роллы",              emoji: "🍣" },
  { id: "baked",    name: "Запечённые роллы",   emoji: "🔥" },
  { id: "tempura",  name: "Темпура",            emoji: "🍤" },
  { id: "sushi",    name: "Суши",               emoji: "🍣" },
  { id: "maki",     name: "Маки",               emoji: "🥢" },
  { id: "pizza",    name: "Пицца",              emoji: "🍕" },
  { id: "wok",      name: "WOK",                emoji: "🥡" },
  { id: "soups",    name: "Супы",               emoji: "🍜" },
  { id: "salads",   name: "Салаты",             emoji: "🥗" },
  { id: "snacks",   name: "Закуски",            emoji: "🍟" },
  { id: "desserts", name: "Десерты",            emoji: "🍰" },
  { id: "drinks",   name: "Напитки",            emoji: "🥤" },
  { id: "sauces",   name: "Соусы",              emoji: "🥣" },
];

// Палитра-заглушка для фото блюд (мягкий градиент + эмодзи вместо фото).
// Замените на реальные фотографии — просто подставьте свой image: url в товар.
const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg,#ffe3d1,#ffb199)",
  "linear-gradient(135deg,#d9f0d0,#a8d98a)",
  "linear-gradient(135deg,#ffd9df,#ff9eb0)",
  "linear-gradient(135deg,#fff0c2,#ffd166)",
  "linear-gradient(135deg,#d9e9ff,#a9c9ff)",
  "linear-gradient(135deg,#f0e0ff,#d1a9ff)",
];
function phGrad(i){ return PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length]; }

// ---- Товары ----------------------------------------------------------------
// id, name, category (id из CATEGORIES), description, ingredients, weight,
// pieces (шт или null), price, oldPrice (или null), image (эмодзи-иконка),
// popular, isNew, tags (для поиска)
const products = [
  { id:1,  name:"Филадельфия",              category:"rolls",   emoji:"🍣", description:"Классика жанра: нежный лосось и сливочный сыр в мягком рисе.", ingredients:"Лосось, сливочный сыр, огурец, рис, нори", weight:"250 г", pieces:8, price:799, oldPrice:949, popular:true, isNew:false, tags:"лосось сыр филадельфия ролл" },
  { id:2,  name:"Калифорния",               category:"rolls",   emoji:"🍣", description:"Сочный крабовый микс с авокадо и икрой тобико сверху.", ingredients:"Крабовое мясо, авокадо, огурец, икра тобико, рис, нори", weight:"240 г", pieces:8, price:649, oldPrice:null, popular:true, isNew:false, tags:"калифорния краб авокадо ролл" },
  { id:3,  name:"Дракон",                   category:"baked",   emoji:"🔥", description:"Запечённый ролл с угрём и соусом унаги, хрустящая корочка сверху.", ingredients:"Угорь, сыр, огурец, рис, соус унаги, кунжут", weight:"260 г", pieces:8, price:899, oldPrice:null, popular:true, isNew:false, tags:"дракон угорь запечённый ролл" },
  { id:4,  name:"Ролл с лососем темпура",    category:"tempura", emoji:"🍤", description:"Хрустящая темпура-корочка снаружи, нежный лосось внутри.", ingredients:"Лосось, сыр, темпура, рис, нори, соус спайси", weight:"270 г", pieces:8, price:749, oldPrice:850, popular:false, isNew:true, tags:"темпура лосось хрустящий ролл" },
  { id:5,  name:"Спайси лосось",            category:"rolls",   emoji:"🍣", description:"Острый ролл с лососем и соусом спайси майо — для любителей огонька.", ingredients:"Лосось, острый соус, огурец, рис, нори, чили", weight:"235 г", pieces:8, price:699, oldPrice:null, popular:false, isNew:true, tags:"спайси острый лосось ролл" },
  { id:6,  name:"Ролл Унаги",               category:"baked",   emoji:"🔥", description:"Угорь гриль в сладком соусе унаги, запечённый под сыром.", ingredients:"Угорь, сыр, соус унаги, рис, нори, кунжут", weight:"255 г", pieces:8, price:829, oldPrice:null, popular:false, isNew:false, tags:"унаги угорь запечённый ролл" },
  { id:7,  name:"Овощной ролл",             category:"rolls",   emoji:"🥒", description:"Лёгкий ролл с хрустящими овощами — свежо и без лишних калорий.", ingredients:"Огурец, авокадо, перец, рис, нори", weight:"210 г", pieces:8, price:449, oldPrice:null, popular:false, isNew:false, tags:"овощной вегетарианский ролл" },
  { id:8,  name:"Суши с лососем",           category:"sushi",   emoji:"🍣", description:"Классические нигири с ломтиком свежего лосося.", ingredients:"Лосось, рис, васаби", weight:"120 г", pieces:2, price:229, oldPrice:null, popular:true, isNew:false, tags:"суши нигири лосось" },
  { id:9,  name:"Суши с угрём",             category:"sushi",   emoji:"🍣", description:"Нигири с копчёным угрём и соусом унаги.", ingredients:"Угорь, рис, соус унаги, васаби", weight:"130 г", pieces:2, price:259, oldPrice:null, popular:false, isNew:false, tags:"суши нигири угорь" },
  { id:10, name:"Суши с креветкой",         category:"sushi",   emoji:"🍤", description:"Нигири с отварной тигровой креветкой.", ingredients:"Креветка, рис, васаби", weight:"120 г", pieces:2, price:239, oldPrice:null, popular:false, isNew:false, tags:"суши нигири креветка" },
  { id:11, name:"Маки с огурцом",           category:"maki",    emoji:"🥒", description:"Тонкий классический маки с хрустящим огурцом.", ingredients:"Огурец, рис, нори", weight:"110 г", pieces:6, price:189, oldPrice:null, popular:false, isNew:false, tags:"маки огурец" },
  { id:12, name:"Маки с лососем",           category:"maki",    emoji:"🍣", description:"Тонкий маки с полоской свежего лосося внутри.", ingredients:"Лосось, рис, нори", weight:"120 г", pieces:6, price:279, oldPrice:null, popular:false, isNew:false, tags:"маки лосось" },
  { id:13, name:"Маки с тунцом",            category:"maki",    emoji:"🐟", description:"Тонкий маки с деликатным тунцом.", ingredients:"Тунец, рис, нори", weight:"120 г", pieces:6, price:299, oldPrice:null, popular:false, isNew:true, tags:"маки тунец" },
  { id:14, name:"Сет Токио",                category:"sets",    emoji:"🍱", description:"Большой сет для компании: хиты меню в одной коробке.", ingredients:"Филадельфия, Калифорния, Дракон, суши-микс", weight:"1100 г", pieces:32, price:2190, oldPrice:2590, popular:true, isNew:false, tags:"сет большой компания токио" },
  { id:15, name:"Сет Осака",                category:"sets",    emoji:"🍱", description:"Сбалансированный сет из запечённых и классических роллов.", ingredients:"Дракон, Унаги, Филадельфия", weight:"820 г", pieces:24, price:1690, oldPrice:1990, popular:true, isNew:false, tags:"сет осака запечённый" },
  { id:16, name:"Сет для двоих",            category:"sets",    emoji:"🍱", description:"Компактный сет — идеально на двоих.", ingredients:"Калифорния, Филадельфия, суши-микс", weight:"560 г", pieces:16, price:1190, oldPrice:null, popular:false, isNew:false, tags:"сет двоих небольшой" },
  { id:17, name:"Сет Вегетарианский",       category:"sets",    emoji:"🥦", description:"Овощной сет без рыбы — свежо и легко.", ingredients:"Огурец, авокадо, перец, рис, нори", weight:"640 г", pieces:20, price:990, oldPrice:null, popular:false, isNew:true, tags:"сет вегетарианский овощи" },
  { id:18, name:"Пицца Пепперони",          category:"pizza",   emoji:"🍕", description:"Хрустящее тесто, острая пепперони и много сыра моцарелла.", ingredients:"Пепперони, моцарелла, томатный соус, тесто", weight:"32 см", pieces:null, price:649, oldPrice:749, popular:true, isNew:false, tags:"пицца пепперони острая" },
  { id:19, name:"Пицца Маргарита",          category:"pizza",   emoji:"🍕", description:"Классика с томатами, моцареллой и базиликом.", ingredients:"Томаты, моцарелла, базилик, томатный соус, тесто", weight:"32 см", pieces:null, price:549, oldPrice:null, popular:true, isNew:false, tags:"пицца маргарита классика" },
  { id:20, name:"Пицца 4 сыра",             category:"pizza",   emoji:"🍕", description:"Моцарелла, горгонзола, пармезан и чеддер на нежном соусе.", ingredients:"Моцарелла, горгонзола, пармезан, чеддер, сливочный соус", weight:"32 см", pieces:null, price:729, oldPrice:null, popular:false, isNew:false, tags:"пицца сыр 4сыра" },
  { id:21, name:"Пицца Мясная",             category:"pizza",   emoji:"🍕", description:"Ветчина, бекон, пепперони, охотничьи колбаски.", ingredients:"Ветчина, бекон, пепперони, колбаски, моцарелла", weight:"35 см", pieces:null, price:799, oldPrice:899, popular:false, isNew:true, tags:"пицца мясная сытная" },
  { id:22, name:"Пицца Гавайская",          category:"pizza",   emoji:"🍕", description:"Ветчина и ананас — спорная классика, которую любят многие.", ingredients:"Ветчина, ананас, моцарелла, томатный соус", weight:"32 см", pieces:null, price:599, oldPrice:null, popular:false, isNew:false, tags:"пицца гавайская ананас" },
  { id:23, name:"Пицца Морская",            category:"pizza",   emoji:"🍕", description:"Креветки, мидии, кальмар и моцарелла.", ingredients:"Креветки, мидии, кальмар, моцарелла, томатный соус", weight:"35 см", pieces:null, price:849, oldPrice:null, popular:false, isNew:false, tags:"пицца морепродукты" },
  { id:24, name:"WOK с курицей",            category:"wok",     emoji:"🥡", description:"Обжаренная лапша с курицей и овощами в соусе терияки.", ingredients:"Лапша, курица, овощи, соус терияки", weight:"340 г", pieces:null, price:459, oldPrice:null, popular:true, isNew:false, tags:"wok лапша курица терияки" },
  { id:25, name:"WOK с креветками",         category:"wok",     emoji:"🍤", description:"Лапша с тигровыми креветками и хрустящими овощами.", ingredients:"Лапша, креветки, овощи, соус устричный", weight:"330 г", pieces:null, price:549, oldPrice:null, popular:false, isNew:false, tags:"wok лапша креветки" },
  { id:26, name:"WOK с говядиной",          category:"wok",     emoji:"🥡", description:"Сочная говядина, острый соус, свежие овощи.", ingredients:"Лапша, говядина, овощи, острый соус", weight:"340 г", pieces:null, price:579, oldPrice:649, popular:false, isNew:true, tags:"wok говядина острый" },
  { id:27, name:"WOK овощной",              category:"wok",     emoji:"🥦", description:"Лёгкий WOK с сезонными овощами без мяса.", ingredients:"Лапша, брокколи, морковь, перец, соус соевый", weight:"300 г", pieces:null, price:389, oldPrice:null, popular:false, isNew:false, tags:"wok овощной вегетарианский" },
  { id:28, name:"Мисо-суп",                 category:"soups",   emoji:"🍜", description:"Тёплый суп на основе мисо-пасты с тофу и водорослями.", ingredients:"Паста мисо, тофу, водоросли вакаме, зелёный лук", weight:"300 мл", pieces:null, price:249, oldPrice:null, popular:true, isNew:false, tags:"мисо суп тофу" },
  { id:29, name:"Том-ям с креветками",      category:"soups",   emoji:"🍜", description:"Острый тайский суп с креветками и кокосовым молоком.", ingredients:"Креветки, кокосовое молоко, грибы, лемонграсс, чили", weight:"350 мл", pieces:null, price:389, oldPrice:null, popular:false, isNew:true, tags:"том ям острый суп" },
  { id:30, name:"Суп с лапшой удон",        category:"soups",   emoji:"🍜", description:"Наваристый бульон с лапшой удон и курицей.", ingredients:"Лапша удон, курица, бульон, зелёный лук", weight:"350 мл", pieces:null, price:329, oldPrice:null, popular:false, isNew:false, tags:"удон суп лапша" },
  { id:31, name:"Салат Чука",               category:"salads",  emoji:"🥗", description:"Маринованные водоросли чука с кунжутом.", ingredients:"Водоросли чука, кунжут, соус", weight:"150 г", pieces:null, price:279, oldPrice:null, popular:true, isNew:false, tags:"чука салат водоросли" },
  { id:32, name:"Салат с лососем и авокадо",category:"salads",  emoji:"🥗", description:"Свежий салат с ломтиками лосося, авокадо и микс-салатом.", ingredients:"Лосось, авокадо, микс-салат, соус кунжутный", weight:"220 г", pieces:null, price:449, oldPrice:null, popular:false, isNew:false, tags:"салат лосось авокадо" },
  { id:33, name:"Цезарь с креветками",      category:"salads",  emoji:"🥗", description:"Хрустящий Цезарь с тигровыми креветками и пармезаном.", ingredients:"Креветки, салат романо, пармезан, соус цезарь, гренки", weight:"230 г", pieces:null, price:429, oldPrice:null, popular:false, isNew:false, tags:"цезарь салат креветки" },
  { id:34, name:"Картофель фри",            category:"snacks",  emoji:"🍟", description:"Хрустящий картофель фри с соусом на выбор.", ingredients:"Картофель, соль, специи", weight:"150 г", pieces:null, price:199, oldPrice:null, popular:true, isNew:false, tags:"картофель фри закуска" },
  { id:35, name:"Крылышки BBQ",             category:"snacks",  emoji:"🍗", description:"Куриные крылышки в соусе барбекю.", ingredients:"Куриные крылья, соус барбекю, специи", weight:"250 г", pieces:6, price:349, oldPrice:null, popular:false, isNew:false, tags:"крылышки bbq закуска" },
  { id:36, name:"Онигири с курицей",        category:"snacks",  emoji:"🍙", description:"Рисовый треугольник с начинкой из курицы терияки.", ingredients:"Рис, курица, нори, соус терияки", weight:"110 г", pieces:1, price:169, oldPrice:null, popular:false, isNew:true, tags:"онигири закуска рис" },
  { id:37, name:"Гёдза с курицей",          category:"snacks",  emoji:"🥟", description:"Жареные японские пельмени с сочной начинкой.", ingredients:"Курица, капуста, тесто, соус соевый", weight:"180 г", pieces:6, price:299, oldPrice:null, popular:false, isNew:false, tags:"гёдза пельмени закуска" },
  { id:38, name:"Моти манго",               category:"desserts",emoji:"🍡", description:"Нежное рисовое пирожное моти с начинкой манго.", ingredients:"Рисовое тесто моти, пюре манго", weight:"90 г", pieces:3, price:279, oldPrice:null, popular:false, isNew:true, tags:"моти десерт манго" },
  { id:39, name:"Чизкейк Нью-Йорк",         category:"desserts",emoji:"🍰", description:"Классический нежный чизкейк на песочной основе.", ingredients:"Сливочный сыр, песочная основа, сливки", weight:"120 г", pieces:null, price:299, oldPrice:null, popular:true, isNew:false, tags:"чизкейк десерт" },
  { id:40, name:"Шоколадный фондан",        category:"desserts",emoji:"🍫", description:"Тёплый шоколадный кекс с жидкой начинкой внутри.", ingredients:"Шоколад, масло, мука, яйцо", weight:"110 г", pieces:null, price:319, oldPrice:null, popular:false, isNew:false, tags:"фондан шоколад десерт" },
  { id:41, name:"Кока-Кола 0.5 л",          category:"drinks",  emoji:"🥤", description:"Классическая газировка, охлаждённая.", ingredients:"Газированный напиток", weight:"0.5 л", pieces:null, price:129, oldPrice:null, popular:true, isNew:false, tags:"кола напиток газировка" },
  { id:42, name:"Морс ягодный",             category:"drinks",  emoji:"🧃", description:"Домашний морс из сезонных ягод.", ingredients:"Ягоды, вода, сахар", weight:"0.5 л", pieces:null, price:159, oldPrice:null, popular:false, isNew:false, tags:"морс напиток ягоды" },
  { id:43, name:"Чай зелёный с жасмином",   category:"drinks",  emoji:"🍵", description:"Ароматный японский зелёный чай с жасмином.", ingredients:"Зелёный чай, жасмин", weight:"0.4 л", pieces:null, price:139, oldPrice:null, popular:false, isNew:false, tags:"чай зелёный напиток" },
  { id:44, name:"Вода negazированная",      category:"drinks",  emoji:"💧", description:"Питьевая вода без газа.", ingredients:"Вода", weight:"0.5 л", pieces:null, price:89, oldPrice:null, popular:false, isNew:false, tags:"вода напиток" },
  { id:45, name:"Соус Унаги",               category:"sauces",  emoji:"🥣", description:"Сладковатый соус на основе соевого — для запечённых роллов.", ingredients:"Соевый соус, сахар, мирин", weight:"30 г", pieces:null, price:59, oldPrice:null, popular:false, isNew:false, tags:"соус унаги" },
  { id:46, name:"Соус Спайси",              category:"sauces",  emoji:"🥣", description:"Острый соус майо с чили.", ingredients:"Майонез, чили, специи", weight:"30 г", pieces:null, price:59, oldPrice:null, popular:false, isNew:false, tags:"соус спайси острый" },
  { id:47, name:"Соевый соус",              category:"sauces",  emoji:"🥣", description:"Классический соевый соус.", ingredients:"Соя, вода, соль", weight:"30 г", pieces:null, price:39, oldPrice:null, popular:false, isNew:false, tags:"соус соевый" },
  { id:48, name:"Имбирь и васаби",          category:"sauces",  emoji:"🥣", description:"Маринованный имбирь и острый васаби — классическое дополнение.", ingredients:"Имбирь маринованный, васаби", weight:"30 г", pieces:null, price:49, oldPrice:null, popular:false, isNew:false, tags:"имбирь васаби" },
];

// Присваиваем каждому товару градиент-заглушку по индексу
products.forEach((p,i)=>{ p.photoBg = phGrad(i); });

// Опции, которые можно добавить в карточке товара (доп. ингредиенты/соусы/напитки)
const ADDON_GROUPS = [
  { id:"sauce", title:"Добавить соус", multi:true, options:[
      { id:"s1", name:"Соус Унаги", price:59 },
      { id:"s2", name:"Соус Спайси", price:59 },
      { id:"s3", name:"Соевый соус", price:39 },
      { id:"s4", name:"Имбирь и васаби", price:49 },
  ]},
  { id:"extra", title:"Дополнительные ингредиенты", multi:true, options:[
      { id:"e1", name:"Дополнительный лосось", price:120 },
      { id:"e2", name:"Сыр чеддер", price:80 },
      { id:"e3", name:"Икра тобико", price:99 },
  ]},
  { id:"drink", title:"Добавить напиток", multi:true, options:[
      { id:"d1", name:"Кока-Кола 0.5 л", price:129 },
      { id:"d2", name:"Чай зелёный с жасмином", price:139 },
  ]},
];

// ---- Акции -------------------------------------------------------------
const promotions = [
  { id:"p1", title:"Скидка 10% на первый заказ", tag:"Новым клиентам", desc:"Оформите первый заказ от 800 ₽ и получите скидку 10% по промокоду.", code:"WELCOME10", color:"var(--tomato)" },
  { id:"p2", title:"Ролл Филадельфия в подарок", tag:"При заказе от 2000 ₽", desc:"Соберите заказ от 2000 ₽ — и ролл Филадельфия приедет бесплатно.", code:null, color:"var(--wasabi)" },
  { id:"p3", title:"Сеты по выгодной цене", tag:"Экономия до 400 ₽", desc:"На все сеты страницы скидка уже включена в цену — смотрите жёлтый ценник.", code:null, color:"var(--salmon)" },
  { id:"p4", title:"−300 ₽ на самовывоз", tag:"Заберите сами", desc:"При самовывозе из ресторана скидка 300 ₽ от суммы заказа при заказе от 1500 ₽.", code:"PIZZA500", color:"var(--nori)" },
  { id:"p5", title:"Комбо дня: пицца + ролл", tag:"До 22:00", desc:"Пицца Маргарита + ролл Калифорния — вместе выгоднее на 15%.", code:"SUSHI10", color:"var(--tomato)" },
];

// Проверка промокодов: percent (%) или amount (фикс. скидка), minSum — минимальная сумма
const PROMO_CODES = {
  "WELCOME10": { type:"percent", value:10, minSum:800, desc:"−10% на первый заказ" },
  "PIZZA500":  { type:"amount",  value:300, minSum:1500, desc:"−300 ₽ на заказ от 1500 ₽" },
  "SUSHI10":   { type:"percent", value:10, minSum:600, desc:"−10% на заказ от 600 ₽" },
};

// ---- Доставка -------------------------------------------------------------
// Легко заменить реальными зонами/ценами в одном месте.
const DELIVERY_ZONES = [
  { name:"Зона 1 — в пределах МКАД",     minOrder:800,  price:0,   freeFrom:1500, time:"35–55 мин" },
  { name:"Зона 2 — Москва за МКАД (до 5 км)", minOrder:1000, price:199, freeFrom:2500, time:"45–70 мин" },
  { name:"Зона 3 — Московская область",  minOrder:1200, price:299, freeFrom:3000, time:"60–90 мин" },
];

const CITIES = ["Москва", "Химки", "Королёв", "Мытищи", "Одинцово", "Балашиха", "Реутов", "Люберцы"];

module.exports = { CATEGORIES, products, ADDON_GROUPS, promotions, PROMO_CODES, DELIVERY_ZONES, CITIES };

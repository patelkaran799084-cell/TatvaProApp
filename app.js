/*************************************************
 * Tatva OS Pro - app.js (NEW CLEAN FINAL)
 * ✅ Works with your OLD index.html layout
 * ✅ 1 Email = 1 Business enforced
 * ✅ Drive hooks + Restore handler included
 * ✅ Business / Team / Category
 * ✅ Orders + Income + Expense/Tasks
 *************************************************/

/* -------------------------------
   GLOBAL STATE
--------------------------------*/
let ACTIVE_EMAIL = "";
let ACTIVE_BIZ_ID = "";
let ACTIVE_ORDER_ID = "";

const ADMIN_EMAIL = "patelkaran799084@gmail.com";
const ADMIN_PIN = "1234"; // change if you want

/* -------------------------------
   STORAGE KEYS
--------------------------------*/
const META_KEY = "tatva_biz_meta_v4"; // business meta
function DB_KEY(bizId) {
  return `tatva_db_${bizId}`;
}

/* -------------------------------
   BASIC HELPERS
--------------------------------*/
function $(id) {
  return document.getElementById(id);
}
function nowId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
}
function safeText(t) {
  return (t || "").toString().trim();
}
function money(n) {
  const x = Number(n || 0);
  return "₹" + x.toFixed(0);
}
function toDateStr(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) {
    return "";
  }
}

/* -------------------------------
   BUSINESS META
--------------------------------*/
function loadBizMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { businesses: [], activeBizId: "" };
    const obj = JSON.parse(raw);
    obj.businesses ||= [];
    obj.activeBizId ||= "";
    return obj;
  } catch (e) {
    return { businesses: [], activeBizId: "" };
  }
}
function saveBizMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

/* -------------------------------
   DB STRUCTURE
--------------------------------*/
function newEmptyDB() {
  return {
    orders: [],
    team: ["Self"],
    categories: ["Model", "Print", "Color", "Material", "Other"],
  };
}

function loadDB(bizId) {
  try {
    const raw = localStorage.getItem(DB_KEY(bizId));
    if (!raw) return newEmptyDB();
    const db = JSON.parse(raw);
    db.orders ||= [];
    db.team ||= ["Self"];
    db.categories ||= ["Model", "Print", "Color", "Material", "Other"];
    return db;
  } catch (e) {
    return newEmptyDB();
  }
}

function saveDB() {
  try {
    if (!ACTIVE_BIZ_ID) return;
    localStorage.setItem(DB_KEY(ACTIVE_BIZ_ID), JSON.stringify(db));
  } catch (e) {}
}

let db = newEmptyDB();

/* -------------------------------
   DRIVE AUTH HOOKS
--------------------------------*/
// gdrive.js will set window.__driveUserEmail
function getLoggedEmail() {
  // prefer drive email
  if (window.__driveUserEmail) return window.__driveUserEmail;
  // fallback
  return ACTIVE_EMAIL || "";
}

/* -------------------------------
   1 EMAIL = 1 BUSINESS RULE
--------------------------------*/
function ensureOneBusinessForEmail(email) {
  const meta = loadBizMeta();
  meta.businesses ||= [];

  // keep only businesses for this email (visible list)
  const mine = meta.businesses.filter((b) => b.ownerEmail === email);

  // if not exists => auto create
  if (mine.length === 0) {
    const id = nowId("biz");
    meta.businesses.push({
      id,
      name: "Main Business",
      ownerEmail: email,
    });
    meta.activeBizId = id;
    saveBizMeta(meta);
    return id;
  }

  // if exists => set active (first or previously active)
  if (meta.activeBizId && mine.find((b) => b.id === meta.activeBizId)) {
    saveBizMeta(meta);
    return meta.activeBizId;
  }
  meta.activeBizId = mine[0].id;
  saveBizMeta(meta);
  return meta.activeBizId;
}

/* -------------------------------
   UI SHOW/HIDE (LOGIN LOCK)
--------------------------------*/
function showLoginLock(show) {
  const lock = $("loginLock");
  const main = $("mainApp");
  const fab = $("fabBtn");

  if (lock) lock.style.display = show ? "flex" : "none";
  if (main) main.style.display = show ? "none" : "block";
  if (fab) fab.style.display = show ? "none" : "flex";
}

/* -------------------------------
   BUSINESS SWITCH
--------------------------------*/
function renderBizDropdown() {
  const sel = $("bizSelect");
  if (!sel) return;

  const meta = loadBizMeta();
  const list = meta.businesses.filter((b) => b.ownerEmail === ACTIVE_EMAIL);

  sel.innerHTML = "";

  list.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    sel.appendChild(opt);
  });

  // active
  if (ACTIVE_BIZ_ID) sel.value = ACTIVE_BIZ_ID;

  // admin button only admin email
  const btnBiz = $("btnBiz");
  if (btnBiz) btnBiz.style.display = ACTIVE_EMAIL === ADMIN_EMAIL ? "inline-flex" : "none";
}

window.switchBusinessFromUI = function () {
  const sel = $("bizSelect");
  if (!sel) return;
  const newId = sel.value;

  const meta = loadBizMeta();
  meta.activeBizId = newId;
  saveBizMeta(meta);

  ACTIVE_BIZ_ID = newId;
  db = loadDB(ACTIVE_BIZ_ID);

  renderHome();
};

/* -------------------------------
   STATS + HOME
--------------------------------*/
function calcOrderSummary(order) {
  const price = Number(order.price || 0);
  const income = (order.income || []).reduce((a, x) => a + Number(x.amount || 0), 0);
  const expense = (order.tasks || []).reduce((a, x) => a + Number(x.cost || 0), 0);
  const pending = Math.max(0, price - income);
  const profit = income - expense;
  return { price, income, expense, pending, profit };
}

function computeTotals() {
  let orders = db.orders.length;
  let totalIncome = 0;
  let totalExpense = 0;
  let revenue = 0;

  db.orders.forEach((o) => {
    const s = calcOrderSummary(o);
    totalIncome += s.income;
    totalExpense += s.expense;
    revenue += s.price;
  });

  const profit = totalIncome - totalExpense;
  const cashHand = totalIncome - totalExpense;

  return { orders, profit, revenue, cashHand };
}

function renderStats() {
  const t = computeTotals();

  if ($("st-orders")) $("st-orders").innerText = t.orders;
  if ($("st-profit")) $("st-profit").innerText = money(t.profit);
  if ($("st-rev")) $("st-rev").innerText = money(t.revenue);
  if ($("st-hand")) $("st-hand").innerText = money(t.cashHand);
}

function renderRecentOrders() {
  const box = $("orders-list");
  if (!box) return;

  const recent = [...db.orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10);

  if (recent.length === 0) {
    box.innerHTML = `<div style="padding:14px;color:#888;">No Orders Yet</div>`;
    return;
  }

  box.innerHTML = "";
  recent.forEach((o) => {
    const s = calcOrderSummary(o);

    const div = document.createElement("div");
    div.className = "order-card";
    div.style.cursor = "pointer";
    div.onclick = () => openOrderDetail(o.id);

    div.innerHTML = `
      <div class="order-left">
        <b>${o.client || "-"}</b>
        <div style="font-size:12px;color:#666;">${o.work || "-"}</div>
        <div style="font-size:12px;color:#999;">${o.date || ""}</div>
      </div>
      <div class="order-right">
        <div style="font-size:12px;color:#666;">Exp: ${money(s.expense)}</div>
        <div style="font-weight:900;color:#ff7a00;">${money(s.price)}</div>
        <div class="pill">${money(s.pending)} Left</div>
      </div>
    `;
    box.appendChild(div);
  });
}

function renderHome() {
  renderBizDropdown();
  renderStats();
  renderRecentOrders();
  saveDB(); // safe save
}

/* -------------------------------
   MODALS
--------------------------------*/
window.openNewOrder = function () {
  if (!$("modal-new")) return;
  $("new-client").value = "";
  $("new-work").value = "";
  $("new-price").value = "";
  $("new-date").value = toDateStr(new Date());
  $("modal-new").style.display = "flex";
};

window.closeModal = function (id) {
  const m = $(id);
  if (m) m.style.display = "none";
};

/* -------------------------------
   CREATE ORDER
--------------------------------*/
window.createOrder = function () {
  const client = safeText($("new-client")?.value);
  const work = safeText($("new-work")?.value);
  const price = Number($("new-price")?.value || 0);
  const date = $("new-date")?.value || toDateStr(new Date());

  if (!client) return alert("Client name required");

  const o = {
    id: nowId("ord"),
    client,
    work,
    price,
    date,
    createdAt: Date.now(),
    income: [],
    tasks: [],
  };

  db.orders.push(o);
  saveDB();
  renderHome();
  window.closeModal("modal-new");

  // auto drive backup if available
  if (window.scheduleAutoBackup) window.scheduleAutoBackup();
};

/* -------------------------------
   ORDER DETAIL
--------------------------------*/
function fillOrderSelect() {
  const sel = $("orderSelect");
  if (!sel) return;

  sel.innerHTML = "";
  db.orders.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = `${o.client} (${o.date})`;
    sel.appendChild(opt);
  });

  if (ACTIVE_ORDER_ID) sel.value = ACTIVE_ORDER_ID;
}

window.onOrderSelectChange = function () {
  const sel = $("orderSelect");
  if (!sel) return;
  openOrderDetail(sel.value);
};

function openOrderDetail(orderId) {
  const o = db.orders.find((x) => x.id === orderId);
  if (!o) return;

  ACTIVE_ORDER_ID = orderId;

  fillOrderSelect();
  $("d-client").innerText = o.client || "-";
  $("d-work").innerText = o.work || "-";
  $("d-date").innerText = o.date || "-";

  const s = calcOrderSummary(o);
  $("d-recd").innerText = money(s.income);
  $("d-paid").innerText = money(s.expense);
  $("d-hand").innerText = money(s.income - s.expense);

  $("d-pending").innerText = s.pending > 0 ? `${money(s.pending)} Pending` : "✅ Completed";

  renderIncomeList(o);
  renderTaskList(o);
  renderHistory(o);

  $("modal-detail").style.display = "flex";
  switchTab("income");
}

window.switchTab = function (tab) {
  const a = $("tab-income");
  const b = $("tab-expense");
  const c = $("tab-summary");
  if (!a || !b || !c) return;

  a.style.display = tab === "income" ? "block" : "none";
  b.style.display = tab === "expense" ? "block" : "none";
  c.style.display = tab === "summary" ? "block" : "none";
};

function renderIncomeList(order) {
  const box = $("list-income");
  if (!box) return;

  order.income ||= [];
  box.innerHTML = "";

  if (order.income.length === 0) {
    box.innerHTML = `<div style="padding:8px;color:#888;">No income entries</div>`;
    return;
  }

  order.income
    .slice()
    .sort((a, b) => (b.time || 0) - (a.time || 0))
    .forEach((x) => {
      const div = document.createElement("div");
      div.className = "mini-row";
      div.innerHTML = `
        <div>${x.date || ""}</div>
        <b>${money(x.amount)}</b>
        <button class="btn btn-sm" style="margin-left:auto;" data-id="${x.id}">🗑</button>
      `;

      div.querySelector("button").onclick = () => {
        order.income = order.income.filter((z) => z.id !== x.id);
        saveDB();
        openOrderDetail(order.id);
        if (window.scheduleAutoBackup) window.scheduleAutoBackup();
      };

      box.appendChild(div);
    });
}

function renderTaskList(order) {
  const box = $("list-tasks");
  if (!box) return;

  order.tasks ||= [];
  box.innerHTML = "";

  if (order.tasks.length === 0) {
    box.innerHTML = `<div style="padding:8px;color:#888;">No expenses/tasks</div>`;
    return;
  }

  order.tasks
    .slice()
    .sort((a, b) => (b.time || 0) - (a.time || 0))
    .forEach((x) => {
      const div = document.createElement("div");
      div.className = "mini-row";
      div.innerHTML = `
        <div>${x.type || ""} • ${x.artist || ""}</div>
        <b>${money(x.cost)}</b>
        <button class="btn btn-sm" style="margin-left:auto;" data-id="${x.id}">🗑</button>
      `;

      div.querySelector("button").onclick = () => {
        order.tasks = order.tasks.filter((z) => z.id !== x.id);
        saveDB();
        openOrderDetail(order.id);
        if (window.scheduleAutoBackup) window.scheduleAutoBackup();
      };

      box.appendChild(div);
    });
}

function renderHistory(order) {
  const hi = $("hist-income");
  const he = $("hist-expense");
  if (!hi || !he) return;

  order.income ||= [];
  order.tasks ||= [];

  hi.innerHTML = order.income
    .slice()
    .sort((a, b) => (b.time || 0) - (a.time || 0))
    .map((x) => `<div style="padding:6px 0;border-bottom:1px solid #eee;">${x.date} - <b>${money(x.amount)}</b></div>`)
    .join("") || `<div style="color:#888;padding:8px;">No income history</div>`;

  he.innerHTML = order.tasks
    .slice()
    .sort((a, b) => (b.time || 0) - (a.time || 0))
    .map((x) => `<div style="padding:6px 0;border-bottom:1px solid #eee;">${x.type} (${x.artist}) - <b>${money(x.cost)}</b></div>`)
    .join("") || `<div style="color:#888;padding:8px;">No expense history</div>`;
}

/* -------------------------------
   ADD INCOME / TASK
--------------------------------*/
window.addIncome = function () {
  const order = db.orders.find((x) => x.id === ACTIVE_ORDER_ID);
  if (!order) return;

  const date = $("pay-in-date").value || toDateStr(new Date());
  const amt = Number($("pay-in-amt").value || 0);
  if (!amt) return alert("Amount required");

  order.income ||= [];
  order.income.push({ id: nowId("inc"), date, amount: amt, time: Date.now() });

  $("pay-in-amt").value = "";

  saveDB();
  openOrderDetail(order.id);
  if (window.scheduleAutoBackup) window.scheduleAutoBackup();
};

function fillTaskDropdowns() {
  const typeSel = $("task-type");
  const artSel = $("task-artist");
  if (!typeSel || !artSel) return;

  // categories
  typeSel.innerHTML = "";
  db.categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    typeSel.appendChild(opt);
  });

  // team
  artSel.innerHTML = "";
  db.team.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    artSel.appendChild(opt);
  });
}

window.addTask = function () {
  const order = db.orders.find((x) => x.id === ACTIVE_ORDER_ID);
  if (!order) return;

  const type = $("task-type").value || "";
  const artist = $("task-artist").value || "";
  const cost = Number($("task-cost").value || 0);
  if (!cost) return alert("Cost required");

  order.tasks ||= [];
  order.tasks.push({
    id: nowId("tsk"),
    type,
    artist,
    cost,
    time: Date.now(),
  });

  $("task-cost").value = "";

  saveDB();
  openOrderDetail(order.id);
  if (window.scheduleAutoBackup) window.scheduleAutoBackup();
};

/* -------------------------------
   AUTO SETTLE (mark done)
--------------------------------*/
window.markDone = function () {
  const order = db.orders.find((x) => x.id === ACTIVE_ORDER_ID);
  if (!order) return;

  const s = calcOrderSummary(order);
  if (s.pending <= 0) return alert("Already settled");

  order.income ||= [];
  order.income.push({
    id: nowId("inc"),
    date: toDateStr(new Date()),
    amount: s.pending,
    time: Date.now(),
  });

  saveDB();
  openOrderDetail(order.id);
  if (window.scheduleAutoBackup) window.scheduleAutoBackup();
};

/* -------------------------------
   DELETE ORDER
--------------------------------*/
window.deleteOrder = function () {
  if (!ACTIVE_ORDER_ID) return;
  if (!confirm("Delete this order?")) return;

  db.orders = db.orders.filter((x) => x.id !== ACTIVE_ORDER_ID);
  ACTIVE_ORDER_ID = "";

  saveDB();
  renderHome();
  window.closeModal("modal-detail");
  if (window.scheduleAutoBackup) window.scheduleAutoBackup();
};

/* -------------------------------
   TEAM MANAGER
--------------------------------*/
window.openTeamMgr = function () {
  $("overlay-team").style.display = "flex";
  renderTeamList();
};

function renderTeamList() {
  const box = $("list-team");
  if (!box) return;
  box.innerHTML = "";

  db.team ||= ["Self"];
  db.team.forEach((m) => {
    const div = document.createElement("div");
    div.className = "mini-row";
    div.innerHTML = `
      <div>${m}</div>
      <button class="btn btn-sm" style="margin-left:auto;">🗑</button>
    `;
    div.querySelector("button").onclick = () => {
      if (m === "Self") return alert("Cannot delete Self");
      db.team = db.team.filter((x) => x !== m);
      saveDB();
      renderTeamList();
      fillTaskDropdowns();
      if (window.scheduleAutoBackup) window.scheduleAutoBackup();
    };
    box.appendChild(div);
  });

  fillTaskDropdowns();
}

window.addTeam = function () {
  const name = safeText($("team-new").value);
  if (!name) return;

  db.team ||= ["Self"];
  if (db.team.includes(name)) return alert("Already exists");

  db.team.push(name);
  $("team-new").value = "";

  saveDB();
  renderTeamList();
  fillTaskDropdowns();
  if (window.scheduleAutoBackup) window.scheduleAutoBackup();
};

/* -------------------------------
   CATEGORY MANAGER
--------------------------------*/
window.openCategoryMgr = function () {
  $("overlay-cat").style.display = "flex";
  renderCatList();
};

function renderCatList() {
  const box = $("list-cat");
  if (!box) return;
  box.innerHTML = "";

  db.categories ||= ["Model", "Print", "Color", "Material", "Other"];
  db.categories.forEach((c) => {
    const div = document.createElement("div");
    div.className = "mini-row";
    div.innerHTML = `
      <div>${c}</div>
      <button class="btn btn-sm" style="margin-left:auto;">🗑</button>
    `;
    div.querySelector("button").onclick = () => {
      db.categories = db.categories.filter((x) => x !== c);
      saveDB();
      renderCatList();
      fillTaskDropdowns();
      if (window.scheduleAutoBackup) window.scheduleAutoBackup();
    };
    box.appendChild(div);
  });

  fillTaskDropdowns();
}

window.addCategory = function () {
  const name = safeText($("cat-new").value);
  if (!name) return;

  db.categories ||= [];
  if (db.categories.includes(name)) return alert("Already exists");

  db.categories.push(name);
  $("cat-new").value = "";

  saveDB();
  renderCatList();
  fillTaskDropdowns();
  if (window.scheduleAutoBackup) window.scheduleAutoBackup();
};

/* -------------------------------
   BUSINESS MANAGER (ADMIN)
--------------------------------*/
window.openBusinessMgr = function () {
  $("overlay-biz").style.display = "flex";
  $("biz-panel").style.display = "none";
  $("biz-pin").value = "";
  $("biz-info").innerText = `Admin Email: ${ADMIN_EMAIL}`;
};

window.unlockBizAdmin = function () {
  if (ACTIVE_EMAIL !== ADMIN_EMAIL) return alert("Not admin email");
  const pin = $("biz-pin").value || "";
  if (pin !== ADMIN_PIN) return alert("Wrong PIN");

  $("biz-panel").style.display = "block";
  renderBizList();
};

function renderBizList() {
  const box = $("biz-list");
  if (!box) return;

  const meta = loadBizMeta();
  box.innerHTML = "";

  meta.businesses.forEach((b) => {
    const div = document.createElement("div");
    div.className = "mini-row";
    div.innerHTML = `
      <div><b>${b.name}</b><div style="font-size:12px;color:#666;">${b.ownerEmail}</div></div>
    `;
    box.appendChild(div);
  });
}

window.addBusiness = function () {
  if (ACTIVE_EMAIL !== ADMIN_EMAIL) return alert("Admin only");

  const name = safeText($("biz-new-name").value);
  const owner = safeText($("biz-new-owner").value).toLowerCase();
  if (!name || !owner) return alert("Name & Owner email required");

  const meta = loadBizMeta();
  meta.businesses ||= [];

  meta.businesses.push({ id: nowId("biz"), name, ownerEmail: owner });
  saveBizMeta(meta);

  $("biz-new-name").value = "";
  $("biz-new-owner").value = "";

  renderBizList();
};

/* -------------------------------
   LOCAL BACKUP / RESTORE
--------------------------------*/
window.collectAppBackupData = function () {
  // Only active business db
  return {
    email: ACTIVE_EMAIL,
    bizId: ACTIVE_BIZ_ID,
    db,
    meta: loadBizMeta(),
    exportedAt: new Date().toISOString(),
  };
};

window.getActiveDriveBackupFileName = function () {
  const meta = loadBizMeta();
  const biz = meta.businesses.find((b) => b.id === ACTIVE_BIZ_ID);
  const safe = (biz?.name || "MainBusiness").replace(/[^a-z0-9_\- ]/gi, "_").replace(/\s+/g, "_");
  return `TatvaPro_${safe}_Backup.json`;
};

// Local Save button
window.backupData = function () {
  const payload = window.collectAppBackupData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `Tatva_Local_Backup_${ACTIVE_BIZ_ID}.json`;
  a.click();

  URL.revokeObjectURL(url);
};

// Local Load input restore (uses old index onchange="restoreData(this)")
window.restoreData = function (inputEl) {
  try {
    const file = inputEl.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const obj = JSON.parse(reader.result);

      if (!obj || !obj.db) return alert("Invalid file");
      window.applyAppRestoreData(obj.db);

      inputEl.value = "";
    };
    reader.readAsText(file);
  } catch (e) {
    alert("Restore error");
  }
};

/* -------------------------------
   DRIVE RESTORE HANDLER
--------------------------------*/
window.applyAppRestoreData = function (dataObj) {
  try {
    if (!dataObj || typeof dataObj !== "object") return alert("❌ Invalid backup");

    db = dataObj;
    db.orders ||= [];
    db.team ||= ["Self"];
    db.categories ||= ["Model", "Print", "Color", "Material", "Other"];

    saveDB();
    renderHome();
    fillTaskDropdowns();

    alert("✅ Restore Done!");
  } catch (e) {
    console.error(e);
    alert("❌ Restore failed");
  }
};

/* -------------------------------
   EXPORT (dummy for button)
--------------------------------*/
window.exportExcel = function () {
  alert("Export feature can be added next (Excel).");
};

/* -------------------------------
   DRIVE LOGIN SUCCESS HOOK
--------------------------------*/
window.onDriveLoginSuccess = function () {
  // email from drive
  ACTIVE_EMAIL = getLoggedEmail().toLowerCase();

  // enforce 1 email = 1 business
  ACTIVE_BIZ_ID = ensureOneBusinessForEmail(ACTIVE_EMAIL);

  // load db
  db = loadDB(ACTIVE_BIZ_ID);

  // unlock UI
  showLoginLock(false);

  renderHome();
  fillTaskDropdowns();
};

/* -------------------------------
   INIT APP
--------------------------------*/
function initApp() {
  // If already connected (gdrive.js restored session) => onDriveLoginSuccess will run from gdrive.js
  // else show lock
  showLoginLock(true);

  // update drive status UI if exists
  if (window.updateDriveStatusUI) window.updateDriveStatusUI();

  // if drive already connected
  if (window.__driveConnected && window.__driveAccessToken) {
    setTimeout(() => {
      if (window.onDriveLoginSuccess) window.onDriveLoginSuccess();
    }, 200);
  }
}

window.addEventListener("load", initApp);

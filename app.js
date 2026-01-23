/*******************************************************
 * Tatva OS Pro - app.js (FINAL ADMIN LOCK + EMAIL LOGIN)
 * ✅ Email based login required (Drive)
 * ✅ Admin only Business Manager button
 * ✅ Multi business profiles (owner email)
 *******************************************************/

// 🔐 Admin config
const ADMIN_EMAIL = "patelkaran799084@gmail.com";
const ADMIN_PIN = "2580"; // change if needed

const BIZ_META_KEY = "tatva_biz_meta_v3";

// email from drive login (set in gdrive.js)
function getLoggedEmail() {
  return (window.__driveUserEmail || "").toLowerCase().trim();
}
function isAdmin() {
  return getLoggedEmail() === ADMIN_EMAIL.toLowerCase();
}

// Default meta: 1 business owned by admin
function defaultMeta() {
  return {
    activeBizId: "biz_main",
    businesses: [
      { id: "biz_main", name: "Main Business", ownerEmail: ADMIN_EMAIL.toLowerCase() }
    ]
  };
}

function loadBizMeta() {
  let meta = JSON.parse(localStorage.getItem(BIZ_META_KEY) || "null");
  if (!meta || !meta.businesses || !meta.activeBizId) {
    meta = defaultMeta();
    localStorage.setItem(BIZ_META_KEY, JSON.stringify(meta));
  }
  return meta;
}
function saveBizMeta(meta) { localStorage.setItem(BIZ_META_KEY, JSON.stringify(meta)); }

function getDBKey(bizId) { return `tatva_pro_db__${bizId}`; }

function emptyDB() {
  return {
    orders: [],
    team: ["Self"],
    categories: ["Model", "Print", "Color", "Material", "Other"]
  };
}

window.getActiveDriveBackupFileName = function () {
  const meta = loadBizMeta();
  const biz = meta.businesses.find(b => b.id === meta.activeBizId);
  const safeName = (biz?.name || "Business").replace(/[^a-z0-9]/gi, "_");
  return `TatvaPro_${safeName}_Backup.json`;
};

function getVisibleBusinesses() {
  const meta = loadBizMeta();
  const email = getLoggedEmail();
  if (!email) return []; // ✅ locked
  return meta.businesses.filter(b => (b.ownerEmail || "").toLowerCase().trim() === email);
}

function ensureActiveBizVisible() {
  const meta = loadBizMeta();
  const visible = getVisibleBusinesses();
  if (visible.length === 0) return;

  const ok = visible.some(b => b.id === meta.activeBizId);
  if (!ok) {
    meta.activeBizId = visible[0].id;
    saveBizMeta(meta);
  }
}

function getActiveBizId() { return loadBizMeta().activeBizId; }

window.renderBizDropdown = function () {
  ensureActiveBizVisible();
  const meta = loadBizMeta();
  const visible = getVisibleBusinesses();
  const sel = document.getElementById("bizSelect");
  if (!sel) return;
  sel.innerHTML = "";

  if (!getLoggedEmail()) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.text = "🔐 Login required";
    sel.add(opt);
    sel.value = "";
    return;
  }

  if (visible.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.text = "❌ No business for this email";
    sel.add(opt);
    sel.value = "";
    return;
  }

  visible.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.text = "🧳 " + b.name;
    sel.add(opt);
  });

  const activeInVisible = visible.some(b => b.id === meta.activeBizId);
  sel.value = activeInVisible ? meta.activeBizId : (visible[0].id);
};

window.switchBusinessFromUI = function () {
  const sel = document.getElementById("bizSelect");
  if (!sel || !sel.value) return;
  const meta = loadBizMeta();
  meta.activeBizId = sel.value;
  saveBizMeta(meta);

  loadDBForActiveBusiness();
  renderHome();
};

// DB
window.db = emptyDB();
window.currentId = null;
window.__isRestoring = false;

if (!localStorage.getItem("LOCAL_LAST_TS")) localStorage.setItem("LOCAL_LAST_TS", "0");

window.loadDBForActiveBusiness = function () {
  if (!getLoggedEmail()) return;

  ensureActiveBizVisible();
  window.renderBizDropdown();

  const bizId = getActiveBizId();
  const key = getDBKey(bizId);
  const stored = JSON.parse(localStorage.getItem(key) || "null");

  db = stored || emptyDB();
  db.orders ||= [];
  db.team ||= ["Self"];
  db.categories ||= ["Model", "Print", "Color", "Material", "Other"];
};

function saveDB() {
  if (!getLoggedEmail()) return;

  const bizId = getActiveBizId();
  const key = getDBKey(bizId);

  localStorage.setItem(key, JSON.stringify(db));
  localStorage.setItem("LOCAL_LAST_TS", String(Date.now()));

  renderHome();
  if (currentId) renderDetail();

  try {
    if (!window.__isRestoring && window.scheduleAutoBackup) {
      window.scheduleAutoBackup();
    }
  } catch (e) {}
}

window.closeModal = function (id) { document.getElementById(id).style.display = "none"; };
function money(n) { return "₹" + Number(n || 0); }

// ADMIN UI
function updateAdminUI() {
  const btn = document.getElementById("btnBiz");
  if (btn) btn.style.display = isAdmin() ? "inline-flex" : "none";
}

// LOCK UI
function lockAppUI(locked) {
  const lock = document.getElementById("loginLock");
  const app = document.getElementById("mainApp");
  const fab = document.getElementById("fabBtn");

  if (locked) {
    if (lock) { lock.style.display = "flex"; lock.style.alignItems="center"; lock.style.justifyContent="center"; }
    if (app) app.style.display = "none";
    if (fab) fab.style.display = "none";
  } else {
    if (lock) lock.style.display = "none";
    if (app) app.style.display = "block";
    if (fab) fab.style.display = "flex";
  }
}

window.onDriveLoginSuccess = function () {
  lockAppUI(false);
  updateAdminUI();
  loadDBForActiveBusiness();
  renderBizDropdown();
  renderHome();
};

// HOME
function renderHome() {
  if (!getLoggedEmail()) return;

  let totalRev = 0, totalExp = 0, totalRecd = 0, totalPaid = 0;
  let html = "";

  let sorted = [...db.orders].sort((a, b) => b.id - a.id);
  sorted.forEach(o => {
    let recd = (o.income || []).reduce((s, x) => s + x.amt, 0);
    let exp = (o.tasks || []).reduce((s, t) => s + t.cost, 0);
    let paid = (o.tasks || []).reduce((s, t) => s + (t.payouts || []).reduce((p, x) => p + x.amt, 0), 0);

    totalRev += o.price;
    totalExp += exp;
    totalRecd += recd;
    totalPaid += paid;

    let pending = o.price - recd;
    let statusText = pending <= 0 ? "✔ Paid" : `⏳ ₹${pending} Left`;

    html += `
      <div class="order-card" onclick="openDetail(${o.id})">
        <div class="oc-top">
          <span>${o.client}</span>
          <span style="color:${pending <= 0 ? "green" : "orange"}">₹${o.price}</span>
        </div>
        <div class="oc-mid">
          <span>${o.work || ""}</span>
          <span>Exp: ₹${exp}</span>
        </div>
        <div class="oc-bot">
          <span>${o.date || ""}</span>
          <span class="status-badge ${pending <= 0 ? "status-green" : "status-orange"}">${statusText}</span>
        </div>
      </div>`;
  });

  document.getElementById("orders-list").innerHTML =
    html || '<div style="text-align:center;color:#aaa;margin-top:20px;">No Orders Yet</div>';

  document.getElementById("st-orders").innerText = db.orders.length;
  document.getElementById("st-profit").innerText = money(totalRev - totalExp);
  document.getElementById("st-rev").innerText = money(totalRev);
  document.getElementById("st-hand").innerText = money(totalRecd - totalPaid);
}

// New order
window.openNewOrder = function () {
  if (!getLoggedEmail()) return alert("Drive Login first!");
  document.getElementById("new-client").value = "";
  document.getElementById("new-work").value = "";
  document.getElementById("new-price").value = "";
  document.getElementById("new-date").valueAsDate = new Date();
  document.getElementById("modal-new").style.display = "flex";
};

window.createOrder = function () {
  let client = document.getElementById("new-client").value.trim();
  let price = Number(document.getElementById("new-price").value);
  if (!client || !price) return alert("Client Name & Price Required");

  db.orders.push({
    id: Date.now(),
    client,
    work: document.getElementById("new-work").value.trim(),
    price,
    date: (document.getElementById("new-date").value || "").split("-").reverse().join("/"),
    income: [],
    tasks: []
  });

  saveDB();
  closeModal("modal-new");
};

// DETAIL
window.openDetail = function (id) {
  currentId = id;
  fillOrderDropdown();
  document.getElementById("orderSelect").value = String(id);
  fillTeamDropdown();
  fillCategoryDropdown();

  renderDetail();
  switchTab("income");
  document.getElementById("modal-detail").style.display = "flex";
};

function fillOrderDropdown() {
  const sel = document.getElementById("orderSelect");
  sel.innerHTML = "";
  let sorted = [...db.orders].sort((a, b) => b.id - a.id);
  sorted.forEach(o => {
    const opt = document.createElement("option");
    opt.value = String(o.id);
    opt.text = `${o.client} - ₹${o.price}`;
    sel.add(opt);
  });
}

window.onOrderSelectChange = function () {
  const id = Number(document.getElementById("orderSelect").value);
  currentId = id;
  fillTeamDropdown();
  fillCategoryDropdown();
  renderDetail();
};

function fillTeamDropdown() {
  let selA = document.getElementById("task-artist");
  selA.innerHTML = "";
  db.team.forEach(t => {
    let opt = document.createElement("option");
    opt.value = t;
    opt.text = t;
    selA.add(opt);
  });
}

function fillCategoryDropdown() {
  let sel = document.getElementById("task-type");
  sel.innerHTML = "";
  (db.categories || []).forEach(c => {
    let opt = document.createElement("option");
    opt.value = c;
    opt.text = c;
    sel.add(opt);
  });
  if (!db.categories || db.categories.length === 0) {
    db.categories = ["Other"];
    saveDB();
  }
}

window.switchTab = function (tab) {
  document.getElementById("tab-income").style.display = tab === "income" ? "block" : "none";
  document.getElementById("tab-expense").style.display = tab === "expense" ? "block" : "none";
  document.getElementById("tab-summary").style.display = tab === "summary" ? "block" : "none";
};

function renderDetail() {
  let o = db.orders.find(x => x.id === currentId);
  if (!o) return closeModal("modal-detail");

  document.getElementById("d-client").innerText = o.client;
  document.getElementById("d-work").innerText = o.work || "-";
  document.getElementById("d-date").innerText = o.date || "-";

  let recd = (o.income || []).reduce((s, x) => s + x.amt, 0);
  let pending = o.price - recd;
  document.getElementById("d-pending").innerText = pending <= 0 ? "Full Paid" : `Pending: ₹${pending}`;

  let incHtml = "";
  (o.income || []).forEach((inc, idx) => {
    incHtml += `<div class="list-item"><span>${inc.date}</span><b>+ ₹${inc.amt}</b>
      <span class="del-x" onclick="delInc(${idx})">×</span></div>`;
  });
  document.getElementById("list-income").innerHTML = incHtml;

  let expHtml = "";
  let totalPaidOut = 0;

  (o.tasks || []).forEach((t, tIdx) => {
    let paid = (t.payouts || []).reduce((s, x) => s + x.amt, 0);
    totalPaidOut += paid;
    let due = t.cost - paid;

    let payHist = "";
    (t.payouts || []).forEach((p, pIdx) => {
      payHist += `<div class="list-item" style="color:#666;font-size:11px;padding-left:10px;">
        • ${p.date}: ₹${p.amt} <span class="del-x" onclick="delTaskPay(${tIdx},${pIdx})">×</span></div>`;
    });

    expHtml += `
      <details style="background:#f9f9f9;border:1px solid #eee;padding:10px;border-radius:12px;margin-bottom:10px;">
        <summary style="cursor:pointer;font-weight:800;">
          ${t.type} (${t.artist}) — Cost ₹${t.cost} — <span style="color:${due <= 0 ? "green" : "red"}">${due <= 0 ? "Paid" : "Due ₹" + due}</span>
          <span class="del-x" onclick="event.preventDefault();delTask(${tIdx})" style="color:red;float:right;">×</span>
        </summary>
        <div style="margin-top:8px;">
          ${payHist}
          <div class="row-inputs" style="margin-top:8px;">
            <input type="date" id="t-date-${tIdx}" style="margin:0;padding:6px;font-size:13px;">
            <input type="number" id="t-pay-${tIdx}" placeholder="Amt" style="margin:0;padding:6px;font-size:13px;">
            <button class="btn btn-blue btn-sm" onclick="payTask(${tIdx})">Pay</button>
          </div>
        </div>
      </details>`;
  });

  document.getElementById("list-tasks").innerHTML = expHtml;

  document.getElementById("d-recd").innerText = money(recd);
  document.getElementById("d-paid").innerText = money(totalPaidOut);
  document.getElementById("d-hand").innerText = money(recd - totalPaidOut);

  document.getElementById("hist-income").innerHTML = incHtml || "<div style='color:#999;'>No income history</div>";
  document.getElementById("hist-expense").innerHTML = expHtml || "<div style='color:#999;'>No expense history</div>";
}

// Income
window.addIncome = function () {
  let amt = Number(document.getElementById("pay-in-amt").value);
  if (!amt) return;

  let dateEl = document.getElementById("pay-in-date");
  let dt = (dateEl && dateEl.value)
    ? dateEl.value.split("-").reverse().join("/")
    : new Date().toLocaleDateString("en-GB");

  let o = db.orders.find(x => x.id === currentId);
  (o.income ||= []).push({ amt, date: dt });

  document.getElementById("pay-in-amt").value = "";
  if (dateEl) dateEl.value = "";
  saveDB();
};

window.delInc = function (idx) {
  if (!confirm("Delete entry?")) return;
  let o = db.orders.find(x => x.id === currentId);
  o.income.splice(idx, 1);
  saveDB();
};

// Tasks
window.addTask = function () {
  let type = document.getElementById("task-type").value;
  let artist = document.getElementById("task-artist").value;
  let cost = Number(document.getElementById("task-cost").value);
  if (!cost) return alert("Enter Cost");

  let o = db.orders.find(x => x.id === currentId);
  (o.tasks ||= []).push({ type, artist, cost, payouts: [] });

  document.getElementById("task-cost").value = "";
  saveDB();
};

window.payTask = function (tIdx) {
  let amt = Number(document.getElementById(`t-pay-${tIdx}`).value);
  if (!amt) return;

  let dateEl = document.getElementById(`t-date-${tIdx}`);
  let dt = (dateEl && dateEl.value)
    ? dateEl.value.split("-").reverse().join("/")
    : new Date().toLocaleDateString("en-GB");

  let o = db.orders.find(x => x.id === currentId);
  o.tasks[tIdx].payouts.push({ amt, date: dt });

  document.getElementById(`t-pay-${tIdx}`).value = "";
  if (dateEl) dateEl.value = "";
  saveDB();
};

window.delTask = function (tIdx) {
  if (!confirm("Delete Task?")) return;
  let o = db.orders.find(x => x.id === currentId);
  o.tasks.splice(tIdx, 1);
  saveDB();
};

window.delTaskPay = function (tIdx, pIdx) {
  if (!confirm("Delete Payment?")) return;
  let o = db.orders.find(x => x.id === currentId);
  o.tasks[tIdx].payouts.splice(pIdx, 1);
  saveDB();
};

// Auto settle / Delete order
window.markDone = function () {
  if (!confirm("Auto-Settle Everything?")) return;
  let o = db.orders.find(x => x.id === currentId);
  let today = new Date().toLocaleDateString("en-GB") + " (Auto)";

  let recd = (o.income || []).reduce((s, x) => s + x.amt, 0);
  if (o.price > recd) {
    (o.income ||= []).push({ amt: o.price - recd, date: today });
  }

  (o.tasks || []).forEach(t => {
    let paid = (t.payouts || []).reduce((s, x) => s + x.amt, 0);
    if (t.cost > paid) {
      (t.payouts ||= []).push({ amt: t.cost - paid, date: today });
    }
  });

  saveDB();
};

window.deleteOrder = function () {
  if (!confirm("Delete entire order?")) return;
  db.orders = db.orders.filter(x => x.id !== currentId);
  currentId = db.orders.length ? db.orders[0].id : null;
  saveDB();
  closeModal("modal-detail");
};

// Team
window.openTeamMgr = function () {
  if (!getLoggedEmail()) return;
  let html = "";
  db.team.forEach((t, i) => {
    if (t !== "Self") {
      html += `<div class="list-item"><span>${t}</span>
        <span class="del-x" onclick="delTeam(${i})">×</span></div>`;
    }
  });
  document.getElementById("list-team").innerHTML = html;
  document.getElementById("overlay-team").style.display = "flex";
};
window.addTeam = function () {
  let nm = document.getElementById("team-new").value.trim();
  if (nm && !db.team.includes(nm)) {
    db.team.push(nm);
    document.getElementById("team-new").value = "";
    saveDB();
    openTeamMgr();
  }
};
window.delTeam = function (i) {
  db.team.splice(i, 1);
  saveDB();
  openTeamMgr();
};

// Category
window.openCategoryMgr = function () {
  if (!getLoggedEmail()) return;
  let html = "";
  (db.categories || []).forEach((c, i) => {
    html += `<div class="list-item"><span>${c}</span>
      <span class="del-x" onclick="delCategory(${i})">×</span></div>`;
  });
  document.getElementById("list-cat").innerHTML = html;
  document.getElementById("overlay-cat").style.display = "flex";
};
window.addCategory = function () {
  let nm = document.getElementById("cat-new").value.trim();
  if (!nm) return;
  db.categories ||= [];
  if (!db.categories.includes(nm)) {
    db.categories.push(nm);
    document.getElementById("cat-new").value = "";
    saveDB();
    openCategoryMgr();
    fillCategoryDropdown();
  }
};
window.delCategory = function (i) {
  if (!confirm("Remove category?")) return;
  db.categories.splice(i, 1);
  if (db.categories.length === 0) db.categories.push("Other");
  saveDB();
  openCategoryMgr();
  fillCategoryDropdown();
};

// Local backup (business wise filename)
window.backupData = function () {
  if (!getLoggedEmail()) return alert("Drive Login first!");

  const meta = loadBizMeta();
  const biz = meta.businesses.find(b => b.id === meta.activeBizId);
  const safeName = (biz?.name || "Business").replace(/[^a-z0-9]/gi, "_");
  const fileName = `TatvaPro_${safeName}.json`;

  let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
  let node = document.createElement("a");
  node.setAttribute("href", dataStr);
  node.setAttribute("download", fileName);
  document.body.appendChild(node);
  node.click();
  node.remove();
};

window.restoreData = function (input) {
  if (!getLoggedEmail()) return alert("Drive Login first!");
  let file = input.files[0];
  let reader = new FileReader();
  reader.onload = function (e) {
    db = JSON.parse(e.target.result);
    db.orders ||= [];
    db.team ||= ["Self"];
    db.categories ||= ["Model", "Print", "Color", "Material", "Other"];
    saveDB();
    alert("Data Restored!");
  };
  reader.readAsText(file);
};

// ---------- BUSINESS MANAGER (ADMIN PIN) ----------
let __bizAdminUnlocked = false;

window.openBusinessMgr = function () {
  if (!isAdmin()) {
    alert("❌ Only Admin can manage businesses.");
    return;
  }

  document.getElementById("overlay-biz").style.display = "flex";
  document.getElementById("biz-info").innerText =
    `Logged in: ${getLoggedEmail()} (Admin)`;

  document.getElementById("biz-panel").style.display = "none";
  document.getElementById("biz-pin").value = "";
  __bizAdminUnlocked = false;
};

window.unlockBizAdmin = function () {
  const pin = document.getElementById("biz-pin").value.trim();
  if (pin !== ADMIN_PIN) {
    alert("❌ Wrong PIN");
    return;
  }
  __bizAdminUnlocked = true;
  document.getElementById("biz-panel").style.display = "block";
  renderBizManagerList();
};

function renderBizManagerList() {
  const meta = loadBizMeta();
  const list = document.getElementById("biz-list");
  list.innerHTML = "";

  meta.businesses.forEach(b => {
    const active = b.id === meta.activeBizId ? "✅ " : "";
    list.innerHTML += `
      <div class="list-item" style="gap:10px;">
        <span>${active}<b>${b.name}</b><br>
          <small style="color:#666;">Owner: ${(b.ownerEmail || "-")}</small>
        </span>
        <span style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-sm" onclick="renameBusiness('${b.id}')">Rename</button>
          <button class="btn btn-sm" onclick="setActiveBusiness('${b.id}')">Use</button>
          <button class="btn btn-red btn-sm" onclick="deleteBusiness('${b.id}')">Delete</button>
        </span>
      </div>`;
  });
}

window.addBusiness = function () {
  if (!__bizAdminUnlocked) return alert("Unlock with PIN first!");

  const nm = document.getElementById("biz-new-name").value.trim();
  const em = document.getElementById("biz-new-owner").value.trim().toLowerCase();

  if (!nm) return alert("Business name required");
  if (!em || !em.includes("@")) return alert("Valid owner email required");

  const meta = loadBizMeta();
  const id = "biz_" + Date.now();

  meta.businesses.push({ id, name: nm, ownerEmail: em });
  meta.activeBizId = id;
  saveBizMeta(meta);

  localStorage.setItem(getDBKey(id), JSON.stringify(emptyDB()));

  document.getElementById("biz-new-name").value = "";
  document.getElementById("biz-new-owner").value = "";

  loadDBForActiveBusiness();
  renderHome();
  renderBizManagerList();
};

window.renameBusiness = function (bizId) {
  if (!__bizAdminUnlocked) return alert("Unlock with PIN first!");
  const meta = loadBizMeta();
  const biz = meta.businesses.find(b => b.id === bizId);
  const nm = prompt("New name:", biz?.name || "");
  if (!nm) return;
  biz.name = nm.trim();
  saveBizMeta(meta);

  renderBizDropdown();
  renderBizManagerList();
};

window.setActiveBusiness = function (bizId) {
  const meta = loadBizMeta();
  meta.activeBizId = bizId;
  saveBizMeta(meta);

  loadDBForActiveBusiness();
  renderHome();
  if (__bizAdminUnlocked) renderBizManagerList();
};

window.deleteBusiness = function (bizId) {
  if (!__bizAdminUnlocked) return alert("Unlock with PIN first!");
  const meta = loadBizMeta();
  if (meta.businesses.length <= 1) return alert("At least 1 business must remain.");

  if (!confirm("Delete this business? All local data will be removed.")) return;

  meta.businesses = meta.businesses.filter(b => b.id !== bizId);
  localStorage.removeItem(getDBKey(bizId));

  if (meta.activeBizId === bizId) meta.activeBizId = meta.businesses[0].id;
  saveBizMeta(meta);

  loadDBForActiveBusiness();
  renderHome();
  renderBizManagerList();
};

// Drive sync helpers
window.collectAppBackupData = function () {
  return { app: "TatvaPro", version: 40, ts: Date.now(), bizId: getActiveBizId(), db: db };
};

window.applyBackupObject = function (backup) {
  if (backup && backup.db) {
    window.__isRestoring = true;

    db = backup.db;
    db.orders ||= [];
    db.team ||= ["Self"];
    db.categories ||= ["Model", "Print", "Color", "Material", "Other"];

    const key = getDBKey(getActiveBizId());
    localStorage.setItem(key, JSON.stringify(db));
    localStorage.setItem("LOCAL_LAST_TS", String(backup.ts || Date.now()));

    renderHome();
    if (currentId) renderDetail();

    setTimeout(() => { window.__isRestoring = false; }, 1200);
  }
};

// INIT (lock until login)
(function init() {
  updateAdminUI();
  renderBizDropdown();

  if (!getLoggedEmail()) {
    lockAppUI(true);
  } else {
    lockAppUI(false);
    loadDBForActiveBusiness();
    renderHome();
  }
})();

/***********************
 * ✅ Drive Restore Handler (Added)
 * gdrive.js calls applyAppRestoreData(data)
 ***********************/
window.applyAppRestoreData = function (dataObj) {
  try {
    if (!dataObj || typeof dataObj !== "object") {
      alert("❌ Invalid backup data");
      return;
    }

    // Replace db
    db = dataObj;

    // safety defaults
    db.orders ||= [];
    db.team ||= ["Self"];
    db.categories ||= ["Model", "Print", "Color", "Material", "Other"];

    saveDB();

    // refresh UI
    try { renderOrders && renderOrders(); } catch (e) {}
    try { updateStats && updateStats(); } catch (e) {}
    try { fillTeamDropdown && fillTeamDropdown(); } catch (e) {}
    try { fillCategoryDropdown && fillCategoryDropdown(); } catch (e) {}

    alert("✅ Drive Restore Done!");
  } catch (e) {
    console.error(e);
    alert("❌ Restore failed in app.js");
  }
};


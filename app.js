// --- DATABASE ---
window.db = JSON.parse(localStorage.getItem('tatva_pro_db')) || { orders: [], team: ['Self'] };
window.currentId = null;

// ✅ track local data timestamp (for auto sync)
if(!localStorage.getItem("LOCAL_LAST_TS")) localStorage.setItem("LOCAL_LAST_TS", "0");

// --- SAVE DB ---
function saveDB() {
    localStorage.setItem('tatva_pro_db', JSON.stringify(db));

    // ✅ update local timestamp every change
    localStorage.setItem("LOCAL_LAST_TS", String(Date.now()));

    renderHome();
    if(currentId) renderDetail();

    // ✅ AUTO BACKUP trigger (Drive connected hoy to)
    try{
        if(window.scheduleAutoBackup) window.scheduleAutoBackup(6000);
    }catch(e){}
}

// --- RENDER HOME ---
function renderHome() {
    let totalRev = 0, totalExp = 0, totalRecd = 0, totalPaid = 0;
    let html = '';
    
    // Sort Newest First
    let sorted = [...db.orders].sort((a,b) => b.id - a.id);

    sorted.forEach(o => {
        // Calcs
        let recd = (o.income || []).reduce((s,x) => s + x.amt, 0);
        let exp = (o.tasks || []).reduce((s,t) => s + t.cost, 0);
        let paid = (o.tasks || []).reduce((s,t) => s + (t.payouts || []).reduce((p,x)=>p+x.amt,0), 0);
        
        totalRev += o.price;
        totalExp += exp;
        totalRecd += recd;
        totalPaid += paid;

        let pending = o.price - recd;
        let statusClass = pending <= 0 ? 'status-green' : 'status-orange';
        let statusText = pending <= 0 ? '✔ Paid' : `⏳ ₹${pending} Left`;

        html += `
        <div class="order-card" onclick="openDetail(${o.id})">
            <div class="oc-top">
                <span>${o.client}</span>
                <span style="color:${pending<=0?'green':'orange'}">₹${o.price}</span>
            </div>
            <div class="oc-mid">
                <span>${o.work}</span>
                <span>Exp: ₹${exp}</span>
            </div>
            <div class="oc-bot">
                <span>${o.date}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
        </div>`;
    });

    document.getElementById('orders-list').innerHTML = html || '<div style="text-align:center;color:#aaa;margin-top:20px;">No Orders Yet</div>';
    
    document.getElementById('st-orders').innerText = db.orders.length;
    document.getElementById('st-profit').innerText = "₹" + (totalRev - totalExp);
    document.getElementById('st-rev').innerText = "₹" + totalRev;
    document.getElementById('st-hand').innerText = "₹" + (totalRecd - totalPaid);
}

// --- NEW ORDER ---
function openNewOrder() {
    document.getElementById('new-client').value = '';
    document.getElementById('new-work').value = '';
    document.getElementById('new-price').value = '';
    document.getElementById('new-date').valueAsDate = new Date();
    document.getElementById('modal-new').style.display = 'block';
}

function createOrder() {
    let client = document.getElementById('new-client').value;
    let price = Number(document.getElementById('new-price').value);
    if(!client || !price) return alert("Client Name & Price Required");

    db.orders.push({
        id: Date.now(),
        client,
        work: document.getElementById('new-work').value,
        price,
        date: document.getElementById('new-date').value.split('-').reverse().join('/'),
        income: [],
        tasks: []
    });
    saveDB();
    closeModal('modal-new');
}

// --- DETAIL VIEW ---
function openDetail(id) {
    currentId = id;
    renderDetail();
    
    // Populate Artist Dropdown
    let sel = document.getElementById('task-artist');
    sel.innerHTML = '';
    db.team.forEach(t => {
        let opt = document.createElement('option');
        opt.text = t;
        sel.add(opt);
    });

    document.getElementById('modal-detail').style.display = 'block';
}

function renderDetail() {
    let o = db.orders.find(x => x.id === currentId);
    if(!o) return closeModal('modal-detail');

    // Header
    document.getElementById('d-client').innerText = o.client;
    document.getElementById('d-work').innerText = o.work;
    document.getElementById('d-date').innerText = o.date;

    // Income Logic
    let recd = (o.income || []).reduce((s,x) => s + x.amt, 0);
    let pending = o.price - recd;
    document.getElementById('d-pending').innerText = pending <= 0 ? "Full Paid" : `Pending: ₹${pending}`;
    
    let incHtml = '';
    (o.income || []).forEach((inc, idx) => {
        incHtml += `<div class="list-item"><span>${inc.date}</span> <b>+ ₹${inc.amt}</b> <span class="del-x" onclick="delInc(${idx})">×</span></div>`;
    });
    document.getElementById('list-income').innerHTML = incHtml;

    // Expenses Logic
    let expHtml = '';
    let totalPaidOut = 0;

    (o.tasks || []).forEach((t, tIdx) => {
        let tPaid = (t.payouts || []).reduce((s,x) => s + x.amt, 0);
        totalPaidOut += tPaid;
        let tDue = t.cost - tPaid;
        
        let payHist = '';
        (t.payouts || []).forEach((p, pIdx) => {
            payHist += `<div class="list-item" style="color:#666; font-size:11px; padding-left:10px;">• ${p.date}: ₹${p.amt} <span class="del-x" onclick="delTaskPay(${tIdx}, ${pIdx})">×</span></div>`;
        });

        expHtml += `
        <div style="background:#f9f9f9; border:1px solid #eee; padding:10px; border-radius:8px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:5px;">
                <span>${t.type} (${t.artist})</span>
                <span class="del-x" onclick="delTask(${tIdx})" style="color:red">×</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                <span>Cost: ₹${t.cost}</span>
                <span style="color:${tDue<=0?'green':'red'}">${tDue<=0?'Paid':'Due: ₹'+tDue}</span>
            </div>
            <div style="border-top:1px dashed #ddd; margin-top:5px; padding-top:5px;">
                ${payHist}
                <div class="row-inputs" style="margin-top:5px;">
                    <input type="number" id="t-pay-${tIdx}" placeholder="Amt" style="margin:0; padding:6px; font-size:13px;">
                    <button class="btn btn-blue btn-sm" onclick="payTask(${tIdx})">Pay</button>
                </div>
            </div>
        </div>`;
    });
    document.getElementById('list-tasks').innerHTML = expHtml;

    // Strip Stats
    document.getElementById('d-recd').innerText = "₹" + recd;
    document.getElementById('d-paid').innerText = "₹" + totalPaidOut;
    document.getElementById('d-hand').innerText = "₹" + (recd - totalPaidOut);
}

// --- INCOME ACTIONS ---
function addIncome() {
    let amt = Number(document.getElementById('pay-in-amt').value);
    if(!amt) return;
    let o = db.orders.find(x => x.id === currentId);
    if(!o.income) o.income = [];
    o.income.push({ amt, date: new Date().toLocaleDateString('en-GB') });
    document.getElementById('pay-in-amt').value = '';
    saveDB();
}
function delInc(idx) {
    if(confirm("Delete entry?")) {
        let o = db.orders.find(x => x.id === currentId);
        o.income.splice(idx, 1);
        saveDB();
    }
}

// --- EXPENSE ACTIONS ---
function addTask() {
    let type = document.getElementById('task-type').value;
    let artist = document.getElementById('task-artist').value;
    let cost = Number(document.getElementById('task-cost').value);
    if(!cost) return alert("Enter Cost");

    let o = db.orders.find(x => x.id === currentId);
    if(!o.tasks) o.tasks = [];
    o.tasks.push({ type, artist, cost, payouts: [] });
    document.getElementById('task-cost').value = '';
    saveDB();
}
function payTask(tIdx) {
    let amt = Number(document.getElementById(`t-pay-${tIdx}`).value);
    if(!amt) return;
    let o = db.orders.find(x => x.id === currentId);
    o.tasks[tIdx].payouts.push({ amt, date: new Date().toLocaleDateString('en-GB') });
    saveDB();
}
function delTask(tIdx) {
    if(confirm("Delete Task?")) {
        let o = db.orders.find(x => x.id === currentId);
        o.tasks.splice(tIdx, 1);
        saveDB();
    }
}
function delTaskPay(tIdx, pIdx) {
    if(confirm("Delete Payment?")) {
        let o = db.orders.find(x => x.id === currentId);
        o.tasks[tIdx].payouts.splice(pIdx, 1);
        saveDB();
    }
}

// --- GLOBAL ACTIONS ---
function markDone() {
    if(!confirm("Auto-Settle Everything?")) return;
    let o = db.orders.find(x => x.id === currentId);
    let today = new Date().toLocaleDateString('en-GB') + " (Auto)";
    
    // Client
    let recd = (o.income || []).reduce((s,x) => s+x.amt, 0);
    if(o.price > recd) {
        if(!o.income) o.income = [];
        o.income.push({ amt: o.price - recd, date: today });
    }
    // Artists
    (o.tasks || []).forEach(t => {
        let paid = (t.payouts || []).reduce((s,x) => s+x.amt, 0);
        if(t.cost > paid) {
            if(!t.payouts) t.payouts = [];
            t.payouts.push({ amt: t.cost - paid, date: today });
        }
    });
    saveDB();
}
function deleteOrder() {
    if(confirm("Delete entire order?")) {
        db.orders = db.orders.filter(x => x.id !== currentId);
        saveDB();
        closeModal('modal-detail');
    }
}

// --- TEAM & UTILS ---
function openTeamMgr() {
    let html = '';
    db.team.forEach((t, i) => {
        if(t !== 'Self') html += `<div class="list-item"><span>${t}</span> <span class="del-x" onclick="delTeam(${i})">×</span></div>`;
    });
    document.getElementById('list-team').innerHTML = html;
    document.getElementById('overlay-team').style.display = 'flex';
}
function addTeam() {
    let nm = document.getElementById('team-new').value;
    if(nm && !db.team.includes(nm)) {
        db.team.push(nm);
        saveDB();
        openTeamMgr(); // refresh
        document.getElementById('team-new').value = '';
    }
}
function delTeam(i) {
    db.team.splice(i, 1);
    saveDB();
    openTeamMgr();
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// --- BACKUP (Local File Backup) ---
function backupData() {
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    let node = document.createElement('a');
    node.setAttribute("href", dataStr);
    node.setAttribute("download", "Tatva_Pro_Backup.json");
    document.body.appendChild(node);
    node.click();
    node.remove();
}
function restoreData(input) {
    let file = input.files[0];
    let reader = new FileReader();
    reader.onload = function(e) {
        db = JSON.parse(e.target.result);
        saveDB();
        alert("Data Restored!");
    };
    reader.readAsText(file);
}

// Init
renderHome();

/* ===========================================================
   ✅ DRIVE SYNC SUPPORT
   =========================================================== */

// ✅ used by Drive backup
window.collectAppBackupData = function(){
    return { app:"TatvaPro", version:1, ts: Date.now(), db: db };
};

// ✅ apply Drive restore without breaking UI
window.applyBackupObject = function(backup){
    if(backup && backup.db){
        db = backup.db;
        saveDB();
    }
};

// ✅ on app open: Auto restore latest Drive backup if it is newer
setTimeout(() => {
    try{
        if(window.autoSyncFromDrive) window.autoSyncFromDrive();
    }catch(e){}
}, 2500);

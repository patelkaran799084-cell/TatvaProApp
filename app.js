// ============================
// Tatva Pro - app.js ✅ PYTHON STYLE ORDER DETAILS
// + Dynamic Categories system (Team jvu)
// ============================

window.db = JSON.parse(localStorage.getItem('tatva_pro_db')) || {
  orders: [],
  team: ['Self'],
  categories: ['Model', 'Print', 'Color', 'Material', 'Other']
};

window.currentId = null;
window.__isRestoring = false;

if(!localStorage.getItem("LOCAL_LAST_TS")) localStorage.setItem("LOCAL_LAST_TS", "0");

// ---------- SAVE ----------
function saveDB() {
  localStorage.setItem('tatva_pro_db', JSON.stringify(db));
  localStorage.setItem("LOCAL_LAST_TS", String(Date.now()));

  renderHome();
  if(currentId) renderDetail();

  try{
    if(!window.__isRestoring && window.scheduleAutoBackup){
      window.scheduleAutoBackup();
    }
  }catch(e){}
}

function closeModal(id){ document.getElementById(id).style.display='none'; }
function money(n){ return "₹" + Number(n || 0); }

// ---------- HOME ----------
function renderHome(){
  let totalRev=0, totalExp=0, totalRecd=0, totalPaid=0;
  let html='';
  let sorted=[...db.orders].sort((a,b)=>b.id-a.id);

  sorted.forEach(o=>{
    let recd=(o.income||[]).reduce((s,x)=>s+x.amt,0);
    let exp=(o.tasks||[]).reduce((s,t)=>s+t.cost,0);
    let paid=(o.tasks||[]).reduce((s,t)=>s+(t.payouts||[]).reduce((p,x)=>p+x.amt,0),0);

    totalRev+=o.price;
    totalExp+=exp;
    totalRecd+=recd;
    totalPaid+=paid;

    let pending=o.price-recd;
    let statusClass=pending<=0?'status-green':'status-orange';
    let statusText=pending<=0?'✔ Paid':`⏳ ₹${pending} Left`;

    html += `
    <div class="order-card" onclick="openDetail(${o.id})">
      <div class="oc-top">
        <span>${o.client}</span>
        <span style="color:${pending<=0?'green':'orange'}">₹${o.price}</span>
      </div>
      <div class="oc-mid">
        <span>${o.work||''}</span>
        <span>Exp: ₹${exp}</span>
      </div>
      <div class="oc-bot">
        <span>${o.date||''}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
    </div>`;
  });

  document.getElementById('orders-list').innerHTML =
    html || '<div style="text-align:center;color:#aaa;margin-top:20px;">No Orders Yet</div>';

  document.getElementById('st-orders').innerText = db.orders.length;
  document.getElementById('st-profit').innerText = money(totalRev-totalExp);
  document.getElementById('st-rev').innerText = money(totalRev);
  document.getElementById('st-hand').innerText = money(totalRecd-totalPaid);
}

// ---------- NEW ORDER ----------
function openNewOrder(){
  document.getElementById('new-client').value='';
  document.getElementById('new-work').value='';
  document.getElementById('new-price').value='';
  document.getElementById('new-date').valueAsDate=new Date();
  document.getElementById('modal-new').style.display='block';
}

function createOrder(){
  let client=document.getElementById('new-client').value.trim();
  let price=Number(document.getElementById('new-price').value);
  if(!client || !price) return alert("Client Name & Price Required");

  db.orders.push({
    id: Date.now(),
    client,
    work: document.getElementById('new-work').value.trim(),
    price,
    date: (document.getElementById('new-date').value||'').split('-').reverse().join('/'),
    income: [],
    tasks: []
  });
  saveDB();
  closeModal('modal-new');
}

// ---------- DETAIL (python style) ----------
function openDetail(id){
  currentId = id;

  fillOrderDropdown();
  document.getElementById("orderSelect").value = String(id);

  fillTeamDropdown();
  fillCategoryDropdown();

  renderDetail();
  switchTab('income');
  document.getElementById('modal-detail').style.display='block';
}

function fillOrderDropdown(){
  const sel = document.getElementById("orderSelect");
  sel.innerHTML = "";
  let sorted = [...db.orders].sort((a,b)=>b.id-a.id);

  sorted.forEach(o=>{
    const opt=document.createElement("option");
    opt.value = String(o.id);
    opt.text = `${o.client} - ₹${o.price}`;
    sel.add(opt);
  });
}

function onOrderSelectChange(){
  const id = Number(document.getElementById("orderSelect").value);
  currentId = id;
  fillTeamDropdown();
  fillCategoryDropdown();
  renderDetail();
}

function fillTeamDropdown(){
  let selA=document.getElementById('task-artist');
  selA.innerHTML='';
  db.team.forEach(t=>{
    let opt=document.createElement('option');
    opt.value=t;
    opt.text=t;
    selA.add(opt);
  });
}

function fillCategoryDropdown(){
  let sel=document.getElementById('task-type');
  sel.innerHTML='';
  (db.categories||[]).forEach(c=>{
    let opt=document.createElement('option');
    opt.value=c;
    opt.text=c;
    sel.add(opt);
  });
  if(!db.categories || db.categories.length===0){
    db.categories=['Other'];
    saveDB();
  }
}

function switchTab(tab){
  document.getElementById("tab-income").style.display = tab==='income' ? 'block':'none';
  document.getElementById("tab-expense").style.display = tab==='expense' ? 'block':'none';
  document.getElementById("tab-summary").style.display = tab==='summary' ? 'block':'none';
}

function renderDetail(){
  let o=db.orders.find(x=>x.id===currentId);
  if(!o) return closeModal('modal-detail');

  document.getElementById('d-client').innerText=o.client;
  document.getElementById('d-work').innerText=o.work||'-';
  document.getElementById('d-date').innerText=o.date||'-';

  let recd=(o.income||[]).reduce((s,x)=>s+x.amt,0);
  let pending=o.price-recd;
  document.getElementById('d-pending').innerText = pending<=0 ? "Full Paid" : `Pending: ₹${pending}`;

  // income list
  let incHtml='';
  (o.income||[]).forEach((inc,idx)=>{
    incHtml += `<div class="list-item"><span>${inc.date}</span><b>+ ₹${inc.amt}</b>
      <span class="del-x" onclick="delInc(${idx})">×</span></div>`;
  });
  document.getElementById('list-income').innerHTML=incHtml;

  // tasks list
  let expHtml='';
  let totalPaidOut=0;

  (o.tasks||[]).forEach((t,tIdx)=>{
    let paid=(t.payouts||[]).reduce((s,x)=>s+x.amt,0);
    totalPaidOut += paid;
    let due=t.cost-paid;

    // dropdown history like python (inside each task)
    let payHist = '';
    (t.payouts||[]).forEach((p,pIdx)=>{
      payHist += `<div class="list-item" style="color:#666;font-size:11px;padding-left:10px;">
        • ${p.date}: ₹${p.amt} <span class="del-x" onclick="delTaskPay(${tIdx},${pIdx})">×</span></div>`;
    });

    expHtml += `
    <details style="background:#f9f9f9;border:1px solid #eee;padding:10px;border-radius:12px;margin-bottom:10px;">
      <summary style="cursor:pointer;font-weight:800;">
        ${t.type} (${t.artist}) — Cost ₹${t.cost} — <span style="color:${due<=0?'green':'red'}">${due<=0?'Paid':'Due ₹'+due}</span>
        <span class="del-x" onclick="event.preventDefault();delTask(${tIdx})" style="color:red;float:right;">×</span>
      </summary>

      <div style="margin-top:8px;">
        ${payHist}
        <div class="row-inputs" style="margin-top:8px;">
          <input type="number" id="t-pay-${tIdx}" placeholder="Amt" style="margin:0;padding:6px;font-size:13px;">
          <button class="btn btn-blue btn-sm" onclick="payTask(${tIdx})">Pay</button>
        </div>
      </div>
    </details>`;
  });

  document.getElementById('list-tasks').innerHTML=expHtml;

  document.getElementById('d-recd').innerText=money(recd);
  document.getElementById('d-paid').innerText=money(totalPaidOut);
  document.getElementById('d-hand').innerText=money(recd-totalPaidOut);

  // SUMMARY tab history
  document.getElementById("hist-income").innerHTML = incHtml || "<div style='color:#999;'>No income history</div>";
  document.getElementById("hist-expense").innerHTML = expHtml || "<div style='color:#999;'>No expense history</div>";
}

// ---------- INCOME ----------
function addIncome(){
  let amt=Number(document.getElementById('pay-in-amt').value);
  if(!amt) return;
  let o=db.orders.find(x=>x.id===currentId);
  (o.income ||= []).push({amt,date:new Date().toLocaleDateString('en-GB')});
  document.getElementById('pay-in-amt').value='';
  saveDB();
}
function delInc(idx){
  if(!confirm("Delete entry?")) return;
  let o=db.orders.find(x=>x.id===currentId);
  o.income.splice(idx,1);
  saveDB();
}

// ---------- TASKS ----------
function addTask(){
  let type=document.getElementById('task-type').value;
  let artist=document.getElementById('task-artist').value;
  let cost=Number(document.getElementById('task-cost').value);
  if(!cost) return alert("Enter Cost");

  let o=db.orders.find(x=>x.id===currentId);
  (o.tasks ||= []).push({ type, artist, cost, payouts: [] });

  document.getElementById('task-cost').value='';
  saveDB();
}
function payTask(tIdx){
  let amt=Number(document.getElementById(`t-pay-${tIdx}`).value);
  if(!amt) return;
  let o=db.orders.find(x=>x.id===currentId);
  o.tasks[tIdx].payouts.push({amt,date:new Date().toLocaleDateString('en-GB')});
  saveDB();
}
function delTask(tIdx){
  if(!confirm("Delete Task?")) return;
  let o=db.orders.find(x=>x.id===currentId);
  o.tasks.splice(tIdx,1);
  saveDB();
}
function delTaskPay(tIdx,pIdx){
  if(!confirm("Delete Payment?")) return;
  let o=db.orders.find(x=>x.id===currentId);
  o.tasks[tIdx].payouts.splice(pIdx,1);
  saveDB();
}

// ---------- AUTO SETTLE / DELETE ----------
function markDone(){
  if(!confirm("Auto-Settle Everything?")) return;
  let o=db.orders.find(x=>x.id===currentId);
  let today=new Date().toLocaleDateString('en-GB')+" (Auto)";

  let recd=(o.income||[]).reduce((s,x)=>s+x.amt,0);
  if(o.price>recd){
    (o.income ||= []).push({amt:o.price-recd, date:today});
  }

  (o.tasks||[]).forEach(t=>{
    let paid=(t.payouts||[]).reduce((s,x)=>s+x.amt,0);
    if(t.cost>paid){
      (t.payouts ||= []).push({amt:t.cost-paid, date:today});
    }
  });

  saveDB();
}

function deleteOrder(){
  if(!confirm("Delete entire order?")) return;
  db.orders=db.orders.filter(x=>x.id!==currentId);
  currentId = db.orders.length ? db.orders[0].id : null;
  saveDB();
  closeModal('modal-detail');
}

// ---------- TEAM MANAGER ----------
function openTeamMgr(){
  let html='';
  db.team.forEach((t,i)=>{
    if(t!=='Self'){
      html += `<div class="list-item"><span>${t}</span>
        <span class="del-x" onclick="delTeam(${i})">×</span></div>`;
    }
  });
  document.getElementById('list-team').innerHTML=html;
  document.getElementById('overlay-team').style.display='flex';
}
function addTeam(){
  let nm=document.getElementById('team-new').value.trim();
  if(nm && !db.team.includes(nm)){
    db.team.push(nm);
    document.getElementById('team-new').value='';
    saveDB();
    openTeamMgr();
  }
}
function delTeam(i){
  db.team.splice(i,1);
  saveDB();
  openTeamMgr();
}

// ---------- CATEGORY MANAGER ----------
function openCategoryMgr(){
  let html='';
  (db.categories||[]).forEach((c,i)=>{
    html += `<div class="list-item"><span>${c}</span>
      <span class="del-x" onclick="delCategory(${i})">×</span></div>`;
  });
  document.getElementById('list-cat').innerHTML=html;
  document.getElementById('overlay-cat').style.display='flex';
}
function addCategory(){
  let nm=document.getElementById('cat-new').value.trim();
  if(!nm) return;
  db.categories ||= [];
  if(!db.categories.includes(nm)){
    db.categories.push(nm);
    document.getElementById('cat-new').value='';
    saveDB();
    openCategoryMgr();
    fillCategoryDropdown();
  }
}
function delCategory(i){
  if(!confirm("Remove category?")) return;
  db.categories.splice(i,1);
  if(db.categories.length===0) db.categories.push("Other");
  saveDB();
  openCategoryMgr();
  fillCategoryDropdown();
}

// ---------- LOCAL BACKUP ----------
function backupData(){
  let dataStr="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(db));
  let node=document.createElement('a');
  node.setAttribute("href",dataStr);
  node.setAttribute("download","Tatva_Pro_Backup.json");
  document.body.appendChild(node);
  node.click();
  node.remove();
}
function restoreData(input){
  let file=input.files[0];
  let reader=new FileReader();
  reader.onload=function(e){
    db=JSON.parse(e.target.result);
    db.team ||= ['Self'];
    db.categories ||= ['Model','Print','Color','Material','Other'];
    saveDB();
    alert("Data Restored!");
  };
  reader.readAsText(file);
}

// Init
renderHome();

// ---------- DRIVE SYNC SUPPORT ----------
window.collectAppBackupData=function(){
  return { app:"TatvaPro", version:3, ts:Date.now(), db:db };
};
window.applyBackupObject=function(backup){
  if(backup && backup.db){
    window.__isRestoring=true;
    db=backup.db;
    db.team ||= ['Self'];
    db.categories ||= ['Model','Print','Color','Material','Other'];
    localStorage.setItem('tatva_pro_db', JSON.stringify(db));
    localStorage.setItem("LOCAL_LAST_TS", String(backup.ts || Date.now()));
    renderHome();
    if(currentId) renderDetail();
    setTimeout(()=>{ window.__isRestoring=false; },1200);
  }
};

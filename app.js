/*************************************************
 * Tatva Pro - Full Addons (PASTE at END of app.js)
 * ✅ Lock app without Drive Login
 * ✅ collectAppBackupData() for Drive backups
 * ✅ Auto update Drive UI + lock/unlock
 * ✅ Auto Cloud Backup on EVERY data change (no need to edit functions)
 * ✅ Daily backup (9:00 PM)
 *************************************************/

// =============================
// Backup data collector
// =============================
function collectAppBackupData(){
  const obj = {};
  for(let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    obj[k] = localStorage.getItem(k);
  }
  return { type:"tatva_backup", version:1, ts:Date.now(), data: obj };
}
window.collectAppBackupData = collectAppBackupData;


// =============================
// Drive Login Lock Overlay
// =============================
window.lockAppUI = function(isLocked){
  let lock = document.getElementById("driveLock");

  if(!lock){
    lock = document.createElement("div");
    lock.id = "driveLock";
    lock.style.position = "fixed";
    lock.style.inset = "0";
    lock.style.background = "rgba(0,0,0,0.88)";
    lock.style.zIndex = "999999";
    lock.style.display = "none";
    lock.style.alignItems = "center";
    lock.style.justifyContent = "center";
    lock.style.textAlign = "center";
    lock.style.padding = "18px";
    lock.style.color = "#fff";

    lock.innerHTML = `
      <div style="max-width:520px;width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:18px;padding:22px;">
        <h2 style="margin:0 0 10px;">🔒 Login Required</h2>
        <p style="margin:0 0 18px;opacity:.9;line-height:1.4;">
          Tatva Pro use karva mate Google Drive login compulsory che.
        </p>
        <button style="padding:10px 18px;font-size:16px;border-radius:12px;border:none;cursor:pointer;"
                onclick="driveLogin && driveLogin()">
          🔐 Drive Login
        </button>
        <p style="margin:16px 0 0;opacity:.75;font-size:12px;">
          1 vaar login pachi varam-var login karvu nahi pade.
        </p>
      </div>
    `;

    document.body.appendChild(lock);
  }

  lock.style.display = isLocked ? "flex" : "none";
};


// =============================
// Enforce Drive Login (Lock/Unlock)
// =============================
window.enforceDriveLogin = function(){
  try{
    if(!window.__requireDriveLogin) return;
    if(!window.__driveConnected){
      window.lockAppUI(true);
    }else{
      window.lockAppUI(false);
    }
  }catch(e){}
};


// =============================
// STEP 3: Auto update Drive status UI + enforce lock
// =============================
(function(){
  function refreshDriveUI(){
    if (window.updateDriveStatusUI) window.updateDriveStatusUI();
    if (window.enforceDriveLogin) window.enforceDriveLogin();
  }

  // run on load
  setTimeout(refreshDriveUI, 1200);

  // run when app becomes visible
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshDriveUI();
  });

  // keep UI fresh
  setInterval(refreshDriveUI, 15000);
})();


// =============================
// Daily Auto Backup (default 9:00 PM)
// =============================
(function dailyAutoBackup(){
  const hour = 21, minute = 0;
  setInterval(()=>{
    try{
      if(!window.__driveConnected) return;

      const now = new Date();
      const today = now.toISOString().slice(0,10);
      const last = localStorage.getItem("LAST_DAILY_BACKUP") || "";

      if(now.getHours()===hour && now.getMinutes()===minute && last!==today){
        if(window.scheduleAutoBackup) window.scheduleAutoBackup(1000);
        localStorage.setItem("LAST_DAILY_BACKUP", today);
      }
    }catch(e){}
  }, 30000);
})();


// =============================
// STEP 4: Auto Backup Hook (NO NEED to edit your functions)
// Auto-backup when localStorage changes (setItem/removeItem/clear)
// =============================
(function(){
  const enabledKey = "AUTO_BACKUP_ENABLED";
  if (localStorage.getItem(enabledKey) === null) {
    localStorage.setItem(enabledKey, "true"); // default ON
  }

  const ignoreKeys = new Set([
    "DRIVE_ACCESS_TOKEN",
    "DRIVE_USER_EMAIL",
    "DRIVE_CONNECTED",
    "LAST_AUTO_BACKUP_TS",
    "LAST_DAILY_BACKUP",
    "AUTO_BACKUP_ENABLED"
  ]);

  // Patch localStorage.setItem
  const _setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value){
    const res = _setItem(key, value);

    try{
      const enabled = localStorage.getItem(enabledKey) !== "false";
      if(enabled && !ignoreKeys.has(key)){
        if(window.scheduleAutoBackup) window.scheduleAutoBackup(8000);
      }
    }catch(e){}

    return res;
  };

  // Patch localStorage.removeItem
  const _removeItem = localStorage.removeItem.bind(localStorage);
  localStorage.removeItem = function(key){
    const res = _removeItem(key);

    try{
      const enabled = localStorage.getItem(enabledKey) !== "false";
      if(enabled && !ignoreKeys.has(key)){
        if(window.scheduleAutoBackup) window.scheduleAutoBackup(8000);
      }
    }catch(e){}

    return res;
  };

  // Patch localStorage.clear
  const _clear = localStorage.clear.bind(localStorage);
  localStorage.clear = function(){
    const res = _clear();
    try{
      const enabled = localStorage.getItem(enabledKey) !== "false";
      if(enabled){
        if(window.scheduleAutoBackup) window.scheduleAutoBackup(12000);
      }
    }catch(e){}
    return res;
  };

  console.log("✅ Auto Backup hook enabled");
})();

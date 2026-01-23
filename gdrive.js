/*************************************************
 * Tatva Pro - Google Drive (gdrive.js)
 * ✅ LOCKED + STABLE AUTO SYNC VERSION
 *
 * Fixes:
 * ✅ Backup failed (concurrent calls problem solved)
 * ✅ PC ↔ Phone sync stable
 *************************************************/

const CLIENT_ID =
  "945495636870-9uljt6291qui5sjskpnojqqtu1hs9o2g.apps.googleusercontent.com";

const API_KEY =
  "AIzaSyBmk0MvlOyzLMBJHtOpuLRz1izmcZQr7x0";

const BACKUP_FILE_NAME = "TatvaPro_Backup.json";

// ---- globals ----
window.__driveConnected = false;
window.__driveUserEmail = "";
window.__driveAccessToken = "";

// ✅ LOCKS (MAIN FIX)
let __backupLock = false;
let __syncLock = false;

// device detect
const __isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// timings
const AUTO_BACKUP_DELAY_MS = __isMobile ? 9000 : 4000; // stable
const AUTO_SYNC_INTERVAL_MS = __isMobile ? 12000 : 8000;

// --------------------------------------
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=src; s.async=true;
    s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
}
async function ensureGapi(){
  if(!window.gapi) await loadScript("https://apis.google.com/js/api.js");
  return new Promise(res=>gapi.load("client",res));
}
async function ensureGIS(){
  if(!window.google || !window.google.accounts)
    await loadScript("https://accounts.google.com/gsi/client");
}
async function initDriveClient(){
  await ensureGapi();
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs:["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });
}
function setDriveStatus(txt){
  const el=document.getElementById("driveStatus");
  if(el) el.innerText=txt;
}
window.updateDriveStatusUI = function(){
  if(window.__driveConnected){
    const em = window.__driveUserEmail ? ` (${window.__driveUserEmail})` : "";
    setDriveStatus("Drive: Connected" + em);
  }else{
    setDriveStatus("Drive: Not connected");
  }
};

// restore session
(function(){
  try{
    const token = localStorage.getItem("DRIVE_ACCESS_TOKEN") || "";
    const email = localStorage.getItem("DRIVE_USER_EMAIL") || "";
    const ok    = localStorage.getItem("DRIVE_CONNECTED") === "1";
    if(ok && token){
      window.__driveAccessToken = token;
      window.__driveUserEmail = email;
      window.__driveConnected = true;
      console.log("✅ Drive session restored");
    }
  }catch(e){}
  setTimeout(()=>window.updateDriveStatusUI && window.updateDriveStatusUI(),500);
})();

async function ensureDriveReady(){
  await initDriveClient();
  if(window.__driveAccessToken){
    gapi.client.setToken({access_token:window.__driveAccessToken});
  }
}

// list file
async function findBackupFileId(){
  const q = `name='${BACKUP_FILE_NAME}' and trashed=false`;
  const res = await gapi.client.drive.files.list({
    q, fields:"files(id,name)", spaces:"drive"
  });
  const files = res.result.files || [];
  return files.length ? files[0].id : null;
}

// upload helper
async function createBackupFile(contentStr){
  const boundary="-------314159265358979323846";
  const delimiter="\r\n--"+boundary+"\r\n";
  const closeDelim="\r\n--"+boundary+"--";

  const metadata={name:BACKUP_FILE_NAME,mimeType:"application/json"};

  const body=
    delimiter+"Content-Type: application/json\r\n\r\n"+JSON.stringify(metadata)+
    delimiter+"Content-Type: application/json\r\n\r\n"+contentStr+
    closeDelim;

  const request=gapi.client.request({
    path:"/upload/drive/v3/files",
    method:"POST",
    params:{uploadType:"multipart"},
    headers:{"Content-Type":`multipart/related; boundary="${boundary}"`},
    body
  });
  const res=await request;
  return res.result.id;
}
async function updateBackupFile(fileId, contentStr){
  const boundary="-------314159265358979323846";
  const delimiter="\r\n--"+boundary+"\r\n";
  const closeDelim="\r\n--"+boundary+"--";

  const metadata={mimeType:"application/json"};

  const body=
    delimiter+"Content-Type: application/json\r\n\r\n"+JSON.stringify(metadata)+
    delimiter+"Content-Type: application/json\r\n\r\n"+contentStr+
    closeDelim;

  const request=gapi.client.request({
    path:"/upload/drive/v3/files/"+fileId,
    method:"PATCH",
    params:{uploadType:"multipart"},
    headers:{"Content-Type":`multipart/related; boundary="${boundary}"`},
    body
  });
  const res=await request;
  return res.result.id;
}

// --------------------------------------
// DRIVE LOGIN
window.driveLogin = async function(forcePrompt=false){
  try{
    await initDriveClient();
    await ensureGIS();

    // If we already have a valid token, just mark connected and return.
    const savedToken = localStorage.getItem("DRIVE_ACCESS_TOKEN");
    if(savedToken && !forcePrompt){
      window.__driveAccessToken = savedToken;
      window.__driveConnected = true;
      gapi.client.setToken({access_token:savedToken});
      try{
        const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers:{Authorization:"Bearer "+savedToken}
        }).then(r=>r.json());
        if(me && me.email){
          window.__driveUserEmail = me.email;
          localStorage.setItem("DRIVE_USER_EMAIL", me.email);
          localStorage.setItem("DRIVE_CONNECTED", "1");
          window.refreshBusinessSelector && window.refreshBusinessSelector();
        }
      }catch(e){}
      return true;
    }

    const promptMode = forcePrompt || !savedToken ? "consent" : "";

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      callback: async (resp)=>{
        if(!resp || !resp.access_token){
          alert("❌ Drive login failed"); 
          return;
        }
        const token = resp.access_token;
        window.__driveAccessToken = token;
        window.__driveConnected = true;

        localStorage.setItem("DRIVE_ACCESS_TOKEN", token);
        localStorage.setItem("DRIVE_CONNECTED", "1");

        gapi.client.setToken({access_token:token});

        try{
          const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers:{Authorization:"Bearer "+token}
          }).then(r=>r.json());
          if(me && me.email){
            window.__driveUserEmail = me.email;
            localStorage.setItem("DRIVE_USER_EMAIL", me.email);
          }
        }catch(e){
          console.warn("userinfo fetch failed", e);
        }

        // Update UI
        try{ window.refreshBusinessSelector && window.refreshBusinessSelector(); }catch(e){}
        alert("✅ Drive Connected: "+(window.__driveUserEmail||""));
      }
    });

    // Request token (this will open popup)
    tokenClient.requestAccessToken({prompt: promptMode});
    return true;

  }catch(err){
    console.error(err);
    alert("❌ Drive login error. Please allow popups & try again.");
    return false;
  }
};

// Optional logout
window.driveLogout = function(){
  localStorage.removeItem("DRIVE_ACCESS_TOKEN");
  localStorage.removeItem("DRIVE_CONNECTED");
  localStorage.removeItem("DRIVE_USER_EMAIL");
  window.__driveAccessToken = null;
  window.__driveConnected = false;
  window.__driveUserEmail = "";
  try{ gapi.client.setToken(null); }catch(e){}
  alert("✅ Drive disconnected");
};

// --------------------------------------
// BACKUP (LOCKED)
window.backupToDrive = async function(dataObj){
  if(!window.__driveConnected){ alert("❌ Drive Login first"); return false; }

  // ✅ LOCK
  if(__backupLock){
    console.log("⏳ Backup skipped (already running)");
    return false;
  }

  __backupLock = true;

  try{
    await ensureDriveReady();

    const contentStr = JSON.stringify(dataObj,null,2);
    const existingId = await findBackupFileId();

    if(existingId) await updateBackupFile(existingId, contentStr);
    else await createBackupFile(contentStr);

    localStorage.setItem("LAST_AUTO_BACKUP_TS", String(Date.now()));
    console.log("✅ Backup success");
    return true;

  }catch(err){
    console.error("❌ Backup failed error:", err);
    alert("❌ Backup failed");
    return false;
  }finally{
    __backupLock = false;
  }
};

// --------------------------------------
// RESTORE
window.restoreFromDrive = async function(){
  if(!window.__driveConnected){ alert("❌ Drive Login first"); return; }

  try{
    await ensureDriveReady();
    const fileId = await findBackupFileId();
    if(!fileId){ alert("❌ No backup found"); return; }

    const res = await gapi.client.drive.files.get({ fileId, alt:"media" });
    const backup = (typeof res.body==="string") ? JSON.parse(res.body) : res.result;

    if(window.applyBackupObject){
      window.applyBackupObject(backup);
      alert("✅ Restore done");
    }else{
      alert("❌ applyBackupObject missing");
    }
  }catch(err){
    console.error(err);
    alert("❌ Restore failed");
  }
};

// --------------------------------------
// AUTO BACKUP (LOCKED)
let __autoBackupTimer = null;
window.scheduleAutoBackup = function(delayMs=AUTO_BACKUP_DELAY_MS){
  try{
    if(!window.__driveConnected) return;
    clearTimeout(__autoBackupTimer);

    __autoBackupTimer = setTimeout(async ()=>{
      try{
        if(typeof collectAppBackupData!=="function") return;
        const obj = collectAppBackupData();
        await window.backupToDrive(obj);
      }catch(e){
        console.warn("Auto backup failed:", e);
      }
    }, delayMs);

  }catch(e){}
};

// --------------------------------------
// AUTO SYNC (LOCKED)
window.autoSyncFromDrive = async function(){
  if(!window.__driveConnected) return;
  if(__syncLock) return;

  __syncLock = true;

  try{
    await ensureDriveReady();
    const fileId = await findBackupFileId();
    if(!fileId) return;

    const res = await gapi.client.drive.files.get({ fileId, alt:"media" });
    const backup = (typeof res.body==="string") ? JSON.parse(res.body) : res.result;

    const driveTs = Number(backup.ts || 0);
    const localTs = Number(localStorage.getItem("LOCAL_LAST_TS") || "0");

    if(driveTs > localTs && window.applyBackupObject){
      console.log("✅ Sync restore newer backup");
      window.applyBackupObject(backup);
      localStorage.setItem("LOCAL_LAST_TS", String(driveTs));
    }
  }catch(e){
    console.warn("AutoSync failed:", e);
  }finally{
    __syncLock = false;
  }
};

// once on open
setTimeout(()=>window.autoSyncFromDrive && window.autoSyncFromDrive(), 2500);

// loop sync
setInterval(()=>window.autoSyncFromDrive && window.autoSyncFromDrive(), AUTO_SYNC_INTERVAL_MS);

console.log("✅ gdrive.js LOCKED stable loaded");

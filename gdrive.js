/*************************************************
 * Tatva Pro - Google Drive (gdrive.js) ✅ FINAL SYNC VERSION
 * Features:
 * ✅ Drive Login (remember login)
 * ✅ Backup / Restore
 * ✅ Auto Backup (scheduleAutoBackup)
 * ✅ AUTO SYNC PC ↔ PHONE (Auto restore latest when app opens)
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
window.__requireDriveLogin = false; // app already works, optional lock

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
  if(!window.google || !window.google.accounts) await loadScript("https://accounts.google.com/gsi/client");
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

// ---- restore session ----
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
  setTimeout(()=>window.updateDriveStatusUI && window.updateDriveStatusUI(),800);
})();

// ---- ensure drive ready ----
async function ensureDriveReady(){
  await initDriveClient();
  if(window.__driveAccessToken){
    gapi.client.setToken({access_token:window.__driveAccessToken});
  }
}

async function findBackupFileId(){
  const q = `name='${BACKUP_FILE_NAME}' and trashed=false`;
  const res = await gapi.client.drive.files.list({
    q, fields:"files(id,name)", spaces:"drive"
  });
  const files = res.result.files || [];
  return files.length ? files[0].id : null;
}

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

// ---- Drive Login ----
window.driveLogin = async function(){
  try{
    await initDriveClient();
    await ensureGIS();

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      callback: async (resp)=>{
        if(!resp || !resp.access_token){
          alert("❌ Drive login failed"); return;
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
          window.__driveUserEmail = me.email || "";
          localStorage.setItem("DRIVE_USER_EMAIL", window.__driveUserEmail);
        }catch(e){}

        alert("✅ Drive Login successful");
        window.updateDriveStatusUI && window.updateDriveStatusUI();

        // ✅ auto sync latest from Drive after login
        setTimeout(()=>window.autoSyncFromDrive && window.autoSyncFromDrive(), 1200);
      }
    });

    tokenClient.requestAccessToken({prompt:""});
  }catch(err){
    console.error(err);
    alert("❌ Drive Login error (OAuth origins / keys check)");
  }
};

// ---- Logout ----
window.driveLogout = function(){
  window.__driveConnected=false;
  window.__driveAccessToken="";
  window.__driveUserEmail="";
  localStorage.removeItem("DRIVE_ACCESS_TOKEN");
  localStorage.removeItem("DRIVE_USER_EMAIL");
  localStorage.removeItem("DRIVE_CONNECTED");
  try{ gapi.client.setToken(null); }catch(e){}
  window.updateDriveStatusUI && window.updateDriveStatusUI();
  alert("✅ Logged out");
};

// ---- Backup ----
window.backupToDrive = async function(dataObj){
  if(!window.__driveConnected){ alert("❌ Drive Login first"); return false; }
  try{
    await ensureDriveReady();
    const contentStr = JSON.stringify(dataObj,null,2);
    const existingId = await findBackupFileId();
    if(existingId) await updateBackupFile(existingId, contentStr);
    else await createBackupFile(contentStr);

    localStorage.setItem("LAST_AUTO_BACKUP_TS", String(Date.now()));
    window.updateDriveStatusUI && window.updateDriveStatusUI();
    return true;
  }catch(err){
    console.error(err);
    alert("❌ Backup failed");
    return false;
  }
};

// ---- Restore ----
window.restoreFromDrive = async function(){
  if(!window.__driveConnected){ alert("❌ Drive Login first"); return; }
  try{
    await ensureDriveReady();
    const fileId = await findBackupFileId();
    if(!fileId){ alert("❌ No backup found"); return; }

    const res = await gapi.client.drive.files.get({ fileId, alt:"media" });
    const backup = (typeof res.body==="string") ? JSON.parse(res.body) : res.result;
    if(!backup){ alert("❌ Invalid backup"); return; }

    // ✅ apply using app.js helper
    if(window.applyBackupObject){
      window.applyBackupObject(backup);
      alert("✅ Restore done");
    }else{
      alert("❌ applyBackupObject missing in app.js");
    }
  }catch(err){
    console.error(err);
    alert("❌ Restore failed");
  }
};

// ---- AUTO BACKUP ----
let __autoBackupTimer = null;
window.scheduleAutoBackup = function(delayMs=8000){
  try{
    if(!window.__driveConnected) return;
    clearTimeout(__autoBackupTimer);
    __autoBackupTimer = setTimeout(async ()=>{
      try{
        if(typeof collectAppBackupData!=="function") return;
        const obj = collectAppBackupData();
        await window.backupToDrive(obj);
        console.log("✅ Auto backup done");
      }catch(e){
        console.warn("Auto backup failed:", e);
      }
    }, delayMs);
  }catch(e){}
};

// ---- AUTO SYNC PC ↔ PHONE ----
// When app opens, if Drive has newer backup -> auto restore
window.autoSyncFromDrive = async function(){
  try{
    if(!window.__driveConnected) return;
    await ensureDriveReady();

    const fileId = await findBackupFileId();
    if(!fileId) return;

    const res = await gapi.client.drive.files.get({ fileId, alt:"media" });
    const backup = (typeof res.body==="string") ? JSON.parse(res.body) : res.result;
    if(!backup) return;

    const driveTs = Number(backup.ts || 0);
    const localTs = Number(localStorage.getItem("LOCAL_LAST_TS") || "0");

    // ✅ only restore if Drive is newer
    if(driveTs > localTs && window.applyBackupObject){
      console.log("✅ Auto Sync: restoring newer data from Drive");
      window.applyBackupObject(backup);
      localStorage.setItem("LOCAL_LAST_TS", String(driveTs));
    }
  }catch(e){
    console.warn("AutoSync failed:", e);
  }
};

// Auto sync when app opens (if already logged in)
setTimeout(()=>window.autoSyncFromDrive && window.autoSyncFromDrive(), 2500);

console.log("✅ gdrive.js FINAL SYNC loaded");

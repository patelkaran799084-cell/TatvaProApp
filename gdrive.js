/*************************************************
 * Tatva Pro - Google Drive (gdrive.js)
 * Features:
 * ✅ Drive Login
 * ✅ Backup / Restore
 * ✅ Remember Login (persistent session)
 * ✅ Logout button support
 * ✅ Auto Cloud Backup (every change, debounced)
 *************************************************/

// =============================
// SET YOUR KEYS
// =============================
const CLIENT_ID = "945495636870-9uljt6291qui5sjskpnojqqtu1hs9o2g.apps.googleusercontent.com";
const API_KEY   = "AIzaSyBmk0MvlOyzLMBJHtOpuLRz1izmcZQr7x0";

// Backup file name in Drive
const BACKUP_FILE_NAME = "TatvaPro_Backup.json";

// =============================
// Drive Session State
// =============================
window.__driveConnected   = false;
window.__driveUserEmail   = "";
window.__driveAccessToken = "";

// Require login to use app
window.__requireDriveLogin = true;

// =============================
// Restore session (persistent login)
// =============================
(function restoreDriveSession(){
  try{
    const token = localStorage.getItem("DRIVE_ACCESS_TOKEN") || "";
    const email = localStorage.getItem("DRIVE_USER_EMAIL") || "";
    const ok    = localStorage.getItem("DRIVE_CONNECTED") === "1";
    if(ok && token){
      window.__driveAccessToken = token;
      window.__driveConnected   = true;
      window.__driveUserEmail   = email;
      console.log("✅ Drive session restored");
      if(window.enforceDriveLogin) setTimeout(()=>window.enforceDriveLogin(), 300);
    }
  }catch(e){}
})();

// =============================
// Google APIs Loader
// =============================
function loadScript(src){
  return new Promise((resolve, reject)=>{
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initGoogleClient(){
  // Load gapi
  if(!window.gapi){
    await loadScript("https://apis.google.com/js/api.js");
  }
  return new Promise((resolve)=>{
    gapi.load("client", async ()=>{
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      });
      resolve();
    });
  });
}

// =============================
// Google Identity Services
// =============================
async function initGIS(){
  if(!window.google || !window.google.accounts){
    await loadScript("https://accounts.google.com/gsi/client");
  }
}

function setDriveStatusUI(){
  const el = document.getElementById("driveStatus");
  if(!el) return;
  if(window.__driveConnected){
    const email = window.__driveUserEmail ? ` (${window.__driveUserEmail})` : "";
    const lastTs = localStorage.getItem("LAST_AUTO_BACKUP_TS");
    const last = lastTs ? new Date(parseInt(lastTs)).toLocaleString() : "";
    el.innerText = `Drive: Connected${email}${last ? " | Last Backup: " + last : ""}`;
  }else{
    el.innerText = "Drive: Not connected";
  }
}
window.updateDriveStatusUI = setDriveStatusUI;

// =============================
// Login
// =============================
window.driveLogin = async function driveLogin(){
  try{
    await initGoogleClient();
    await initGIS();

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      callback: async (resp) => {
        if(resp && resp.access_token){
          // Save session
          window.__driveAccessToken = resp.access_token;
          window.__driveConnected = true;

          localStorage.setItem("DRIVE_ACCESS_TOKEN", resp.access_token);
          localStorage.setItem("DRIVE_CONNECTED", "1");

          // Fetch email (optional)
          try{
            const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: "Bearer " + resp.access_token }
            }).then(r=>r.json());
            window.__driveUserEmail = me.email || "";
            localStorage.setItem("DRIVE_USER_EMAIL", window.__driveUserEmail);
          }catch(e){}

          // Set token for Drive API
          gapi.client.setToken({ access_token: resp.access_token });

          alert("✅ Drive Login successful");
          setDriveStatusUI();

          // Unlock app
          if(window.enforceDriveLogin) window.enforceDriveLogin();
        }else{
          alert("❌ Drive login failed");
        }
      }
    });

    tokenClient.requestAccessToken({ prompt: "" }); // silent if possible
  }catch(err){
    console.error(err);
    alert("❌ Drive Login error. Check CLIENT_ID/API_KEY and OAuth origins.");
  }
};

// =============================
// Logout
// =============================
window.driveLogout = function driveLogout(){
  window.__driveConnected = false;
  window.__driveUserEmail = "";
  window.__driveAccessToken = "";

  localStorage.removeItem("DRIVE_ACCESS_TOKEN");
  localStorage.removeItem("DRIVE_USER_EMAIL");
  localStorage.removeItem("DRIVE_CONNECTED");

  try{
    gapi.client.setToken(null);
  }catch(e){}

  alert("✅ Logged out");
  setDriveStatusUI();
  if(window.enforceDriveLogin) window.enforceDriveLogin();
};

// =============================
// Drive Helpers
// =============================
async function findBackupFileId(){
  const q = `name='${BACKUP_FILE_NAME}' and trashed=false`;
  const res = await gapi.client.drive.files.list({
    q,
    fields: "files(id,name)",
    spaces: "drive",
  });
  const files = res.result.files || [];
  return files.length ? files[0].id : null;
}

async function uploadNewFile(contentStr){
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: "application/json",
  };

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    contentStr +
    closeDelim;

  const request = gapi.client.request({
    path: "/upload/drive/v3/files",
    method: "POST",
    params: { uploadType: "multipart" },
    headers: { "Content-Type": 'multipart/related; boundary="' + boundary + '"' },
    body: multipartRequestBody,
  });

  const res = await request;
  return res.result.id;
}

async function updateExistingFile(fileId, contentStr){
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const metadata = { mimeType: "application/json" };

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    contentStr +
    closeDelim;

  const request = gapi.client.request({
    path: "/upload/drive/v3/files/" + fileId,
    method: "PATCH",
    params: { uploadType: "multipart" },
    headers: { "Content-Type": 'multipart/related; boundary="' + boundary + '"' },
    body: multipartRequestBody,
  });

  const res = await request;
  return res.result.id;
}

// =============================
// Backup / Restore
// =============================
window.backupToDrive = async function backupToDrive(dataObj){
  if(!window.__driveConnected) return alert("❌ Please Drive Login first.");

  try{
    // Ensure token set for gapi
    if(window.__driveAccessToken){
      gapi.client.setToken({ access_token: window.__driveAccessToken });
    }

    const contentStr = JSON.stringify(dataObj, null, 2);
    const existingId = await findBackupFileId();

    if(existingId){
      await updateExistingFile(existingId, contentStr);
    }else{
      await uploadNewFile(contentStr);
    }

    localStorage.setItem("LAST_AUTO_BACKUP_TS", String(Date.now()));
    setDriveStatusUI();
    return true;
  }catch(err){
    console.error(err);
    alert("❌ Backup failed. Try login again.");
    return false;
  }
};

window.restoreFromDrive = async function restoreFromDrive(){
  if(!window.__driveConnected) return alert("❌ Please Drive Login first.");

  try{
    if(window.__driveAccessToken){
      gapi.client.setToken({ access_token: window.__driveAccessToken });
    }

    const fileId = await findBackupFileId();
    if(!fileId) return alert("❌ No backup found in Drive.");

    const res = await gapi.client.drive.files.get({
      fileId,
      alt: "media",
    });

    const backup = (typeof res.body === "string") ? JSON.parse(res.body) : res.result;
    if(!backup) return alert("❌ Invalid backup file.");

    // apply backup
    if(backup.data && typeof backup.data === "object"){
      // Restore localStorage fully
      localStorage.clear();
      for(const k of Object.keys(backup.data)){
        localStorage.setItem(k, backup.data[k]);
      }
      alert("✅ Restore complete. Refreshing...");
      location.reload();
    }else{
      alert("❌ Backup format wrong.");
    }
  }catch(err){
    console.error(err);
    alert("❌ Restore failed.");
  }
};

// =============================
// Auto Backup (Every change)
// =============================
let __autoBackupTimer = null;
let __lastBackupHash  = "";

function simpleHash(str){
  let hash = 0;
  for(let i=0;i<str.length;i++){
    hash = ((hash<<5)-hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

window.scheduleAutoBackup = function scheduleAutoBackup(delayMs = 8000){
  try{
    if(!window.__driveConnected) return;
    const enabled = localStorage.getItem("AUTO_BACKUP_ENABLED") !== "false";
    if(!enabled) return;

    clearTimeout(__autoBackupTimer);
    __autoBackupTimer = setTimeout(async ()=>{
      try{
        if(typeof collectAppBackupData !== "function") return;

        const dataObj = collectAppBackupData();
        const json = JSON.stringify(dataObj);

        const h = simpleHash(json);
        if(h === __lastBackupHash) return;

        await window.backupToDrive(dataObj);
        __lastBackupHash = h;

        console.log("✅ Auto backup done");
      }catch(e){
        console.warn("Auto backup failed:", e);
      }
    }, delayMs);
  }catch(e){}
};

// initial UI status update
setTimeout(()=>setDriveStatusUI(), 800);

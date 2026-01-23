/*************************************************
 * Tatva OS Pro - gdrive.js (FINAL)
 * ✅ Drive login (email)
 * ✅ Auto sync between phone + pc
 * ✅ Auto backup on changes
 *************************************************/

const CLIENT_ID =
  "945495636870-9uljt6291qui5sjskpnojqqtu1hs9o2g.apps.googleusercontent.com";

const API_KEY =
  "AIzaSyBmk0MvlOyzLMBJHtOpuLRz1izmcZQr7x0";

let __backupLock = false;
let __syncLock = false;

window.__driveConnected = false;
window.__driveUserEmail = "";
window.__driveAccessToken = "";

// detect device
const __isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// faster sync
const AUTO_BACKUP_DELAY_MS = __isMobile ? 6000 : 2500;
const AUTO_SYNC_INTERVAL_MS = __isMobile ? 8000 : 5000;

function getBackupFileName() {
  return (window.getActiveDriveBackupFileName && window.getActiveDriveBackupFileName()) || "TatvaPro_Backup.json";
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureGapi() {
  if (!window.gapi) await loadScript("https://apis.google.com/js/api.js");
  return new Promise(res => gapi.load("client", res));
}

async function ensureGIS() {
  if (!window.google || !window.google.accounts)
    await loadScript("https://accounts.google.com/gsi/client");
}

async function initDriveClient() {
  await ensureGapi();
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });
}

function setDriveStatus(txt) {
  const el = document.getElementById("driveStatus");
  if (el) el.innerText = txt;
}

window.updateDriveStatusUI = function () {
  if (window.__driveConnected) {
    const em = window.__driveUserEmail ? ` (${window.__driveUserEmail})` : "";
    setDriveStatus("Drive: Connected" + em);
  } else {
    setDriveStatus("Drive: Not connected");
  }
};

// restore session
(function () {
  try {
    const token = localStorage.getItem("DRIVE_ACCESS_TOKEN") || "";
    const email = localStorage.getItem("DRIVE_USER_EMAIL") || "";
    const ok = localStorage.getItem("DRIVE_CONNECTED") === "1";
    if (ok && token) {
      window.__driveAccessToken = token;
      window.__driveUserEmail = email;
      window.__driveConnected = true;
    }
  } catch (e) {}
  setTimeout(() => window.updateDriveStatusUI && window.updateDriveStatusUI(), 500);
})();

async function ensureDriveReady() {
  await initDriveClient();
  if (window.__driveAccessToken) {
    gapi.client.setToken({ access_token: window.__driveAccessToken });
  }
}

// find file
async function findBackupFileId() {
  const name = getBackupFileName();
  const q = `name='${name}' and trashed=false`;
  const res = await gapi.client.drive.files.list({
    q, fields: "files(id,name)", spaces: "drive"
  });
  const files = res.result.files || [];
  return files.length ? files[0].id : null;
}

async function createBackupFile(contentStr) {
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const metadata = { name: getBackupFileName(), mimeType: "application/json" };

  const body =
    delimiter + "Content-Type: application/json\r\n\r\n" + JSON.stringify(metadata) +
    delimiter + "Content-Type: application/json\r\n\r\n" + contentStr +
    closeDelim;

  const request = gapi.client.request({
    path: "/upload/drive/v3/files",
    method: "POST",
    params: { uploadType: "multipart" },
    headers: { "Content-Type": `multipart/related; boundary="${boundary}"` },
    body
  });
  const res = await request;
  return res.result.id;
}

async function updateBackupFile(fileId, contentStr) {
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const metadata = { mimeType: "application/json" };

  const body =
    delimiter + "Content-Type: application/json\r\n\r\n" + JSON.stringify(metadata) +
    delimiter + "Content-Type: application/json\r\n\r\n" + contentStr +
    closeDelim;

  const request = gapi.client.request({
    path: "/upload/drive/v3/files/" + fileId,
    method: "PATCH",
    params: { uploadType: "multipart" },
    headers: { "Content-Type": `multipart/related; boundary="${boundary}"` },
    body
  });
  const res = await request;
  return res.result.id;
}

// DRIVE LOGIN
window.driveLogin = async function () {
  try {
    await initDriveClient();
    await ensureGIS();

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      callback: async (resp) => {
        if (!resp || !resp.access_token) {
          alert("❌ Drive login failed");
          return;
        }

        const token = resp.access_token;

        window.__driveAccessToken = token;
        window.__driveConnected = true;

        localStorage.setItem("DRIVE_ACCESS_TOKEN", token);
        localStorage.setItem("DRIVE_CONNECTED", "1");

        gapi.client.setToken({ access_token: token });

        try {
          const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: "Bearer " + token }
          }).then(r => r.json());

          window.__driveUserEmail = me.email || "";
          localStorage.setItem("DRIVE_USER_EMAIL", window.__driveUserEmail);
        } catch (e) {}

        window.updateDriveStatusUI && window.updateDriveStatusUI();

        // ✅ inform app
        try {
          if (window.onDriveLoginSuccess) window.onDriveLoginSuccess();
        } catch (e) {}

        alert("✅ Drive Login successful");
        try { window.onDriveLoginSuccess && window.onDriveLoginSuccess(); } catch(e) {}

        setTimeout(() => window.autoSyncFromDrive && window.autoSyncFromDrive(), 1200);
      }
    });

    tokenClient.requestAccessToken({ prompt: "" });
  } catch (err) {
    console.error(err);
    alert("❌ Drive Login error");
  }
};

// BACKUP
window.backupToDrive = async function (dataObj) {
  if (!window.__driveConnected) { alert("❌ Drive Login first"); return false; }
  if (__backupLock) return false;

  __backupLock = true;
  try {
    await ensureDriveReady();

    const contentStr = JSON.stringify(dataObj, null, 2);
    const existingId = await findBackupFileId();

    if (existingId) await updateBackupFile(existingId, contentStr);
    else await createBackupFile(contentStr);

    localStorage.setItem("LAST_AUTO_BACKUP_TS", String(Date.now()));
    return true;

  } catch (err) {
    console.error("Backup error:", err);
    alert("❌ Backup failed");
    return false;
  } finally {
    __backupLock = false;
  }
};

// RESTORE
window.restoreFromDrive = async function () {
  if (!window.__driveConnected) { alert("❌ Drive Login first"); return; }

  try {
    await ensureDriveReady();
    const fileId = await findBackupFileId();
    if (!fileId) { alert("❌ No backup found in Drive for this business"); return; }

    const res = await gapi.client.drive.files.get({ fileId, alt: "media" });
    const backup = (typeof res.body === "string") ? JSON.parse(res.body) : res.result;

    if (window.applyBackupObject) {
      window.applyBackupObject(backup);
      alert("✅ Restore done");
    } else {
      alert("❌ applyBackupObject missing");
    }
  } catch (err) {
    console.error(err);
    alert("❌ Restore failed");
  }
};

// AUTO BACKUP
let __autoBackupTimer = null;
window.scheduleAutoBackup = function (delayMs = AUTO_BACKUP_DELAY_MS) {
  try {
    if (!window.__driveConnected) return;
    clearTimeout(__autoBackupTimer);
    __autoBackupTimer = setTimeout(async () => {
      try {
        if (typeof collectAppBackupData !== "function") return;
        const obj = collectAppBackupData();
        await window.backupToDrive(obj);
      } catch (e) {}
    }, delayMs);
  } catch (e) {}
};

// AUTO SYNC
window.autoSyncFromDrive = async function () {
  if (!window.__driveConnected) return;
  if (__syncLock) return;
  __syncLock = true;

  try {
    await ensureDriveReady();
    const fileId = await findBackupFileId();
    if (!fileId) return;

    const res = await gapi.client.drive.files.get({ fileId, alt: "media" });
    const backup = (typeof res.body === "string") ? JSON.parse(res.body) : res.result;

    const driveTs = Number(backup.ts || 0);
    const localTs = Number(localStorage.getItem("LOCAL_LAST_TS") || "0");

    if (driveTs > localTs && window.applyBackupObject) {
      window.applyBackupObject(backup);
      localStorage.setItem("LOCAL_LAST_TS", String(driveTs));
    }
  } catch (e) {
    console.warn("AutoSync failed:", e);
  } finally {
    __syncLock = false;
  }
};

// init auto sync
setTimeout(() => window.autoSyncFromDrive && window.autoSyncFromDrive(), 2000);
setInterval(() => window.autoSyncFromDrive && window.autoSyncFromDrive(), AUTO_SYNC_INTERVAL_MS);

console.log("✅ gdrive.js loaded (FINAL)");

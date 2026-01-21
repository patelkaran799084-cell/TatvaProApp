/*************************************************
 * Tatva Pro - Google Drive (gdrive.js) ✅ FULL WORKING
 * Features:
 * ✅ Drive Login
 * ✅ Backup / Restore
 * ✅ Remember Login (persistent session)
 * ✅ Logout
 * ✅ Auto Cloud Backup (call scheduleAutoBackup())
 *************************************************/

// =============================
// ✅ SET YOUR KEYS (Already set)
// =============================
const CLIENT_ID =
  "945495636870-9uljt6291qui5sjskpnojqqtu1hs9o2g.apps.googleusercontent.com";

const API_KEY =
  "AIzaSyBmk0MvlOyzLMBJHtOpuLRz1izmcZQr7x0";

// Backup file name in Drive
const BACKUP_FILE_NAME = "TatvaPro_Backup.json";

// =============================
// ✅ Global Drive State
// =============================
window.__driveConnected = false;
window.__driveUserEmail = "";
window.__driveAccessToken = "";

// Require login (your lock overlay uses this)
window.__requireDriveLogin = true;


// =============================
// ✅ Small Helpers
// =============================
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

async function ensureGapiLoaded() {
  if (!window.gapi) {
    await loadScript("https://apis.google.com/js/api.js");
  }
  return new Promise((resolve) => {
    gapi.load("client", resolve);
  });
}

async function ensureGISLoaded() {
  if (!window.google || !window.google.accounts) {
    await loadScript("https://accounts.google.com/gsi/client");
  }
}

async function initDriveClient() {
  await ensureGapiLoaded();
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [
      "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    ],
  });
}

// =============================
// ✅ UI Status
// =============================
function setDriveStatus(text) {
  const el = document.getElementById("driveStatus");
  if (el) el.innerText = text;
}
window.updateDriveStatusUI = function () {
  if (window.__driveConnected) {
    const email = window.__driveUserEmail ? ` (${window.__driveUserEmail})` : "";
    setDriveStatus("Drive: Connected" + email);
  } else {
    setDriveStatus("Drive: Not connected");
  }
};

// =============================
// ✅ Restore previous session
// =============================
(function restoreSession() {
  try {
    const token = localStorage.getItem("DRIVE_ACCESS_TOKEN") || "";
    const email = localStorage.getItem("DRIVE_USER_EMAIL") || "";
    const ok = localStorage.getItem("DRIVE_CONNECTED") === "1";

    if (ok && token) {
      window.__driveAccessToken = token;
      window.__driveUserEmail = email;
      window.__driveConnected = true;

      // Set token into gapi after init (later)
      console.log("✅ Drive session restored");
    }
  } catch (e) {}
  setTimeout(() => window.updateDriveStatusUI && window.updateDriveStatusUI(), 800);
})();


// =============================
// ✅ Drive Login (MAIN FUNCTION)
// =============================
window.driveLogin = async function driveLogin() {
  try {
    await initDriveClient();
    await ensureGISLoaded();

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope:
        "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      callback: async (resp) => {
        try {
          if (!resp || !resp.access_token) {
            alert("❌ Drive login failed");
            return;
          }

          const accessToken = resp.access_token;

          // ✅ Save in memory
          window.__driveAccessToken = accessToken;
          window.__driveConnected = true;

          // ✅ Save in localStorage (Remember login)
          localStorage.setItem("DRIVE_ACCESS_TOKEN", accessToken);
          localStorage.setItem("DRIVE_CONNECTED", "1");

          // ✅ Set token for Drive API
          gapi.client.setToken({ access_token: accessToken });

          // ✅ Fetch email (optional)
          try {
            const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: "Bearer " + accessToken },
            }).then((r) => r.json());

            window.__driveUserEmail = me.email || "";
            localStorage.setItem("DRIVE_USER_EMAIL", window.__driveUserEmail);
          } catch (e) {}

          alert("✅ Drive Login successful");

          window.updateDriveStatusUI && window.updateDriveStatusUI();
          window.enforceDriveLogin && window.enforceDriveLogin(); // unlock UI
        } catch (e) {
          console.error(e);
          alert("❌ Login callback error");
        }
      },
    });

    // prompt:"" => tries silent login if possible
    tokenClient.requestAccessToken({ prompt: "" });
  } catch (err) {
    console.error(err);
    alert("❌ Drive Login error. Check OAuth origins & keys.");
  }
};


// =============================
// ✅ Logout
// =============================
window.driveLogout = function driveLogout() {
  window.__driveConnected = false;
  window.__driveUserEmail = "";
  window.__driveAccessToken = "";

  localStorage.removeItem("DRIVE_ACCESS_TOKEN");
  localStorage.removeItem("DRIVE_USER_EMAIL");
  localStorage.removeItem("DRIVE_CONNECTED");

  try {
    gapi.client.setToken(null);
  } catch (e) {}

  alert("✅ Logged out");

  window.updateDriveStatusUI && window.updateDriveStatusUI();
  window.enforceDriveLogin && window.enforceDriveLogin();
};


// =============================
// ✅ Drive helpers
// =============================
async function ensureDriveReady() {
  await initDriveClient();
  if (window.__driveAccessToken) {
    gapi.client.setToken({ access_token: window.__driveAccessToken });
  }
}

async function findBackupFileId() {
  const q = `name='${BACKUP_FILE_NAME}' and trashed=false`;
  const res = await gapi.client.drive.files.list({
    q,
    fields: "files(id,name)",
    spaces: "drive",
  });
  const files = res.result.files || [];
  return files.length ? files[0].id : null;
}

async function createBackupFile(contentStr) {
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const metadata = { name: BACKUP_FILE_NAME, mimeType: "application/json" };

  const body =
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
    headers: { "Content-Type": `multipart/related; boundary="${boundary}"` },
    body,
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
    headers: { "Content-Type": `multipart/related; boundary="${boundary}"` },
    body,
  });

  const res = await request;
  return res.result.id;
}


// =============================
// ✅ Backup to Drive
// =============================
window.backupToDrive = async function backupToDrive(dataObj) {
  if (!window.__driveConnected) {
    alert("❌ Please Drive Login first.");
    return false;
  }

  try {
    await ensureDriveReady();

    const contentStr = JSON.stringify(dataObj, null, 2);
    const existingId = await findBackupFileId();

    if (existingId) {
      await updateBackupFile(existingId, contentStr);
    } else {
      await createBackupFile(contentStr);
    }

    localStorage.setItem("LAST_AUTO_BACKUP_TS", String(Date.now()));
    window.updateDriveStatusUI && window.updateDriveStatusUI();

    alert("✅ Backup saved to Drive");
    return true;
  } catch (err) {
    console.error(err);
    alert("❌ Backup failed. Try login again.");
    return false;
  }
};


// =============================
// ✅ Restore from Drive
// =============================
window.restoreFromDrive = async function restoreFromDrive() {
  if (!window.__driveConnected) {
    alert("❌ Please Drive Login first.");
    return;
  }

  try {
    await ensureDriveReady();

    const fileId = await findBackupFileId();
    if (!fileId) {
      alert("❌ No backup found in Drive.");
      return;
    }

    const res = await gapi.client.drive.files.get({
      fileId,
      alt: "media",
    });

    const backup =
      typeof res.body === "string" ? JSON.parse(res.body) : res.result;

    if (!backup || !backup.data) {
      alert("❌ Backup file format invalid.");
      return;
    }

    // Restore localStorage
    localStorage.clear();
    for (const k of Object.keys(backup.data)) {
      localStorage.setItem(k, backup.data[k]);
    }

    alert("✅ Restore complete. Refreshing...");
    location.reload();
  } catch (err) {
    console.error(err);
    alert("❌ Restore failed.");
  }
};


// =============================
// ✅ Auto Backup Support
// (Call scheduleAutoBackup() after change OR use your app.js hook)
// =============================
let __autoBackupTimer = null;

window.scheduleAutoBackup = function scheduleAutoBackup(delayMs = 8000) {
  try {
    if (!window.__driveConnected) return;

    clearTimeout(__autoBackupTimer);
    __autoBackupTimer = setTimeout(async () => {
      try {
        if (typeof collectAppBackupData !== "function") return;
        const dataObj = collectAppBackupData();
        await window.backupToDrive(dataObj);
        console.log("✅ Auto backup done");
      } catch (e) {
        console.warn("Auto backup failed:", e);
      }
    }, delayMs);
  } catch (e) {}
};


// ✅ Final
setTimeout(() => window.updateDriveStatusUI && window.updateDriveStatusUI(), 1000);
console.log("✅ gdrive.js loaded, driveLogin ready:", typeof window.driveLogin);

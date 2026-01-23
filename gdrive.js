/*************************************************
 * Tatva OS Pro - gdrive.js (UPDATED FINAL)
 * ✅ Drive login (email)
 * ✅ Persistent login after refresh
 * ✅ Logout button (clear + revoke token)
 * ✅ Auto sync between phone + pc
 * ✅ Auto backup on changes
 *************************************************/

const CLIENT_ID =
  "945495636870-9uljt6291qui5sjskpnojqqtu1hs9o2g.apps.googleusercontent.com";

const API_KEY =
  "AIzaSyBmk0MvlOyzLMBJHtOpuLRz1izmcZQr7x0";

let __backupLock = false;
let __syncLock = false;

const IS_MOBILE =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);

const AUTO_BACKUP_DELAY_MS = IS_MOBILE ? 6000 : 2500;
const AUTO_SYNC_INTERVAL_MS = IS_MOBILE ? 8000 : 5000;

function getBackupFileName() {
  return (
    window.getBackupFileNameFromApp
      ? window.getBackupFileNameFromApp()
      : "TatvaPro_Main_Backup.json"
  );
}

function setDriveButtonsUI(connected) {
  try {
    const btnLogin = document.getElementById("btnDriveLogin");
    const btnLogout = document.getElementById("btnDriveLogout");

    if (btnLogin) btnLogin.style.display = connected ? "none" : "inline-block";
    if (btnLogout) btnLogout.style.display = connected ? "inline-block" : "none";
  } catch (e) {}
}

window.updateDriveStatusUI = function () {
  try {
    const el = document.getElementById("driveStatus");
    if (!el) return;

    if (window.__driveConnected && window.__driveAccessToken) {
      const email = window.__driveUserEmail || "Connected";
      el.innerText = `Drive: ✅ Connected (${email})`;
      setDriveButtonsUI(true);
    } else {
      el.innerText = "Drive: ❌ Not connected";
      setDriveButtonsUI(false);
    }
  } catch (e) {}
};

// ✅ restore session (auto login after refresh)
(function restoreDriveSession() {
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

  setTimeout(() => window.updateDriveStatusUI && window.updateDriveStatusUI(), 400);
})();

async function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

let __driveReady = false;

async function initDriveClient() {
  if (__driveReady) return;

  // load gapi
  if (!window.gapi) {
    await loadScript("https://apis.google.com/js/api.js");
  }

  await new Promise((resolve) => gapi.load("client", resolve));

  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });

  __driveReady = true;
}

async function ensureDriveReady() {
  await initDriveClient();
  if (window.__driveAccessToken) {
    gapi.client.setToken({ access_token: window.__driveAccessToken });
  }
}

async function findBackupFileId() {
  const name = getBackupFileName();
  const q = `name='${name}' and trashed=false`;

  const res = await gapi.client.drive.files.list({
    q,
    fields: "files(id,name)",
    spaces: "drive",
  });

  const files = res?.result?.files || [];
  return files.length ? files[0].id : null;
}

async function uploadBackupJson(jsonStr) {
  await ensureDriveReady();
  const name = getBackupFileName();
  const fileId = await findBackupFileId();

  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const metadata = {
    name,
    mimeType: "application/json",
  };

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    jsonStr +
    close_delim;

  const method = fileId ? "PATCH" : "POST";
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: "Bearer " + window.__driveAccessToken,
      "Content-Type": "multipart/related; boundary=" + boundary,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) throw new Error("Upload failed");
}

async function downloadBackupJson() {
  await ensureDriveReady();

  const fileId = await findBackupFileId();
  if (!fileId) {
    alert("❌ Drive backup file not found");
    return null;
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + window.__driveAccessToken },
  });

  if (!res.ok) throw new Error("Download failed");
  return await res.text();
}

// ✅ Login
window.driveLogin = async function () {
  try {
    await initDriveClient();

    // If already connected -> just update UI
    if (window.__driveConnected && window.__driveAccessToken) {
      window.updateDriveStatusUI && window.updateDriveStatusUI();
      return;
    }

    // load google identity services
    if (!window.google || !window.google.accounts) {
      await loadScript("https://accounts.google.com/gsi/client");
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope:
        "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
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

        // fetch user email
        try {
          const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: "Bearer " + token },
          }).then((r) => r.json());

          window.__driveUserEmail = me.email || "";
          localStorage.setItem("DRIVE_USER_EMAIL", window.__driveUserEmail);
        } catch (e) {}

        window.updateDriveStatusUI && window.updateDriveStatusUI();

        // inform app
        if (window.onDriveConnected) window.onDriveConnected();
      },
    });

    tokenClient.requestAccessToken({ prompt: "" }); // ✅ silent if possible
  } catch (err) {
    console.error(err);
    alert("❌ Drive init/login failed");
  }
};

// ✅ Logout (Clear token + revoke)
window.driveLogout = async function () {
  try {
    const token = window.__driveAccessToken || localStorage.getItem("DRIVE_ACCESS_TOKEN") || "";

    // Clear app state
    window.__driveAccessToken = "";
    window.__driveConnected = false;
    window.__driveUserEmail = "";

    try {
      localStorage.removeItem("DRIVE_ACCESS_TOKEN");
      localStorage.removeItem("DRIVE_CONNECTED");
      localStorage.removeItem("DRIVE_USER_EMAIL");
    } catch (e) {}

    // Clear gapi token
    try {
      if (window.gapi?.client) gapi.client.setToken(null);
    } catch (e) {}

    // Revoke token
    if (token) {
      try {
        await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token), {
          method: "POST",
          headers: { "Content-type": "application/x-www-form-urlencoded" },
        });
      } catch (e) {}
    }

    window.updateDriveStatusUI && window.updateDriveStatusUI();
    alert("✅ Drive logout successful");
  } catch (err) {
    console.error(err);
    alert("❌ Logout failed");
  }
};

// BACKUP
window.backupToDrive = async function (dataObj) {
  try {
    if (!window.__driveConnected || !window.__driveAccessToken) {
      alert("❌ Please Drive Login first");
      return;
    }
    if (__backupLock) return;
    __backupLock = true;

    const jsonStr = JSON.stringify(dataObj || {}, null, 2);
    await uploadBackupJson(jsonStr);

    alert("✅ Backup uploaded to Drive");
  } catch (err) {
    console.error(err);
    alert("❌ Backup failed");
  } finally {
    __backupLock = false;
  }
};

// RESTORE
window.restoreFromDrive = async function () {
  try {
    if (!window.__driveConnected || !window.__driveAccessToken) {
      alert("❌ Please Drive Login first");
      return;
    }

    const jsonStr = await downloadBackupJson();
    if (!jsonStr) return;

    const dataObj = JSON.parse(jsonStr);

    if (window.applyAppRestoreData) {
      window.applyAppRestoreData(dataObj);
    } else {
      alert("❌ App restore handler not found");
    }

    alert("✅ Restore successful");
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
        if (!window.__driveConnected || !window.__driveAccessToken) return;
        const data = window.collectAppBackupData ? window.collectAppBackupData() : {};
        const jsonStr = JSON.stringify(data || {}, null, 2);
        await uploadBackupJson(jsonStr);
        console.log("✅ Auto backup success");
      } catch (e) {
        console.log("Auto backup fail", e);
      }
    }, delayMs);
  } catch (e) {}
};

// AUTO SYNC (polling)
setInterval(async () => {
  try {
    if (!window.__driveConnected || !window.__driveAccessToken) return;
    if (__syncLock) return;
    __syncLock = true;

    // download
    const jsonStr = await downloadBackupJson();
    if (!jsonStr) return;

    // compare
    const remote = JSON.parse(jsonStr);
    const local = window.collectAppBackupData ? window.collectAppBackupData() : {};

    const remoteHash = JSON.stringify(remote);
    const localHash = JSON.stringify(local);

    if (remoteHash !== localHash) {
      // apply remote
      if (window.applyAppRestoreData) {
        window.applyAppRestoreData(remote);
        console.log("✅ Sync applied from Drive");
      }
    }
  } catch (e) {
    // silent
  } finally {
    __syncLock = false;
  }
}, AUTO_SYNC_INTERVAL_MS);

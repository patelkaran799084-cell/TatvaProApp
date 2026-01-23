/*************************************************
 * Tatva OS Pro - gdrive.js (FINAL)
 * ✅ Persistent Login
 * ✅ Drive Logout
 * ✅ Backup + Restore Working
 * ✅ Calls app.js: onDriveLoginSuccess()
 * ✅ Calls app.js: applyAppRestoreData()
 *************************************************/

const CLIENT_ID =
  "945495636870-9uljt6291qui5sjskpnojqqtu1hs9o2g.apps.googleusercontent.com";

const API_KEY =
  "AIzaSyBmk0MvlOyzLMBJHtOpuLRz1izmcZQr7x0";

let __driveReady = false;

function setDriveButtonsUI(connected) {
  const btnLogin = document.getElementById("btnDriveLogin");
  const btnLogout = document.getElementById("btnDriveLogout");

  if (btnLogin) btnLogin.style.display = connected ? "none" : "inline-flex";
  if (btnLogout) btnLogout.style.display = connected ? "inline-flex" : "none";
}

window.updateDriveStatusUI = function () {
  const el = document.getElementById("driveStatus");
  const ok = !!(window.__driveConnected && window.__driveAccessToken);

  if (el) {
    if (ok) {
      const email = window.__driveUserEmail || "";
      el.innerText = `Drive: ✅ Connected (${email})`;
    } else {
      el.innerText = "Drive: ❌ Not connected";
    }
  }
  setDriveButtonsUI(ok);
};

// load script helper
async function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initDriveClient() {
  if (__driveReady) return;

  if (!window.gapi) await loadScript("https://apis.google.com/js/api.js");
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

/**************
 * ✅ Restore session after refresh (no login again)
 **************/
(function restoreDriveSession() {
  try {
    const token = localStorage.getItem("DRIVE_ACCESS_TOKEN") || "";
    const email = localStorage.getItem("DRIVE_USER_EMAIL") || "";
    const ok = localStorage.getItem("DRIVE_CONNECTED") === "1";

    if (ok && token) {
      window.__driveAccessToken = token;
      window.__driveUserEmail = email;
      window.__driveConnected = true;

      setTimeout(() => {
        window.updateDriveStatusUI && window.updateDriveStatusUI();

        // unlock app
        if (window.onDriveLoginSuccess) window.onDriveLoginSuccess();
      }, 200);

      return;
    }
  } catch (e) {}

  setTimeout(() => window.updateDriveStatusUI && window.updateDriveStatusUI(), 200);
})();

function getBackupFileName() {
  // ✅ Business wise file, same business select => same data
  return window.getBackupFileNameFromApp
    ? window.getBackupFileNameFromApp()
    : "TatvaPro_Main_Backup.json";
}

async function findBackupFileId() {
  await ensureDriveReady();
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

  const metadata = { name, mimeType: "application/json" };

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
    alert("❌ Drive backup file not found (pehla Backup karo)");
    return null;
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + window.__driveAccessToken },
  });

  if (!res.ok) throw new Error("Download failed");
  return await res.text();
}

/**************
 * ✅ Drive Login
 **************/
window.driveLogin = async function () {
  try {
    await initDriveClient();

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

        // email
        try {
          const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: "Bearer " + token },
          }).then((r) => r.json());

          window.__driveUserEmail = me.email || "";
          localStorage.setItem("DRIVE_USER_EMAIL", window.__driveUserEmail);
        } catch (e) {}

        window.updateDriveStatusUI && window.updateDriveStatusUI();

        // unlock
        if (window.onDriveLoginSuccess) window.onDriveLoginSuccess();
      },
    });

    tokenClient.requestAccessToken({ prompt: "" });
  } catch (err) {
    console.error(err);
    alert("❌ Drive login/init failed");
  }
};

/**************
 * ✅ Drive Logout
 **************/
window.driveLogout = async function () {
  try {
    const token =
      window.__driveAccessToken ||
      localStorage.getItem("DRIVE_ACCESS_TOKEN") ||
      "";

    window.__driveAccessToken = "";
    window.__driveConnected = false;
    window.__driveUserEmail = "";

    localStorage.removeItem("DRIVE_ACCESS_TOKEN");
    localStorage.removeItem("DRIVE_CONNECTED");
    localStorage.removeItem("DRIVE_USER_EMAIL");

    try {
      if (window.gapi?.client) gapi.client.setToken(null);
    } catch (e) {}

    if (token) {
      try {
        await fetch(
          "https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token),
          {
            method: "POST",
            headers: { "Content-type": "application/x-www-form-urlencoded" },
          }
        );
      } catch (e) {}
    }

    window.updateDriveStatusUI && window.updateDriveStatusUI();
    location.reload();
  } catch (err) {
    console.error(err);
    alert("❌ Logout failed");
  }
};

/**************
 * ✅ Backup
 **************/
window.backupToDrive = async function (dataObj) {
  try {
    if (!window.__driveConnected || !window.__driveAccessToken) {
      alert("❌ Please Drive Login first");
      return;
    }
    const jsonStr = JSON.stringify(dataObj || {}, null, 2);
    await uploadBackupJson(jsonStr);
    alert("✅ Backup uploaded to Drive");
  } catch (err) {
    console.error(err);
    alert("❌ Backup failed");
  }
};

/**************
 * ✅ Restore
 **************/
window.restoreFromDrive = async function () {
  try {
    if (!window.__driveConnected || !window.__driveAccessToken) {
      alert("❌ Please Drive Login first");
      return;
    }

    const jsonStr = await downloadBackupJson();
    if (!jsonStr) return;

    const dataObj = JSON.parse(jsonStr);

    // ✅ THIS IS THE FIX
    if (window.applyAppRestoreData) {
      window.applyAppRestoreData(dataObj);
    } else {
      alert("❌ app.js missing: applyAppRestoreData()");
    }
  } catch (err) {
    console.error(err);
    alert("❌ Restore failed");
  }
};

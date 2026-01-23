(function(){
/* Tatva OS Pro - gdrive.js FINAL (Stable Upload/Download)
   - Uses app.js hooks:
     getActiveDriveBackupFileName()
     collectAppBackupData()
     applyAppRestoreData()
     onDriveLoginSuccess()
*/
const CLIENT_ID="945495636870-9uljt6291qui5sjskpnojqqtu1hs9o2g.apps.googleusercontent.com";
const API_KEY="AIzaSyBmk0MvlOyzLMBJHtOpuLRz1izmcZQr7x0";
let ready=false;

function qs(id){ return document.getElementById(id); }

function setUI(){
  const ok=!!(window.__driveConnected && window.__driveAccessToken);
  const el=qs("driveStatus");
  if(el) el.textContent= ok ? `Drive: ✅ Connected (${window.__driveUserEmail||""})` : "Drive: ❌ Not connected";
  const a=qs("btnDriveLogin"), b=qs("btnDriveLogout");
  if(a) a.style.display= ok?"none":"inline-flex";
  if(b) b.style.display= ok?"inline-flex":"none";
}
window.updateDriveStatusUI=setUI;

async function loadScript(src){
  return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);});
}

async function init(){
  if(ready) return;
  if(!window.gapi) await loadScript("https://apis.google.com/js/api.js");
  await new Promise(r=>gapi.load("client", r));
  await gapi.client.init({ apiKey: API_KEY, discoveryDocs:["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]});
  ready=true;
}

function fileName(){
  try{ if(window.getActiveDriveBackupFileName) return window.getActiveDriveBackupFileName(); }catch(e){}
  return "TatvaPro_Backup.json";
}

async function listFile(){
  await init();
  gapi.client.setToken({access_token: window.__driveAccessToken});
  const name=fileName();
  const q=`name='${name.replace(/'/g,"\\'")}' and trashed=false`;
  const r=await gapi.client.drive.files.list({q, fields:"files(id,name)", spaces:"drive"});
  const files=r?.result?.files||[];
  return files.length?files[0].id:null;
}

async function upload(jsonStr){
  await init();
  const name=fileName();
  const fileId=await listFile();

  // multipart upload via fetch (more reliable than gapi for multipart)
  const boundary="-------314159265358979323846";
  const delimiter="\r\n--"+boundary+"\r\n";
  const close="\r\n--"+boundary+"--";

  const metadata={name, mimeType:"application/json"};
  const body=
    delimiter+"Content-Type: application/json; charset=UTF-8\r\n\r\n"+JSON.stringify(metadata)+
    delimiter+"Content-Type: application/json\r\n\r\n"+jsonStr+
    close;

  const method=fileId?"PATCH":"POST";
  const url=fileId
    ?`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    :"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const res=await fetch(url,{
    method,
    headers:{
      "Authorization":"Bearer "+window.__driveAccessToken,
      "Content-Type":"multipart/related; boundary="+boundary
    },
    body
  });

  if(!res.ok){
    const t=await res.text().catch(()=> "");
    console.log("DRIVE_UPLOAD_ERROR",res.status,t);
    throw new Error("Upload failed: "+res.status);
  }
}

async function download(){
  await init();
  const id=await listFile();
  if(!id){ alert("❌ Drive backup file not found. Pehla Backup karo."); return null; }
  const url=`https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
  const res=await fetch(url,{ headers:{Authorization:"Bearer "+window.__driveAccessToken}});
  if(!res.ok) throw new Error("Download failed: "+res.status);
  return await res.text();
}

// Persistent session
(function(){
  try{
    const token=localStorage.getItem("DRIVE_ACCESS_TOKEN")||"";
    const email=localStorage.getItem("DRIVE_USER_EMAIL")||"";
    const ok=localStorage.getItem("DRIVE_CONNECTED")==="1";
    if(ok && token){
      window.__driveAccessToken=token;
      window.__driveConnected=true;
      window.__driveUserEmail=email;
      setTimeout(()=>{ setUI(); if(window.onDriveLoginSuccess) window.onDriveLoginSuccess(); },150);
      return;
    }
  }catch(e){}
  setTimeout(setUI,150);
})();

window.driveLogin = async function(){
  try{
    await init();
    if(!window.google || !window.google.accounts) await loadScript("https://accounts.google.com/gsi/client");
    const tc=google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope:"https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      callback: async (resp)=>{
        if(!resp || !resp.access_token){ alert("❌ Drive login failed"); return; }
        window.__driveAccessToken=resp.access_token;
        window.__driveConnected=true;
        localStorage.setItem("DRIVE_ACCESS_TOKEN",resp.access_token);
        localStorage.setItem("DRIVE_CONNECTED","1");
        try{
          const me=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+resp.access_token}}).then(r=>r.json());
          window.__driveUserEmail=me.email||"";
          localStorage.setItem("DRIVE_USER_EMAIL", window.__driveUserEmail);
        }catch(e){}
        setUI();
        if(window.onDriveLoginSuccess) window.onDriveLoginSuccess();
      }
    });
    tc.requestAccessToken({prompt:""});
  }catch(e){ console.error(e); alert("❌ Drive init/login failed"); }
};

window.driveLogout = async function(){
  const token=window.__driveAccessToken||"";
  window.__driveAccessToken="";
  window.__driveConnected=false;
  window.__driveUserEmail="";
  localStorage.removeItem("DRIVE_ACCESS_TOKEN");
  localStorage.removeItem("DRIVE_CONNECTED");
  localStorage.removeItem("DRIVE_USER_EMAIL");
  try{ if(token) await fetch("https://oauth2.googleapis.com/revoke?token="+encodeURIComponent(token),{method:"POST"}); }catch(e){}
  setUI();
  location.reload();
};

window.backupToDrive = async function(){
  try{
    if(!window.__driveConnected || !window.__driveAccessToken) return alert("❌ Please Drive Login first");
    if(!window.collectAppBackupData) return alert("❌ collectAppBackupData() missing in app.js");
    const data=window.collectAppBackupData();
    await upload(JSON.stringify(data,null,2));
    alert("✅ Backup uploaded to Drive");
  }catch(e){ console.error(e); alert("❌ Backup failed (Open console for details)"); }
};

window.restoreFromDrive = async function(){
  try{
    if(!window.__driveConnected || !window.__driveAccessToken) return alert("❌ Please Drive Login first");
    const txt=await download();
    if(!txt) return;
    const obj=JSON.parse(txt);
    if(window.applyAppRestoreData) window.applyAppRestoreData(obj);
    else alert("❌ applyAppRestoreData() missing in app.js");
  }catch(e){ console.error(e); alert("❌ Restore failed"); }
};
})();
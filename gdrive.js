
// ================================
// Google Drive Cloud Backup/Restore
// ================================
// 1) Create Google Cloud project
// 2) Enable "Google Drive API"
// 3) OAuth client (Web) -> add your domain/origin
// 4) Put CLIENT_ID & API_KEY below
//
// Backup file: TatvaPro_Backup.json

const CLIENT_ID = "945495636870-9uljt6291qui5sjskpnojqqtu1hs9o2g.apps.googleusercontent.com";
const API_KEY   = "AIzaSyBmk0MvlOyzLMBJHtOpuLRz1izmcZQr7x0";
const SCOPES    = 'https://www.googleapis.com/auth/drive.file';

let gToken = null;
let tokenClient = null;

function setDriveStatus(msg){
  const el = document.getElementById('driveStatus');
  if(el) el.textContent = 'Drive: ' + msg;
}

function loadGis(){
  return new Promise((resolve,reject)=>{
    if(document.getElementById('gis')) return resolve();
    const s=document.createElement('script');
    s.id='gis';
    s.src='https://accounts.google.com/gsi/client';
    s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
}

async function gdriveLogin(){
  try{
    await loadGis();
    if(CLIENT_ID.includes('PASTE_')){
      alert('Google Drive not configured. Please set CLIENT_ID & API_KEY in gdrive.js');
      return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if(resp && resp.access_token){
          gToken = resp.access_token;
          setDriveStatus('Connected ✅');
        }
      }
    });
    tokenClient.requestAccessToken({prompt:'consent'});
  }catch(e){
    console.error(e);
    setDriveStatus('Login failed ❌');
    alert('Drive login failed. Check console.');
  }
}

async function driveFetch(url, options={}){
  options.headers = options.headers || {};
  options.headers['Authorization'] = 'Bearer ' + gToken;
  return fetch(url, options);
}

async function findBackupFile(){
  const q = "name='TatvaPro_Backup.json' and trashed=false";
  const url = 'https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name,modifiedTime)';
  const res = await driveFetch(url);
  const data = await res.json();
  return (data.files && data.files[0]) ? data.files[0] : null;
}

async function uploadNewFile(content){
  const metadata = { name: 'TatvaPro_Backup.json', mimeType:'application/json' };
  const boundary = '-------314159265358979323846';
  const delimiter = '\r\n--' + boundary + '\r\n';
  const close_delim = '\r\n--' + boundary + '--';

  const multipart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    content +
    close_delim;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + gToken,
      'Content-Type': 'multipart/related; boundary=' + boundary
    },
    body: multipart
  });
  return res.json();
}

async function updateFile(fileId, content){
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files/'+fileId+'?uploadType=media', {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + gToken,
      'Content-Type': 'application/json'
    },
    body: content
  });
  return res.json();
}

async function gdriveBackup(){
  try{
    if(!gToken){ alert('Please Drive Login first'); return; }
    setDriveStatus('Backing up...');
    const content = localStorage.getItem('tatva_pro_db') || JSON.stringify(window.db || {});
    const existing = await findBackupFile();
    if(existing){
      await updateFile(existing.id, content);
      setDriveStatus('Backup updated ✅');
    }else{
      await uploadNewFile(content);
      setDriveStatus('Backup created ✅');
    }
    alert('Backup saved to Google Drive ✅');
  }catch(e){
    console.error(e);
    setDriveStatus('Backup failed ❌');
    alert('Backup failed. Check console.');
  }
}

async function downloadFile(fileId){
  const res = await driveFetch('https://www.googleapis.com/drive/v3/files/'+fileId+'?alt=media');
  return res.text();
}

async function gdriveRestore(){
  try{
    if(!gToken){ alert('Please Drive Login first'); return; }
    setDriveStatus('Restoring...');
    const existing = await findBackupFile();
    if(!existing){
      alert('No TatvaPro_Backup.json found in Drive');
      setDriveStatus('No backup found');
      return;
    }
    const text = await downloadFile(existing.id);
    localStorage.setItem('tatva_pro_db', text);
    // update running app
    try{
      window.db = JSON.parse(text);
      if(typeof window.saveDB === 'function') window.saveDB();
    }catch(_){}
    setDriveStatus('Restored ✅');
    alert('Restore completed ✅');
  }catch(e){
    console.error(e);
    setDriveStatus('Restore failed ❌');
    alert('Restore failed. Check console.');
  }
}

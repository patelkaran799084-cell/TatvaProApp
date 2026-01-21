# Tatva Pro (PWA + Google Drive Backup)

## 1) Run locally (PC)
Use any local server (required for PWA & Google login):

### Option A: Python
```bash
cd TatvaProApp
python -m http.server 8000
```
Open: http://localhost:8000

### Option B: VS Code Live Server
Install "Live Server" extension and click **Go Live**.

## 2) Install as App
- **PC (Chrome/Edge):** click Install icon in address bar
- **Phone (Android Chrome):** Menu → **Add to Home screen**

## 3) Enable Google Drive Backup (FREE)
1) Go to Google Cloud Console
2) Create Project
3) Enable **Google Drive API**
4) Create **API key**
5) OAuth consent screen → External → add test users
6) Create OAuth Client ID → **Web application**
   - Authorized JavaScript origins:
     - http://localhost:8000
     - your domain (e.g. https://yourname.github.io)
7) Open `gdrive.js` and paste:
   - CLIENT_ID
   - API_KEY

> Note: You must host on HTTPS for real phone usage (GitHub Pages is easiest).

## Buttons
- 🔐 Drive Login
- ☁ Backup (creates/updates `TatvaPro_Backup.json` in Drive)
- ☁ Restore (downloads & applies backup)


const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const serveHandler = require('serve-handler');

let mainWindow = null;
let backendProcess = null;
let frontendServer = null;
const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

// ── Backend binary path ─────────────────────────────────────────────────────
function getBackendExecutablePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'inventory-backend', 'inventory-backend.exe');
  }
  // Dev mode: use compiled binary in desktop/bin/
  return path.join(__dirname, 'bin', 'inventory-backend', 'inventory-backend.exe');
}

// ── Frontend static files path ───────────────────────────────────────────────
function getFrontendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontend-out');
  }
  // Dev mode: use the Next.js static export in frontend/out/
  return path.join(__dirname, '..', 'frontend', 'out');
}

// ── Start backend process ─────────────────────────────────────────────────────
function startBackendServer() {
  const exePath = getBackendExecutablePath();
  console.log(`[Electron] Launching backend: ${exePath}`);

  backendProcess = spawn(exePath, [], {
    env: { ...process.env, PORT: String(BACKEND_PORT), HOST: '127.0.0.1' },
    cwd: path.dirname(exePath),
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (d) => process.stdout.write(`[Backend] ${d}`));
  backendProcess.stderr.on('data', (d) => process.stderr.write(`[Backend ERR] ${d}`));
  backendProcess.on('exit', (code) => console.log(`[Backend] Exited with code ${code}`));
}

// ── Poll /health until backend is ready ───────────────────────────────────────
function checkBackendHealth(retries = 40, delayMs = 500) {
  return new Promise((resolve, reject) => {
    const attempt = (count) => {
      http.get(`${BACKEND_URL}/health`, (res) => {
        if (res.statusCode === 200) { console.log('[Electron] Backend ready!'); resolve(); }
        else retryOrReject(count);
      }).on('error', () => retryOrReject(count));
    };
    const retryOrReject = (count) => {
      if (count <= 0) reject(new Error('Backend did not start in time.'));
      else setTimeout(() => attempt(count - 1), delayMs);
    };
    attempt(retries);
  });
}

// ── Serve Next.js static export via local HTTP server ─────────────────────────
function startFrontendServer() {
  return new Promise((resolve, reject) => {
    const staticPath = getFrontendPath();
    console.log(`[Electron] Serving static frontend from: ${staticPath}`);

    frontendServer = http.createServer((req, res) => {
      return serveHandler(req, res, {
        public: staticPath,
        rewrites: [{ source: '**', destination: '/index.html' }],
      });
    });

    frontendServer.listen(0, '127.0.0.1', () => {
      const { port } = frontendServer.address();
      console.log(`[Electron] Frontend server on port ${port}`);
      resolve(`http://127.0.0.1:${port}`);
    });

    frontendServer.on('error', reject);
  });
}

// ── Create main Electron window ───────────────────────────────────────────────
async function createWindow(frontendUrl) {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'Inventory Flow Desktop',
    autoHideMenuBar: true,
    backgroundColor: '#09090b', // zinc-950 matches the app's dark theme
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow local API calls to 127.0.0.1
    },
  });

  await mainWindow.loadURL(frontendUrl);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    // 1. Start PyInstaller backend
    startBackendServer();

    // 2. Start frontend static file server (parallel with backend startup)
    const frontendUrl = await startFrontendServer();

    // 3. Wait for backend to be healthy
    await checkBackendHealth();

    // 4. Open the desktop window
    await createWindow(frontendUrl);

  } catch (err) {
    console.error('[Startup Error]', err);
    dialog.showErrorBox('Startup Failed', `Could not start the application:\n\n${err.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  console.log('[Electron] Shutting down...');
  if (backendProcess) { backendProcess.kill(); }
  if (frontendServer) { frontendServer.close(); }
});

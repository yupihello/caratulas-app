/**
 * Custom auto-updater for portable Electron app.
 * Checks GitHub Releases for a newer version, downloads the new .exe,
 * and hot-swaps it via a batch script (old exe gets replaced automatically).
 *
 * Uses PORTABLE_EXECUTABLE_FILE env var set by electron-builder portable.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { app, dialog } = require('electron');

const GITHUB_OWNER = 'yupihello';
const GITHUB_REPO = 'caratulas-app';
const CURRENT_VERSION = require('../package.json').version;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'CaratulasApp' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const request = (downloadUrl) => {
      https.get(downloadUrl, { headers: { 'User-Agent': 'CaratulasApp' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed: ${res.statusCode}`));
        }
        const totalSize = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(destPath);
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress && totalSize) onProgress(downloaded, totalSize);
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
      }).on('error', reject);
    };
    request(url);
  });
}

function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Get the path to the actual portable .exe the user double-clicked.
 * electron-builder portable sets PORTABLE_EXECUTABLE_FILE.
 * Falls back to process.execPath for dev mode.
 */
function getPortableExePath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

/**
 * Check GitHub Releases for a newer version.
 * @param {boolean} force - If true, return the latest release even if same/older version (for testing)
 */
async function checkForUpdate(force = false) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    const { statusCode, body } = await httpGet(url);
    if (statusCode === 404) return { error: 'No se encontro el repositorio o no hay releases publicados.' };
    if (statusCode !== 200) return { error: `Error al consultar GitHub (HTTP ${statusCode})` };

    const release = JSON.parse(body);
    const remoteVersion = release.tag_name || release.name || '';

    const isNewer = compareVersions(remoteVersion, CURRENT_VERSION) > 0;

    if (!isNewer && !force) {
      return { hasUpdate: false, version: CURRENT_VERSION };
    }

    const exeAsset = (release.assets || []).find(a => a.name.endsWith('.exe'));
    if (!exeAsset) return null;

    return {
      hasUpdate: true,
      forced: !isNewer && force,
      version: remoteVersion,
      downloadUrl: exeAsset.browser_download_url,
      fileName: exeAsset.name,
      size: exeAsset.size,
      releaseNotes: release.body || '',
    };
  } catch {
    return null;
  }
}

/**
 * Creates a batch script that:
 * 1. Waits for the old process to exit (by PID)
 * 2. Replaces the old exe with the new one
 * 3. Launches the updated exe
 * 4. Deletes the temp download and itself
 */
function createSwapScript(oldExePath, newExePath, pid) {
  const scriptPath = path.join(path.dirname(newExePath), '_update.bat');
  const script = `@echo off
echo Actualizando Generador de Caratulas...
echo Esperando a que cierre la version anterior...
:waitloop
tasklist /FI "PID eq ${pid}" 2>NUL | find "${pid}" >NUL
if not errorlevel 1 (
  timeout /t 1 /nobreak >NUL
  goto waitloop
)
echo Reemplazando ejecutable...
timeout /t 1 /nobreak >NUL
copy /Y "${newExePath}" "${oldExePath}" >NUL
if errorlevel 1 (
  echo ERROR: No se pudo reemplazar el ejecutable.
  echo El nuevo archivo esta en: ${newExePath}
  pause
  exit /b 1
)
echo Iniciando nueva version...
start "" "${oldExePath}"
del "${newExePath}" >NUL 2>&1
del "%~f0" >NUL 2>&1
`;
  fs.writeFileSync(scriptPath, script, 'utf-8');
  return scriptPath;
}

/**
 * Download update, replace exe via batch script, and restart.
 */
async function downloadAndApplyUpdate(updateInfo, mainWindow) {
  const downloadDir = path.join(app.getPath('userData'), 'updates');
  fs.mkdirSync(downloadDir, { recursive: true });
  const newExePath = path.join(downloadDir, updateInfo.fileName);
  const oldExePath = getPortableExePath();

  // Download with progress
  if (mainWindow) {
    mainWindow.setTitle(`Descargando actualizacion... 0%`);
  }

  await downloadFile(updateInfo.downloadUrl, newExePath, (downloaded, total) => {
    const pct = Math.round((downloaded / total) * 100);
    if (mainWindow) {
      mainWindow.setTitle(`Descargando actualizacion... ${pct}%`);
    }
  });

  if (mainWindow) {
    mainWindow.setTitle('Generador de Caratulas - SEMARNAT');
  }

  // Confirm restart
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Actualizacion lista',
    message: `Version ${updateInfo.version} descargada.`,
    detail: 'La app se cerrara y se actualizara automaticamente. Se reabrira con la nueva version.',
    buttons: ['Actualizar y reiniciar', 'Despues'],
  });

  if (response !== 0) return;

  // Create swap script and launch it
  const scriptPath = createSwapScript(oldExePath, newExePath, process.pid);
  spawn('cmd.exe', ['/c', scriptPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();

  // Quit so the batch script can replace the exe
  app.quit();
}

/**
 * Run update check silently on startup. Prompt if update found.
 */
async function checkAndPromptUpdate(mainWindow) {
  const updateInfo = await checkForUpdate();
  if (!updateInfo || updateInfo.error || !updateInfo.hasUpdate) return;

  const sizeMB = updateInfo.size ? `(${(updateInfo.size / 1024 / 1024).toFixed(1)} MB)` : '';

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Actualizacion disponible',
    message: `Nueva version: ${updateInfo.version}`,
    detail: `Version actual: v${CURRENT_VERSION}\n${updateInfo.releaseNotes}\n\nDescargar ${updateInfo.fileName} ${sizeMB}?`,
    buttons: ['Descargar y actualizar', 'Despues'],
  });

  if (response === 0) {
    await downloadAndApplyUpdate(updateInfo, mainWindow);
  }
}

module.exports = { checkForUpdate, downloadAndApplyUpdate, checkAndPromptUpdate, CURRENT_VERSION };

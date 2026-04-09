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
const { app, dialog, shell } = require('electron');

// Debug log to file (next to the exe)
function log(msg) {
  try {
    const logPath = path.join(
      process.env.PORTABLE_EXECUTABLE_DIR || app.getPath('userData'),
      'updater.log'
    );
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch {}
}

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

function downloadFile(url, destPath, onProgress, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    let redirects = 0;
    const request = (downloadUrl) => {
      const parsedUrl = new URL(downloadUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: { 'User-Agent': 'CaratulasApp' },
      };
      https.get(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // drain response
          if (++redirects > maxRedirects) return reject(new Error('Too many redirects'));
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }
        const totalSize = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(destPath);
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress && totalSize) onProgress(downloaded, totalSize);
        });
        res.pipe(file);
        file.on('close', () => {
          // Verify size
          if (totalSize && downloaded < totalSize) {
            fs.unlink(destPath, () => {});
            return reject(new Error(`Descarga incompleta: ${downloaded}/${totalSize} bytes`));
          }
          resolve();
        });
        res.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
        file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
      }).on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
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
 * Called on startup. Applies a pending update if one was downloaded.
 *
 * Strategy (two-phase, pure Node.js, no cmd/bat):
 *   Phase 1 (downloadAndApplyUpdate): Downloads new exe next to current as _new.exe, quits.
 *   Phase 2 (applyPendingUpdate on next startup): The old exe is no longer locked,
 *     so we rename old → _old, rename _new → original, launch it, quit.
 *     The NEXT startup after that deletes _old.
 */
/**
 * Try to delete _old exe, retrying up to 10 times with 1s delay.
 * The old process may still be shutting down.
 */
/**
 * Called on startup BEFORE anything else.
 * If _new.exe exists next to the running exe, it means a previous
 * update was downloaded. Since the exe is not locked yet at this point
 * (fresh process), we overwrite it with the new version.
 * The app continues normally — next launch will run the new code.
 */
/**
 * Called on startup. If _new exists, wait for the old process to release
 * the exe (up to 15s), then overwrite and clean up.
 * Returns a Promise that resolves when done (or gives up).
 */
/**
 * Called on startup. If _new.exe exists, the user is opening CaratulasApp.exe
 * after a previous update cycle. Since nothing else is running, the exe is
 * not locked and we can safely overwrite it.
 */
function applyPendingUpdate() {
  const exePath = getPortableExePath();
  const dir = path.dirname(exePath);
  const ext = path.extname(exePath);
  const base = path.basename(exePath, ext);
  const newPath = path.join(dir, base + '_new' + ext);
  log(`STARTUP: exe=${exePath} _new exists=${fs.existsSync(newPath)}`);

  if (!fs.existsSync(newPath)) return;

  try {
    fs.copyFileSync(newPath, exePath);
    fs.unlinkSync(newPath);
    log(`STARTUP: exe overwritten with _new, cleaned up`);
  } catch (err) {
    log(`STARTUP: overwrite failed: ${err.code} ${err.message} — _new remains for next launch`);
  }
}

/**
 * Download new exe and place it next to the current one as _new.exe.
 * On next startup, applyPendingUpdate() will do the swap.
 */
async function downloadAndApplyUpdate(updateInfo, mainWindow) {
  const oldExePath = getPortableExePath();
  const dir = path.dirname(oldExePath);
  const ext = path.extname(oldExePath);
  const base = path.basename(oldExePath, ext);
  const newPath = path.join(dir, base + '_new' + ext);

  // Download with progress in title bar
  if (mainWindow) mainWindow.setTitle('Descargando actualizacion... 0%');

  await downloadFile(updateInfo.downloadUrl, newPath, (downloaded, total) => {
    const pct = Math.round((downloaded / total) * 100);
    if (mainWindow) mainWindow.setTitle(`Descargando actualizacion... ${pct}%`);
  });

  if (mainWindow) mainWindow.setTitle('Generador de Caratulas - SEMARNAT');

  // Try immediate swap (rename running exe — works on portable extracted to temp)
  log(`DOWNLOAD COMPLETE: ${newPath} (${fs.statSync(newPath).size} bytes)`);

  // Launch _new.exe directly (not the original) — this way we don't need
  // the old instance to die first. The _new exe runs fine on its own.
  // Next time the user opens CaratulasApp.exe normally, applyPendingUpdate()
  // will copy _new over the original (no lock since nothing is running).
  log(`RELAUNCH: launching _new directly: ${newPath}`);
  shell.openPath(newPath);
  setTimeout(() => app.quit(), 500);
}

/**
 * Run update check silently on startup. Prompt if update found.
 */
async function checkAndPromptUpdate(mainWindow) {
  // Don't check if a pending update already exists (avoids re-download loop)
  const exePath = getPortableExePath();
  const pendingPath = path.join(path.dirname(exePath), path.basename(exePath, path.extname(exePath)) + '_new' + path.extname(exePath));
  if (fs.existsSync(pendingPath)) {
    log(`AUTO-CHECK: _new already exists, skipping`);
    return;
  }

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

module.exports = { checkForUpdate, downloadAndApplyUpdate, checkAndPromptUpdate, applyPendingUpdate, CURRENT_VERSION };

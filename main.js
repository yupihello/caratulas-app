/**
 * Caratulas App — Electron main process.
 * Levanta Express + Next.js internamente y abre la ventana.
 * Entry point: electron . (npm start)
 */
const { app, BrowserWindow, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const next = require('next');
const http = require('http');

const { readCaratulaOds, readBrendaOds } = require('./lib/ods-reader');
const { generateCaratulaPdf } = require('./lib/caratula-pdf');
const { checkForUpdate, downloadAndApplyUpdate, checkAndPromptUpdate, applyPendingUpdate, CURRENT_VERSION } = require('./lib/updater');

const PORT = 4000;
let mainWindow;

// ── Settings ──
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return {};
}

function saveSettings(settings) {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

// ── Start server + window ──
function startServer() {
  const dev = !app.isPackaged;
  const nextApp = next({ dev, dir: __dirname });
  const handle = nextApp.getRequestHandler();

  nextApp.prepare().then(() => {
    const server = express();
    server.use(express.json({ limit: '50mb' }));

    // API: Settings
    server.get('/api/settings', (_req, res) => res.json(loadSettings()));
    server.post('/api/settings', (req, res) => {
      const merged = { ...loadSettings(), ...req.body };
      saveSettings(merged);
      res.json(merged);
    });

    // API: Read ODS
    server.post('/api/read-ods', (req, res) => {
      const { filePath, tipo } = req.body;
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(400).json({ error: `Archivo no encontrado: ${filePath}` });
      }
      try {
        const result = tipo === 'caratula' ? readCaratulaOds(filePath) : readBrendaOds(filePath);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // API: File dialog (Electron native)
    server.post('/api/open-file-dialog', async (req, res) => {
      const { tipo } = req.body;
      const result = await dialog.showOpenDialog(mainWindow, {
        title: tipo === 'caratula'
          ? 'Seleccionar archivo de Caratulas (ODS)'
          : 'Seleccionar archivo Base Brenda (ODS)',
        filters: [{ name: 'Archivos ODS/Excel', extensions: ['ods', 'xlsx', 'xls'] }],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) return res.json({ filePath: null });
      res.json({ filePath: result.filePaths[0] });
    });

    // API: Generate PDF (download or save with native dialog)
    server.post('/api/generate-pdf', async (req, res) => {
      const { data, useSaveDialog } = req.body;
      const logoPath = path.join(__dirname, 'public', 'assets', 'logo_medio_ambiente.png');
      try {
        const pdfBuffer = await generateCaratulaPdf(data, logoPath);

        if (useSaveDialog) {
          const defaultName = data._bitacora
            ? `caratula_${data._bitacora.replace(/\//g, '-')}.pdf`
            : 'caratula.pdf';
          const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Guardar Caratula PDF',
            defaultPath: defaultName,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
          });
          if (result.canceled || !result.filePath) return res.json({ saved: false });
          fs.writeFileSync(result.filePath, pdfBuffer);
          return res.json({ saved: true, path: result.filePath });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="caratula.pdf"');
        res.send(pdfBuffer);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // API: Multi-page PDF (one page per caratula, single file)
    server.post('/api/generate-pdf-multi', async (req, res) => {
      const { dataArray } = req.body;
      if (!dataArray || dataArray.length === 0) return res.status(400).json({ error: 'No hay datos' });

      const defaultName = `caratulas_${dataArray.length}.pdf`;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Guardar PDF con todas las caratulas',
        defaultPath: defaultName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (result.canceled || !result.filePath) return res.json({ saved: false });

      const logoPath = path.join(__dirname, 'public', 'assets', 'logo_medio_ambiente.png');
      try {
        const { generateMultiCaratulaPdf } = require('./lib/caratula-pdf');
        const pdfBuffer = await generateMultiCaratulaPdf(dataArray, logoPath);
        fs.writeFileSync(result.filePath, pdfBuffer);
        res.json({ saved: true, path: result.filePath, count: dataArray.length });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // API: Check for updates
    server.get('/api/version', (_req, res) => res.json({
      version: CURRENT_VERSION,
      portableExe: process.env.PORTABLE_EXECUTABLE_FILE || null,
      portableDir: process.env.PORTABLE_EXECUTABLE_DIR || null,
      execPath: process.execPath,
      isPackaged: app.isPackaged,
    }));

    server.post('/api/check-update', async (_req, res) => {
      const info = await checkForUpdate();
      res.json(info || { hasUpdate: false, version: CURRENT_VERSION });
    });

    server.post('/api/download-update', async (_req, res) => {
      try {
        const info = await checkForUpdate();
        if (!info || !info.hasUpdate) return res.json({ downloaded: false });
        const { downloadAndApplyUpdate } = require('./lib/updater');
        await downloadAndApplyUpdate(info, mainWindow);
        res.json({ downloaded: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Next.js pages
    server.all('*', (req, res) => handle(req, res));

    http.createServer(server).listen(PORT, '127.0.0.1', () => {
      console.log(`Server ready on http://localhost:${PORT}`);
      createWindow();
    });
  });
}

async function manualUpdateCheck(force) {
  const info = await checkForUpdate(force);
  if (!info || info.error) {
    await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'No se pudo verificar',
      message: info?.error || 'No se pudo conectar con GitHub.',
      detail: `Version actual: v${CURRENT_VERSION}\nRepositorio: yupihello/caratulas-app\n\nVerifica que el repositorio exista y tenga al menos un Release publicado con un archivo .exe adjunto.`,
      buttons: ['OK'],
    });
    return;
  }
  if (!info.hasUpdate) {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Sin actualizaciones',
      message: `Estas en la version mas reciente (v${CURRENT_VERSION}).`,
      buttons: ['OK'],
    });
    return;
  }
  const sizeMB = info.size ? `(${(info.size / 1024 / 1024).toFixed(1)} MB)` : '';
  const label = info.forced ? '(misma version - modo prueba)' : '';
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Actualizacion disponible',
    message: `Version disponible: ${info.version} ${label}`,
    detail: `Version actual: v${CURRENT_VERSION}\n${info.releaseNotes}\n\nDescargar ${info.fileName} ${sizeMB}?`,
    buttons: ['Descargar y actualizar', 'Cancelar'],
  });
  if (response === 0) {
    await downloadAndApplyUpdate(info, mainWindow);
  }
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Actualizacion',
      submenu: [
        {
          label: 'Buscar actualizaciones',
          click: () => manualUpdateCheck(false).catch(() => {}),
        },
        {
          label: 'Reinstalar version actual (prueba)',
          click: () => manualUpdateCheck(true).catch(() => {}),
        },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: `Version v${CURRENT_VERSION}`,
          enabled: false,
        },
        { role: 'toggleDevTools', label: 'DevTools' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  buildMenu();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Generador de Caratulas - SEMARNAT',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Check for updates 3 seconds after window loads
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      checkAndPromptUpdate(mainWindow).catch(() => {});
    }, 3000);
  });
}

// Apply pending update FIRST — before Electron locks the exe via NSIS extraction.
// This runs synchronously at module load time, before app.whenReady().
applyPendingUpdate();

app.whenReady().then(startServer);

app.on('window-all-closed', () => {
  app.quit();
});

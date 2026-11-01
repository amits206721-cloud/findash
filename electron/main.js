import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { writeFileSync } from 'node:fs';
import { readFile as readFileAsync, stat as statAsync, writeFile as writeFileAsync } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isValidFinanceData } from '../src/js/data-validation.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDirectory, '..');
const appEntryUrl = pathToFileURL(path.join(appRoot, 'desktop-dist', 'index.html')).href;
const MAX_EXPORT_BYTES = 10 * 1024 * 1024;
const WINDOW_STATE_PATH = path.join(app.getPath('userData'), 'window-state.json');
let mainWindow;

function isTrustedAppUrl(url) {
  try {
    const candidate = new URL(url);
    candidate.hash = '';
    return candidate.href === appEntryUrl;
  } catch {
    return false;
  }
}

function assertTrustedSender(event) {
  if (event.sender !== mainWindow?.webContents || event.senderFrame !== event.sender.mainFrame
    || !isTrustedAppUrl(event.senderFrame.url)) {
    throw new Error('This request is not permitted.');
  }
}

async function readWindowState() {
  try {
    const state = JSON.parse(await readFileAsync(WINDOW_STATE_PATH, 'utf8'));
    if (state && typeof state === 'object'
      && Number.isInteger(state.width) && state.width >= 900 && state.width <= 7680
      && Number.isInteger(state.height) && state.height >= 640 && state.height <= 4320
      && typeof state.maximized === 'boolean') {
      return state;
    }
    console.warn('Ignoring invalid saved window dimensions.');
    return null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) {
      console.warn('Ignoring unreadable saved window dimensions.', error);
      return null;
    }
    throw error;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const { width, height } = mainWindow.isMaximized() ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    writeFileSync(WINDOW_STATE_PATH, JSON.stringify({
      width: Math.max(900, width),
      height: Math.max(640, height),
      maximized: mainWindow.isMaximized()
    }), 'utf8');
  } catch (error) {
    console.error('Unable to save the application window state.', error);
  }
}

function sendMenuAction(action) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('menu:action', action);
}

function createApplicationMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New expense', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new-expense') },
        { type: 'separator' },
        { label: 'Export transactions as CSV…', accelerator: 'CmdOrCtrl+Shift+E', click: () => sendMenuAction('export-csv') },
        { label: 'Save backup…', accelerator: 'CmdOrCtrl+Shift+B', click: () => sendMenuAction('export-backup') },
        { label: 'Restore backup…', accelerator: 'CmdOrCtrl+Shift+I', click: () => sendMenuAction('import-backup') },
        { label: 'Export report as PDF…', accelerator: 'CmdOrCtrl+Shift+P', click: () => sendMenuAction('export-pdf') },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => sendMenuAction('navigate-settings') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        {
          label: 'Maximize / Restore',
          click: () => {
            if (!mainWindow) return;
            if (mainWindow.isMaximized()) mainWindow.unmaximize();
            else mainWindow.maximize();
          }
        },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [{
        label: 'About FinDash',
        click: () => dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'About FinDash',
          message: 'FinDash',
          detail: `Personal finance, stored locally.\nVersion ${app.getVersion()}`
        })
      }]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

function registerIpcHandlers() {
  ipcMain.handle('window:minimize', (event) => {
    assertTrustedSender(event);
    mainWindow.minimize();
  });
  ipcMain.handle('window:toggle-maximize', (event) => {
    assertTrustedSender(event);
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', (event) => {
    assertTrustedSender(event);
    mainWindow.close();
  });
  ipcMain.handle('data:export-backup', async (event, data) => {
    assertTrustedSender(event);
    if (!isValidFinanceData(data)) throw new Error('The backup data is invalid.');
    const contents = JSON.stringify(data, null, 2);
    if (Buffer.byteLength(contents, 'utf8') > MAX_EXPORT_BYTES) throw new Error('The backup exceeds the 10 MB limit.');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save FinDash backup',
      defaultPath: 'findash-backup.json',
      filters: [{ name: 'FinDash backup', extensions: ['json'] }]
    });
    if (result.canceled) return { canceled: true };
    await writeFileAsync(result.filePath, contents, 'utf8');
    return { canceled: false };
  });
  ipcMain.handle('data:import-backup', async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Restore FinDash backup',
      properties: ['openFile'],
      filters: [{ name: 'FinDash backup', extensions: ['json'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    if ((await statAsync(filePath)).size > MAX_EXPORT_BYTES) throw new Error('The selected backup exceeds the 10 MB limit.');
    const file = await readFileAsync(filePath);
    let data;
    try {
      data = JSON.parse(file.toString('utf8'));
    } catch {
      throw new Error('The selected file is not valid JSON.');
    }
    if (!isValidFinanceData(data)) throw new Error('The selected file is not a valid FinDash backup.');
    return data;
  });
  ipcMain.handle('data:save-csv', async (event, csv) => {
    assertTrustedSender(event);
    if (typeof csv !== 'string' || Buffer.byteLength(csv, 'utf8') > MAX_EXPORT_BYTES) {
      throw new Error('The CSV export is invalid or exceeds the 10 MB limit.');
    }
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export transactions',
      defaultPath: 'findash-transactions.csv',
      filters: [{ name: 'CSV file', extensions: ['csv'] }]
    });
    if (result.canceled) return { canceled: true };
    await writeFileAsync(result.filePath, csv, 'utf8');
    return { canceled: false };
  });
  ipcMain.handle('reports:export-pdf', async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export report as PDF',
      defaultPath: 'findash-report.pdf',
      filters: [{ name: 'PDF file', extensions: ['pdf'] }]
    });
    if (result.canceled) return { canceled: true };
    const pdf = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    });
    await writeFileAsync(result.filePath, pdf);
    return { canceled: false };
  });
}

async function createWindow() {
  const savedState = await readWindowState();
  mainWindow = new BrowserWindow({
    width: savedState?.width || 1440,
    height: savedState?.height || 960,
    minWidth: 900,
    minHeight: 640,
    show: false,
    frame: false,
    title: 'FinDash',
    icon: path.join(appRoot, 'assets', 'findash.ico'),
    backgroundColor: '#f6f7fa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  if (savedState?.maximized) mainWindow.maximize();
  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.once('ready-to-show', () => {
    if (mainWindow.isMaximized()) mainWindow.webContents.send('window:maximized-changed', true);
    mainWindow.show();
  });
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized-changed', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized-changed', false));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });

  await mainWindow.loadFile(path.join(appRoot, 'desktop-dist', 'index.html'));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    registerIpcHandlers();
    createApplicationMenu();
    await createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow().catch((error) => {
          console.error('FinDash could not reopen.', error);
          dialog.showErrorBox('FinDash could not reopen', error.message || 'An unexpected startup error occurred.');
        });
      }
    });
  }).catch((error) => {
    console.error('FinDash failed to start.', error);
    dialog.showErrorBox('FinDash could not start', error.message || 'An unexpected startup error occurred.');
    app.quit();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

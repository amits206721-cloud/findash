const { contextBridge, ipcRenderer } = require('electron');
const menuActions = new Set([
  'new-expense',
  'export-csv',
  'export-backup',
  'import-backup',
  'export-pdf',
  'navigate-settings'
]);

contextBridge.exposeInMainWorld('finDashDesktop', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    onMaximizedChanged(callback) {
      const listener = (_event, isMaximized) => callback(isMaximized);
      ipcRenderer.on('window:maximized-changed', listener);
      return () => ipcRenderer.removeListener('window:maximized-changed', listener);
    }
  },
  onMenuAction(callback) {
    if (typeof callback !== 'function') throw new TypeError('A menu action callback is required.');
    const listener = (_event, action) => {
      if (menuActions.has(action)) callback(action);
    };
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
  data: {
    exportBackup: (data) => ipcRenderer.invoke('data:export-backup', data),
    importBackup: () => ipcRenderer.invoke('data:import-backup'),
    saveCsv: (csv) => ipcRenderer.invoke('data:save-csv', csv)
  },
  reports: {
    exportPdf: () => ipcRenderer.invoke('reports:export-pdf')
  }
});

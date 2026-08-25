const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    closeApp: () => ipcRenderer.send('close-app'),
    maximizeApp: () => ipcRenderer.send('maximize-app'),
    appReady: () => ipcRenderer.send('app-ready'),
    exportPDF: (payload) => ipcRenderer.invoke('export-pdf', payload)
});

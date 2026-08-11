const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import and start the server
require('./server.js');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 520,
        height: 650,
        center: true,
        resizable: true,
        title: "Gestione Ordini",
        icon: path.join(__dirname, 'public/images/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true
    });

    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL('http://localhost:3000');
        }
    }, 800);
}

ipcMain.on('close-app', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
    }
});

ipcMain.on('maximize-app', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (!mainWindow.isMaximized()) {
            mainWindow.maximize();
        }
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

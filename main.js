const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import and start the server
require('./server.js');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 850,
        height: 540,
        center: true,
        resizable: true,
        frame: false,
        show: false,
        backgroundColor: '#1e2a4a',
        title: "Gestione Ordini",
        icon: path.join(__dirname, 'public/images/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true
    });

    // Fallback in case app-ready IPC event is not received
    mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
                mainWindow.show();
            }
        }, 150);
    });

    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
        }
    }, 2000);

    const loadApp = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL('http://localhost:3000').catch(() => {
                setTimeout(loadApp, 150);
            });
        }
    };

    setTimeout(loadApp, 200);
}

ipcMain.on('app-ready', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        mainWindow.show();
    }
});

ipcMain.on('close-app', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
    }
});

ipcMain.on('maximize-app', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(true);
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

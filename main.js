const { app, BrowserWindow } = require('electron');
const path = require('path');

// Import and start the server
// This executes server.js, which starts listening on port 3000
require('./server.js');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Gestione Ordini",
        icon: path.join(__dirname, 'public/logo.png'),
        webPreferences: {
            nodeIntegration: false, // Security best practice
            contextIsolation: true  // Security best practice
        },
        autoHideMenuBar: true // Makes it look more app-like
    });

    // Load the local server
    // We add a small delay or retry mechanic could be useful, 
    // but usually server starts fast enough.
    setTimeout(() => {
        win.loadURL('http://localhost:3000');
    }, 1000);

    // Optional: Open DevTools only if needed
    // win.webContents.openDevTools();
}

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

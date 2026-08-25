const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// Import and start the server
const serverModule = require('./server.js');

let mainWindow = null;

function promptAnotherInstance() {
    const choice = dialog.showMessageBoxSync({
        type: 'question',
        title: 'Applicazione già in esecuzione',
        message: "C'è un'altra istanza dell'app in esecuzione.",
        detail: "Un'altra sessione del programma o del server è già attiva. Vuoi avviare comunque?",
        buttons: ['Avvia comunque', 'Chiudi'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    });
    return choice === 0;
}

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

ipcMain.handle('export-pdf', async (event, { html, defaultFileName }) => {
    let printWin = null;
    let tempFilePath = null;
    try {
        const os = require('os');
        const fs = require('fs');
        const path = require('path');

        tempFilePath = path.join(os.tmpdir(), `menu_export_${Date.now()}.html`);
        const resolvedHtml = html.replace(/src="images\//g, 'src="http://localhost:3000/images/');
        fs.writeFileSync(tempFilePath, resolvedHtml, 'utf8');

        printWin = new BrowserWindow({
            show: false,
            width: 794,
            height: 1123,
            webPreferences: {
                offscreen: true,
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        await printWin.loadFile(tempFilePath);
        await new Promise(r => setTimeout(r, 500));

        const pdfData = await printWin.webContents.printToPDF({
            pageSize: 'A4',
            printBackground: true,
            margins: {
                marginType: 'none'
            }
        });

        printWin.close();
        printWin = null;
        try { fs.unlinkSync(tempFilePath); } catch(e){}

        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow || null, {
            title: 'Salva Menu come PDF',
            defaultPath: defaultFileName || 'Menu_Evento.pdf',
            filters: [
                { name: 'Documenti PDF (*.pdf)', extensions: ['pdf'] }
            ]
        });

        if (canceled || !filePath) {
            return { canceled: true };
        }

        fs.writeFileSync(filePath, pdfData);
        return { success: true, filePath };
    } catch (err) {
        if (printWin && !printWin.isDestroyed()) printWin.close();
        if (tempFilePath) { try { require('fs').unlinkSync(tempFilePath); } catch(e){} }
        console.error("Error generating PDF:", err);
        return { success: false, error: err.message };
    }
});

const gotLock = app.requestSingleInstanceLock();

app.whenReady().then(() => {
    const isPortBusy = serverModule.isPortInUse && serverModule.isPortInUse();

    if (!gotLock || isPortBusy) {
        const shouldLaunch = promptAnotherInstance();
        if (!shouldLaunch) {
            app.quit();
            return;
        }
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

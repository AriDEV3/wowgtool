// Ganz oben als erste Zeile: Lädt die .env Datei in die Laufzeitumgebung
require('dotenv').config();

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc-handlers');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        titleBarStyle: 'default'
    });

    mainWindow.loadFile('index.html');

    // Entfernt die standardmäßige obere Menüleiste für einen cleanen App-Look
    mainWindow.setMenu(null);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC-Datenleitungen für das Inventar und TSM registrieren
registerIpcHandlers();

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

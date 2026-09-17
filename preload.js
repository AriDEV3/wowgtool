const { contextBridge, ipcRenderer } = require('electron');

// Hier definieren wir eine sichere Brücke zum Frontend
contextBridge.exposeInMainWorld('electronAPI', {
    // Handler für das Laden der WoW-Daten
    loadBankData: (selectedAccount) => ipcRenderer.invoke('load-bank-data', selectedAccount),
    
    // Handler für den CSV-Export
    exportToCsv: (itemsData) => ipcRenderer.invoke('export-to-csv', itemsData),
    
    // Handler für das Ändern der Region
    updateRegionSetting: (newRegion) => ipcRenderer.invoke('update-region-setting', newRegion)
});
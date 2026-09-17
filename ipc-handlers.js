const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { fetchTSMPricesStream } = require('./tsm');
const { cleanAndParseLua } = require('./parser');

const { resolveLuaPath } = require('./path-resolver');
const { aggregateInventory } = require('./inventory-aggregator');
const { processTrendsAndSnapshots } = require('./trend-analyzer');

function registerIpcHandlers() {
    ipcMain.handle('load-bank-data', async (event, selectedAccount) => {
        const pathResult = resolveLuaPath(selectedAccount);
        if (pathResult.error) return pathResult;

        try {
            const fileContent = fs.readFileSync(pathResult.luaPath, 'utf8');
            const db = cleanAndParseLua(fileContent);
            if (!db) return { error: "Struktur der SavedVariables-Datei konnte nicht gelesen werden." };

            const masterItemMap = aggregateInventory(db);
            const priceMap = await fetchTSMPricesStream();
            const namesDb = db.names || {};
            return processTrendsAndSnapshots(masterItemMap, priceMap, namesDb);

        } catch (err) {
            console.error(err);
            return { error: `Fehler bei der Datenverarbeitung im Backend: ${err.message}` };
        }
    });

    // Korrigierter Export-Handler mit korrektem `app`-Import
    ipcMain.handle('export-to-csv', async (event, itemsData) => {
        try {
            const { filePath } = await dialog.showSaveDialog({
                title: 'Inventar als CSV exportieren',
                defaultPath: path.join(app.getPath('desktop'), 'WoW_CrossRealm_Inventar.csv'),
                filters: [{ name: 'CSV-Dateien', extensions: ['csv'] }]
            });

            if (!filePath) return { success: false, message: 'Export abgebrochen.' };

            let csvContent = '\uFEFFGegenstand;Item-ID;Gesamtmenge;Einzelpreis (Gold);Gesamtwert (Gold)\n';
            
            itemsData.forEach(item => {
                const cleanName = (item.name || '').replace(/;/g, ' '); 
                const priceNum = typeof item.dbRecentGold === 'number' ? item.dbRecentGold : 0;
                const totalNum = typeof item.totalRecentValueGold === 'number' ? item.totalRecentValueGold : 0;
                
                const formattedPrice = priceNum.toFixed(2).replace('.', ',');
                const formattedTotal = totalNum.toFixed(2).replace('.', ',');
                
                csvContent += `${cleanName};#${item.id};${item.totalQty};${formattedPrice};${formattedTotal}\n`;
            });

            fs.writeFileSync(filePath, csvContent, 'utf8');
            return { success: true, message: 'Datei erfolgreich auf dem Desktop gespeichert!' };
        } catch (err) {
            console.error(err);
            return { success: false, message: `Export-Fehler: ${err.message}` };
        }
    });
	
	// NEU: Nimmt die geänderte Region entgegen und spiegelt sie live in der Laufzeit-Umgebung
    ipcMain.handle('update-region-setting', (event, newRegion) => {
        process.env.REGION = newRegion;
        console.log(`[Backend-Konfiguration] Region wurde erfolgreich auf "${newRegion.toUpperCase()}" umgestellt.`);
        return { success: true };
    });
}

module.exports = { registerIpcHandlers };
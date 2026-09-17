// --- DYNAMISCHER EXCEL/CSV EXPORT TRIGGER ---
const exportBtn = document.getElementById('export-btn');

if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        // Greift auf das globale Fenster-Array zu, das in der renderer.js befüllt wird
        const itemsToExport = window.currentLoadedItemsDataArray || [];
        
        if (!itemsToExport || itemsToExport.length === 0) {
            alert('Bitte synchronisiere zuerst dein Inventar, bevor du Daten exportieren kannst.');
            return;
        }
        
        const status = document.getElementById('status-msg');
        const oldStatus = status ? status.innerHTML : "Synchronisiert.";
        if (status) status.innerHTML = "Exportiere Daten...";
    
        const result = await require('electron').ipcRenderer.invoke('export-to-csv', itemsToExport);
        
        if (status) status.innerHTML = oldStatus;
        if (result.success) {
            alert(result.message);
        } else if (result.message !== 'Export abgebrochen.') {
            alert(`Fehler: ${result.message}`);
        }
    });
}
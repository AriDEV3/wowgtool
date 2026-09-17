// --- INTERAKTIVES REGIONS-SETTINGS MODAL ---
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const regionSelect = document.getElementById('region-select');

// Lädt die gespeicherte Region beim App-Start
const savedRegion = localStorage.getItem('user-wow-region') || 'eu';
if (regionSelect) regionSelect.value = savedRegion;

if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
}

if (modalCloseBtn && settingsModal) {
    modalCloseBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
}

if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
}

if (settingsSaveBtn && regionSelect && settingsModal) {
    settingsSaveBtn.addEventListener('click', async () => {
        const selectedRegion = regionSelect.value;
        localStorage.setItem('user-wow-region', selectedRegion);
        
        // Benachrichtige das Backend über die neue Region
        await require('electron').ipcRenderer.invoke('update-region-setting', selectedRegion);
        
        settingsModal.classList.add('hidden');
        
        // Globaler Trigger zum Neuladen der Tabelle, falls vorhanden
        if (typeof window.triggerGlobalLedgerSync === 'function') {
            window.triggerGlobalLedgerSync();
        }
    });
}
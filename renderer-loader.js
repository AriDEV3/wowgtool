// ==========================================================================
// --- RENDERER-LOADER.JS (DATENPIPELINE-EINSPEISUNG & DELTA-RESET-FIX)   ---
// ==========================================================================

const { ipcRenderer } = require('electron');

// Globale Cache-Variablen für alle Frontend-Module
window.currentLoadedItemsDataArray = [];
window.lastLoadedHistoryLog = [];
window.activeCharacterGoldList = []; // Cacht die sortierte Charakter-Liste aus dem Backend

/**
 * Kernfunktion der Datenpipeline: Ruft Daten über IPC ab und verteilt sie im DOM.
 */
async function loadBankDataPipeline() {
    const status = document.getElementById('status-msg');
    const tbody = document.getElementById('table-body');
    const accountInput = document.getElementById('account-input');
    const setupInput = document.getElementById('setup-account-input');
    
    // Ermittle den aktiven Account-Ordnernamen (Setup oder Header-Eingabe)
    const activeAccount = accountInput?.value.trim() || setupInput?.value.trim() || localStorage.getItem('user-active-wow-account') || '';
    
    if (!activeAccount) { 
        if (typeof window.showSetupScreen === 'function') window.showSetupScreen();
        return; 
    }
    
    const activeRegion = localStorage.getItem('user-wow-region') || 'eu';
    
    // Aktiviere den Ladebildschirm während des TSM-Streams und LUA-Scans
    document.getElementById('loading-screen')?.classList.remove('hidden');
    
    // Region im Backend aktualisieren und Bank Snapshot laden
    await ipcRenderer.invoke('update-region-setting', activeRegion);
    const response = await ipcRenderer.invoke('load-bank-data', activeAccount); 
    
    document.getElementById('loading-screen')?.classList.add('hidden');

    // Fehlerbehandlung für ungültige Pfade oder LUA-Strukturen
    if (response.error) {
        if (status) status.innerHTML = "Fehler beim Einlesen.";
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="color:var(--blue-accent); font-weight:700; padding:20px;">${response.error}</td></tr>`;
        return;
    }

    if (status) status.innerHTML = `Synchronisiert: ${activeAccount} (${activeRegion.toUpperCase()})`;

    // --- KORREKTUR: DELTA GEWINN/VERLUST ANZEIGE SAUBER RESETTEN ---
    const deltaDisplay = document.getElementById('delta-display');
    if (deltaDisplay) {
        // Zuerst alle alten Farb-Klassen restlos entfernen, um Farbmischungen zu verhindern
        deltaDisplay.classList.remove('profit', 'loss', 'neutral');

        if (response.delta > 0) {
            deltaDisplay.innerHTML = `+${Math.round(response.delta).toLocaleString()}g zum letzten Scan`;
            deltaDisplay.className = "delta-text profit";
        } else if (response.delta < 0) {
            deltaDisplay.innerHTML = `${Math.round(response.delta).toLocaleString()}g zum letzten Scan`;
            deltaDisplay.className = "delta-text loss";
        } else {
            // NEU: Setzt den Text bei 0 Gold Änderung exakt zurück und erzwingt die graue Neutral-Klasse
            deltaDisplay.innerHTML = `0g zum letzten Scan (Unverändert)`;
            deltaDisplay.className = "delta-text neutral";
        }
    }

    // Variablen global cachen
    window.lastLoadedHistoryLog = response.historyLog || [];
    window.currentLoadedItemsDataArray = response.items || [];
    window.activeCharacterGoldList = response.characterList || []; // Speichert die Charakter-Gold-Liste

    // Canvas-Trenddiagramm füttern
    if (typeof window.renderTrendChart === 'function') {
        window.renderTrendChart(response.historyLog || []);
    }

    // Triggert den Render-Vorgang der Gegenstands-Tabelle
    if (typeof window.sortAndRenderTable === 'function') {
        window.sortAndRenderTable();
    }

    // Triggert den Render-Vorgang der Charakter-Tabelle, falls diese Ansicht gerade aktiv ist
    if (typeof window.renderCharacterTable === 'function') {
        window.renderCharacterTable();
    }

    // --- BEFÜLLEN DER DASHBOARD METRIK-KARTEN ---
    const totalRsaEl = document.getElementById('total-rsa');
    if (totalRsaEl) {
        totalRsaEl.innerText = `${Math.round(response.totalValue).toLocaleString()}g`;
    }

    const liquidGoldEl = document.getElementById('liquid-gold-display');
    if (liquidGoldEl) {
        liquidGoldEl.innerText = `${Math.round(response.liquidGold || 0).toLocaleString()}g`;
    }

    const itemGoldEl = document.getElementById('item-gold-display');
    if (itemGoldEl) {
        itemGoldEl.innerText = `${Math.round(response.itemValue || 0).toLocaleString()}g`;
    }
}

/**
 * Liest die gecachte Charakterliste aus und injiziert die Zeilen über renderer-html.js.
 */
window.renderCharacterTable = function() {
    const charTbody = document.getElementById('character-table-body');
    if (!charTbody) return;
    
    charTbody.innerHTML = "";

    const charList = window.activeCharacterGoldList || [];

    if (charList.length === 0) {
        charTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-muted);">Keine Charaktere geladen. Bitte synchronisiere dein Inventar im Header.</td></tr>`;
        return;
    }

    // Schleife durch alle Charaktere und Generierung des HTML über die UI-Engine
    charList.forEach(c => {
        if (globalThis.ItemHtmlBuilder && typeof globalThis.ItemHtmlBuilder.buildCharacterRow === 'function') {
            const rowHtml = globalThis.ItemHtmlBuilder.buildCharacterRow(c.name, c.realm, c.goldKupfer);
            charTbody.innerHTML += rowHtml;
        }
    });
};

// Pipeline global verankern, damit renderer.js darauf zugreifen kann
window.triggerGlobalLedgerSync = loadBankDataPipeline;
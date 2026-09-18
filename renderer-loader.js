// ==========================================================================
// --- RENDERER-LOADER.JS (DATENPIPELINE-EINSPEISUNG & METRIK-STEUERUNG)   ---
// ==========================================================================

const { ipcRenderer } = require('electron');

// Globale Cache-Variablen für alle Frontend-Module
window.currentLoadedItemsDataArray = [];
window.lastLoadedHistoryLog = [];
window.activeCharacterGoldList = []; // Cacht die sortierte Charakter- und Warband-Liste aus dem Backend

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

    // Delta Gewinn/Verlust Anzeige updaten und alten CSS-Zustand bereinigen
    const deltaDisplay = document.getElementById('delta-display');
    if (deltaDisplay) {
        deltaDisplay.classList.remove('profit', 'loss', 'neutral');

        if (response.delta > 0) {
            deltaDisplay.innerHTML = `+${Math.round(response.delta).toLocaleString()}g zum letzten Scan`;
            deltaDisplay.className = "delta-text profit";
        } else if (response.delta < 0) {
            deltaDisplay.innerHTML = `${Math.round(response.delta).toLocaleString()}g zum letzten Scan`;
            deltaDisplay.className = "delta-text loss";
        } else {
            deltaDisplay.innerHTML = `0g zum letzten Scan (Unverändert)`;
            deltaDisplay.className = "delta-text neutral";
        }
    }

    // Variablen global cachen
    window.lastLoadedHistoryLog = response.historyLog || [];
    window.currentLoadedItemsDataArray = response.items || [];
    window.activeCharacterGoldList = response.characterList || []; // Speichert Charaktere inkl. Kriegsmeute

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
 * Trennt das Kriegsmeuten-Gold von den Charakteren und befüllt beide Tabellen separat.
 */
window.renderCharacterTable = function() {
    const warbandTbody = document.getElementById('warband-table-body');
    const charTbody = document.getElementById('character-table-body');
    
    if (!charTbody || !warbandTbody) return;
    
    // Beide Tabellen vor dem Rendern leeren
    warbandTbody.innerHTML = "";
    charTbody.innerHTML = "";

    const charList = window.activeCharacterGoldList || [];

    if (charList.length === 0) {
        const emptyRow = `<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-muted);">Keine Daten geladen. Bitte synchronisiere dein Inventar im Header.</td></tr>`;
        warbandTbody.innerHTML = emptyRow;
        charTbody.innerHTML = emptyRow;
        return;
    }

    let hasWarbandData = false;
    let hasCharacterData = false;

    // Schleife durch alle Einträge aus der trend-analyzer.js Response
    charList.forEach(c => {
        if (globalThis.ItemHtmlBuilder && typeof globalThis.ItemHtmlBuilder.buildCharacterRow === 'function') {
            
            // 1. FALLS ES DIE KRIEGSMEUTE IST: In die obere Tabelle schieben
            if (c.name === "Kriegsmeuten-Bank") {
                const rowHtml = globalThis.ItemHtmlBuilder.buildCharacterRow(c.name, c.realm, c.goldKupfer);
                warbandTbody.innerHTML += rowHtml;
                hasWarbandData = true;
            } 
            // 2. FALLS ES EIN CHARAKTER IST: In die untere Tabelle schieben
            else {
                const rowHtml = globalThis.ItemHtmlBuilder.buildCharacterRow(c.name, c.realm, c.goldKupfer);
                charTbody.innerHTML += rowHtml;
                hasCharacterData = true;
            }
        }
    });

    // Fallbacks generieren, falls eine der Kategorien leer ist
    if (!hasWarbandData) {
        warbandTbody.innerHTML = `<tr><td><strong>Kriegsmeuten-Bank</strong></td><td><span class="tag-compact-capsule" style="background:rgba(245,158,11,0.1); border:1px solid #d97706; color:#b45309; padding:4px 10px; border-radius:12px; font-size:0.85em; font-weight:600;">Account-Weit</span></td><td style="text-align:right; padding-right:24px;"><span style="color:var(--text-muted); font-family:monospace;">0g</span></td></tr>`;
    }
    if (!hasCharacterData) {
        charTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px; color:var(--text-muted);">Keine Einzel-Charaktere in diesem WTF-Account gefunden.</td></tr>`;
    }
};

// Pipeline global verankern, damit renderer.js darauf zugreifen kann
window.triggerGlobalLedgerSync = loadBankDataPipeline;
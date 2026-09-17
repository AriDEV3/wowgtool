const { ipcRenderer } = require('electron');

const refreshBtn = document.getElementById('refresh-btn');
if (refreshBtn) refreshBtn.addEventListener('click', loadData);

let currentSortColumn = 'recent'; 
let currentSortDirection = 'desc'; 

window.currentLoadedItemsDataArray = [];
window.triggerGlobalLedgerSync = loadData;

// --- HAUPT-LADEFUNKTION FÜR DIE TABELLENDATEN ---
async function loadData() {
    const status = document.getElementById('status-msg');
    const tbody = document.getElementById('table-body');
    const accountInput = document.getElementById('account-input');
    const setupInput = document.getElementById('setup-account-input');
    const loadingScreen = document.getElementById('loading-screen');
    const loadingSubMsg = document.getElementById('loading-msg-sub');
    
    let activeAccount = "";
    if (accountInput && accountInput.value.trim() !== "") {
        activeAccount = accountInput.value.trim();
    } else if (setupInput && setupInput.value.trim() !== "") {
        activeAccount = setupInput.value.trim();
    } else {
        activeAccount = localStorage.getItem('user-active-wow-account') || '';
    }
    
    if (!activeAccount.trim()) {
        showSetupScreen();
        return;
    }
    
    const activeRegion = localStorage.getItem('user-wow-region') || 'eu';
    
    if (loadingScreen) {
        if (loadingSubMsg) {
            loadingSubMsg.innerText = `Lade regionale ${activeRegion.toUpperCase()}-Preismatrix und scanne BankSnapshot.lua...`;
        }
        loadingScreen.classList.remove('hidden');
    }
    
    if (status) status.innerHTML = `Lese Account "${activeAccount}" ein...`;
    
    await ipcRenderer.invoke('update-region-setting', activeRegion);
    const response = await ipcRenderer.invoke('load-bank-data', activeAccount); 
    
    if (loadingScreen) loadingScreen.classList.add('hidden');

    if (response.error) {
        if (status) status.innerHTML = "Fehler.";
        if (tbody) tbody.innerHTML = `<tr><td colspan="5"><div class="error">${response.error}</div></td></tr>`;
        return;
    }

    if (status) status.innerHTML = `Synchronisiert: ${activeAccount} (${activeRegion.toUpperCase()})`;
    if (tbody) tbody.innerHTML = "";

    const deltaDisplay = document.getElementById('delta-display');
    if (deltaDisplay) {
        if (response.delta > 0) {
            deltaDisplay.innerHTML = `+${response.delta.toLocaleString()}g Gewinn zum letzten Scan`;
            deltaDisplay.className = "delta-text profit";
        } else if (response.delta < 0) {
            deltaDisplay.innerHTML = `${response.delta.toLocaleString()}g Verlust zum letzten Scan`;
            deltaDisplay.className = "delta-text loss";
        } else {
            deltaDisplay.innerHTML = `Unveraendert zum letzten Scan`;
            deltaDisplay.className = "delta-text neutral";
        }
    }

    window.lastLoadedHistoryLog = response.historyLog || [];
    if (typeof window.renderTrendChart === 'function') {
        window.renderTrendChart(response.historyLog || []);
    }

    window.currentLoadedItemsDataArray = response.items || [];
    sortAndRenderTable();

    const totalRsaEl = document.getElementById('total-rsa');
    if (totalRsaEl) {
        totalRsaEl.innerText = `${response.totalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}g`;
    }
}

function sortAndRenderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody || window.currentLoadedItemsDataArray.length === 0) return;

    let sortedItems = [];
    if (globalThis.ItemSortEngine) {
        sortedItems = globalThis.ItemSortEngine.sortItems(window.currentLoadedItemsDataArray, currentSortColumn, currentSortDirection);
    } else {
        sortedItems = window.currentLoadedItemsDataArray;
    }

    tbody.innerHTML = "";
    if (globalThis.ItemHtmlBuilder) {
        sortedItems.forEach(item => {
            const holdingHTML = globalThis.ItemHtmlBuilder.buildHoldingRows(item.holdingDetails, item);
            const currentLog = window.lastLoadedHistoryLog || [];
            const rowHTML = globalThis.ItemHtmlBuilder.buildTableRow(item, holdingHTML, currentLog);
            tbody.innerHTML += rowHTML;
        });
    }
    updateSortIcons();
}

function updateSortIcons() {
    const headers = [
        { id: 'th-name', key: 'name' },
        { id: 'th-qty', key: 'qty' },
        { id: 'th-recent', key: 'recent' },
        { id: 'th-trend', key: 'trend' }
    ];
    headers.forEach(h => {
        const el = document.getElementById(h.id);
        if (!el) return;
        if (currentSortColumn === h.key) {
            el.classList.add('active-sort');
            el.querySelector('.sort-icon').innerText = currentSortDirection === 'asc' ? '▲' : '▼';
        } else {
            el.classList.remove('active-sort');
            el.querySelector('.sort-icon').innerText = '-';
        }
    });
}

function handleHeaderClick(columnKey) {
    if (currentSortColumn === columnKey) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = columnKey;
        currentSortDirection = 'desc';
    }
    sortAndRenderTable();
}

const thName = document.getElementById('th-name');
if (thName) thName.addEventListener('click', () => handleHeaderClick('name'));
const thQty = document.getElementById('th-qty');
if (thQty) thQty.addEventListener('click', () => handleHeaderClick('qty'));
const thRecent = document.getElementById('th-recent');
if (thRecent) thRecent.addEventListener('click', () => handleHeaderClick('recent'));
const thTrend = document.getElementById('th-trend');
if (thTrend) thTrend.addEventListener('click', () => handleHeaderClick('trend'));


// --- INITIALISIERUNG & SETUP-SPERRE ROUTINEN ---
const setupScreen = document.getElementById('setup-screen');
const mainAppLayout = document.getElementById('main-app-layout');
const accountInput = document.getElementById('account-input');
const setupInput = document.getElementById('setup-account-input');
const setupRegionSelect = document.getElementById('setup-region-select');
const setupSubmitBtn = document.getElementById('setup-submit-btn');

function showSetupScreen() {
    if (setupScreen) setupScreen.classList.remove('hidden');
    if (mainAppLayout) mainAppLayout.classList.add('hidden');
    const savedRegion = localStorage.getItem('user-wow-region') || 'eu';
    if (setupRegionSelect) setupRegionSelect.value = savedRegion;
}

function hideSetupScreenAndLoad(accountName, regionValue) {
    localStorage.setItem('user-active-wow-account', accountName);
    localStorage.setItem('user-wow-region', regionValue);
    const dashboardRegionSelect = document.getElementById('region-select');
    if (dashboardRegionSelect) dashboardRegionSelect.value = regionValue;
    if (accountInput) accountInput.value = accountName;
    if (setupScreen) setupScreen.classList.add('hidden');
    if (mainAppLayout) mainAppLayout.classList.remove('hidden');
    loadData();
}

const savedAccount = localStorage.getItem('user-active-wow-account');
if (savedAccount && savedAccount.trim() !== "") {
    if (accountInput) accountInput.value = savedAccount;
    if (setupScreen) setupScreen.classList.add('hidden');
    if (mainAppLayout) mainAppLayout.classList.remove('hidden');
    loadData();
} else {
    showSetupScreen();
}

if (setupSubmitBtn) {
    setupSubmitBtn.addEventListener('click', () => {
        const accountVal = setupInput ? setupInput.value.trim() : '';
        const regionVal = setupRegionSelect ? setupRegionSelect.value : 'eu';
        if (accountVal) hideSetupScreenAndLoad(accountVal, regionVal);
    });
}
if (setupInput) {
    setupInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const accountVal = setupInput.value.trim();
            const regionVal = setupRegionSelect ? setupRegionSelect.value : 'eu';
            if (accountVal) hideSetupScreenAndLoad(accountVal, regionVal);
        }
    });
}
if (accountInput) {
    accountInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const value = accountInput.value.trim();
            if (value) {
                localStorage.setItem('user-active-wow-account', value);
                loadData();
            } else {
                localStorage.removeItem('user-active-wow-account');
                if (setupInput) setupInput.value = "";
                showSetupScreen();
            }
        }
    });
    accountInput.addEventListener('blur', (e) => {
        if (accountInput.value.trim() !== "") {
            localStorage.setItem('user-active-wow-account', accountInput.value.trim());
        }
    });
}
let currentSortColumn = 'recent'; 
let currentSortDirection = 'desc'; 

function sortItemsArray(itemsArray, column, direction) {
    if (!itemsArray || itemsArray.length === 0) return [];
    const sorted = [...itemsArray];
    let modifier = direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        switch (column) {
            case 'name': return (a.name || '').localeCompare(b.name || '') * modifier;
            case 'qty': return (a.totalQty - b.totalQty) * modifier;
            case 'recent': return (a.totalRecentValueGold - b.totalRecentValueGold) * modifier;
            case 'price': return (a.totalSaleAvgValueGold - b.totalSaleAvgValueGold) * modifier;
            case 'trend': return (a.fluctuation - b.fluctuation) * modifier;
            default: return 0;
        }
    });
    return sorted;
}

window.sortAndRenderTable = function() {
    const tbody = document.getElementById('table-body');
    const itemsToRender = window.currentLoadedItemsDataArray || [];
    
    if (!tbody) return;
    tbody.innerHTML = "";
    
    if (itemsToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Keine Gegenstände geladen. Bitte synchronisieren.</td></tr>`;
        return;
    }
    
    const sortedItems = sortItemsArray(itemsToRender, currentSortColumn, currentSortDirection);
    
    sortedItems.forEach(item => {
        if (globalThis.ItemHtmlBuilder) {
            const holdingHTML = globalThis.ItemHtmlBuilder.buildHoldingRows(item.holdingDetails);
            const rowHTML = globalThis.ItemHtmlBuilder.buildTableRow(item, holdingHTML, window.lastLoadedHistoryLog);
            tbody.innerHTML += rowHTML;
        }
    });
    
    updateSortIndicators();
};

function updateSortIndicators() {
    const headers = [
        { id: 'th-name', key: 'name' }, { id: 'th-qty', key: 'qty' }, { id: 'th-recent', key: 'recent' }, { id: 'th-trend', key: 'trend' }
    ];
    headers.forEach(h => {
        const el = document.getElementById(h.id);
        if (!el) return;
        if (currentSortColumn === h.key) {
            el.classList.add('active-sort');
            el.querySelector('.sort-icon').innerText = currentSortDirection === 'asc' ? ' ▲' : ' ▼';
        } else {
            el.classList.remove('active-sort');
            el.querySelector('.sort-icon').innerText = ' -';
        }
    });
}

function handleHeaderClick(columnKey) {
    currentSortDirection = (currentSortColumn === columnKey && currentSortDirection === 'desc') ? 'asc' : 'desc';
    currentSortColumn = columnKey;
    window.sortAndRenderTable();
}

document.addEventListener('DOMContentLoaded', () => {
    ['name', 'qty', 'recent', 'trend'].forEach(col => {
        document.getElementById(`th-${col}`)?.addEventListener('click', () => handleHeaderClick(col));
    });
});
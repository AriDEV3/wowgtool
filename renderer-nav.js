// ==========================================================================
// --- RENDERER-NAV.JS (SIDEBAR INTERACTIVE ROUTER MIT CANVAS-REDRIVE)    ---
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const btnDashboard = document.getElementById('menu-btn-dashboard');
    const btnItems = document.getElementById('menu-btn-items');
    const btnCharacters = document.getElementById('menu-btn-characters');
    
    const pageDashboard = document.getElementById('page-dashboard');
    const pageItems = document.getElementById('page-items');
    const pageCharacters = document.getElementById('page-characters');

    /**
     * Setzt alle Menüknöpfe zurück und blendet alle Inhaltsseiten aus
     */
    function hideAllPages() {
        pageDashboard?.classList.add('hidden');
        pageItems?.classList.add('hidden');
        pageCharacters?.classList.add('hidden');
        
        btnDashboard?.classList.remove('active');
        btnItems?.classList.remove('active');
        btnCharacters?.classList.remove('active');
    }

    // --- KLICK AUF HAUPTMENÜ (DASHBOARD) ---
    btnDashboard?.addEventListener('click', () => {
        hideAllPages();
        btnDashboard.classList.add('active');
        pageDashboard?.classList.remove('hidden');
        
        // KORREKTUR: Zwingt die Graph-Engine dazu, die Trendlinie sofort neu zu zeichnen,
        // sobald der Dashboard-Container im DOM wieder sichtbar ist und seine volle Breite besitzt.
        if (window.lastLoadedHistoryLog && typeof window.renderTrendChart === 'function') {
            // Ein minimaler Timeout von 10ms stellt sicher, dass der Browser das CSS-Layout final berechnet hat
            setTimeout(() => {
                window.renderTrendChart(window.lastLoadedHistoryLog);
            }, 10);
        }
    });

    // --- KLICK AUF GEGENSTÄNDE ---
    btnItems?.addEventListener('click', () => {
        hideAllPages();
        btnItems.classList.add('active');
        pageItems?.classList.remove('hidden');
    });

    // --- KLICK AUF CHARAKTERE ---
    btnCharacters?.addEventListener('click', () => {
        hideAllPages();
        btnCharacters.classList.add('active');
        pageCharacters?.classList.remove('hidden');
        
        // Rendert die Charaktertabelle frisch aus den gecachten Daten
        if (typeof window.renderCharacterTable === 'function') {
            window.renderCharacterTable();
        }
    });
});
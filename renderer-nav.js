// --- VERTICAL SIDEBAR INTERACTIVE NAVIGATION ROUTER ---
document.addEventListener('DOMContentLoaded', () => {
    const btnDashboard = document.getElementById('menu-btn-dashboard');
    const btnItems = document.getElementById('menu-btn-items');
    const pageDashboard = document.getElementById('page-dashboard');
    const pageItems = document.getElementById('page-items');

    if (btnDashboard && btnItems && pageDashboard && pageItems) {
        // Klick auf Hauptmenü
        btnDashboard.addEventListener('click', () => {
            btnDashboard.classList.add('active');
            btnItems.classList.remove('active');
            pageDashboard.classList.remove('hidden');
            pageItems.classList.add('hidden');
        });

        // Klick auf Gegenstände (Ledger)
        btnItems.addEventListener('click', () => {
            btnItems.classList.add('active');
            btnDashboard.classList.remove('active');
            pageItems.classList.remove('hidden');
            pageDashboard.classList.add('hidden');
            
            // Verhindert, dass das Chart nach dem Einblenden unsichtbar bleibt
            if (window.lastLoadedHistoryLog && typeof window.renderTrendChart === 'function') {
                window.renderTrendChart(window.lastLoadedHistoryLog);
            }
        });
    }
});
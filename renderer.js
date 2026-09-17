// --- RENDERER.JS (CORE ORCHESTRATOR & APPLIKATIONS-BOOT) ---

// Koppel den globalen Refresh-Button an den Loader
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (typeof window.triggerGlobalLedgerSync === 'function') {
                window.triggerGlobalLedgerSync();
            }
        });
    }

    const accountInputField = document.getElementById('account-input');
    if (accountInputField) {
        accountInputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && accountInputField.value.trim()) {
                localStorage.setItem('user-active-wow-account', accountInputField.value.trim().toUpperCase());
                if (typeof window.triggerGlobalLedgerSync === 'function') {
                    window.triggerGlobalLedgerSync();
                }
            }
        });
    }

    // --- ENTSCHEIDUNG BEIM BOOT-VORGANG ---
    const savedAccount = localStorage.getItem('user-active-wow-account');
    if (savedAccount && savedAccount.trim() !== "") {
        if (accountInputField) accountInputField.value = savedAccount;
        document.getElementById('setup-screen')?.classList.add('hidden');
        document.getElementById('main-app-layout')?.classList.remove('hidden');
        
        // Starte die Datenpipeline
        if (typeof window.triggerGlobalLedgerSync === 'function') {
            window.triggerGlobalLedgerSync();
        }
    } else {
        if (typeof window.showSetupScreen === 'function') {
            window.showSetupScreen();
        }
    }
});

// Setup-Screen Sichtbarkeit steuern
window.showSetupScreen = function() {
    const setupScreen = document.getElementById('setup-screen');
    const mainAppLayout = document.getElementById('main-app-layout');
    if (setupScreen) setupScreen.classList.remove('hidden');
    if (mainAppLayout) mainAppLayout.classList.add('hidden');
    
    if (typeof window.initializeSetupEventListeners === 'function') {
        window.initializeSetupEventListeners();
    }
};
// --- RENDERER-THEME.JS (DESIGN-STEUERUNG) ---
function applyThemeToApp(themeName) {
    if (!themeName || themeName === 'light') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', themeName);
    }
}

function initializeThemeEngine() {
    const themeSelect = document.getElementById('theme-select');
    const savedTheme = localStorage.getItem('user-ledger-theme') || 'light';
    
    // Design sofort beim Laden anwenden
    applyThemeToApp(savedTheme);
    
    if (themeSelect) {
        themeSelect.value = savedTheme;
        
        themeSelect.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;
            applyThemeToApp(selectedTheme);
            localStorage.setItem('user-ledger-theme', selectedTheme);
        });
    }
}

// Initialisiere die Theme-Engine direkt beim Laden der Datei
document.addEventListener('DOMContentLoaded', initializeThemeEngine);
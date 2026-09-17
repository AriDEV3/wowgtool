const fs = require('fs');
const path = require('path');

// --- HTML TEMPLATE INJECTION ENGINE ---
function injectTemplates() {
    try {
        const templateDir = path.join(__dirname, 'templates');
        
        // Fragmente synchron einlesen und in die Mount-Points einbetten
        document.getElementById('setup-screen').innerHTML = fs.readFileSync(path.join(templateDir, 'setup.html'), 'utf8');
        document.getElementById('app-header-mount').innerHTML = fs.readFileSync(path.join(templateDir, 'header.html'), 'utf8');
        document.getElementById('app-sidebar-mount').innerHTML = fs.readFileSync(path.join(templateDir, 'sidebar.html'), 'utf8');
        document.getElementById('page-dashboard').innerHTML = fs.readFileSync(path.join(templateDir, 'dashboard.html'), 'utf8');
        document.getElementById('page-items').innerHTML = fs.readFileSync(path.join(templateDir, 'items.html'), 'utf8');
        document.getElementById('app-footer-mount').innerHTML = fs.readFileSync(path.join(templateDir, 'footer.html'), 'utf8');
        
        // Minimalen Lade-Spinner statisch generieren
        document.getElementById('loading-screen').innerHTML = `
            <div class="loading-card">
                <div class="loading-spinner"></div>
                <h3 id="loading-msg-title">Datenverbindung wird hergestellt</h3>
                <p id="loading-msg-sub">Analysiere BankSnapshot.lua und synchronisiere TSM-Datenströme...</p>
            </div>`;
            
        console.log("[Template Loader] Alle HTML-Fragmente erfolgreich injiziert.");
    } catch (err) {
        console.error("[Template Loader Kritischer Fehler]:", err);
    }
}

// Sofort ausführen
injectTemplates();
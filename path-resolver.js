const path = require('path');
const fs = require('fs');

function resolveLuaPath(selectedAccount) {
    let foundPath = null;

    // 1. PRIORITÄT: Prüfen, ob der Benutzer die WOW_WTF_PATH Variable definiert hat
    if (process.env.WOW_WTF_PATH) {
        // Bereinigt den Pfad von eventuellen Anführungszeichen, die beim Kopieren entstehen
        const cleanWtfBase = process.env.WOW_WTF_PATH.replace(/["']/g, '').trim();
        
        // Baut den Pfad: WOW_WTF_PATH + Account + SavedVariables + BankSnapshot.lua
        const envDerivedPath = path.join(cleanWtfBase, 'Account', selectedAccount, 'SavedVariables', 'BankSnapshot.lua');
        
        console.log(`[Pfad-Resolver] Teste benutzerdefinierten WOW_WTF_PATH: ${envDerivedPath}`);
        if (fs.existsSync(envDerivedPath)) {
            foundPath = envDerivedPath;
        }
    }

    // 2. PRIORITÄT: Sicherheitsnetz (Fallback), falls die Variable nicht gesetzt oder falsch ist
    if (!foundPath) {
        const standardPaths = [
            `C:\\Program Files (x86)\\World of Warcraft\\_retail_\\WTF\\Account\\${selectedAccount}\\SavedVariables`,
            `C:\\Program Files\\World of Warcraft\\_retail_\\WTF\\Account\\${selectedAccount}\\SavedVariables`,
            `/Applications/World of Warcraft/_retail_/WTF/Account/${selectedAccount}/SavedVariables`
        ];

        for (const base of standardPaths) {
            const fullPath = path.join(base, 'BankSnapshot.lua');
            if (fs.existsSync(fullPath)) {
                foundPath = fullPath;
                break;
            }
        }
    }

    // 3. FEHLER-CHECK: Wenn nirgends eine Datei gefunden wurde
    if (!foundPath) {
        let errorMsg = `Die Addon-Datei "BankSnapshot.lua" konnte nicht gefunden werden.`;
        if (process.env.WOW_WTF_PATH) {
            errorMsg += ` Geprüfter WOW_WTF_PATH war: "${process.env.WOW_WTF_PATH}".`;
        }
        errorMsg += ` Bitte stelle sicher, dass der Pfad stimmt und du im Spiel eingeloggt warst.`;
        
        return { error: errorMsg };
    }

    console.log(`[Pfad-Resolver] Addon-Daten erfolgreich lokalisiert: ${foundPath}`);
    return { luaPath: foundPath };
}

module.exports = { resolveLuaPath };
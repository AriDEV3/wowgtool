/**
 * Robuster, hierarchischer LUA-Parser basierend auf Einrückungstiefe und Struktur-Kontext.
 * @param {string} fileContent - Der rohe Textinhalt der BankSnapshot.lua
 * @returns {Object} Das strukturierte JavaScript-Datenobjekt (realms, warband, names, warbandGold)
 */
function cleanAndParseLua(fileContent) {
    const data = { realms: {}, warband: {}, names: {}, warbandGold: 0 };
    
    // Entferne LUA-Kommentare und spalte den Inhalt in einzelne Zeilen
    const cleanContent = fileContent.replace(/--.*$/gm, '');
    const lines = cleanContent.split(/\r?\n/);
    
    // Pfad-Tracker für die hierarchische Tiefe
    let currentScope = 'GLOBAL'; // GLOBAL -> REALMS -> REALM -> CHAR -> SUB_CONTAINER
    let currentRealm = null;
    let currentCharacter = null;
    let currentContainer = null; // 'bags' oder 'bank'

    lines.forEach(line => {
        const trimmed = line.trim();
        
        // Ignoriere leere Zeilen und die Hauptvariablen-Deklaration
        if (!trimmed || trimmed === 'BankSnapshotDB = {' || trimmed === 'BankSnapshotDB={') return;

        // --- 1. SCOPE-STEUERUNG ANHAND SCHLIESSENDER KLAMMERN ---
        if (trimmed === '}' || trimmed === '},' || trimmed === '}') {
            if (currentScope === 'SUB_CONTAINER') {
                currentScope = 'CHAR';
                currentContainer = null;
            } else if (currentScope === 'CHAR') {
                currentScope = 'REALM';
                currentCharacter = null;
            } else if (currentScope === 'REALM') {
                currentScope = 'REALMS';
                currentRealm = null;
            } else {
                currentScope = 'GLOBAL';
            }
            return;
        }

        // --- 2. SCOPE-STEUERUNG ANHAND ÖFFNENDER BLÖCKE ---
        if (trimmed.includes('{')) {
            // Globale Hauptkategorien abfangen
            if (trimmed.startsWith('["warband"]') || trimmed.startsWith('"warband"')) { currentScope = 'WARBAND'; return; }
            if (trimmed.startsWith('["names"]') || trimmed.startsWith('"names"')) { currentScope = 'NAMES'; return; }
            if (trimmed.startsWith('["realms"]') || trimmed.startsWith('"realms"')) { currentScope = 'REALMS'; return; }

            // Verschachtelte Blöcke innerhalb der Realms und Charaktere auflösen
            const blockMatch = trimmed.match(/\["([^"]+)"\]\s*=\s*\{/);
            if (blockMatch) {
                const blockKey = blockMatch[1];
                
                if (currentScope === 'REALMS') {
                    currentRealm = blockKey;
                    data.realms[currentRealm] = {};
                    currentScope = 'REALM';
                } else if (currentScope === 'REALM') {
                    currentCharacter = blockKey;
                    data.realms[currentRealm][currentCharacter] = { bags: {}, bank: {}, gold: 0 };
                    currentScope = 'CHAR';
                } else if (currentScope === 'CHAR') {
                    if (blockKey === 'bags' || blockKey === 'bank') {
                        currentContainer = blockKey;
                        currentScope = 'SUB_CONTAINER';
                    }
                }
            }
            return;
        }

        // --- 3. WERTE-EXTRAKTION (ITEMS, CHAR-GOLD, KRIEGSMEITEN-GOLD & CACHE) ---
        const valueMatch = trimmed.match(/(?:\["([^"]+)"\]|\[(\d+)\]|([a-zA-Z0-9_]+))\s*=\s*(.*)/);
        if (valueMatch) {
            // Ermittle den gefundenen Schlüssel aus den Regex-Capture-Groups
            const key = valueMatch[1] || valueMatch[2] || valueMatch[3];
            let rawVal = valueMatch[4].replace(/,$/, '').trim();
            
            // Bereinige eventuelle Anführungszeichen bei Text-Strings
            let cleanStrVal = rawVal.replace(/^["']|["']$/g, '');

            if (currentScope === 'NAMES') {
                data.names[key] = cleanStrVal;
            } else if (currentScope === 'WARBAND') {
                const itemId = parseInt(key, 10);
                const qty = parseInt(rawVal, 10);
                if (!isNaN(itemId) && !isNaN(qty)) data.warband[itemId] = qty;
            } else if (key === 'warbandGold') {
                // NEU: Extrahiert dein Kriegsmeuten-Bankgold auf globaler LUA-Ebene
                data.warbandGold = parseFloat(rawVal) || 0;
            } else if (key === 'gold') {
                // Liest das flüssige Gold im Charakter-Kontext aus
                if (currentRealm && currentCharacter) {
                    data.realms[currentRealm][currentCharacter].gold = parseInt(rawVal, 10) || 0;
                }
            } else if (currentScope === 'SUB_CONTAINER' && currentContainer) {
                const itemId = parseInt(key, 10);
                const qty = parseInt(rawVal, 10);
                if (!isNaN(itemId) && !isNaN(qty)) {
                    data.realms[currentRealm][currentCharacter][currentContainer][itemId] = qty;
                }
            }
        }
    });

    return data;
}

module.exports = { cleanAndParseLua };
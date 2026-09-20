/**
 * Hierarchischer LUA-Parser für die BankSnapshot-Struktur.
 * Abgestimmt auf den gebündelten Charakter-Block inklusive Soulbound-Filter.
 */
function cleanAndParseLua(fileContent) {
    const data = { realms: {}, warband: {}, names: {}, warbandGold: 0 };
    
    if (!fileContent) return data;

    const cleanContent = fileContent.replace(/--.*$/gm, '');
    const lines = cleanContent.split(/\r?\n/);
    
    let currentScope = 'GLOBAL'; // GLOBAL -> REALMS -> REALM -> CHAR -> SUB_CONTAINER
    let currentRealm = null;
    let currentCharacter = null;
    let currentContainer = null; // 'bags', 'bank' oder 'soulbound'

    lines.forEach(line => {
        const trimmed = line.trim();
        
        if (!trimmed || trimmed === 'BankSnapshotDB = {' || trimmed === 'BankSnapshotDB={') return;

        // --- 1. SCOPE-STEUERUNG ---
        if (trimmed === '}' || trimmed === '},') {
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

        // --- 2. BLÖCKE ERKENNEN ---
        if (trimmed.includes('{')) {
            if (trimmed.startsWith('["warband"]') || trimmed.startsWith('"warband"')) { currentScope = 'WARBAND'; return; }
            if (trimmed.startsWith('["names"]') || trimmed.startsWith('"names"')) { currentScope = 'NAMES'; return; }
            if (trimmed.startsWith('["realms"]') || trimmed.startsWith('"realms"')) { currentScope = 'REALMS'; return; }

            const blockMatch = trimmed.match(/\["([^"]+)"\]\s*=\s*\{/);
            if (blockMatch) {
                const blockKey = blockMatch[1]; // Holt den reinen String-Inhalt der Klammer
                
                if (currentScope === 'REALMS') {
                    currentRealm = blockKey;
                    data.realms[currentRealm] = {};
                    currentScope = 'REALM';
                } else if (currentScope === 'CHAR' && (blockKey === 'bags' || blockKey === 'bank' || blockKey === 'soulbound')) {
                    // WICHTIG: Erst prüfen, ob es ein Unterordner des Charakters ist!
                    currentContainer = blockKey;
                    currentScope = 'SUB_CONTAINER';
                } else if (currentScope === 'REALM') {
                    // Wenn wir im Realm-Scope sind, ist es garantiert ein Charakter
                    currentCharacter = blockKey;
                    data.realms[currentRealm][currentCharacter] = { gold: 0, bags: {}, bank: {}, soulbound: {} };
                    currentScope = 'CHAR';
                }
            }
            return;
        }

        // --- 3. WERTE EXTRAHIEREN ---
        const valueMatch = trimmed.match(/(?:\["([^"]+)"\]|\[(\d+)\]|([a-zA-Z0-9_]+))\s*=\s*(.*)/);
        if (valueMatch) {
            const key = valueMatch[1] || valueMatch[2] || valueMatch[3];
            let rawVal = valueMatch[4].replace(/,$/, '').trim();
            let cleanStrVal = rawVal.replace(/^["']|["']$/g, '');

            if (currentScope === 'NAMES') {
                data.names[key] = cleanStrVal;
            } else if (currentScope === 'WARBAND') {
                if (key === 'warbandGold') {
                    data.warbandGold = parseFloat(rawVal) || 0;
                } else {
                    const itemId = parseInt(key, 10);
                    const qty = parseInt(rawVal, 10);
                    if (!isNaN(itemId) && !isNaN(qty)) data.warband[itemId] = qty;
                }
            } else if (key === 'warbandGold') {
                data.warbandGold = parseFloat(rawVal) || 0;
            } else if (key === 'gold') {
                if (currentRealm && currentCharacter && data.realms[currentRealm][currentCharacter]) {
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
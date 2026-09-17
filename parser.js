function cleanAndParseLua(fileContent) {
    let jsonText = fileContent;
    jsonText = jsonText.replace(/^\s*BankSnapshotDB\s*=\s*/, '');
    jsonText = jsonText.replace(/\[\s*["']?([^"'\]]+)["']?\s*\]\s*=\s*/g, '"$1":');
    jsonText = jsonText.replace(/,\s*([\}\]])/g, '$1');
    jsonText = jsonText.trim();
    if (jsonText.endsWith(';')) jsonText = jsonText.slice(0, -1);

    try {
        return JSON.parse(jsonText);
    } catch (e) {
        return parseLuaDefensive(fileContent);
    }
}

function parseLuaDefensive(fileContent) {
    const data = { realms: {}, warband: {}, names: {} };
    let currentCategory = null;
    let currentRealm = null;
    let currentCharacter = null;

    const lines = fileContent.split(/\r?\n/);
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.includes('"warband"') && trimmed.includes('{')) { currentCategory = 'warband'; return; }
        if (trimmed.includes('"names"') && trimmed.includes('{')) { currentCategory = 'names'; return; }

        const headerMatch = trimmed.match(/"([^"]+)":\s*\{/);
        if (headerMatch) {
            const name = headerMatch[1];
            if (name === 'realms') return;
            if (name === 'bags') { currentCategory = 'bags'; return; }
            if (name === 'bank') { currentCategory = 'bank'; return; }

            if (!currentRealm) {
                currentRealm = name;
                data.realms[currentRealm] = {};
            } else if (!currentCharacter) {
                currentCharacter = name;
                data.realms[currentRealm][currentCharacter] = { bags: {}, bank: {} };
            }
            return;
        }

        if (trimmed === '}' || trimmed === '},') {
            if (currentCategory === 'bags' || currentCategory === 'bank') currentCategory = null;
            else if (currentCharacter) currentCharacter = null;
            else if (currentRealm) currentRealm = null;
            else currentCategory = null;
            return;
        }

        const keyValueMatch = trimmed.match(/"([^"]+)":\s*(.*)/);
        if (keyValueMatch) {
            const key = keyValueMatch[1];
            let val = keyValueMatch[2].replace(/,$/, '').trim();
            
            if (currentCategory === 'names') {
                val = val.replace(/^["']|["']$/g, '');
                data.names[parseInt(key, 10)] = val;
            } else {
                const itemId = parseInt(key, 10);
                const qty = parseInt(val, 10);
                if (!isNaN(itemId) && !isNaN(qty)) {
                    if (currentCategory === 'warband') data.warband[itemId] = qty;
                    else if (currentCategory === 'bags' && currentRealm && currentCharacter) data.realms[currentRealm][currentCharacter].bags[itemId] = qty;
                    else if (currentCategory === 'bank' && currentRealm && currentCharacter) data.realms[currentRealm][currentCharacter].bank[itemId] = qty;
                }
            }
        }
    });
    return data;
}

module.exports = { cleanAndParseLua };
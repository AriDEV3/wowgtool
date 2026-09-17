// --- INVENTORY-AGGREGATOR.JS (ROBUSTE CROSS-REALM MATRIX) ---
function aggregateInventory(db) {
    const masterItemMap = new Map();
    
    const addOwnership = (itemId, qty, location, realm, character) => {
        const idNum = parseInt(itemId, 10);
        const qtyNum = parseInt(qty, 10);
        if (isNaN(idNum) || isNaN(qtyNum) || qtyNum <= 0) return;

        if (!masterItemMap.has(idNum)) {
            masterItemMap.set(idNum, { id: idNum, totalQty: 0, holdingDetails: [] });
        }
        const entry = masterItemMap.get(idNum);
        entry.totalQty += qtyNum;
        entry.holdingDetails.push({ location, realm, character, qty: qtyNum });
    };

    if (db && db.realms) {
        for (const [realm, characters] of Object.entries(db.realms)) {
            for (const [character, containers] of Object.entries(characters)) {
                if (containers.bags) {
                    for (const [id, qty] of Object.entries(containers.bags)) {
                        addOwnership(id, qty, 'Bags', realm, character);
                    }
                }
                if (containers.bank) {
                    for (const [id, qty] of Object.entries(containers.bank)) {
                        addOwnership(id, qty, 'Bank', realm, character);
                    }
                }
            }
        }
    }

    if (db && db.warband) {
        for (const [id, qty] of Object.entries(db.warband)) {
            addOwnership(id, qty, 'Warband Bank', 'Account Wide', 'Shared');
        }
    }

    return masterItemMap;
}

module.exports = { aggregateInventory };
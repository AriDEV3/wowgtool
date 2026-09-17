function aggregateInventory(db) {
    const masterItemMap = new Map();
    
    const addOwnership = (itemId, qty, location, realm, character) => {
        if (!masterItemMap.has(itemId)) {
            masterItemMap.set(itemId, { id: itemId, totalQty: 0, holdingDetails: [] });
        }
        const entry = masterItemMap.get(itemId);
        entry.totalQty += qty;
        entry.holdingDetails.push({ location, realm, character, qty });
    };

    if (db.realms) {
        for (const [realm, characters] of Object.entries(db.realms)) {
            for (const [character, containers] of Object.entries(characters)) {
                if (containers.bags) {
                    for (const [id, qty] of Object.entries(containers.bags)) addOwnership(parseInt(id, 10), qty, 'Bags', realm, character);
                }
                if (containers.bank) {
                    for (const [id, qty] of Object.entries(containers.bank)) addOwnership(parseInt(id, 10), qty, 'Bank', realm, character);
                }
            }
        }
    }

    if (db.warband) {
        for (const [id, qty] of Object.entries(db.warband)) {
            addOwnership(parseInt(id, 10), qty, 'Warband Bank', 'Account Wide', 'Shared');
        }
    }

    return masterItemMap;
}

module.exports = { aggregateInventory };
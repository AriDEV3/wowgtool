const path = require('path');
const fs = require('fs');
const { fetchTSMPricesStream } = require('./tsm');
const { cleanAndParseLua } = require('./parser');

async function processBankData(selectedAccount) {
    const wtfBase = process.env.WOW_WTF_PATH;
    if (!wtfBase) {
        return { error: "Umgebungsvariable WOW_WTF_PATH ist in der .env nicht definiert." };
    }

    const luaPath = path.join(wtfBase, 'Account', selectedAccount, 'SavedVariables', 'BankSnapshotter.lua'); 
    if (!fs.existsSync(luaPath)) {
        return { error: `SavedVariables-Datei fuer Account "${selectedAccount}" nicht gefunden unter:\n"${luaPath}"` };
    }

    const fileContent = fs.readFileSync(luaPath, 'utf8');
    const db = cleanAndParseLua(fileContent);
    if (!db) return { error: "Struktur der SavedVariables-Datei konnte nicht gelesen werden." };

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

    const priceMap = await fetchTSMPricesStream();
    
    // --- TIMELINE-HISTORIE LADEN ---
    const historyPath = path.join(__dirname, 'history_log.json');
    let history = [];
    if (fs.existsSync(historyPath)) {
        try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch(e) {}
    }
    
    const now = new Date();
    const target14DaysAgoMs = now.getTime() - (14 * 24 * 60 * 60 * 1000);
    
    let referenceSnapshot = history.length > 0 ? history[0] : null; 
    let bestDiff = Infinity;

    history.forEach(snap => {
        if (snap.rawTimestamp) {
            const snapTime = new Date(snap.rawTimestamp).getTime();
            const currentDiff = Math.abs(snapTime - target14DaysAgoMs);
            if (currentDiff < bestDiff) {
                bestDiff = currentDiff;
                referenceSnapshot = snap;
            }
        }
    });

    const lastSnapshot = history.length > 0 ? history[history.length - 1] : null;
    const enrichedItems = [];
    const namesDb = db.names || {};
    let totalRecentGoldSum = 0; 

    for (const item of masterItemMap.values()) {
        const tsmMetrics = priceMap.get(item.id) || { marketValue: 0, dbRecent: 0, regionSaleAvg: 0 };
        const recentGold = (tsmMetrics.dbRecent || 0) / 10000;
        totalRecentGoldSum += (recentGold * item.totalQty);
    }

    for (const item of masterItemMap.values()) {
        const name = namesDb[item.id] || `Unbekannter Gegenstand (#${item.id})`;
        const tsmMetrics = priceMap.get(item.id) || { marketValue: 0, dbRecent: 0, regionSaleAvg: 0 };
        
        const mvGold = tsmMetrics.marketValue / 10000;         
        const recentGold = (tsmMetrics.dbRecent || 0) / 10000; 
        const rsaGold = (tsmMetrics.regionSaleAvg || 0) / 10000; 
        
        const finalRsaGold = isNaN(rsaGold) ? 0 : rsaGold;
        const finalMvGold = isNaN(mvGold) ? 0 : mvGold;
        const finalRecentGold = isNaN(recentGold) ? 0 : recentGold;
        
        const totalItemWorthRecent = finalRecentGold * item.totalQty; 

        // Rregionale Items (Commodities) erkennen
        const isRegionalCommodity = item.holdingDetails.some(d => d.qty > 1) || item.totalQty > 20;

        let currentPriceForTrend = finalRecentGold; 
        let historicPriceBasis = 0;

        if (isRegionalCommodity && finalRsaGold > 0) {
            currentPriceForTrend = finalRsaGold; // Region-Modus
        }

        if (referenceSnapshot && referenceSnapshot.itemPrices && referenceSnapshot.itemPrices[item.id] !== undefined) {
            historicPriceBasis = referenceSnapshot.itemPrices[item.id];
        }

        if (historicPriceBasis === 0 || historicPriceBasis === currentPriceForTrend) {
            if (isRegionalCommodity) {
                if (finalMvGold > 0 && finalRsaGold !== finalMvGold) historicPriceBasis = finalMvGold; 
                else historicPriceBasis = finalRsaGold; 
            } else {
                if (finalMvGold > 0 && finalRecentGold !== finalMvGold) historicPriceBasis = finalMvGold;
                else historicPriceBasis = finalRecentGold;
            }
        }

        let priceFluctuation = 0;
        if (currentPriceForTrend > 0 && historicPriceBasis > 0) {
            priceFluctuation = ((currentPriceForTrend - historicPriceBasis) / historicPriceBasis) * 100;
        }

        enrichedItems.push({
            ...item,
            name: name,
            regionSaleAvgGold: finalRsaGold,
            marketValueGold: finalMvGold,
            dbRecentGold: finalRecentGold,
            totalMarketValueGold: finalMvGold * item.totalQty,
            totalRecentValueGold: totalItemWorthRecent,
            totalSaleAvgValueGold: finalRsaGold * item.totalQty,
            oldPriceGold: historicPriceBasis, 
            fluctuation: priceFluctuation     
        });
    }

    const currentDate = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isoString = new Date().toISOString();

    const currentItemPrices = {};
    enrichedItems.forEach(i => {
        const isRegional = i.holdingDetails.some(d => d.qty > 1) || i.totalQty > 20;
        currentItemPrices[i.id] = isRegional ? i.regionSaleAvgGold : i.dbRecentGold;
    });

    const previousTotal = referenceSnapshot ? referenceSnapshot.value : totalRecentGoldSum;
    const deltaGold = totalRecentGoldSum - previousTotal;

    if (history.length === 0 || (lastSnapshot && lastSnapshot.value !== totalRecentGoldSum)) {
        history.push({ 
            date: currentDate,
            time: currentTime,
            value: Math.round(totalRecentGoldSum),
            rawTimestamp: isoString,
            itemPrices: currentItemPrices
        });
        if (history.length > 150) history.shift(); 
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
    }

    return { 
        items: enrichedItems,
        totalValue: totalRecentGoldSum,
        delta: deltaGold,
        historyLog: history
    };
}

module.exports = { processBankData };
const fs = require('fs');
const path = require('path');

/**
 * Verarbeitet Markttrends, Sparklines und berechnet den kumulierten Gesamtwert (Gold + Items).
 */
function processTrendsAndSnapshots(masterItemMap, priceMap, namesDb, db) {
    const historyPath = path.join(__dirname, 'history_log.json');
    let history = [];
    if (fs.existsSync(historyPath)) {
        try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch(e) {}
    }
    
    const now = new Date();
    const target14DaysAgoMs = now.getTime() - (14 * 24 * 60 * 60 * 1000);
    
    let referenceSnapshot = null; 
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
    
    // --- 1. VOLUMENBERECHNUNG & CHARAKTERLISTE (INKL. KRIEGSMEITEN-BANKGOLD) ---
    let totalCharacterGoldSum = 0;
    let totalItemGoldSum = 0; 
    const characterGoldList = [];

    // Kriegsmeuten-Bankgold auswerten (falls im LUA vorhanden)
    const rawWarbandGold = db && db.warbandGold ? parseFloat(db.warbandGold) : 0;
    if (!isNaN(rawWarbandGold) && rawWarbandGold > 0) {
        totalCharacterGoldSum += (rawWarbandGold / 10000); // Zu flüssigem Gesamtgold addieren
        
        // Virtuellen Eintrag für die Charakterliste im Frontend erzeugen
        characterGoldList.push({
            name: "Kriegsmeuten-Bank",
            realm: "Account-Weit",
            goldKupfer: rawWarbandGold
        });
    }

    // Normales Charakter-Gold auswerten
    if (db && db.realms) {
        for (const [realmName, characters] of Object.entries(db.realms)) {
            for (const [charName, charData] of Object.entries(characters)) {
                if (charData && charData.gold !== undefined) {
                    const rawGoldValue = parseFloat(charData.gold);
                    if (!isNaN(rawGoldValue)) {
                        totalCharacterGoldSum += (rawGoldValue / 10000);
                        
                        characterGoldList.push({
                            name: charName,
                            realm: realmName,
                            goldKupfer: rawGoldValue
                        });
                    }
                }
            }
        }
    }

    // Sortiert die Gesamtliste absteigend nach Goldbestand
    characterGoldList.sort((a, b) => b.goldKupfer - a.goldKupfer);

    // TSM-Marktwerte akkumulieren
    for (const item of masterItemMap.values()) {
        const tsmMetrics = priceMap.get(item.id) || { regionAvgSalePrice: 0, realmRecent: 0 };
        const rsaGold = (tsmMetrics.regionAvgSalePrice || 0) / 10000;
        const recentGold = (tsmMetrics.realmRecent || 0) / 10000;
        let determinedPrice = rsaGold > 0 ? rsaGold : recentGold;
        totalItemGoldSum += (determinedPrice * item.totalQty); 
    }

    const totalMixedGoldSum = totalCharacterGoldSum + totalItemGoldSum;

    const roundedCurrentValue = Math.round(totalMixedGoldSum);
    const roundedLastValue = lastSnapshot ? Math.round(lastSnapshot.value) : roundedCurrentValue;
    const deltaGold = roundedCurrentValue - roundedLastValue;

    // --- 2. DURCHLAUF: ENRICHMENT FÜR GEGENSTÄNDE ---
    for (const item of masterItemMap.values()) {
        const name = namesDb[item.id] || `Unbekannter Gegenstand (#${item.id})`;
        const tsmMetrics = priceMap.get(item.id) || { regionMarketValue: 0, regionAvgSalePrice: 0, realmMarketValue: 0, realmRecent: 0 };
        
        const rsaGold = (tsmMetrics.regionAvgSalePrice || 0) / 10000;
        const recentGold = (tsmMetrics.realmRecent || 0) / 10000;
        const regionMvGold = (tsmMetrics.regionMarketValue || 0) / 10000;
        const realmMvGold = (tsmMetrics.realmMarketValue || 0) / 10000;

        let activeLivePriceGold = rsaGold > 0 ? rsaGold : recentGold;
        let activeMarketValueGold = rsaGold > 0 ? regionMvGold : realmMvGold;
        if (activeMarketValueGold === 0) activeMarketValueGold = realmMvGold || regionMvGold;

        const totalItemWorthActive = activeLivePriceGold * item.totalQty; 

        let historicPriceBasis = 0;
        if (referenceSnapshot && referenceSnapshot.itemPrices && referenceSnapshot.itemPrices[item.id] !== undefined) {
            historicPriceBasis = referenceSnapshot.itemPrices[item.id];
        }

        if (historicPriceBasis === 0 || historicPriceBasis === activeLivePriceGold) {
            historicPriceBasis = (activeMarketValueGold > 0 && activeLivePriceGold !== activeMarketValueGold) ? activeMarketValueGold : activeLivePriceGold;
        }

        let priceFluctuation = 0;
        if (activeLivePriceGold > 0 && historicPriceBasis > 0) {
            priceFluctuation = ((activeLivePriceGold - historicPriceBasis) / historicPriceBasis) * 100;
        }

        enrichedItems.push({
            ...item,
            name: name,
            regionSaleAvgGold: rsaGold,
            marketValueGold: activeMarketValueGold,
            dbRecentGold: activeLivePriceGold, 
            totalMarketValueGold: activeMarketValueGold * item.totalQty,
            totalRecentValueGold: totalItemWorthActive, 
            totalSaleAvgValueGold: rsaGold * item.totalQty,
            oldPriceGold: historicPriceBasis, 
            fluctuation: priceFluctuation     
        });
    }

    // --- 3. HISTORIE LOGGEN ---
    const currentDate = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isoString = new Date().toISOString();

    const currentItemPrices = {};
    enrichedItems.forEach(i => { currentItemPrices[i.id] = i.dbRecentGold; });

    if (history.length === 0 || (lastSnapshot && Math.round(lastSnapshot.value) !== roundedCurrentValue)) {
        history.push({ 
            date: currentDate,
            time: currentTime,
            value: roundedCurrentValue,
            rawTimestamp: isoString,
            itemPrices: currentItemPrices
        });
        if (history.length > 200) history.shift(); 
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
    }

    return { 
        items: enrichedItems,
        totalValue: totalMixedGoldSum,
        liquidGold: totalCharacterGoldSum,
        itemValue: totalItemGoldSum,
        delta: deltaGold, 
        historyLog: history,
        characterList: characterGoldList
    };
}

module.exports = { processTrendsAndSnapshots };
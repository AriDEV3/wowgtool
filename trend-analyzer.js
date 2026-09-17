const fs = require('fs');
const path = require('path');

function processTrendsAndSnapshots(masterItemMap, priceMap, namesDb) {
    const historyPath = path.join(__dirname, 'history_log.json');
    let history = [];
    if (fs.existsSync(historyPath)) {
        try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch(e) {}
    }
    
    const now = new Date();
    const target14DaysAgoMs = now.getTime() - (14 * 24 * 60 * 60 * 1000);
    
    let referenceSnapshot = history.length > 0 ? history : null; 
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
    let totalMixedGoldSum = 0; 

    // 1. DURCHLAUF: Gesamtwert berechnen basierend auf der neuen Hierarchie
    for (const item of masterItemMap.values()) {
        const tsmMetrics = priceMap.get(item.id) || { regionMarketValue: 0, regionAvgSalePrice: 0, realmMarketValue: 0, realmRecent: 0 };
        
        const rsaGold = (tsmMetrics.regionAvgSalePrice || 0) / 10000;
        const recentGold = (tsmMetrics.realmRecent || 0) / 10000;

        // ERZWUNGENE PRIORISIERUNG: Nutze RSA (Region), außer der Wert ist 0 -> Dann nutze Recent (Realm)
        let determinedPrice = rsaGold > 0 ? rsaGold : recentGold;
        totalMixedGoldSum += (determinedPrice * item.totalQty); 
    }

    // 2. DURCHLAUF: Tabellenaufbereitung und 14-Tage-Trend-Filter
    for (const item of masterItemMap.values()) {
        const name = namesDb[item.id] || `Unbekannter Gegenstand (#${item.id})`;
        const tsmMetrics = priceMap.get(item.id) || { regionMarketValue: 0, regionAvgSalePrice: 0, realmMarketValue: 0, realmRecent: 0 };
        
        const rsaGold = (tsmMetrics.regionAvgSalePrice || 0) / 10000;
        const recentGold = (tsmMetrics.realmRecent || 0) / 10000;
        
        // Marktwert-Quellen in Gold umrechnen
        const regionMvGold = (tsmMetrics.regionMarketValue || 0) / 10000;
        const realmMvGold = (tsmMetrics.realmMarketValue || 0) / 10000;

        // --- DEINE NEUE STRIKTE ANZEIGE-LOGIK ---
        // Nutze Recent NUR, wenn die regionale CSV für dieses Item keinen Eintrag (0) hat!
        let activeLivePriceGold = rsaGold > 0 ? rsaGold : recentGold;
        
        // Passenden historischen Marktwert-Vergleichswert bestimmen
        let activeMarketValueGold = rsaGold > 0 ? regionMvGold : realmMvGold;
        if (activeMarketValueGold === 0) activeMarketValueGold = realmMvGold || regionMvGold;

        const totalItemWorthActive = activeLivePriceGold * item.totalQty; 

        // 14-Tage-Historienbasis aus Log laden
        let historicPriceBasis = 0;
        if (referenceSnapshot && referenceSnapshot.itemPrices && referenceSnapshot.itemPrices[item.id] !== undefined) {
            historicPriceBasis = referenceSnapshot.itemPrices[item.id];
        }

        // Selektive Überschreibung bei fehlendem Log-Eintrag
        if (historicPriceBasis === 0 || historicPriceBasis === activeLivePriceGold) {
            if (activeMarketValueGold > 0 && activeLivePriceGold !== activeMarketValueGold) {
                historicPriceBasis = activeMarketValueGold;
            } else {
                historicPriceBasis = activeLivePriceGold;
            }
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
            dbRecentGold: activeLivePriceGold, // Wird sauber an das UI (Preis-Spalte) übergeben
            totalMarketValueGold: activeMarketValueGold * item.totalQty,
            totalRecentValueGold: totalItemWorthActive, 
            totalSaleAvgValueGold: rsaGold * item.totalQty,
            oldPriceGold: historicPriceBasis, 
            fluctuation: priceFluctuation     
        });
    }

    // 3. Snapshot in history_log.json sichern
    const currentDate = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isoString = new Date().toISOString();

    const currentItemPrices = {};
    enrichedItems.forEach(i => {
        // Speichere die im UI aktive Preisquelle ab, um fehlerfreie Sparklines im nächsten Durchlauf zu garantieren
        currentItemPrices[i.id] = i.dbRecentGold;
    });

    const previousTotal = referenceSnapshot ? referenceSnapshot.value : totalMixedGoldSum;
    const deltaGold = totalMixedGoldSum - previousTotal;

    if (history.length === 0 || (lastSnapshot && lastSnapshot.value !== totalMixedGoldSum)) {
        history.push({ 
            date: currentDate,
            time: currentTime,
            value: Math.round(totalMixedGoldSum),
            rawTimestamp: isoString,
            itemPrices: currentItemPrices
        });
        if (history.length > 150) history.shift(); 
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
    }

    return { 
        items: enrichedItems,
        totalValue: totalMixedGoldSum,
        delta: deltaGold,
        historyLog: history
    };
}

module.exports = { processTrendsAndSnapshots };
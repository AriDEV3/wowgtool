const axios = require('axios');
const readline = require('readline');

async function fetchTSMPricesStream() {
    const priceMap = new Map();
    const region = (process.env.REGION || 'eu').toLowerCase(); 
    const defaultRealm = region === 'eu' ? 'silvermoon' : 'area-52';

    // 1. SCHRITT: Regionale CSV einlesen (Spalte 3 = MarketValue, Spalte 5 = AvgSalePrice)
    try {
        const regionUrl = `https://public-data.tradeskillmaster.com/retail/${region}/region/items.csv`;
        console.log(`[TSM Stream] Lade Region-Preise von: ${regionUrl}`);
        
        const response = await axios({ method: 'get', url: regionUrl, responseType: 'stream', timeout: 15000 });
        const rl = readline.createInterface({ input: response.data, crlfDelay: Infinity });

        let isHeader = true;

        for await (const line of rl) {
            const parts = line.split(/[,;]+/);
            if (isHeader) { isHeader = false; continue; }

            // KORREKTUR: Sicherer Zugriff auf die Array-Indizes (0, 2, 4)
            if (parts && parts.length > 4) {
                const itemId = parseInt(parts[0].replace(/^\ufeff/, '').trim(), 10);
                const regionMarketValue = parseInt(parts[2]?.trim(), 10) || 0;
                const regionAvgSalePrice = parseInt(parts[4]?.trim(), 10) || 0;

                if (!isNaN(itemId)) {
                    priceMap.set(itemId, { 
                        regionMarketValue: regionMarketValue,
                        regionAvgSalePrice: regionAvgSalePrice,
                        realmMarketValue: 0,
                        realmRecent: 0
                    });
                }
            }
        }
    } catch (error) {
        console.warn(`[TSM Stream Hinweis] Regionaler CSV-Abruf fehlgeschlagen: ${error.message}`);
    }

    // 2. SCHRITT: Lokale Realm-CSV einlesen (Spalte 4 = Recent [Index 3])
    try {
        const realmUrl = `https://public-data.tradeskillmaster.com/retail/${region}/realm/${defaultRealm}/items.csv`;
        console.log(`[TSM Stream] Lade Realm-Preise von: ${realmUrl}`);
        
        const response = await axios({ method: 'get', url: realmUrl, responseType: 'stream', timeout: 15000 });
        const rl = readline.createInterface({ input: response.data, crlfDelay: Infinity });

        let headerMap = null;

        for await (const line of rl) {
            const parts = line.split(/[,;]+/);

            if (!headerMap) {
                headerMap = {};
                parts.forEach((part, index) => { headerMap[part.trim()] = index; });
                continue;
            }

            const idIndex = headerMap['itemId'];
            const mvIndex = headerMap['minBuyout'] !== undefined ? headerMap['minBuyout'] : headerMap['marketValue'];

            if (idIndex !== undefined && parts[idIndex]) {
                const itemId = parseInt(parts[idIndex].replace(/^\ufeff/, '').trim(), 10);
                
                // KORREKTUR: Sicherer Zugriff auf Spalte 4 (Index 3) für localRecent
                const localRecent = parts.length > 3 ? (parseInt(parts[3]?.trim(), 10) || 0) : 0; 
                const localMarketValue = mvIndex !== undefined ? (parseInt(parts[mvIndex]?.trim(), 10) || 0) : 0;

                if (!isNaN(itemId)) {
                    if (priceMap.has(itemId)) {
                        const data = priceMap.get(itemId);
                        
                        if (data.regionMarketValue === 0) {
                            data.realmMarketValue = localMarketValue;
                        } else {
                            data.realmMarketValue = data.regionMarketValue; 
                        }
                        
                        data.realmRecent = localRecent;           
                    } else {
                        priceMap.set(itemId, {
                            regionMarketValue: 0,
                            regionAvgSalePrice: 0,
                            realmMarketValue: localMarketValue,
                            realmRecent: localRecent
                        });
                    }
                }
            }
        }
        console.log(`[TSM Stream] Realm-Daten erfolgreich mit Überschreibungs-Sperre verknüpft.`);
    } catch (error) {
        console.warn(`[TSM Stream Hinweis] Realm-Abruf fehlgeschlagen: ${error.message}`);
    }

    return priceMap;
}

module.exports = { fetchTSMPricesStream };
globalThis.ItemHtmlBuilder = {
    // Baut die detaillierte Aufschlüsselung als horizontalen Kapsel-Grid (inkl. Realm-Namen)
    buildHoldingRows: function(holdingDetails, item) {
        let html = '<div class="holding-grid-compact" style="display: flex; flex-wrap: wrap; gap: 6px; max-width: 580px; padding: 4px 0;">';
        
        holdingDetails.forEach(detail => {
            let badgeBg = '#e2e8f0';
            let badgeBorder = '#cbd5e1';
            let badgeText = '#334155';
            let locationLabel = '';

            // Dynamisches Farbschema je nach WoW-Lagerplatz & Integration der Realms
            if (detail.realm === 'Account Wide' || detail.realm === 'Account-Weit') {
                // Kriegsmeuten-Bank (Bernsteingold-Stil - Realm ist accountweit shared)
                badgeBg = 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(217, 119, 6, 0.15))';
                badgeBorder = '#d97706';
                badgeText = '#b45309';
                locationLabel = `Kriegsmeute (${detail.qty})`;
            } else if (detail.location === 'Bank') {
                // Charakter-Bank (Gilden/Klassisch-Blau) inkl. Realm-Kürzel
                badgeBg = 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(29, 78, 216, 0.15))';
                badgeBorder = '#2563eb';
                badgeText = '#1d4ed8';
                locationLabel = `${detail.character}-${detail.realm} [Bank] (${detail.qty})`;
            } else {
                // Charakter-Taschen (Smaragdgrün) inkl. Realm-Kürzel
                badgeBg = 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(5, 150, 105, 0.15))';
                badgeBorder = '#10b981';
                badgeText = '#059669';
                locationLabel = `${detail.character}-${detail.realm} (${detail.qty})`;
            }

            // Kapsel-Design mit direkt sichtbaren Realm-Daten
            html += `
                <span class="tag-compact-capsule" 
                      title="Server: ${detail.realm} | Ort: ${detail.location} | Menge: ${detail.qty}x" 
                      style="
                        display: inline-flex;
                        align-items: center;
                        background: ${badgeBg};
                        border: 1px solid ${badgeBorder};
                        color: ${badgeText};
                        padding: 4px 10px;
                        border-radius: 20px;
                        font-size: 0.82em;
                        font-weight: 700;
                        white-space: nowrap;
                        cursor: help;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
                        transition: all 0.2s ease-in-out;
                      "
                      onmouseover="this.style.transform='translateY(-1.5px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.08)';"
                      onmouseout="this.style.transform='translateY(0px)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.04)';"
                >
                    <span>${locationLabel}</span>
                </span>`;
        });
        html += '</div>';
        return html;
    },

    // Baut die Hauptzeilen der Inventar-Tabelle (Skaliert und neu angeordnet)
    buildTableRow: function(item, holdingBoxHTML, historyLog = []) {
        // --- 14-TAGE VERLAUFS-GRAPH (SVG SPARKLINE) BERECHNEN ---
        let sparklineSVG = '';
        let itemPriceHistory = [];
        
        if (historyLog && historyLog.length > 0) {
            const now = new Date();
            const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
            
            const relevantSnapshots = historyLog.filter(snap => {
                const snapDate = snap.rawTimestamp ? new Date(snap.rawTimestamp) : new Date();
                return snapDate >= fourteenDaysAgo;
            });

            relevantSnapshots.forEach(snap => {
                if (snap.itemPrices && snap.itemPrices[item.id] !== undefined) {
                    itemPriceHistory.push(snap.itemPrices[item.id]);
                }
            });
        }

        // Aktuellen Preis als neuesten Datenpunkt anhängen
        if (item.dbRecentGold > 0 && (itemPriceHistory.length === 0 || itemPriceHistory[itemPriceHistory.length - 1] !== item.dbRecentGold)) {
            itemPriceHistory.push(item.dbRecentGold);
        }

        // Falls die Historie flach ist, binde den Marktwert für die Kurvenwellen ein
        if (itemPriceHistory.length >= 1 && item.marketValueGold > 0 && item.dbRecentGold !== item.marketValueGold) {
            const allSame = itemPriceHistory.every(p => p === item.dbRecentGold);
            if (allSame) {
                itemPriceHistory.unshift(item.marketValueGold);
            }
        }

        // Dynamische Farbcodierung der Kurve anhand der Wertentwicklung
        let strokeColor = '#64748b'; 
        if (item.fluctuation > 0.01) strokeColor = '#16a34a';     
        else if (item.fluctuation < -0.01) strokeColor = '#dc2626'; 

        // Generiere die Sparkline-Kurve fehlerfrei
        if (itemPriceHistory.length >= 2) {
            const maxPrice = Math.max(...itemPriceHistory);
            const minPrice = Math.min(...itemPriceHistory);
            
            const svgWidth = 60;
            const svgHeight = 18;
            const padding = 2;
            const netHeight = svgHeight - (padding * 2);

            let pathCommands = '';
            
            if (maxPrice === minPrice) {
                const yCenter = svgHeight / 2;
                pathCommands = `M 0 ${yCenter} L ${svgWidth} ${yCenter}`;
            } else {
                const priceRange = maxPrice - minPrice;
                itemPriceHistory.forEach((price, idx) => {
                    const x = (idx / (itemPriceHistory.length - 1)) * svgWidth;
                    const y = padding + netHeight - ((price - minPrice) / priceRange) * netHeight;
                    if (idx === 0) pathCommands += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                    else pathCommands += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
                });
            }

            sparklineSVG = `
                <svg width="${svgWidth}" height="${svgHeight}" style="vertical-align: middle; margin-right: 12px; background: transparent; overflow: visible;">
                    <path d="${pathCommands}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
        } else {
            sparklineSVG = `
                <svg width="60" height="18" style="vertical-align: middle; margin-right: 12px; background: transparent;">
                    <line x1="2" y1="9" x2="58" y2="9" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="1 3"/>
                </svg>`;
        }

        // --- VERLAUFS-PROZENTWERTE AUF 2 NACHKOMMASTELLEN MIT RICHTUNGSPFEIL ---
        let fluctuationHTML = '<span style="color: #64748b; font-weight: 600;">● 0,00%</span>';
        if (item.fluctuation > 0) {
            const formattedFluctuation = item.fluctuation.toFixed(2).replace('.', ',');
            fluctuationHTML = `<span style="color: #16a34a; font-weight: bold;">▲ +${formattedFluctuation}%</span>`;
        } else if (item.fluctuation < 0) {
            const formattedFluctuation = item.fluctuation.toFixed(2).replace('.', ',');
            fluctuationHTML = `<span style="color: #dc2626; font-weight: bold;">▼ ${formattedFluctuation}%</span>`;
        }

        let dbRecentHTML = '';
        if (item.dbRecentGold > 0) {
            dbRecentHTML = `
                <span class="price-text" style="color: #0284c7;">${item.dbRecentGold.toLocaleString(undefined, {maximumFractionDigits: 2})}g</span>
                <span class="sub-price">Gesamt: <strong>${item.totalRecentValueGold.toLocaleString(undefined, {maximumFractionDigits: 2})}g</strong></span>
            `;
        }

        const historicalDisplay = item.oldPriceGold > 0 
            ? `Vor 14 Tagen: ${item.oldPriceGold.toLocaleString(undefined, {maximumFractionDigits: 2})}g` 
            : 'Erster Scan';

        // DIE RÜCKGABE-REIHUNG: th-trend (Verlauf) steht nun vor th-recent (Preis)
        return `
            <tr>
                <td>
                    <span class="item-row-title">${item.name}</span><br/>
                    <span class="item-row-id">ITEM ID: #${item.id}</span>
                </td>
                <td style="vertical-align: middle;">${holdingBoxHTML}</td>
                <td><strong style="color: var(--text-dark); font-size: 1.15em;">${item.totalQty.toLocaleString()}</strong></td>
                
                <!-- 1. Der 14-Tage-Verlauf steht jetzt als vorletzte Spalte in der Mitte -->
                <td>
                    <div style="display: inline-flex; align-items: center; white-space: nowrap;">
                        ${sparklineSVG}
                        <div>
                            <div style="font-size: 1.15em; margin-bottom: 2px;">${fluctuationHTML}</div>
                            <span style="font-size: 0.8em; color: var(--text-muted); font-weight: 600;">${historicalDisplay}</span>
                        </div>
                    </div>
                </td>
                
                <!-- 2. Der Preis bildet nun die Abschluss-Spalte ganz rechts -->
                <td>${dbRecentHTML}</td>
            </tr>
        `;
    }
};







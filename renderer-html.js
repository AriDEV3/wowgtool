// ==========================================================================
// --- RENDERER-HTML.JS (DEINE SPEZIFISCHE UI-RENDERING ENGINE)            ---
// ==========================================================================

globalThis.ItemHtmlBuilder = {
    /**
     * Generiert die kompakten Badges/Kapseln für die verschiedenen Lagerorte.
     * @param {Array} holdingDetails - Die Aufschlüsselung der Standorte aus dem Aggregator
     */
    buildHoldingRows: function(holdingDetails) {
        if (!holdingDetails || holdingDetails.length === 0) {
            return '<span style="color:var(--text-muted); font-size:0.85em;">Kein Ort gefunden</span>';
        }

        let html = '<div class="holding-grid-compact" style="display: flex; flex-wrap: wrap; gap: 6px; max-width: 580px; padding: 4px 0;">';
        
        holdingDetails.forEach(detail => {
            let badgeBg = '#e2e8f0';
            let badgeBorder = '#cbd5e1';
            let badgeText = '#334155';
            let locationLabel = '';

            // Unterscheidung anhand des Server/Realm Namens oder der Location für farbliche Badges
            if (detail.realm === 'Account Wide' || detail.realm === 'Account-Weit' || detail.location === 'Warband Bank') {
                badgeBg = 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(217, 119, 6, 0.15))';
                badgeBorder = '#d97706'; 
                badgeText = '#b45309'; 
                locationLabel = `Kriegsmeute (${detail.qty})`;
            } else if (detail.location === 'Bank') {
                badgeBg = 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(29, 78, 216, 0.15))';
                badgeBorder = '#2563eb'; 
                badgeText = '#1d4ed8'; 
                locationLabel = `${detail.character}-${detail.realm} [Bank] (${detail.qty})`;
            } else {
                badgeBg = 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(5, 150, 105, 0.15))';
                badgeBorder = '#10b981'; 
                badgeText = '#059669'; 
                locationLabel = `${detail.character}-${detail.realm} (${detail.qty})`;
            }

            html += `<span class="tag-compact-capsule" style="display: inline-flex; align-items: center; background: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeText}; padding: 4px 10px; border-radius: 20px; font-size: 0.82em; font-weight: 700; white-space: nowrap;">${locationLabel}</span>`;
        });
        
        html += '</div>';
        return html;
    },

    /**
     * Baut eine vollständige Tabellenzeile (tr) für ein Item zusammen.
     * Generiert automatisch eine SVG-Sparkline basierend auf der Verlaufshistorie.
     */
    buildTableRow: function(item, holdingBoxHTML, historyLog = []) {
        let sparklineSVG = '';
        let itemPriceHistory = [];
        
        if (historyLog && historyLog.length > 0) {
            const fourteenDaysAgo = new Date(new Date().getTime() - (14 * 24 * 60 * 60 * 1000));
            const relevantSnapshots = historyLog.filter(snap => (snap.rawTimestamp ? new Date(snap.rawTimestamp) : new Date()) >= fourteenDaysAgo);
            relevantSnapshots.forEach(snap => { 
                if (snap.itemPrices && snap.itemPrices[item.id] !== undefined) {
                    itemPriceHistory.push(snap.itemPrices[item.id]); 
                }
            });
        }
        
        if (item.dbRecentGold > 0 && (itemPriceHistory.length === 0 || itemPriceHistory[itemPriceHistory.length - 1] !== item.dbRecentGold)) {
            itemPriceHistory.push(item.dbRecentGold);
        }

        let strokeColor = '#64748b'; 
        if (item.fluctuation > 0.01) strokeColor = '#16a34a';     
        else if (item.fluctuation < -0.01) strokeColor = '#dc2626'; 

        if (itemPriceHistory.length >= 2) {
            const maxPrice = Math.max(...itemPriceHistory);
            const minPrice = Math.min(...itemPriceHistory);
            const svgWidth = 60;
            const svgHeight = 18;
            const padding = 2;
            const netHeight = svgHeight - (padding * 2);
            let pathCommands = '';
            
            if (maxPrice === minPrice) { 
                pathCommands = `M 0 9 L 60 9`; 
            } else {
                itemPriceHistory.forEach((price, idx) => {
                    const x = (idx / (itemPriceHistory.length - 1)) * svgWidth;
                    const y = padding + netHeight - ((price - minPrice) / (maxPrice - minPrice)) * netHeight;
                    pathCommands += `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                });
            }
            sparklineSVG = `<svg width="60" height="18" style="vertical-align: middle; margin-right: 12px; overflow: visible;"><path d="${pathCommands}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else {
            sparklineSVG = `<svg width="60" height="18" style="vertical-align: middle; margin-right: 12px;"><line x1="2" y1="9" x2="58" y2="9" stroke="#64748b" stroke-width="1.5" stroke-dasharray="1 3"/></svg>`;
        }

        let fluctuationHTML = '<span style="color: #64748b; font-weight: 600;">● 0,00%</span>';
        if (item.fluctuation > 0) fluctuationHTML = `<span style="color: #16a34a; font-weight: bold;">▲ +${item.fluctuation.toFixed(2).replace('.', ',')}%</span>`;
        else if (item.fluctuation < 0) fluctuationHTML = `<span style="color: #dc2626; font-weight: bold;">▼ ${item.fluctuation.toFixed(2).replace('.', ',')}%</span>`;

        return `
            <tr>
                <td><span class="item-row-title">${item.name}</span><br/><span class="item-row-id">ITEM ID: #${item.id}</span></td>
                <td>${holdingBoxHTML}</td>
                <td><strong style="color: var(--text-dark); font-size: 1.15em;">${item.totalQty.toLocaleString()}</strong></td>
                <td><div style="display: inline-flex; align-items: center; white-space: nowrap;">${sparklineSVG}<div><div style="font-size: 1.15em; margin-bottom: 2px;">${fluctuationHTML}</div><span style="font-size: 0.8em; color: var(--text-muted); font-weight: 600;">${item.oldPriceGold > 0 ? 'Vor 14 Tagen: '+item.oldPriceGold.toLocaleString(undefined, {maximumFractionDigits:0})+'g' : 'Erster Scan'}</span></div></div></td>
                <td><span class="price-text" style="color: #0284c7;">${item.dbRecentGold.toLocaleString(undefined, {maximumFractionDigits: 2})}g</span><span class="sub-price">Gesamt: <strong>${item.totalRecentValueGold.toLocaleString(undefined, {maximumFractionDigits: 2})}g</strong></span></td>
            </tr>`;
    },

    /**
     * IMPLEMENTATION NEU: Baut eine vollständige Zeile für das Charakter-Gold-Dashboard zusammen.
     * @param {string} charName - Der Name des WoW-Charakters
     * @param {string} realmName - Der Server/Realm des Charakters
     * @param {number} goldKupfer - Der rohe Kupferwert aus der LUA-Datei (10.000 Kupfer = 1 Gold)
     */
    buildCharacterRow: function(charName, realmName, goldKupfer) {
        // Sichere mathematische Konvertierung von Kupfer zu Gold
        const goldAmount = Math.floor((goldKupfer || 0) / 10000);
        
        return `
            <tr>
                <td><strong style="color: var(--text-dark); font-size: 1.1em;">${charName}</strong></td>
                <td>
                    <span class="tag-compact-capsule" style="background: rgba(56, 189, 248, 0.1); border: 1px solid #2563eb; color: #1d4ed8; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">
                        ${realmName}
                    </span>
                </td>
                <td style="text-align: right; padding-right: 24px;">
                    <span class="price-text" style="color: #ffb400; font-weight: 700; font-size: 1.15em; font-family: monospace;">
                        ${goldAmount.toLocaleString()}g
                    </span>
                </td>
            </tr>
        `;
    }
};






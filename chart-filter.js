// Hilfsfunktion zur lesbaren Formatierung grosser Goldbeträge (z.B. 1.2M oder 450k)
function formatGoldAxisLabel(value) {
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1).replace('.0', '') + 'M';
    } else if (value >= 1000) {
        return (value / 1000).toFixed(0) + 'k';
    }
    return value.toString();
}

// Filtert die Snapshots anhand des ausgewählten Zeitfensters
function filterHistoryByScope(historyLog, scope) {
    if (!historyLog || historyLog.length === 0) return [];
    
    const now = new Date();
    
    return historyLog.filter(point => {
        let pointDate;
        if (point.rawTimestamp) {
            pointDate = new Date(point.rawTimestamp);
        } else {
            // Fallback: Parser falls ISO-String fehlt
            const parts = point.time.split(/[\s,.]+/);
            if (parts.length >= 4) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                const timeParts = parts[3].split(':');
                const hour = parseInt(timeParts[0], 10);
                const min = parseInt(timeParts[1], 10);
                const sec = parseInt(timeParts[2] || 0, 10);
                pointDate = new Date(year, month, day, hour, min, sec);
            } else {
                pointDate = new Date();
            }
        }

        const msDiff = now - pointDate;
        const hoursDiff = msDiff / (1000 * 60 * 60);

        if (scope === 'hourly') {
            return hoursDiff <= 1; // Letzte 60 Minuten
        } else if (scope === 'daily') {
            return hoursDiff <= 24; // Letzte 24 Stunden
        } else if (scope === '7day') {
            return hoursDiff <= 168; // Letzte 7 Tage
        }
        return true;
    });
}

// Global für andere Skripte verfügbar machen
window.formatGoldAxisLabel = formatGoldAxisLabel;
window.filterHistoryByScope = filterHistoryByScope;
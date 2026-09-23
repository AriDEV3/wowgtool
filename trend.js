// ==========================================================================
// --- TREND.JS (FRONTEND GRAPH-ENGINE - AUTONOMER COMPONENT-FIX)         ---
// ==========================================================================

let currentGlobalHistory = [];
let activeChartFilter = 'hourly'; 

window.renderTrendChart = function(historyLog) {
    if (historyLog) currentGlobalHistory = historyLog;
    
    const container = document.getElementById('chart-area');
    const htmlTooltip = document.getElementById('trend-html-tooltip');
    if (!container) return;
    
    // ----------------------------------------------------------------------
    // KORREKTUR: Autonome Filter-Logik direkt in der trend.js (Unfehlbar)
    // ----------------------------------------------------------------------
    const now = new Date();
    const filteredLog = currentGlobalHistory.filter(point => {
        let pointDate;
        
        // Nutzt den unfehlbaren ISO-Timestamp aus dem Backend
        if (point.rawTimestamp) {
            pointDate = new Date(point.rawTimestamp);
        } else if (point.date && point.time) {
            // Fallback: Kombiniert date (DD.MM.YYYY) und time (HH:MM:SS)
            const dateParts = point.date.split('.');
            const timeParts = point.time.split(':');
            if (dateParts.length === 3 && timeParts.length >= 2) {
                pointDate = new Date(
                    parseInt(dateParts[2], 10),
                    parseInt(dateParts[1], 10) - 1,
                    parseInt(dateParts[0], 10),
                    parseInt(timeParts[0], 10),
                    parseInt(timeParts[1], 10),
                    parseInt(timeParts[2] || 0, 10)
                );
            } else {
                pointDate = new Date();
            }
        } else {
            pointDate = new Date();
        }

        if (isNaN(pointDate.getTime())) return false;

        const hoursDiff = (now - pointDate) / (1000 * 60 * 60);

        if (activeChartFilter === 'hourly') return hoursDiff <= 1;   // Letzte 60 Min
        if (activeChartFilter === 'daily') return hoursDiff <= 24;  // Letzte 24 Std
        if (activeChartFilter === '7day') return hoursDiff <= 168;  // Letzte 7 Tage
        return true;
    });
    // ----------------------------------------------------------------------

    if (!filteredLog || filteredLog.length < 2) {
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85em; padding: 45px 0; text-align: center; width: 100%; font-weight: 600;">Warte auf weitere Snapshot-Punkte im "${activeChartFilter}" Filter...</div>`;
        if (htmlTooltip) htmlTooltip.classList.add('hidden');
        return;
    }

    let activeCanvas = document.getElementById('trendCanvas');
    if (!activeCanvas) {
        const tooltipBackup = htmlTooltip ? htmlTooltip.outerHTML : '';
        container.innerHTML = `<canvas id="trendCanvas" style="width: 100%; height: 100%; display: block;"></canvas>${tooltipBackup}`;
        activeCanvas = document.getElementById('trendCanvas');
    }

    let containerWidth = container.getBoundingClientRect().width || 600;
    const height = 115;
    const paddingLeft = 52; const paddingRight = 20; const paddingTop = 15; const paddingBottom = 25; 

    const values = filteredLog.map(h => parseFloat(h.value) || 0);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    let valRange = maxVal - minVal;
    if (valRange <= 0) valRange = maxVal === 0 ? 10000 : maxVal * 0.1;
    
    let pointsCoordinates = [];

    function drawGraph(highlightIndex = null) {
        activeCanvas.width = containerWidth * window.devicePixelRatio; 
        activeCanvas.height = height * window.devicePixelRatio;
        
        const ctx = activeCanvas.getContext('2d');
        ctx.resetTransform(); 
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const chartWidth = containerWidth - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;
        ctx.clearRect(0, 0, containerWidth, height);

        pointsCoordinates = [];
        filteredLog.forEach((point, index) => {
            const x = paddingLeft + (index / (filteredLog.length - 1)) * chartWidth;
            const y = maxVal === minVal 
                ? paddingTop + (chartHeight / 2)
                : paddingTop + chartHeight - (((parseFloat(point.value) || 0) - minVal) / valRange) * chartHeight;
            
            let labelText = point.time || '';
            if (activeChartFilter === 'daily' || activeChartFilter === '7day') {
                labelText = `${point.date ? point.date.substring(0, 5) : ''} ${point.time ? point.time.substring(0, 5) : ''}`;
            }
            pointsCoordinates.push({ x, y, value: point.value, time: point.time || '', date: point.date || '', label: labelText });
        });

        // Grid zeichnen
        ctx.font = '10px sans-serif'; ctx.fillStyle = '#64748b'; ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)'; ctx.textAlign = 'right'; ctx.lineWidth = 1;
        const axisTicks = maxVal === minVal ? [minVal - valRange/2, minVal, minVal + valRange/2] : [minVal, minVal + (valRange / 2), maxVal];
        axisTicks.forEach(tickVal => {
            const y = maxVal === minVal ? paddingTop + (chartHeight / 2) : paddingTop + chartHeight - (((tickVal - minVal) / valRange) * chartHeight);
            ctx.beginPath(); ctx.moveTo(paddingLeft, y); ctx.lineTo(containerWidth - paddingRight, y); ctx.stroke();
            const formattedLabel = typeof window.formatGoldAxisLabel === 'function' ? window.formatGoldAxisLabel(tickVal) : Math.round(tickVal).toLocaleString();
            ctx.fillText(formattedLabel + 'g', paddingLeft - 8, y + 3);
        });

        // Trendlinie zeichnen
        ctx.beginPath(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        pointsCoordinates.forEach((pt, idx) => idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke();

        // Punkte & Labels zeichnen
        pointsCoordinates.forEach((pt, idx) => {
            ctx.beginPath(); ctx.arc(pt.x, pt.y, idx === highlightIndex ? 5.5 : 3.5, 0, 2 * Math.PI);
            ctx.fillStyle = idx === highlightIndex ? '#2563eb' : '#b45309'; ctx.fill();

            const skipStep = Math.ceil(filteredLog.length / 4);
            if (idx % skipStep === 0 || idx === filteredLog.length - 1 || idx === 0) {
                ctx.fillStyle = '#64748b'; ctx.textAlign = 'center';
                ctx.fillText(pt.label, pt.x, height - paddingBottom + 16);
            }
        });

        // Tooltip
        const liveTooltip = document.getElementById('trend-html-tooltip');
        if (liveTooltip && highlightIndex !== null && pointsCoordinates[highlightIndex]) {
            const pt = pointsCoordinates[highlightIndex];
            document.getElementById('tooltip-date').innerText = pt.date ? `${pt.date} - ${pt.time}` : pt.time;
            document.getElementById('tooltip-gold').innerText = `Vermögen: ${Math.round(pt.value).toLocaleString()}g`;
            liveTooltip.classList.remove('hidden');
            liveTooltip.style.left = `${pt.x + 12 + liveTooltip.getBoundingClientRect().width > containerWidth ? pt.x - liveTooltip.getBoundingClientRect().width - 12 : pt.x + 12}px`;
            liveTooltip.style.top = `${pt.y - 45}px`;
        } else if (liveTooltip) {
            liveTooltip.classList.add('hidden');
        }
    }

    drawGraph();

    activeCanvas.onmousemove = function(e) {
        let activeIndex = null;
        for (let i = 0; i < pointsCoordinates.length; i++) {
            if (Math.sqrt((e.offsetX - pointsCoordinates[i].x) ** 2 + (e.offsetY - pointsCoordinates[i].y) ** 2) < 18) { activeIndex = i; break; }
        }
        drawGraph(activeIndex);
    };
    activeCanvas.onmouseleave = () => drawGraph(null);
};

// Zeitfilter-Tabs verknüpfen (KORREKTUR: Liest direkt den globalen Frontend-Speicher aus)
document.addEventListener('DOMContentLoaded', () => {
    ['hourly', 'daily', '7day'].forEach(filter => {
        const el = document.getElementById(`tab-${filter}`);
        if (el) {
            el.addEventListener('click', () => {
                ['hourly', 'daily', '7day'].forEach(f => document.getElementById(`tab-${f}`)?.classList.remove('active'));
                el.classList.add('active');
                
                activeChartFilter = filter; 
                
                // Holt die Daten direkt aus dem globalen Speicher deiner renderer-loader.js
                const activeHistory = window.lastLoadedHistoryLog || currentGlobalHistory || [];
                window.renderTrendChart(activeHistory); 
            });
        }
    });

    window.addEventListener('resize', () => {
        const activeHistory = window.lastLoadedHistoryLog || currentGlobalHistory || [];
        if (activeHistory && activeHistory.length >= 2) {
            window.renderTrendChart(activeHistory);
        }
    });
});
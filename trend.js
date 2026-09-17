// ==========================================================================
// --- TREND.JS (FRONTEND GRAPH-ENGINE MIT HTML-TOOLTIP HYBRID)           ---
// ==========================================================================

let currentGlobalHistory = [];
let activeChartFilter = 'hourly'; 

window.renderTrendChart = function(historyLog) {
    if (historyLog) currentGlobalHistory = historyLog;
    
    const container = document.getElementById('chart-area');
    const htmlTooltip = document.getElementById('trend-html-tooltip');
    if (!container) return;
    
    const filteredLog = typeof window.filterHistoryByScope === 'function' 
        ? window.filterHistoryByScope(currentGlobalHistory, activeChartFilter)
        : currentGlobalHistory;
    
    if (!filteredLog || filteredLog.length < 2) {
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85em; padding: 45px 0; text-align: center; width: 100%; font-weight: 600;">Warte auf weitere Snapshot-Punkte im "${activeChartFilter}" Filter...</div>`;
        if (htmlTooltip) htmlTooltip.classList.add('hidden');
        return;
    }

    let activeCanvas = document.getElementById('trendCanvas');
    if (!activeCanvas) {
        // Tooltip beim Neuerzeugen erhalten
        const tooltipBackup = htmlTooltip ? htmlTooltip.outerHTML : '';
        container.innerHTML = `<canvas id="trendCanvas" style="width: 100%; height: 100%; display: block;"></canvas>${tooltipBackup}`;
        activeCanvas = document.getElementById('trendCanvas');
    }

    let containerWidth = container.getBoundingClientRect().width;
    if (containerWidth <= 0) {
        containerWidth = container.parentElement ? container.parentElement.getBoundingClientRect().width : 600;
    }
    if (containerWidth <= 0) containerWidth = 500;

    const height = 115;
    const paddingLeft = 52;
    const paddingRight = 20;
    const paddingTop = 15;
    const paddingBottom = 25; 

    const values = filteredLog.map(h => parseFloat(h.value) || 0);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const valRange = (maxVal - minVal) === 0 ? 1000 : (maxVal - minVal);
    
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

        // 1. KOORDINATEN BERECHNEN
        filteredLog.forEach((point, index) => {
            const x = paddingLeft + (index / (filteredLog.length - 1)) * chartWidth;
            const currentPointValue = parseFloat(point.value) || 0;
            const y = paddingTop + chartHeight - (((currentPointValue - minVal) / valRange) * chartHeight);
            
            let labelText = point.time || '';
            if (activeChartFilter === 'daily' || activeChartFilter === '7day') {
                labelText = `${point.date ? point.date.substring(0, 5) : ''} ${point.time ? point.time.substring(0, 5) : ''}`;
            }
            
            pointsCoordinates.push({ 
                x: x, 
                y: y, 
                value: currentPointValue, 
                time: point.time || '', 
                date: point.date || '', 
                label: labelText 
            });
        });

        // 2. GRID METRIK-LINIEN ZEICHNEN
        ctx.font = '10px sans-serif'; 
        ctx.fillStyle = '#64748b'; 
        ctx.textAlign = 'right'; 
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)'; 
        ctx.lineWidth = 1;

        const axisTicks = [minVal, minVal + (valRange / 2), maxVal];
        axisTicks.forEach(tickVal => {
            const y = paddingTop + chartHeight - (((tickVal - minVal) / valRange) * chartHeight);
            ctx.beginPath(); 
            ctx.moveTo(paddingLeft, y); 
            ctx.lineTo(containerWidth - paddingRight, y); 
            ctx.stroke();
            
            const formattedLabel = typeof window.formatGoldAxisLabel === 'function'
                ? window.formatGoldAxisLabel(tickVal)
                : Math.round(tickVal).toLocaleString();
                
            ctx.fillText(formattedLabel + 'g', paddingLeft - 8, y + 3);
        });

        // 3. TRENDLINIE ZEICHNEN
        ctx.beginPath(); 
        ctx.strokeStyle = '#2563eb'; 
        ctx.lineWidth = 2.5; 
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        pointsCoordinates.forEach((pt, index) => { 
            if (index === 0) ctx.moveTo(pt.x, pt.y); 
            else ctx.lineTo(pt.x, pt.y); 
        });
        ctx.stroke();

        // 4. KNOTENPUNKTE ZEICHNEN
        pointsCoordinates.forEach((pt, index) => {
            ctx.beginPath(); 
            ctx.arc(pt.x, pt.y, index === highlightIndex ? 5.5 : 3.5, 0, 2 * Math.PI);
            ctx.fillStyle = index === highlightIndex ? '#2563eb' : '#b45309'; 
            ctx.fill();
        });

        // 5. STEUERUNG DES NEUEN NATIVEN HTML-TOOLTIPS (UNFEHLBAR)
        const liveTooltip = document.getElementById('trend-html-tooltip');
        const tDate = document.getElementById('tooltip-date');
        const tGold = document.getElementById('tooltip-gold');

        if (liveTooltip && tDate && tGold) {
            if (highlightIndex !== null && pointsCoordinates[highlightIndex]) {
                const pt = pointsCoordinates[highlightIndex];
                
                // Text-Inhalt zuweisen (Werte aus JavaScript)
                tDate.innerText = pt.date ? `${pt.date} - ${pt.time}` : pt.time;
                tGold.innerText = `Vermögen: ${Math.round(pt.value).toLocaleString()}g`;
                
                // Einblenden
                liveTooltip.classList.remove('hidden');
                
                // Position setzen
                let targetX = pt.x + 12;
                const tooltipWidth = liveTooltip.getBoundingClientRect().width || 130;
                
                if (targetX + tooltipWidth > containerWidth) {
                    targetX = pt.x - tooltipWidth - 12; // Nach links klappen
                }
                
                liveTooltip.style.left = `${targetX}px`;
                liveTooltip.style.top = `${pt.y - 45}px`;
            } else {
                liveTooltip.classList.add('hidden');
            }
        }
    }

    drawGraph();

    // 6. MAUS-TRACKING FÜR TOOLTIP INTERAKTION
    activeCanvas.onmousemove = function(e) {
        let activeIndex = null;
        for (let i = 0; i < pointsCoordinates.length; i++) {
            if (Math.sqrt((e.offsetX - pointsCoordinates[i].x) ** 2 + (e.offsetY - pointsCoordinates[i].y) ** 2) < 18) { 
                activeIndex = i; 
                break; 
            }
        }
        drawGraph(activeIndex);
    };

    activeCanvas.onmouseleave = () => {
        drawGraph(null);
    };
};

// Zeitfilter-Tabs verknüpfen
document.addEventListener('DOMContentLoaded', () => {
    ['hourly', 'daily', '7day'].forEach(filter => {
        const el = document.getElementById(`tab-${filter}`);
        if (el) {
            el.addEventListener('click', () => {
                ['hourly', 'daily', '7day'].forEach(f => document.getElementById(`tab-${f}`)?.classList.remove('active'));
                el.classList.add('active');
                
                activeChartFilter = filter; 
                window.renderTrendChart(); 
            });
        }
    });

    window.addEventListener('resize', () => {
        if (currentGlobalHistory && currentGlobalHistory.length >= 2) {
            window.renderTrendChart();
        }
    });
});
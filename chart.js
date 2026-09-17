let currentGlobalHistory = [];
let activeChartFilter = 'hourly'; 

function renderTrendChart(historyLog) {
    if (historyLog) currentGlobalHistory = historyLog;
    
    const container = document.getElementById('chart-area');
    
    // Nutzt das ausgelagerte Filter-Modul
    const filteredLog = window.filterHistoryByScope(currentGlobalHistory, activeChartFilter);
    
    if (!filteredLog || filteredLog.length < 2) {
        container.innerHTML = `<div style="color: #94a3b8; font-size: 0.85em; padding: 35px 0; text-align: center; width: 100%;">Warte auf weitere Snapshot-Punkte im "${activeChartFilter}" Filter...</div>`;
        return;
    }

    if (container.querySelector('canvas') === null) {
        container.innerHTML = `<canvas id="trendCanvas" style="width: 100%; height: 100%; display: block;"></canvas>`;
    }

    const activeCanvas = document.getElementById('trendCanvas');
    const height = 115;
    
    const paddingLeft = 48; 
    const paddingRight = 20;
    const paddingTop = 15;
    const paddingBottom = 25; 

    const values = filteredLog.map(h => h.value);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    let pointsCoordinates = [];

    function drawGraph(highlightIndex = null) {
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        
        activeCanvas.width = width * window.devicePixelRatio;
        activeCanvas.height = height * window.devicePixelRatio;
        
        const ctx = activeCanvas.getContext('2d');
        ctx.resetTransform();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;
        
        ctx.clearRect(0, 0, width, height);
        
        pointsCoordinates = [];
        filteredLog.forEach((point, index) => {
            const x = paddingLeft + (index / (filteredLog.length - 1)) * chartWidth;
            const y = paddingTop + chartHeight - ((point.value - minVal) / valRange) * chartHeight;
            
            // KORREKTUR: Dynamische Achsenbeschriftung mit Datum je nach Filter
            let labelText = point.time; // Standardmäßig die Uhrzeit (HH:MM:SS)
            if (activeChartFilter === 'daily' || activeChartFilter === '7day') {
                // Kombiniere Tag/Monat mit der Uhrzeit gekürzt (z.B. "15.09. 18:22")
                const shortDate = point.date ? point.date.substring(0, 5) : '';
                const shortTime = point.time ? point.time.substring(0, 5) : '';
                labelText = `${shortDate} ${shortTime}`;
            }

            pointsCoordinates.push({ 
                x, 
                y, 
                value: point.value, 
                time: point.time, 
                date: point.date || '', // Holt das neue Datumsfeld aus dem Log
                label: labelText 
            });
        });

        // 1. Hintergrund-Grid und Y-Achse zeichnen
        ctx.font = '500 10px "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'right';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;

        const yTicks = [minVal, minVal + valRange / 2, maxVal];
        yTicks.forEach(tickVal => {
            const y = paddingTop + chartHeight - ((tickVal - minVal) / valRange) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(width - paddingRight, y);
            ctx.stroke();

            ctx.fillText(window.formatGoldAxisLabel(tickVal) + 'g', paddingLeft - 8, y + 3);
        });

        ctx.beginPath();
        ctx.strokeStyle = '#cbd5e1';
        ctx.moveTo(paddingLeft, paddingTop);
        ctx.lineTo(paddingLeft, height - paddingBottom);
        ctx.stroke();

        // 2. Trendlinie zeichnen
        ctx.beginPath();
        ctx.strokeStyle = '#2563eb'; 
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        pointsCoordinates.forEach((pt, index) => {
            if (index === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        // 3. Scheitelpunkte und X-Achse zeichnen
        pointsCoordinates.forEach((pt, index) => {
            ctx.beginPath();
            if (index === highlightIndex) {
                ctx.arc(pt.x, pt.y, 5.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#2563eb';
            } else {
                ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#b45309';
            }
            ctx.fill();

            const skipStep = Math.ceil(filteredLog.length / 4);
            if (index % skipStep === 0 || index === filteredLog.length - 1 || index === 0) {
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'center';
                
                ctx.beginPath();
                ctx.strokeStyle = '#cbd5e1';
                ctx.moveTo(pt.x, height - paddingBottom);
                ctx.lineTo(pt.x, height - paddingBottom + 4);
                ctx.stroke();

                ctx.fillText(pt.label, pt.x, height - paddingBottom + 16);
            }
        });

        // 4. In-Canvas Tooltip (KORREKTUR: Jetzt mit Datum und Uhrzeit)
        if (highlightIndex !== null && pointsCoordinates[highlightIndex]) {
            const pt = pointsCoordinates[highlightIndex];
            
            const dateText = pt.date ? `${pt.date} - ${pt.time}` : pt.time;
            const goldText = `Gold: ${pt.value.toLocaleString()}g`;
            
            ctx.font = 'bold 11px "Segoe UI", Roboto, sans-serif';
            const textWidth = Math.max(ctx.measureText(dateText).width, ctx.measureText(goldText).width);
            
            const boxWidth = textWidth + 16;
            const boxHeight = 36;
            
            let boxX = pt.x + 10;
            let boxY = pt.y - 42;
            
            if (boxX + boxWidth > width) boxX = pt.x - boxWidth - 10;
            if (boxY < 2) boxY = pt.y + 10;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(boxX + 2, boxY + 2, boxWidth, boxHeight);

            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1.5;
            ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'left';
            ctx.font = '500 10px "Segoe UI", Roboto, sans-serif';
            ctx.fillText(dateText, boxX + 8, boxY + 14); // Zeigt "DD.MM.YYYY - HH:MM:SS"

            ctx.fillStyle = '#ffb400';
            ctx.font = 'bold 11px "Segoe UI", Roboto, sans-serif';
            ctx.fillText(goldText, boxX + 8, boxY + 28);
        }
    }

    drawGraph();

    if (window.chartResizeObserver) window.chartResizeObserver.disconnect();
    window.chartResizeObserver = new ResizeObserver(() => drawGraph());
    window.chartResizeObserver.observe(container);

    activeCanvas.onmousemove = function(e) {
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;
        let activeIndex = null;

        for (let i = 0; i < pointsCoordinates.length; i++) {
            const pt = pointsCoordinates[i];
            const distance = Math.sqrt((mouseX - pt.x) ** 2 + (mouseY - pt.y) ** 2);
            if (distance < 18) {
                activeIndex = i;
                break;
            }
        }

        if (activeIndex !== null) {
            drawGraph(activeIndex);
            activeCanvas.style.cursor = 'pointer';
        } else {
            drawGraph();
            activeCanvas.style.cursor = 'default';
        }
    };

    activeCanvas.onmouseleave = function() {
        drawGraph();
        activeCanvas.style.cursor = 'default';
    };
}

function setupChartTabControls() {
    const tabBindings = [
        { id: 'tab-hourly', filter: 'hourly' },
        { id: 'tab-daily', filter: 'daily' },
        { id: 'tab-7day', filter: '7day' }
    ];

    tabBindings.forEach(binding => {
        const el = document.getElementById(binding.id);
        if (el) {
            el.addEventListener('click', () => {
                tabBindings.forEach(b => document.getElementById(b.id)?.classList.remove('active'));
                el.classList.add('active');
                activeChartFilter = binding.filter;
                renderTrendChart(); 
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', setupChartTabControls);

window.renderTrendChart = renderTrendChart;

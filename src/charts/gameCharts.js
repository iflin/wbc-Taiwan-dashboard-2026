window.Charts = window.Charts || {};

/**
 * 得分期望值起伏圖 (RE24 Worm Chart)
 * 顯示比賽中得分期望值(RE24)的累計變化
 */
function drawRE24WormChart(containerId, data, isWin) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = ''; // 清除舊圖

  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 180 - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // X 軸是打席序列
  const xScale = d3.scaleLinear()
    .domain([0, data.length - 1])
    .range([0, width]);

  // Y 軸是 RE24 累計值
  const yExtent = d3.extent(data, d => d.cumulativeRe24);
  const yMax = Math.max(Math.abs(yExtent[0] || 0), Math.abs(yExtent[1] || 0), 1);
  const yScale = d3.scaleLinear()
    .domain([-yMax * 1.1, yMax * 1.1])
    .range([height, 0]);

  // 定義漸層填色
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", `re24-gradient-${containerId}`)
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%");
  gradient.append("stop").attr("offset", "0%").attr("stop-color", "#06d6a0").attr("stop-opacity", 0.6);
  gradient.append("stop").attr("offset", "50%").attr("stop-color", "#06d6a0").attr("stop-opacity", 0);
  gradient.append("stop").attr("offset", "50%").attr("stop-color", "#e63946").attr("stop-opacity", 0);
  gradient.append("stop").attr("offset", "100%").attr("stop-color", "#e63946").attr("stop-opacity", 0.6);

  // 0 基線
  svg.append('line')
    .attr('x1', 0).attr('y1', yScale(0))
    .attr('x2', width).attr('y2', yScale(0))
    .attr('stroke', 'rgba(255,255,255,0.4)')
    .attr('stroke-dasharray', '4,4')
    .attr('stroke-width', 1);

  // 左側座標軸
  svg.append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(0, 0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .attr('color', 'rgba(255,255,255,0.6)');

  // 繪製面積
  const area = d3.area()
    .x((d, i) => xScale(i))
    .y0(yScale(0))
    .y1(d => yScale(d.cumulativeRe24))
    .curve(d3.curveMonotoneX);

  svg.append("path")
    .datum(data)
    .attr("fill", `url(#re24-gradient-${containerId})`)
    .attr("d", area);

  // 繪製折線
  const line = d3.line()
    .x((d, i) => xScale(i))
    .y(d => yScale(d.cumulativeRe24))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', isWin ? '#fb8500' : '#4cc9f0')
    .attr('stroke-width', 2.5)
    .attr('d', line);

  // 互動提示
  const tip = createTooltip();
  svg.selectAll('circle.data-point')
    .data(data).enter().append('circle')
    .attr('class', 'data-point')
    .attr('cx', (d, i) => xScale(i))
    .attr('cy', d => yScale(d.cumulativeRe24))
    .attr('r', 3)
    .attr('fill', d => d.diff >= 0 ? '#06d6a0' : '#e63946')
    .attr('opacity', 0)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 1).attr('r', 6);
      
      showTooltip(tip, event, `
        <div class="tooltip-row"><span class="tooltip-label">打席</span><span class="tooltip-value">${d.inning} 局${d.half.includes('top') ? '上' : '下'}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">劇本</span><span class="tooltip-value" style="font-weight:bold">${d.isOffense ? '台灣進攻' : '台灣防守'}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">對決</span><span class="tooltip-value">${d.pitcher} vs ${d.batter}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">結果</span><span class="tooltip-value" style="color:var(--text-color)">${d.event}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">期望值起伏</span><span class="tooltip-value" style="color: ${d.diff >= 0 ? '#06d6a0' : '#e63946'}">${d.diff > 0 ? '+' : ''}${d.diff.toFixed(2)} 分</span></div>
      `);
    })
    .on('mousemove', e => { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; })
    .on('mouseout', function() { d3.select(this).attr('opacity', 0).attr('r', 3); hideTooltip(tip); });
}

/**
 * 📈 局數得分熱區 (Inning Scoring Bar Chart)
 * 雙向長條圖：上半為得分，下半為失分
 */
function drawInningScoringBarChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !d3) return;
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;">無足夠的賽事資料</div>';
    return;
  }

  const margin = { top: 40, right: 30, bottom: 40, left: 50 };
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 350;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('max-width', '100%')
    .style('height', 'auto');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // 取最大得分與最大失分來決定 Y 軸範圍
  const maxScored = d3.max(data, d => d.scored) || 1;
  const maxAllowed = d3.max(data, d => d.allowed) || 1;
  const yDomainMax = Math.max(maxScored, maxAllowed) + 1; // 留點上方空間

  const xScale = d3.scaleBand()
    .domain(data.map(d => d.inning))
    .range([0, innerWidth])
    .padding(0.3);

  // Y 軸：從 -yDomainMax 到 +yDomainMax
  const yScale = d3.scaleLinear()
    .domain([-yDomainMax, yDomainMax])
    .range([innerHeight, 0])
    .nice();

  // 背景水平網格線
  const yTicks = yScale.ticks(10).filter(t => t !== 0); // 排除 0，因為 0 會畫實線
  g.selectAll('.grid-line')
    .data(yTicks)
    .enter().append('line')
    .attr('class', 'grid-line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', d => yScale(d))
    .attr('y2', d => yScale(d))
    .attr('stroke', '#334155')
    .attr('stroke-dasharray', '3,3')
    .style('opacity', 0.5);

  // Y=0 基準線
  g.append('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', yScale(0))
    .attr('y2', yScale(0))
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 2);

  // Y 軸標籤
  const yAxis = d3.axisLeft(yScale)
    .tickFormat(d => Math.abs(d)) // 標籤只顯示絕對值
    .ticks(8);
  
  g.append('g')
    .call(yAxis)
    .selectAll('text')
    .attr('fill', '#94a3b8')
    .style('font-size', '12px');
    
  g.select('.domain').attr('stroke', '#334155');
  g.selectAll('.tick line').attr('stroke', '#334155');

  // X 軸標籤 (局數)
  g.append('g')
    .attr('transform', `translate(0, ${yScale(0)})`) // 放在 Y=0 的位置
    .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10))
    .selectAll('text')
    .attr('fill', '#f1f5f9')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .text(d => `第 ${d} 局`);
    
  g.select('.domain').remove(); // 移除 X 軸底線，因為已有 Y=0 基準線

  // 繪製得分長條圖 (上方)
  const scoredBars = g.selectAll('.bar-scored')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar-scored')
    .attr('x', d => xScale(d.inning))
    .attr('y', yScale(0))
    .attr('width', xScale.bandwidth())
    .attr('height', 0)
    .attr('fill', '#3b82f6') // 藍色
    .attr('rx', 4);

  scoredBars.transition()
    .duration(1000)
    .delay((d, i) => i * 50)
    .attr('y', d => yScale(d.scored))
    .attr('height', d => yScale(0) - yScale(d.scored));

  // 加上得分標籤
  g.selectAll('.label-scored')
    .data(data.filter(d => d.scored > 0))
    .enter().append('text')
    .attr('class', 'label-scored')
    .attr('x', d => xScale(d.inning) + xScale.bandwidth() / 2)
    .attr('y', yScale(0))
    .attr('dy', '-0.5em')
    .attr('text-anchor', 'middle')
    .text(d => '+' + d.scored)
    .attr('fill', '#60a5fa')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .transition()
    .duration(1000)
    .delay((d, i) => i * 50)
    .attr('y', d => yScale(d.scored));

  // 繪製失分長條圖 (下方)
  const allowedBars = g.selectAll('.bar-allowed')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar-allowed')
    .attr('x', d => xScale(d.inning))
    .attr('y', yScale(0))
    .attr('width', xScale.bandwidth())
    .attr('height', 0)
    .attr('fill', '#ef4444') // 紅色
    .attr('rx', 4);

  allowedBars.transition()
    .duration(1000)
    .delay((d, i) => i * 50)
    .attr('y', yScale(0))
    .attr('height', d => Math.abs(yScale(-d.allowed) - yScale(0)));

  // 加上失分標籤
  g.selectAll('.label-allowed')
    .data(data.filter(d => d.allowed > 0))
    .enter().append('text')
    .attr('class', 'label-allowed')
    .attr('x', d => xScale(d.inning) + xScale.bandwidth() / 2)
    .attr('y', yScale(0))
    .attr('dy', '1.2em')
    .attr('text-anchor', 'middle')
    .text(d => '-' + d.allowed)
    .attr('fill', '#f87171')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .transition()
    .duration(1000)
    .delay((d, i) => i * 50)
    .attr('y', d => yScale(-d.allowed));

  // 圖例說明
  const legend = svg.append('g')
    .attr('transform', `translate(${width - margin.right - 180}, 15)`);

  legend.append('rect').attr('x', 0).attr('y', 0).attr('width', 12).attr('height', 12).attr('fill', '#3b82f6').attr('rx', 2);
  legend.append('text').attr('x', 20).attr('y', 10).text('台灣隊得分').style('font-size', '12px').attr('fill', '#e2e8f0');

  legend.append('rect').attr('x', 95).attr('y', 0).attr('width', 12).attr('height', 12).attr('fill', '#ef4444').attr('rx', 2);
  legend.append('text').attr('x', 115).attr('y', 10).text('台灣隊失分').style('font-size', '12px').attr('fill', '#e2e8f0');

  // Tooltip
  const tip = createTooltip();
  
  // 建立滑鼠互動的隱形熱區
  g.selectAll('.hover-zone')
    .data(data)
    .enter().append('rect')
    .attr('class', 'hover-zone')
    .attr('x', d => xScale(d.inning))
    .attr('y', 0)
    .attr('width', xScale.bandwidth())
    .attr('height', innerHeight)
    .style('fill', 'transparent')
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).style('fill', 'rgba(255,255,255,0.05)');
      showTooltip(tip, event, `
        <div style="font-size:14px; font-weight:bold; color:#f8fafc; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:4px;">
          第 ${d.inning} 局
        </div>
        <div style="margin-top:4px"><span style="display:inline-block;width:10px;height:10px;background:#3b82f6;margin-right:5px;border-radius:2px;"></span>得分：<strong style="color:#60a5fa">${d.scored}</strong></div>
        <div style="margin-top:2px"><span style="display:inline-block;width:10px;height:10px;background:#ef4444;margin-right:5px;border-radius:2px;"></span>失分：<strong style="color:#f87171">${d.allowed}</strong></div>
        <div style="margin-top:4px; color:#94a3b8; font-size:12px; border-top:1px solid #334155; padding-top:4px;">
          得失差：<strong style="color:${d.scored - d.allowed > 0 ? '#60a5fa' : (d.scored - d.allowed < 0 ? '#f87171' : '#cbd5e1')}">${d.scored - d.allowed > 0 ? '+' : ''}${d.scored - d.allowed}</strong>
        </div>
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 15) + 'px';
      tip.style.top = (event.clientY - 15) + 'px';
    })
    .on('mouseout', function() {
      d3.select(this).style('fill', 'transparent');
      hideTooltip(tip);
    });
}

// 匯出至全域 Charts 物件
window.Charts.drawRE24WormChart = drawRE24WormChart;
window.Charts.drawInningScoringBarChart = drawInningScoringBarChart;

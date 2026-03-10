/**
 * WBC 台灣隊 2026 預賽 C 組 — 進階擴充圖表模組
 * 負責渲染歷史走勢 (DE-02)、戰術解構 (DE-03)、英雄怪力榜單 (DE-04)
 */

// ============================================================
// DE-02: 歷屆戰績進化圖 (Historical Evolution)
// ============================================================
function drawHistoryEvolutionChart(containerId, historyData) {
  if (!historyData || !historyData.batting || !historyData.pitching || historyData.batting.length === 0) {
    if (typeof renderEmptyState === 'function') renderEmptyState(containerId, '無歷屆戰績比較資料');
    return;
  }

  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  // 整理資料：合併打擊的 OPS 與投手的 ERA
  // 將其翻轉由遠到近 (2006 -> 2026) 作為 X 軸。同時過濾未包含年份的異常雜質資料
  let data = historyData.batting
    .filter(b => b['年份'] && !isNaN(parseInt(b['年份'])))
    .map(b => {
      const p = historyData.pitching.find(x => x['年份'] === b['年份']) || {};
      return {
        year: parseInt(b['年份']),
        event: String(b['年份']), // 將 X 軸標籤改為年份字串而非賽事的 "WBC"
        ops: parseFloat(b['平均攻擊指數']) || parseFloat(b['長打率']) + parseFloat(b['上壘率']) || 0,
        era: parseFloat(p['防禦率']) || 0,
        runs: parseFloat(b['總得分']) || 0
      };
    })
    .sort((a, b) => a.year - b.year);

  // 由於這是一個混合了折線與長條圖的雙軸圖表，我們使用純 D3 實作
  const rect = container.getBoundingClientRect();
  const width = rect.width > 0 ? rect.width : 800;
  const height = rect.height > 0 ? rect.height : 300;
  const margin = { top: 40, right: 60, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(container).append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("font-family", "Inter, Noto Sans TC, sans-serif");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // X 軸 (年份/賽事)
  const x = d3.scalePoint()
    .domain(data.map(d => d.event))
    .range([0, innerWidth])
    .padding(0.5);

  // Y 軸 1 (左) - 總得分 (Bar)
  const yRuns = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.runs) * 1.2])
    .range([innerHeight, 0]);

  // Y 軸 2 (右) - ERA (Area/Line)
  const yERA = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.era) * 1.2])
    .range([innerHeight, 0]);

  // 繪製格線
  g.append("g")
    .attr("class", "grid")
    .style("color", "rgba(255, 255, 255, 0.05)")
    .call(d3.axisLeft(yRuns).tickSize(-innerWidth).tickFormat(""))
    .selectAll("path, line").style("stroke-dasharray", "3,3");

  // 繪製 X 軸
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .attr("color", "var(--text-muted)")
    .selectAll("text")
    .style("font-size", "12px")
    .style("font-weight", "600");

  // 左 Y 軸 - 得分
  g.append("g")
    .call(d3.axisLeft(yRuns).ticks(5))
    .attr("color", "var(--accent-blue)")
    .append("text")
    .attr("x", 0)
    .attr("y", -15)
    .attr("fill", "var(--accent-blue)")
    .attr("text-anchor", "middle")
    .style("font-weight", "700")
    .text("總得分");

  // 右 Y 軸 - ERA
  g.append("g")
    .attr("transform", `translate(${innerWidth},0)`)
    .call(d3.axisRight(yERA).ticks(5))
    .attr("color", "var(--accent-red)")
    .append("text")
    .attr("x", 0)
    .attr("y", -15)
    .attr("fill", "var(--accent-red)")
    .attr("text-anchor", "middle")
    .style("font-weight", "700")
    .text("團隊防禦率");

  // 繪製 長條圖 (得分)
  g.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.event) - 20)
    .attr("width", 40)
    .attr("y", innerHeight)
    .attr("height", 0)
    .attr("fill", "rgba(58, 134, 255, 0.4)")
    .attr("stroke", "var(--accent-blue)")
    .attr("stroke-width", 2)
    .attr("rx", 4)
    .transition()
    .duration(1000)
    .attr("y", d => yRuns(d.runs))
    .attr("height", d => innerHeight - yRuns(d.runs));
    
  g.selectAll(".bar-label")
    .data(data)
    .enter().append("text")
    .attr("x", d => x(d.event))
    .attr("y", d => yRuns(d.runs) - 10)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--text-primary)")
    .style("font-weight", "700")
    .style("font-size", "12px")
    .style("opacity", 0)
    .text(d => d.runs)
    .transition()
    .delay(800)
    .duration(500)
    .style("opacity", 1);

  // 繪製 折線圖 (ERA)
  const line = d3.line()
    .x(d => x(d.event))
    .y(d => yERA(d.era))
    .curve(d3.curveMonotoneX);

  const path = g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "var(--accent-red)")
    .attr("stroke-width", 3)
    .attr("d", line);

  const totalLength = path.node().getTotalLength();
  path
    .attr("stroke-dasharray", totalLength + " " + totalLength)
    .attr("stroke-dashoffset", totalLength)
    .transition()
    .duration(1500)
    .ease(d3.easeLinear)
    .attr("stroke-dashoffset", 0);

  // 折線圖焦點 (ERA)
  g.selectAll(".dot")
    .data(data)
    .enter().append("circle")
    .attr("class", "dot")
    .attr("cx", d => x(d.event))
    .attr("cy", d => yERA(d.era))
    .attr("r", 5)
    .attr("fill", "var(--bg-card)")
    .attr("stroke", "var(--accent-red)")
    .attr("stroke-width", 2)
    .style("opacity", 0)
    .transition()
    .delay((d, i) => i * (1500 / data.length))
    .style("opacity", 1);
    
  // ERA 數值文字
  g.selectAll(".era-label")
    .data(data)
    .enter().append("text")
    .attr("x", d => x(d.event))
    .attr("y", d => yERA(d.era) - 15)
    .attr("fill", "var(--accent-red)")
    .attr("text-anchor", "middle")
    .style("font-weight", "700")
    .style("font-size", "12px")
    .style("opacity", 0)
    .text(d => d.era.toFixed(2))
    .transition()
    .delay(1000)
    .duration(500)
    .style("opacity", 1);
}

// ============================================================
// DE-03: 戰術解構 (Tactical Breakdown)
// ============================================================

/** 繪製團隊打點來源長條圖 */
function drawRBISourceChart(containerId, rbiData) {
  if (!rbiData || rbiData.length === 0) {
    if (typeof renderEmptyState === 'function') renderEmptyState(containerId, '無打點來源資料');
    return;
  }
  
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  // 按照打點獲得方式彙總
  const grouped = d3.rollup(rbiData, v => d3.sum(v, d => parseFloat(d['打點'])||0), d => d['打點獲得方式']);
  let data = Array.from(grouped, ([key, value]) => ({ type: key, rbi: value }))
    .sort((a, b) => b.rbi - a.rbi);

  // 繪製精美橫向長條圖 (HTML/CSS)
  const maxRbi = d3.max(data, d => d.rbi) || 1;
  
  let html = `<div style="display: flex; flex-direction: column; gap: 12px; height: 100%; justify-content: center; padding: 20px 0;">`;
  data.forEach((d, i) => {
    const pct = (d.rbi / maxRbi) * 100;
    // 第1名用金色，其他用藍色
    const color = i === 0 ? 'var(--accent-gold)' : 'var(--accent-blue)';
    html += `
      <div style="display: flex; align-items: center; gap: 15px;">
        <div style="width: 100px; text-align: right; font-weight: 600; color: var(--text-secondary);">${escapeHTML(d.type)}</div>
        <div style="flex: 1; height: 24px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; position: relative;">
          <div style="height: 100%; width: ${pct}%; background: ${color}; opacity: 0.8; border-radius: 4px; transition: width 1s ease-out;"></div>
        </div>
        <div style="width: 40px; font-weight: 800; color: ${color}; font-variant-numeric: tabular-nums;">${d.rbi}</div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

/** 繪製團隊球種使用比例 (圓餅圖) */
function drawTeamPitchArsenalChart(containerId, pitchData) {
  if (!pitchData || pitchData.length === 0) {
    if (typeof renderEmptyState === 'function') renderEmptyState(containerId, '無球種比例資料');
    return;
  }
  
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const rect = container.getBoundingClientRect();
  const width = rect.width > 0 ? rect.width : 400;
  const height = rect.height > 0 ? rect.height : 300;
  const radius = Math.max(Math.min(width, height) / 2 - 20, 50);

  const svg = d3.select(container).append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .append("g")
    .attr("transform", `translate(${width/2},${height/2})`);

  // 使用 D3 Pie
  const pie = d3.pie()
    .value(d => parseFloat(d['比例']) || 0)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(radius * 0.5) // Donut
    .outerRadius(radius * 0.8);
    
  const outerArc = d3.arc()
    .innerRadius(radius * 0.9)
    .outerRadius(radius * 0.9);

  // 嘗試使用現有的 PITCH_COLOR_MAP
  const getColor = window.DataProcessor && window.DataProcessor.PITCH_COLOR_MAP ? 
    (d => window.DataProcessor.PITCH_COLOR_MAP[d['英文']] || "#aaaaaa") : 
    d3.scaleOrdinal(d3.schemeCategory10);

  const arcs = svg.selectAll("arc")
    .data(pie(pitchData))
    .enter()
    .append("g");

  arcs.append("path")
    .attr("d", arc)
    .attr("fill", d => typeof getColor === 'function' ? getColor(d.data) : getColor(d.data.球種))
    .attr("stroke", "var(--bg-card)")
    .style("stroke-width", "2px")
    .style("opacity", 0.8)
    .on("mouseover", function() { d3.select(this).style("opacity", 1); })
    .on("mouseout", function() { d3.select(this).style("opacity", 0.8); });

  // 加上百分比標籤
  arcs.append("text")
    .attr("transform", d => {
      const pos = outerArc.centroid(d);
      pos[0] = radius * (midAngle(d) < Math.PI ? 1 : -1);
      return `translate(${pos})`;
    })
    .attr("text-anchor", d => midAngle(d) < Math.PI ? "start" : "end")
    .attr("dy", ".35em")
    .attr("fill", "var(--text-primary)")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .text(d => {
      const pct = (d.data['比例'] * 100).toFixed(1);
      return pct >= 3.0 ? `${d.data['球種']} ${pct}%` : ''; // 太小的比例不印字
    });

  // Polyline for labels
  arcs.append("polyline")
    .attr("stroke", "var(--text-muted)")
    .style("fill", "none")
    .attr("stroke-width", 1)
    .attr("points", d => {
      if ((d.data['比例'] * 100) < 3.0) return "";
      const pos = outerArc.centroid(d);
      pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
      return [arc.centroid(d), outerArc.centroid(d), pos];
    });

  function midAngle(d) {
    return d.startAngle + (d.endAngle - d.startAngle) / 2;
  }
}

// ============================================================
// DE-04: 英雄怪力榜單 (Heroism & Extremes)
// ============================================================

/** 繪製打線怪力榜 (前10遠全壘打) - 生成精美 HTML 列表 */
function drawMonsterHitsList(containerId, hrData) {
  if (!hrData || hrData.length === 0) {
    if (typeof renderEmptyState === 'function') renderEmptyState(containerId, '無全壘打距離資料');
    return;
  }
  
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // HTML 排版
  let html = `<div class="stats-table-wrapper"><table class="stats-table">
    <thead>
      <tr>
        <th>Rank</th>
        <th>打者</th>
        <th>擊球初速 (EV)</th>
        <th>擊球仰角 (LA)</th>
        <th style="color: var(--accent-red)">飛行距離</th>
        <th>對戰隊伍</th>
        <th>苦主投手</th>
      </tr>
    </thead>
    <tbody>`;
    
  hrData.forEach((d, i) => {
    // Top 3 會有獎牌顏色
    let rankColor = "var(--text-muted)";
    if (i === 0) rankColor = "#ffd700"; // 金
    if (i === 1) rankColor = "#c0c0c0"; // 銀
    if (i === 2) rankColor = "#cd7f32"; // 銅
    
    // 中英分離降級處理
    const localName = window.DataProcessor && window.DataProcessor.TAIWAN_PLAYER_NAMES 
                      ? getPlayerLocalNameExt(d['打者']) : d['打者'];

    html += `
      <tr>
        <td style="text-align: left; font-weight: 800; color: ${rankColor}; font-size: 1.2em;">#${i+1}</td>
        <td>${localName}</td>
        <td style="color: var(--accent-gold); font-weight: 700;">${parseFloat(d['擊球初速 (km/h)']).toFixed(1)} <span style="font-size:0.8em; color:var(--text-muted); font-weight: normal;">km/h</span></td>
        <td>${d['擊球仰角（度）']}°</td>
        <td style="color: var(--accent-red); font-weight: 800; font-size: 1.1em;">${parseFloat(d['距離 (m)']).toFixed(1)} <span style="font-size:0.7em; color:var(--text-muted); font-weight: normal;">m</span></td>
        <td>${escapeHTML(d['對戰國家'])}</td>
        <td style="color: var(--text-secondary);">${escapeHTML(d['對戰投手'])}</td>
      </tr>
    `;
  });
  
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

/** 繪製火球男排行榜 (前10火球) - 生成精美 HTML 列表 */
function drawTopFastballsList(containerId, fbData) {
  if (!fbData || fbData.length === 0) {
    if (typeof renderEmptyState === 'function') renderEmptyState(containerId, '無火球測速資料');
    return;
  }
  
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let html = `<div class="stats-table-wrapper"><table class="stats-table">
    <thead>
      <tr>
        <th>Rank</th>
        <th>火球男</th>
        <th style="color: var(--accent-red)">極速 (Velo)</th>
        <th>球種</th>
        <th>對戰隊伍</th>
        <th>面對打者</th>
      </tr>
    </thead>
    <tbody>`;
    
  fbData.forEach((d, i) => {
    let rankColor = "var(--text-muted)";
    if (i === 0) rankColor = "#ffd700";
    if (i === 1) rankColor = "#c0c0c0";
    if (i === 2) rankColor = "#cd7f32";
    
    html += `
      <tr>
        <td style="text-align: left; font-weight: 800; color: ${rankColor}; font-size: 1.2em;">#${i+1}</td>
        <td>${getPlayerLocalNameExt(d['投手'])}</td>
        <td style="color: var(--accent-red); font-weight: 800; font-size: 1.1em;">${escapeHTML(d['球速'])}</td>
        <td style="color: var(--accent-blue);">${escapeHTML(d['球種'])}</td>
        <td>${escapeHTML(d['對戰隊伍'])}</td>
        <td style="color: var(--text-secondary);">${escapeHTML(d['對戰選手'])}</td>
      </tr>
    `;
  });
  
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// 輔助函式：由於獨立模組，我們需要一個專屬的名字分離器
function getPlayerLocalNameExt(engName) {
  if (!engName) return "";
  const mapped = window.DataProcessor && window.DataProcessor.TAIWAN_PLAYER_NAMES ? window.DataProcessor.TAIWAN_PLAYER_NAMES[engName] : null;
  if (!mapped) return escapeHTML(engName);
  const match = mapped.match(/^(.+?)\s*(\(.+\))$/);
  if (match) {
    return escapeHTML(match[1].trim()); // 依照使用者最新要求，移除了英文與括號
  }
  return escapeHTML(mapped);
}

// ============================================================
// 註冊至全域 Charts 物件
// ============================================================
window.Charts = window.Charts || {};
window.Charts.drawHistoryEvolutionChart = drawHistoryEvolutionChart;
window.Charts.drawRBISourceChart = drawRBISourceChart;
window.Charts.drawTeamPitchArsenalChart = drawTeamPitchArsenalChart;
window.Charts.drawMonsterHitsList = drawMonsterHitsList;
window.Charts.drawTopFastballsList = drawTopFastballsList;

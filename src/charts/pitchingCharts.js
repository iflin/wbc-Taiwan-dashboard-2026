window.Charts = window.Charts || {};

// ============================================================
// 2. 投球位移圖（Movement Chart）
// ============================================================

/**
 * 繪製投球水平/垂直位移散布圖
 * @param {string} containerId - 容器元素 ID
 * @param {Object[]} pitchDetails - 投手的 pitchDetails 陣列
 * @param {string} pitcherName - 投手姓名（圖表標題用）
 */
function drawMovementChart(containerId, pitchDetails, pitcherName) {
  const container = document.getElementById(containerId);
  if (!container || pitchDetails.length === 0) return;
  container.innerHTML = '';

  const validData = pitchDetails.filter(d => d.pfxX !== null && d.pfxZ !== null);
  if (validData.length === 0) return;

  const margin = { top: 20, right: 30, bottom: 50, left: 55 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 380 - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const tip = createTooltip();

  // 比例尺
  const xExtent = d3.extent(validData, d => d.pfxX);
  const yExtent = d3.extent(validData, d => d.pfxZ);
  const maxRange = Math.max(
    Math.abs(xExtent[0] || 0), Math.abs(xExtent[1] || 0),
    Math.abs(yExtent[0] || 0), Math.abs(yExtent[1] || 0),
    15
  ) + 5;

  const xScale = d3.scaleLinear().domain([-maxRange, maxRange]).range([0, width]);
  const yScale = d3.scaleLinear().domain([-maxRange, maxRange]).range([height, 0]);

  // 十字線
  svg.append('line')
    .attr('x1', xScale(0)).attr('y1', 0)
    .attr('x2', xScale(0)).attr('y2', height)
    .attr('stroke', 'rgba(148,163,184,0.2)').attr('stroke-dasharray', '4,4');

  svg.append('line')
    .attr('x1', 0).attr('y1', yScale(0))
    .attr('x2', width).attr('y2', yScale(0))
    .attr('stroke', 'rgba(148,163,184,0.2)').attr('stroke-dasharray', '4,4');

  // 座標軸
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(6))
    .append('text')
    .attr('class', 'axis-label')
    .attr('x', width / 2).attr('y', 40)
    .attr('text-anchor', 'middle')
    .text('水平位移 Horizontal Break (in)');

  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(6))
    .append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -42)
    .attr('text-anchor', 'middle')
    .text('垂直位移 Induced Vertical Break (in)');

  // 散布點（依球種著色）
  const colorMap = DataProcessor.PITCH_COLOR_MAP;

  svg.selectAll('circle')
    .data(validData)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.pfxX))
    .attr('cy', d => yScale(d.pfxZ))
    .attr('r', 4.5)
    .attr('fill', d => colorMap[d.type] || '#64748b')
    .attr('fill-opacity', 0.7)
    .attr('stroke', d => colorMap[d.type] || '#64748b')
    .attr('stroke-width', 0.8)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 7).attr('fill-opacity', 1);
      showTooltip(tip, event, `
        <div class="tooltip-title">${escapeHTML(d.typeName)} (${escapeHTML(d.type)})</div>
        <div class="tooltip-row"><span class="tooltip-label">球速</span><span class="tooltip-value">${d.speed ? d.speed.toFixed(1) : '—'} mph</span></div>
        <div class="tooltip-row"><span class="tooltip-label">轉速</span><span class="tooltip-value">${d.spin || '—'} rpm</span></div>
        <div class="tooltip-row"><span class="tooltip-label">水平位移</span><span class="tooltip-value">${d.pfxX.toFixed(1)} in</span></div>
        <div class="tooltip-row"><span class="tooltip-label">垂直位移</span><span class="tooltip-value">${d.pfxZ.toFixed(1)} in</span></div>
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 12) + 'px';
      tip.style.top = (event.clientY - 10) + 'px';
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 4.5).attr('fill-opacity', 0.7);
      hideTooltip(tip);
    });
}

// ============================================================
// 3. 好球帶熱圖
// ============================================================

/**
 * 繪製好球帶進壘位置圖
 * 參考 generate_svg_shapes.py 風格：
 * - 1:1 正方形繪圖區保持真實比例
 * - 球種以不同形狀區分（速球=圓形 / 變化球=不同方向三角形）
 * - 九宮格虛線、帶陰影好球帶框、精確五邊形本壘板
 * @param {string} containerId - 容器 ID
 * @param {Object[]} pitchDetails - 投球詳細資料
 */
function drawStrikeZoneChart(containerId, pitchDetails) {
  const container = document.getElementById(containerId);
  if (!container || pitchDetails.length === 0) return;
  container.innerHTML = '';

  const validData = pitchDetails.filter(d => d.pX !== null && d.pZ !== null);
  if (validData.length === 0) return;

  // ====== 佈局常數（模仿 generate_svg_shapes.py 的 1:1 正方形結構） ======
  const plotSize = 420;               // 正方形繪圖區邊長
  const margin = { top: 30, right: 40, bottom: 100, left: 70 };
  const svgW = margin.left + plotSize + margin.right;
  const svgH = margin.top + plotSize + margin.bottom;

  // 可視範圍（英尺）— 1:1 等比例
  const viewRange = 5.2;
  const viewCX = 0.0;                 // 水平中心
  const viewCY = 2.2;                 // 垂直中心（好球帶中點附近）
  const viewLeft = viewCX - viewRange / 2;
  const viewRight = viewCX + viewRange / 2;
  const viewBot = viewCY - viewRange / 2;
  const viewTop = viewCY + viewRange / 2;

  // 英尺 → SVG 座標轉換
  function ftToX(ft) {
    return margin.left + ((ft - viewLeft) / (viewRight - viewLeft)) * plotSize;
  }
  function ftToY(ft) {
    return margin.top + (1 - (ft - viewBot) / (viewTop - viewBot)) * plotSize;
  }

  // 建立 SVG
  const svgEl = d3.select(`#${containerId}`)
    .append('svg')
    .attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`);
  const svg = svgEl;

  const tip = createTooltip();

  // ====== 好球帶尺寸（使用實際資料中的平均 sz_top/sz_bot，或預設值） ======
  const plateHalfW = 17 / 12 / 2;     // 0.7083 ft（17 英吋的一半）
  const szLeft = -plateHalfW;
  const szRight = plateHalfW;

  // 嘗試從投球資料中取得實際好球帶高度（取有效值的平均）
  // 若資料中沒有 szTop/szBot 屬性，使用標準預設值
  const szTops = validData.map(d => d.szTop).filter(v => v !== null && v !== undefined);
  const szBots = validData.map(d => d.szBot).filter(v => v !== null && v !== undefined);
  const szTop = szTops.length > 0 ? szTops.reduce((a, b) => a + b, 0) / szTops.length : 3.5;
  const szBot = szBots.length > 0 ? szBots.reduce((a, b) => a + b, 0) / szBots.length : 1.5;

  // ====== 座標軸刻度與格線 ======
  const axisColor = '#555555';
  const guideColor = '#444444';
  const labelColor = '#888888';
  const tickLen = 4;

  // X 軸刻度 (-2, -1, 0, 1, 2)
  const plotBotY = margin.top + plotSize;
  for (let ft = -2; ft <= 2; ft++) {
    const x = ftToX(ft);
    // 刻度線
    svg.append('line')
      .attr('x1', x).attr('y1', plotBotY)
      .attr('x2', x).attr('y2', plotBotY + tickLen)
      .attr('stroke', axisColor).attr('stroke-width', 1);
    // 垂直導引線
    svg.append('line')
      .attr('x1', x).attr('y1', margin.top)
      .attr('x2', x).attr('y2', plotBotY)
      .attr('stroke', guideColor).attr('stroke-width', 0.3).attr('stroke-dasharray', '2,4');
    // 刻度標籤
    svg.append('text')
      .attr('x', x).attr('y', plotBotY + tickLen + 13)
      .attr('text-anchor', 'middle')
      .attr('fill', labelColor).attr('font-size', '10px').attr('font-family', 'sans-serif')
      .text(ft);
  }

  // X 軸名稱
  svg.append('text')
    .attr('x', margin.left + plotSize / 2).attr('y', plotBotY + tickLen + 28)
    .attr('text-anchor', 'middle')
    .attr('fill', labelColor).attr('font-size', '10px').attr('font-family', 'sans-serif')
    .text('← 內角　水平位置 (ft)　外角 →');

  // Y 軸刻度 (0, 1, 2, 3, 4)
  for (let ft = 0; ft <= 4; ft++) {
    const y = ftToY(ft);
    if (y < margin.top || y > plotBotY) continue;
    // 刻度線
    svg.append('line')
      .attr('x1', margin.left - tickLen).attr('y1', y)
      .attr('x2', margin.left).attr('y2', y)
      .attr('stroke', axisColor).attr('stroke-width', 1);
    // 水平導引線
    svg.append('line')
      .attr('x1', margin.left).attr('y1', y)
      .attr('x2', margin.left + plotSize).attr('y2', y)
      .attr('stroke', guideColor).attr('stroke-width', 0.3).attr('stroke-dasharray', '2,4');
    // 刻度標籤
    svg.append('text')
      .attr('x', margin.left - tickLen - 5).attr('y', y + 3)
      .attr('text-anchor', 'end')
      .attr('fill', labelColor).attr('font-size', '10px').attr('font-family', 'sans-serif')
      .text(ft);
  }

  // Y 軸名稱（旋轉）
  const yTitleX = margin.left - tickLen - 30;
  const yTitleY = margin.top + plotSize / 2;
  svg.append('text')
    .attr('x', yTitleX).attr('y', yTitleY)
    .attr('text-anchor', 'middle')
    .attr('fill', labelColor).attr('font-size', '10px').attr('font-family', 'sans-serif')
    .attr('transform', `rotate(-90, ${yTitleX}, ${yTitleY})`)
    .text('高度 (ft)');

  // ====== 好球帶外框（帶陰影） ======
  const szX1 = ftToX(szLeft);
  const szX2 = ftToX(szRight);
  const szY1 = ftToY(szTop);
  const szY2 = ftToY(szBot);
  const szW = szX2 - szX1;
  const szH = szY2 - szY1;

  // 陰影層
  svg.append('rect')
    .attr('x', szX1 + 1.5).attr('y', szY1 + 1.5)
    .attr('width', szW).attr('height', szH)
    .attr('fill', 'none').attr('stroke', '#444444').attr('stroke-width', 3).attr('rx', 2);

  // 主好球帶框
  svg.append('rect')
    .attr('x', szX1).attr('y', szY1)
    .attr('width', szW).attr('height', szH)
    .attr('fill', 'rgba(255,255,255,0.03)')
    .attr('stroke', 'rgba(255,255,255,0.6)').attr('stroke-width', 2.5).attr('rx', 2);

  // ====== 九宮格虛線 ======
  const thirdW = szW / 3;
  const thirdH = szH / 3;
  for (let i = 1; i < 3; i++) {
    // 垂直線
    svg.append('line')
      .attr('x1', szX1 + i * thirdW).attr('y1', szY1)
      .attr('x2', szX1 + i * thirdW).attr('y2', szY2)
      .attr('stroke', 'rgba(255,255,255,0.2)').attr('stroke-width', 0.8).attr('stroke-dasharray', '4,3');
    // 水平線
    svg.append('line')
      .attr('x1', szX1).attr('y1', szY1 + i * thirdH)
      .attr('x2', szX2).attr('y2', szY1 + i * thirdH)
      .attr('stroke', 'rgba(255,255,255,0.2)').attr('stroke-width', 0.8).attr('stroke-dasharray', '4,3');
  }

  // ====== 五邊形本壘板（精確比例） ======
  const ph = plateHalfW;
  const plateFrontZ = 0.35;
  const plateSideD = ph * 0.5;
  const plateBackD = ph * 0.5;
  const platePoints = [
    [ftToX(-ph), ftToY(plateFrontZ)],                           // 前左
    [ftToX(ph),  ftToY(plateFrontZ)],                           // 前右
    [ftToX(ph),  ftToY(plateFrontZ - plateSideD)],              // 側右
    [ftToX(0),   ftToY(plateFrontZ - plateSideD - plateBackD)], // 後尖端
    [ftToX(-ph), ftToY(plateFrontZ - plateSideD)],              // 側左
  ];
  svg.append('polygon')
    .attr('points', platePoints.map(p => p.join(',')).join(' '))
    .attr('fill', 'rgba(255,255,255,0.05)')
    .attr('stroke', '#888888').attr('stroke-width', 1.2);

  // ====== 三角形輔助函式（模仿 generate_svg_shapes.py） ======
  /**
   * 計算正三角形的頂點座標
   * @param {number} cx - 中心 X
   * @param {number} cy - 中心 Y
   * @param {number} r - 外接圓半徑
   * @param {number} angleDeg - 尖端指向角度（0=右, 90=下, 180=左, 270=上）
   */
  function trianglePoints(cx, cy, r, angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return [
      [cx + r * Math.cos(a),                    cy + r * Math.sin(a)],
      [cx + r * Math.cos(a + 2 * Math.PI / 3),  cy + r * Math.sin(a + 2 * Math.PI / 3)],
      [cx + r * Math.cos(a - 2 * Math.PI / 3),  cy + r * Math.sin(a - 2 * Math.PI / 3)],
    ];
  }

  // 球種 → 形狀角度對照（速球類=圓形，變化球=三角形各方向）
  const shapeAngles = {
    SI: 30,    // 伸卡球 → 右下三角
    FC: 180,   // 切球 → 左三角
    SL: 0,     // 滑球 → 右三角
    CU: 90,    // 曲球 → 下三角
    CH: 270,   // 變速球 → 上三角
    FS: 90,    // 指叉球 → 下三角
    ST: 0,     // 掃掠滑球 → 右三角
    KC: 90,    // 彎曲球 → 下三角
  };
  // 圓形球種（速球類）
  const circlePitchTypes = new Set(['FF']);

  const colorMap = DataProcessor.PITCH_COLOR_MAP;
  const markerSize = 8;
  const circleR = markerSize * 0.643; // 面積匹配比例

  // ====== 依球種順序繪製投球點 ======
  // 取得出現過的球種類型並排序（速球優先顯示在下層）
  const typeOrder = [...new Set(validData.map(d => d.type))].sort((a, b) => {
    const aIsCircle = circlePitchTypes.has(a) ? 0 : 1;
    const bIsCircle = circlePitchTypes.has(b) ? 0 : 1;
    return aIsCircle - bIsCircle;
  });

  typeOrder.forEach(ptype => {
    const typeData = validData.filter(d => d.type === ptype);
    const color = colorMap[ptype] || '#64748b';

    if (circlePitchTypes.has(ptype)) {
      // 速球類 → 圓形
      svg.selectAll(null)
        .data(typeData)
        .enter()
        .append('circle')
        .attr('cx', d => ftToX(d.pX))
        .attr('cy', d => ftToY(d.pZ))
        .attr('r', circleR)
        .attr('fill', color).attr('fill-opacity', 0.82)
        .attr('stroke', '#ffffff').attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('r', circleR + 3).attr('fill-opacity', 1);
          _showStrikeZoneTip(tip, event, d);
        })
        .on('mousemove', function(event) {
          tip.style.left = (event.clientX + 12) + 'px';
          tip.style.top = (event.clientY - 10) + 'px';
        })
        .on('mouseout', function() {
          d3.select(this).attr('r', circleR).attr('fill-opacity', 0.82);
          hideTooltip(tip);
        });
    } else {
      // 變化球 → 三角形（不同方向）
      const angle = shapeAngles[ptype] !== undefined ? shapeAngles[ptype] : 0;
      svg.selectAll(null)
        .data(typeData)
        .enter()
        .append('polygon')
        .attr('points', d => {
          const cx = ftToX(d.pX);
          const cy = ftToY(d.pZ);
          const verts = trianglePoints(cx, cy, markerSize, angle);
          return verts.map(v => `${v[0].toFixed(1)},${v[1].toFixed(1)}`).join(' ');
        })
        .attr('fill', color).attr('fill-opacity', 0.82)
        .attr('stroke', '#ffffff').attr('stroke-width', 1.5)
        .attr('stroke-linejoin', 'round')
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('fill-opacity', 1)
            .attr('stroke-width', 2.5);
          _showStrikeZoneTip(tip, event, d);
        })
        .on('mousemove', function(event) {
          tip.style.left = (event.clientX + 12) + 'px';
          tip.style.top = (event.clientY - 10) + 'px';
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill-opacity', 0.82).attr('stroke-width', 1.5);
          hideTooltip(tip);
        });
    }
  });

  // ====== 底部球種圖例 ======
  const legendBaseY = svgH - margin.bottom + 50;
  const legendCX = margin.left + plotSize / 2;

  // 圖例標題
  svg.append('text')
    .attr('x', legendCX).attr('y', legendBaseY)
    .attr('text-anchor', 'middle')
    .attr('fill', '#aaaaaa').attr('font-size', '11px').attr('font-family', 'sans-serif')
    .text('球種');

  // 統計各球種數量
  const typeCounts = {};
  validData.forEach(d => { typeCounts[d.type] = (typeCounts[d.type] || 0) + 1; });
  const legendItems = typeOrder.map(code => ({
    code,
    label: `${DataProcessor.PITCH_TYPE_MAP[code] || code} (${typeCounts[code] || 0})`,
  }));

  // 自動排成多行，每行最多 3 個
  const itemW = 160;
  const itemH = 22;
  const itemsPerRow = 3;
  const rows = [];
  for (let i = 0; i < legendItems.length; i += itemsPerRow) {
    rows.push(legendItems.slice(i, i + itemsPerRow));
  }

  rows.forEach((row, rowIdx) => {
    const rowTotal = row.length * itemW;
    const rowStart = legendCX - rowTotal / 2;
    const rowY = legendBaseY + 20 + rowIdx * itemH;

    row.forEach((item, colIdx) => {
      const lx = rowStart + colIdx * itemW;
      const color = colorMap[item.code] || '#64748b';
      const markerCX = lx + 8;
      const markerCY = rowY - 4;

      // 圖例標記
      if (circlePitchTypes.has(item.code)) {
        svg.append('circle')
          .attr('cx', markerCX).attr('cy', markerCY)
          .attr('r', 5 * 0.643)
          .attr('fill', color).attr('fill-opacity', 0.85)
          .attr('stroke', '#ffffff').attr('stroke-width', 1);
      } else {
        const angle = shapeAngles[item.code] !== undefined ? shapeAngles[item.code] : 0;
        const verts = trianglePoints(markerCX, markerCY, 5, angle);
        svg.append('polygon')
          .attr('points', verts.map(v => `${v[0].toFixed(1)},${v[1].toFixed(1)}`).join(' '))
          .attr('fill', color).attr('fill-opacity', 0.85)
          .attr('stroke', '#ffffff').attr('stroke-width', 1).attr('stroke-linejoin', 'round');
      }

      // 圖例文字
      svg.append('text')
        .attr('x', lx + 20).attr('y', rowY)
        .attr('fill', '#cccccc').attr('font-size', '10px').attr('font-family', 'sans-serif')
        .text(item.label);
    });
  });

  // 底部說明
  svg.append('text')
    .attr('x', legendCX).attr('y', svgH - 8)
    .attr('text-anchor', 'middle')
    .attr('fill', '#666666').attr('font-size', '10px').attr('font-family', 'sans-serif')
    .text('捕手視角 Catcher\'s View');
}

// ============================================================
// 5. 球種分布條（用於投手頁面）
// ============================================================

/**
 * 建立球種分布彩色條（HTML 元素）
 * @param {HTMLElement} container - 容器元素
 * @param {Object} pitchTypes - 投手的 pitchTypes 物件
 */
function renderPitchMixBar(container, pitchTypes) {
  if (!container) return;
  const typeArr = Object.values(pitchTypes).sort((a, b) => b.count - a.count);
  const total = typeArr.reduce((sum, pt) => sum + pt.count, 0);
  if (total === 0) return;

  const bar = document.createElement('div');
  bar.className = 'pitch-mix-bar';

  typeArr.forEach(pt => {
    const pct = (pt.count / total * 100);
    if (pct < 1) return;
    const seg = document.createElement('div');
    seg.className = 'pitch-mix-segment';
    seg.style.width = pct + '%';
    seg.style.background = DataProcessor.PITCH_COLOR_MAP[pt.code] || '#64748b';
    seg.title = `${pt.name} (${pt.code}): ${pct.toFixed(1)}%`;
    if (pct > 8) seg.textContent = pt.code;
    bar.appendChild(seg);
  });

  container.appendChild(bar);

  // 圖例
  const legend = document.createElement('div');
  legend.className = 'pitch-legend';
  typeArr.forEach(pt => {
    const pct = (pt.count / total * 100);
    if (pct < 1) return;
    const item = document.createElement('span');
    item.className = 'pitch-legend-item';
    item.innerHTML = `<span class="pitch-legend-dot" style="background:${DataProcessor.PITCH_COLOR_MAP[pt.code] || '#64748b'}"></span>${pt.name} ${pct.toFixed(0)}%`;
    legend.appendChild(item);
  });
  container.appendChild(legend);
}

// ============================================================
// 6. 主審誤判視覺化
// ============================================================

/**
 * 繪製主審好球帶判決圖
 * @param {string} containerId - 容器 ID
 * @param {Object} umpireData - computeUmpireAnalysis 回傳的資料
 */
function drawUmpireChart(containerId, umpireData) {
  const container = document.getElementById(containerId);
  if (!container || !umpireData || umpireData.pitches.length === 0) return;
  container.innerHTML = '';

  const data = umpireData.pitches;

  const margin = { top: 20, right: 20, bottom: 40, left: 45 };
  const size = Math.min(container.clientWidth, 420);
  const width = size - margin.left - margin.right;
  const height = size * 1.1 - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${size} ${size * 1.1}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const tip = createTooltip();

  const xScale = d3.scaleLinear().domain([-2.5, 2.5]).range([0, width]);
  const yScale = d3.scaleLinear().domain([0, 5]).range([height, 0]);

  // 取出所有被判斷為好球的紀錄以繪製變形蟲等高線 (Amoeba Zone)
  const calledStrikes = data.filter(d => d.calledStrike);

  if (calledStrikes.length > 0) {
    const densityData = d3.contourDensity()
      .x(d => xScale(d.pX))
      .y(d => yScale(d.pZ))
      .size([width, height])
      .bandwidth(20) // 控制變形蟲邊緣的圓滑程度
      .thresholds(8) // 用 8 個等高線層次來堆疊立體感
      (calledStrikes);

    const maxVal = d3.max(densityData, d => d.value) || 1;

    svg.insert("g", "rect") // 畫在好球帶框架之前，作為底圖背景
      .selectAll("path")
      .data(densityData)
      .enter()
      .append("path")
      .attr("d", d3.geoPath())
      .attr("fill", "#60a5fa") // 偏冷的藍色系
      .attr("fill-opacity", d => (d.value / maxVal) * 0.4) // 依據好球密度加深不透明度
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.3)
      .style("stroke-linejoin", "round");
  }

  // 法定標準好球帶外框 (對照用)
  const szTop = 3.5, szBot = 1.5, plateHalf = 0.83;
  svg.append('rect')
    .attr('x', xScale(-plateHalf)).attr('y', yScale(szTop))
    .attr('width', xScale(plateHalf) - xScale(-plateHalf))
    .attr('height', yScale(szBot) - yScale(szTop))
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.4)')
    .attr('stroke-dasharray', '4,4') // 改成虛線避免搶走變形蟲的風采
    .attr('stroke-width', 2);

  // 投球點 (弱化正確判決的球以突顯爭議與好球帶形狀)
  svg.selectAll('circle')
    .data(data)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.pX))
    .attr('cy', d => yScale(d.pZ))
    .attr('r', d => (d.isPhantomStrike || d.isMissedStrike) ? 5 : 3) // 放大誤判球
    .attr('fill', d => {
      if (d.isPhantomStrike) return '#e63946'; // 爆紅
      if (d.isMissedStrike) return '#f5c542'; // 金黃
      if (d.isCorrect && d.calledStrike) return '#94a3b8'; // 退色的灰藍
      return '#334155'; // 退色的深灰
    })
    .attr('fill-opacity', d => (d.isPhantomStrike || d.isMissedStrike) ? 0.9 : 0.3)
    .attr('stroke', d => (d.isPhantomStrike || d.isMissedStrike) ? '#fff' : 'none')
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 7).attr('fill-opacity', 1);
      let label = '正確判決';
      if (d.isPhantomStrike) label = '🔴 幽靈好球';
      if (d.isMissedStrike) label = '🟡 漏判好球';
      showTooltip(tip, event, `
        <div class="tooltip-title">${label}</div>
        <div class="tooltip-row"><span class="tooltip-label">判決</span><span class="tooltip-value">${d.calledStrike ? '好球' : '壞球'}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">實際</span><span class="tooltip-value">${d.isInZone ? '好球帶內' : '好球帶外'}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">投手</span><span class="tooltip-value">${escapeHTML(d.pitcher)}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">打者</span><span class="tooltip-value">${escapeHTML(d.batter)}</span></div>
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 12) + 'px';
      tip.style.top = (event.clientY - 10) + 'px';
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 4).attr('fill-opacity', 0.6);
      hideTooltip(tip);
    });
}

// ============================================================
// 9. CSW% 圓環圖
// ============================================================
function drawCSWDonutChart(containerId, pitcher) {
  const container = document.getElementById(containerId);
  if (!container || !pitcher || pitcher.pitchCount === 0) return;
  container.innerHTML = '';

  const width = container.clientWidth;
  const height = 330;
  const radius = Math.min(width, height) / 2 - 20;

  const svg = d3.select(`#${containerId}`).append('svg').attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g').attr('transform', `translate(${width/2},${height/2})`);

  const tip = createTooltip();

  const csw = pitcher.calledStrikes + pitcher.swingingStrikes;
  const other = pitcher.pitchCount - csw;
  const data = [
    { label: 'Called Strikes', value: pitcher.calledStrikes, color: '#3a86ff' },
    { label: 'Swinging Strikes', value: pitcher.swingingStrikes, color: '#e63946' },
    { label: 'Others', value: other, color: 'rgba(51, 65, 85, 0.4)' }
  ];

  const pie = d3.pie().value(d => d.value).sort(null);
  const dataReady = pie(data);

  const arc = d3.arc().innerRadius(radius * 0.65).outerRadius(radius);
  const arcHover = d3.arc().innerRadius(radius * 0.65).outerRadius(radius + 10);

  svg.selectAll('path')
    .data(dataReady).enter().append('path')
    .attr('d', arc)
    .attr('fill', d => d.data.color)
    .attr('stroke', '#1e293b').attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('d', arcHover).attr('opacity', 0.9);
      showTooltip(tip, event, `<div class="tooltip-title">${escapeHTML(d.data.label)}</div><div class="tooltip-row"><span class="tooltip-label">數量</span><span class="tooltip-value">${d.data.value} 球</span></div>`);
    })
    .on('mousemove', e => { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; })
    .on('mouseout', function() { d3.select(this).attr('d', arc).attr('opacity', 1); hideTooltip(tip); });

  const cswPct = (csw / pitcher.pitchCount * 100).toFixed(1);
  const isElite = cswPct >= 30;

  svg.append('text').attr('text-anchor', 'middle').attr('y', -10).attr('fill', '#94a3b8').attr('font-size', '14px').text('CSW%');
  svg.append('text').attr('text-anchor', 'middle').attr('y', 25).attr('fill', isElite ? '#f5c542' : '#fff').attr('font-size', '36px').attr('font-weight', 'bold').text(`${cswPct}%`);
}

// ============================================================
// 10. Chase% 壞球誘使出棒熱區圖
// ============================================================
function drawChaseHeatmapChart(containerId, pitcher) {
  const container = document.getElementById(containerId);
  if (!container || !pitcher || !pitcher.pitchDetails) return;
  container.innerHTML = '';

  const outZonePitches = pitcher.pitchDetails.filter(d => d.pX !== null && d.pZ !== null && d.zone !== null && d.zone > 9);
  if (outZonePitches.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8; text-align:center; padding: 40px;">無足夠壞球帶數據</div>';
    return;
  }

  const margin = { top: 30, right: 30, bottom: 50, left: 50 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`).append('svg').attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const tip = createTooltip();
  const xScale = d3.scaleLinear().domain([-2.5, 2.5]).range([0, width]);
  const yScale = d3.scaleLinear().domain([0, 5]).range([height, 0]);

  svg.append('rect').attr('x', xScale(-0.83)).attr('y', yScale(3.5)).attr('width', xScale(0.83) - xScale(-0.83)).attr('height', yScale(1.5) - yScale(3.5)).attr('fill', 'none').attr('stroke', '#fff').attr('stroke-dasharray', '4,4').attr('stroke-width', 2);

  const xStep = 1.0, yStep = 1.0;
  const bins = [];
  for(let x = -2.5; x < 2.5; x += xStep) {
    for(let y = 0; y < 5; y += yStep) {
      bins.push({ x0: x, x1: x + xStep, y0: y, y1: y + yStep, swings: 0, total: 0 });
    }
  }

  outZonePitches.forEach(p => {
    const isSwing = p.description.includes('Swinging') || p.description.includes('Foul') || p.description.includes('In play');
    for (let b of bins) {
      if (p.pX >= b.x0 && p.pX < b.x1 && p.pZ >= b.y0 && p.pZ < b.y1) {
        b.total++;
        if (isSwing) b.swings++;
        break;
      }
    }
  });

  const colorScale = d3.scaleLinear().domain([0, 1]).range(['rgba(230,57,70,0.05)', 'rgba(230,57,70,0.95)']);

  svg.selectAll('rect.bin')
    .data(bins.filter(b => b.total > 0)).enter().append('rect').attr('class', 'bin')
    .attr('x', d => xScale(d.x0)).attr('y', d => yScale(d.y1))
    .attr('width', d => xScale(d.x1) - xScale(d.x0) - 2).attr('height', d => yScale(d.y0) - yScale(d.y1) - 2)
    .attr('fill', d => colorScale(d.swings / d.total))
    .attr('fill-opacity', 0.85).attr('rx', 4)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('fill-opacity', 1).attr('stroke', '#fff').attr('stroke-width', 1);
      showTooltip(tip, event, `<div class="tooltip-title">熱區 Chase%</div><div class="tooltip-row"><span class="tooltip-label">追打率</span><span class="tooltip-value">${(d.swings / d.total * 100).toFixed(1)}%</span></div><div class="tooltip-row"><span class="tooltip-label">揮棒/總數</span><span class="tooltip-value">${d.swings} / ${d.total}</span></div>`);
    })
    .on('mousemove', e => { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; })
    .on('mouseout', function() { d3.select(this).attr('fill-opacity', 0.85).attr('stroke', 'none'); hideTooltip(tip); });

  svg.selectAll('text.bin-label')
    .data(bins.filter(b => b.total > 0)).enter().append('text').attr('class', 'bin-label')
    .attr('x', d => xScale((d.x0 + d.x1) / 2)).attr('y', d => yScale((d.y0 + d.y1) / 2) + 4)
    .attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', '12px').attr('font-weight', 'bold')
    .text(d => `${Math.round(d.swings / d.total * 100)}%`);
}

/**
 * 投球配球馬可夫鏈網絡圖 (Pitch Sequencing Network)
 */
function drawPitchSequenceNetwork(containerId, pitcher) {
  const container = document.getElementById(containerId);
  if (!container || !pitcher || !pitcher.pitchSequence || !pitcher.pitchSequence.transitions) return;
  
  const transitions = pitcher.pitchSequence.transitions;
  const nodesMap = {};
  const links = [];

  // 整理 nodes 與 links
  Object.keys(transitions).forEach(source => {
    if (!nodesMap[source]) nodesMap[source] = { id: source };
    Object.keys(transitions[source]).forEach(target => {
      if (!nodesMap[target]) nodesMap[target] = { id: target };
      const value = transitions[source][target];
      if (value > 0) {
        links.push({ source, target, value });
      }
    });
  });

  const nodes = Object.values(nodesMap);
  if (nodes.length === 0 || links.length === 0) {
    container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;">無足夠的連球紀錄進行分析</div>';
    return;
  }
  
  container.innerHTML = '';

  const width = container.clientWidth || 400;
  const height = 400;

  const svg = d3.select(`#${containerId}`)
    .append("svg")
    .attr("viewBox", [0, 0, width, height]);

  const tip = createTooltip();

  // 定義箭頭 (marker)
  svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 25) // 將箭頭往後推，以免被圓圈蓋住
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("fill", "#94a3b8")
    .attr("d", "M0,-5L10,0L0,5");

  // 力導向佈局
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(120))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(30));

  // 繪製連線 Links
  const link = svg.append("g")
    .selectAll("path")
    .data(links)
    .enter()
    .append("path")
    .attr("fill", "none")
    .attr("stroke", "#475569")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", d => Math.max(1, Math.sqrt(d.value) * 1.5))
    .attr("marker-end", "url(#arrow)")
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr("stroke", "#f5c542").attr("stroke-opacity", 1);
      showTooltip(tip, event, `
        <div class="tooltip-row"><span class="tooltip-label">${escapeHTML(window.DataProcessor.PITCH_TYPE_MAP[d.source.id] || d.source.id)} → ${escapeHTML(window.DataProcessor.PITCH_TYPE_MAP[d.target.id] || d.target.id)}</span></div>
        <div class="tooltip-row"><span class="tooltip-value">連續出現 ${d.value} 次</span></div>
      `);
    })
    .on('mousemove', e => { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; })
    .on('mouseout', function() { d3.select(this).attr("stroke", "#475569").attr("stroke-opacity", 0.6); hideTooltip(tip); });

  // 繪製節點 Nodes
  const node = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .enter()
    .append("g")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  node.append("circle")
    .attr("r", 20)
    .attr("fill", d => window.DataProcessor.PITCH_COLOR_MAP[d.id] || "#64748b")
    .attr("stroke", "#1e293b")
    .attr("stroke-width", 2);

  node.append("text")
    .attr("dy", 4)
    .attr("text-anchor", "middle")
    .text(d => d.id)
    .attr("fill", "#fff")
    .attr("font-size", 12)
    .attr("font-weight", "bold");

  // 更新位置
  simulation.on("tick", () => {
    // 使用曲線連接
    link.attr("d", d => {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // 曲率
      // 若是自己連自己，畫個圈
      if (d.source === d.target) {
        return `M${d.source.x},${d.source.y} A15,15 0 1,1 ${d.source.x + 1},${d.source.y}`;
      }
      return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
    });

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

/**
 * 球種 RV 瀑布圖 (Run Value Waterfall Chart)
 */
function drawRunValueWaterfallChart(containerId, pitcher) {
  const container = document.getElementById(containerId);
  if (!container || !pitcher || !pitcher.pitchTypes) return;

  const validTypes = Object.values(pitcher.pitchTypes).filter(p => p.count > 0 && p.totalRV !== undefined);
  if (validTypes.length === 0) {
    container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;">無足夠的球種 RV 數據進行分析</div>';
    return;
  }
  container.innerHTML = '';

  // 整理 Waterfall 資料，由好至壞排序 (RV 由小到大)
  const sortedTypes = validTypes.sort((a, b) => a.totalRV - b.totalRV);
  
  // 計算累積值
  let cumulative = 0;
  const waterfallData = sortedTypes.map(d => {
    const start = cumulative;
    cumulative += d.totalRV;
    const end = cumulative;
    return {
      name: d.name,
      code: d.code,
      value: d.totalRV,
      start: start,
      end: end,
      min: Math.min(start, end),
      max: Math.max(start, end)
    };
  });

  // 加上 Total 總結條
  waterfallData.push({
    name: '總和 (Total RV)',
    code: 'TOTAL',
    value: cumulative,
    start: 0,
    end: cumulative,
    min: Math.min(0, cumulative),
    max: Math.max(0, cumulative),
    isTotal: true
  });

  const margin = { top: 30, right: 30, bottom: 40, left: 100 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 360 - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const tip = createTooltip();

  // X 軸：Run Value (從最小到最大延伸稍微留白)
  const xMin = Math.min(0, d3.min(waterfallData, d => d.min));
  const xMax = Math.max(0, d3.max(waterfallData, d => d.max));
  
  const xScale = d3.scaleLinear()
    .domain([xMin > 0 ? -1 : xMin * 1.2, xMax < 0 ? 1 : xMax * 1.2])
    .range([0, width]);

  // Y 軸：球種
  const yScale = d3.scaleBand()
    .domain(waterfallData.map(d => d.name))
    .range([0, height])
    .padding(0.2);

  // 畫 X 軸
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(6))
    .attr('color', '#94a3b8')
    .attr('font-size', '12px');

  // 畫 Y 軸
  svg.append('g')
    .call(d3.axisLeft(yScale))
    .attr('color', '#94a3b8')
    .attr('font-size', '12px')
    .selectAll('text')
    .attr('font-weight', d => d === '總和 (Total RV)' ? 'bold' : 'normal');

  // 畫零軸基準線
  svg.append('line')
    .attr('x1', xScale(0))
    .attr('y1', 0)
    .attr('x2', xScale(0))
    .attr('y2', height)
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,4');

  // 長條
  svg.selectAll('.bar')
    .data(waterfallData)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.min))
    .attr('y', d => yScale(d.name))
    .attr('width', d => Math.abs(xScale(d.end) - xScale(d.start)))
    .attr('height', yScale.bandwidth())
    .attr('fill', d => {
      if (d.isTotal) return d.value < 0 ? '#10b981' : '#ef4444'; // 負值(好)綠色，正值(差)紅色
      return window.DataProcessor.PITCH_COLOR_MAP[d.code] || '#3b82f6';
    })
    .attr('rx', 4)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 0.8);
      showTooltip(tip, event, `
        <div class="tooltip-title">${escapeHTML(d.name)}</div>
        <div class="tooltip-row"><span class="tooltip-label">Run Value 貢獻</span><span class="tooltip-value">${d.value > 0 ? '+' : ''}${d.value.toFixed(2)}</span></div>
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 12) + 'px';
      tip.style.top = (event.clientY - 10) + 'px';
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 1);
      hideTooltip(tip);
    });

  // 長條上的標籤
  svg.selectAll('.label')
    .data(waterfallData)
    .enter().append('text')
    .attr('class', 'label')
    .attr('x', d => {
      const xPos = xScale(d.end);
      return d.value < 0 ? xPos - 5 : xPos + 5;
    })
    .attr('y', d => yScale(d.name) + yScale.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.value < 0 ? 'end' : 'start')
    .attr('fill', '#e2e8f0')
    .attr('font-size', '11px')
    .attr('font-weight', d => d.isTotal ? 'bold' : 'normal')
    .text(d => `${d.value > 0 ? '+' : ''}${d.value.toFixed(2)}`);
  
  // 連線 (連接每一步的差距)
  const lineGenerator = d3.line()
    .x(d => d[0])
    .y(d => d[1]);

  for (let i = 0; i < waterfallData.length - 1; i++) {
    const d1 = waterfallData[i];
    const d2 = waterfallData[i + 1];
    svg.append('path')
      .attr('d', lineGenerator([
        [xScale(d1.end), yScale(d1.name) + yScale.bandwidth()],
        [xScale(d1.end), yScale(d2.name)]
      ]))
      .attr('stroke', '#64748b')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('fill', 'none');
  }
}


/**
 * 🔥 火球排行榜計速器 (Fireball Speedometer)
 * 汽車儀表板動態感、強烈烈焰漸層色的橫向長條圖
 */
function drawFireballSpeedometer(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !d3) return;
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;">無足夠的投球資料</div>';
    return;
  }

  const margin = { top: 30, right: 60, bottom: 20, left: 190 };
  const width = Math.max(container.clientWidth || 500, 400);
  const height = Math.max(container.clientHeight || 350, 300);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('max-width', '100%')
    .style('height', 'auto');

  // 定義火焰漸層 (Fire Gradient)
  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'fire-gradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '100%')
    .attr('y2', '0%');
    
  gradient.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b'); // Amber
  gradient.append('stop').attr('offset', '50%').attr('stop-color', '#ea580c'); // Orange
  gradient.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444'); // Red

  // 設置比例尺
  // 讓 X 軸從 130 km/h 開始，突顯差異
  const minSpeed = Math.min(130, d3.min(data, d => d.speedKmh) - 5);
  const maxSpeed = Math.max(155, d3.max(data, d => d.speedKmh) + 2);
  
  const xScale = d3.scaleLinear()
    .domain([minSpeed, maxSpeed])
    .range([0, innerWidth]);

  const yScale = d3.scaleBand()
    .domain(data.map((d, i) => i)) // 使用索引當作 Domain
    .range([0, innerHeight])
    .padding(0.3);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // 加入背景網格線 (儀表板刻度感)
  const xTicks = xScale.ticks(5);
  g.selectAll('.grid-line')
    .data(xTicks)
    .enter().append('line')
    .attr('class', 'grid-line')
    .attr('x1', d => xScale(d))
    .attr('y1', 0)
    .attr('x2', d => xScale(d))
    .attr('y2', innerHeight)
    .attr('stroke', '#334155')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '2,2')
    .style('opacity', 0.5);

  g.selectAll('.grid-label')
    .data(xTicks)
    .enter().append('text')
    .attr('class', 'grid-label')
    .attr('x', d => xScale(d))
    .attr('y', -8)
    .attr('text-anchor', 'middle')
    .text(d => d + ' km/h')
    .attr('fill', '#64748b')
    .style('font-size', '11px');

  // 長條背景軌道
  g.selectAll('.bar-track')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar-track')
    .attr('x', 0)
    .attr('y', (d, i) => yScale(i))
    .attr('width', innerWidth)
    .attr('height', yScale.bandwidth())
    .attr('fill', '#1e293b')
    .attr('rx', 4);

  // 火焰長條圖本體
  const bars = g.selectAll('.fire-bar')
    .data(data)
    .enter().append('rect')
    .attr('class', 'fire-bar')
    .attr('x', 0)
    .attr('y', (d, i) => yScale(i))
    .attr('width', 0) // 先設為 0 以做動畫
    .attr('height', yScale.bandwidth())
    .attr('fill', 'url(#fire-gradient)')
    .attr('rx', 4);

  // 加上閃爍亮光的裝飾條
  g.selectAll('.shine-line')
    .data(data)
    .enter().append('rect')
    .attr('x', 0)
    .attr('y', (d, i) => yScale(i) + 2)
    .attr('width', 0)
    .attr('height', Math.max(1, yScale.bandwidth() * 0.2))
    .attr('fill', 'rgba(255,255,255,0.3)')
    .attr('rx', 2)
    .transition()
    .duration(1500)
    .ease(d3.easeCubicOut)
    .attr('width', d => xScale(d.speedKmh) - 4);

  // 長條圖進場動畫
  bars.transition()
    .duration(1500)
    .ease(d3.easeCubicOut)
    .attr('width', d => xScale(d.speedKmh));

  // Y 軸標籤 (排名、球員、球種)
  const labels = g.selectAll('.y-label')
    .data(data)
    .enter().append('g')
    .attr('transform', (d, i) => `translate(-10, ${yScale(i) + yScale.bandwidth() / 2})`);

  labels.append('text')
    .attr('text-anchor', 'end')
    .attr('dy', '-0.1em')
    .text((d, i) => `#${i + 1} ${d.pitcherName}`)
    .attr('fill', '#f1f5f9')
    .style('font-size', '13px')
    .style('font-weight', 'bold');

  labels.append('text')
    .attr('text-anchor', 'end')
    .attr('dy', '1.2em')
    .text(d => d.pitchType || 'Unknown')
    .attr('fill', '#94a3b8')
    .style('font-size', '11px');

  // 球速數值標籤 (跑馬燈效果)
  const valueLabels = g.selectAll('.val-label')
    .data(data)
    .enter().append('text')
    .attr('class', 'val-label')
    .attr('x', 5)
    .attr('y', (d, i) => yScale(i) + yScale.bandwidth() / 2)
    .attr('dy', '0.35em')
    .text('0.0')
    .attr('fill', '#fcd34d') // 金黃色
    .style('font-size', '13px')
    .style('font-weight', '900')
    .style('font-style', 'italic');

  valueLabels.transition()
    .duration(1500)
    .ease(d3.easeCubicOut)
    .attr('x', d => xScale(d.speedKmh) + 8)
    .tween('text', function(d) {
      const i = d3.interpolate(minSpeed, d.speedKmh);
      return function(t) {
        this.textContent = i(t).toFixed(1) + ' km/h';
      };
    });
    
  // 游標懸停 Tooltip
  const tip = createTooltip();
  bars.style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).style('filter', 'brightness(1.2)');
      showTooltip(tip, event, `
        <div style="font-size:14px; font-weight:bold; color:#f87171;">☄️ 測速槍記錄</div>
        <div style="margin-top:6px; color:#e2e8f0;">
          <div>投手：<b>${d.pitcherName}</b></div>
          <div>球種：<b>${d.pitchType}</b></div>
          <div>球速：<b style="color:#fcd34d">${d.speedKmh.toFixed(1)} km/h</b> <span style="font-size:11px;color:#94a3b8">(${d.speedMph.toFixed(1)} mph)</span></div>
          ${d.batterName ? `<div>打者：${d.batterName}</div>` : ''}
          ${d.result ? `<div style="margin-top:4px; font-size:11px; color:#cbd5e1">${d.result}</div>` : ''}
        </div>
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 15) + 'px';
      tip.style.top = (event.clientY - 15) + 'px';
    })
    .on('mouseout', function() {
      hideTooltip(tip);
    });
}

/**
 * 牛棚拆彈圓餅圖與排行 (Reliever Crisis Donut)
 * 統計後援投手「壘上有人」危機登板時，成功無失分下莊 vs 失分的比例
 */
function drawRelieverCrisisChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !d3 || !data || !data.overall) return;

  container.innerHTML = '';

  const margin = { top: 40, right: 30, bottom: 40, left: 30 };
  const width = container.clientWidth || 800;
  // 保持高度跟容器宣告一致
  const height = 380;
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // 切分為左右兩區
  const leftWidth = innerWidth * 0.4;
  const rightWidth = innerWidth * 0.6;
  const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

  // ==========================
  // 左側：整體拆彈成功率圓環圖
  // ==========================
  const donutG = g.append('g')
    .attr('transform', `translate(${leftWidth / 2}, ${innerHeight / 2 - 20})`);

  const radius = Math.min(leftWidth, innerHeight) / 2.2;
  const arc = d3.arc().innerRadius(radius * 0.65).outerRadius(radius);
  const pie = d3.pie().value(d => d.value).sort(null);

  const pieData = [
    { label: '拆彈成功', value: data.overall.success, color: '#10b981' }, // 碧綠
    { label: '防線失守', value: data.overall.fail, color: '#ef4444' }    // 鮮紅
  ];

  const arcs = donutG.selectAll('.arc')
    .data(pie(pieData))
    .enter()
    .append('g')
    .attr('class', 'arc');

  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => d.data.color)
    .attr('stroke', '#0f172a')
    .style('stroke-width', '2px')
    .style('opacity', 0)
    .transition()
    .duration(1000)
    .delay((d, i) => i * 200)
    .style('opacity', 0.9)
    .attrTween('d', function(d) {
      const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
      return function(t) { return arc(i(t)); };
    });

  // 圓餅圖中心文字
  donutG.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', -15)
    .attr('fill', '#94a3b8')
    .style('font-size', '13px')
    .text('整體牛棚');
    
  let pct = "0%";
  if (data.overall.crisisPA > 0) {
    pct = (data.overall.success / data.overall.crisisPA * 100).toFixed(1) + "%";
  }
  donutG.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 15)
    .attr('fill', '#f1f5f9')
    .style('font-size', '32px')
    .style('font-weight', 'bold')
    .text(pct);
  donutG.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 35)
    .attr('fill', '#10b981')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .text('成功率');

  // ==========================
  // 右側：個別拆彈手排行榜 (堆疊長條圖)
  // ==========================
  const rightG = g.append('g')
    .attr('transform', `translate(${leftWidth + 20}, -10)`);
    
  // 只取前 6 名拆彈手，避免擁擠
  const pitchers = data.pitchers.slice(0, 6); 
  
  const yBarScale = d3.scaleBand()
    .domain(pitchers.map(d => d.name))
    .range([0, innerHeight + 10])
    .padding(0.4);

  const maxPA = d3.max(pitchers, d => d.crisisPA) || 10;
  const xBarScale = d3.scaleLinear()
    .domain([0, maxPA])
    .range([0, rightWidth - 70]); 

  rightG.append('g')
    .attr('class', 'grid-lines')
    .attr('transform', `translate(0, ${innerHeight + 10})`)
    .call(d3.axisBottom(xBarScale).ticks(5).tickSize(-(innerHeight + 10)).tickFormat(''))
    .selectAll('line').style('stroke', '#334155').style('stroke-dasharray', '3,3');

  rightG.append('g')
    .attr('transform', `translate(0, ${innerHeight + 10})`)
    .call(d3.axisBottom(xBarScale).ticks(5))
    .selectAll('text').attr('fill', '#94a3b8').style('font-size', '11px');
  rightG.select('.domain').style('stroke', '#475569');

  const yAxisG = rightG.append('g')
    .call(d3.axisLeft(yBarScale).tickSize(0));
  yAxisG.selectAll('text')
    .attr('fill', '#f1f5f9')
    .style('font-size', '12px')
    .style('font-weight', '500')
    .attr('dx', '-5');
  yAxisG.select('.domain').remove();

  // 堆疊長條圖：左半為成功，緊跟右半為失敗
  const barGroups = rightG.selectAll('.pitcher-bar')
    .data(pitchers)
    .enter()
    .append('g')
    .attr('transform', d => `translate(0, ${yBarScale(d.name)})`);

  // 成功區塊
  barGroups.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('height', yBarScale.bandwidth())
    .attr('width', 0)
    .attr('fill', '#10b981')
    .attr('rx', 3)
    .transition().duration(800)
    .attr('width', d => xBarScale(d.success));

  // 失敗區塊
  barGroups.append('rect')
    .attr('x', d => xBarScale(d.success))
    .attr('y', 0)
    .attr('height', yBarScale.bandwidth())
    .attr('width', 0)
    .attr('fill', '#ef4444')
    .attr('rx', 3)
    .transition().duration(800)
    .attr('width', d => xBarScale(d.fail));

  // 成功數字標籤
  barGroups.append('text')
    .attr('class', 'success-label')
    .attr('x', d => Math.max(0, xBarScale(d.success) / 2))
    .attr('y', yBarScale.bandwidth() / 2 + 4)
    .attr('text-anchor', 'middle')
    .attr('fill', '#0f172a')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('opacity', 0)
    .text(d => d.success > 0 ? d.success : '')
    .transition().duration(800).delay(800)
    .style('opacity', 1);

  // 失敗數字標籤
  barGroups.append('text')
    .attr('class', 'fail-label')
    .attr('x', d => xBarScale(d.success) + xBarScale(d.fail) / 2)
    .attr('y', yBarScale.bandwidth() / 2 + 4)
    .attr('text-anchor', 'middle')
    .attr('fill', '#0f172a')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('opacity', 0)
    .text(d => d.fail > 0 ? d.fail : '')
    .transition().duration(800).delay(800)
    .style('opacity', 1);

  // 打席次標籤
  barGroups.append('text')
    .attr('x', d => xBarScale(d.crisisPA) + 8)
    .attr('y', yBarScale.bandwidth() / 2 + 3)
    .attr('fill', '#94a3b8')
    .style('font-size', '11px')
    .style('opacity', 0)
    .text(d => `(${d.crisisPA} 席)`)
    .transition().duration(800).delay(800)
    .style('opacity', 1);
    
  // ==========================
  // 圖例 (Legend)
  // ==========================
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 160}, 20)`);
    
  legend.append('rect').attr('x', 0).attr('y', 0).attr('width', 12).attr('height', 12).attr('fill', '#10b981').attr('rx', 2);
  legend.append('text').attr('x', 20).attr('y', 10).attr('fill', '#cbd5e1').style('font-size', '11px').text('拆彈成功 (製造出局)');
  
  legend.append('rect').attr('x', 0).attr('y', 20).attr('width', 12).attr('height', 12).attr('fill', '#ef4444').attr('rx', 2);
  legend.append('text').attr('x', 20).attr('y', 30).attr('fill', '#cbd5e1').style('font-size', '11px').text('防線失守 (失血)');
}

// 匯出至全域 Charts 物件
window.Charts.drawMovementChart = drawMovementChart;
window.Charts.drawStrikeZoneChart = drawStrikeZoneChart;
window.Charts.renderPitchMixBar = renderPitchMixBar;
window.Charts.drawUmpireChart = drawUmpireChart;
window.Charts.drawCSWDonutChart = drawCSWDonutChart;
window.Charts.drawChaseHeatmapChart = drawChaseHeatmapChart;
window.Charts.drawPitchSequenceNetwork = drawPitchSequenceNetwork;
window.Charts.drawRunValueWaterfallChart = drawRunValueWaterfallChart;
window.Charts.drawFireballSpeedometer = drawFireballSpeedometer;
window.Charts.drawRelieverCrisisChart = drawRelieverCrisisChart;

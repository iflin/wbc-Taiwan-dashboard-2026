/**
 * WBC 台灣隊 2026 預賽 C 組 — D3.js 視覺化圖表模組
 * 
 * 包含：
 * 1. EV × LA 擊球品質散布圖
 * 2. 投球位移圖（Movement Chart）
 * 3. 好球帶熱圖
 * 4. 仰角分類堆疊橫條圖
 * 5. 球種分布圖
 */

// ============================================================
// 共用 Tooltip
// ============================================================

/** 建立全域 Tooltip 元素 */
function createTooltip() {
  let tip = document.querySelector('.chart-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    document.body.appendChild(tip);
  }
  return tip;
}

/** 顯示 Tooltip */
function showTooltip(tip, event, html) {
  tip.innerHTML = html;
  tip.classList.add('visible');
  const x = event.clientX + 12;
  const y = event.clientY - 10;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

/** 隱藏 Tooltip */
function hideTooltip(tip) {
  tip.classList.remove('visible');
}

// ============================================================
// 1. EV × LA 擊球品質散布圖
// ============================================================

/**
 * 繪製擊球初速(EV) × 擊球仰角(LA) 散布圖
 * 含 Barrel Zone 標註區域
 * @param {string} containerId - 容器元素 ID
 * @param {Object[]} data - collectBattedBallData 回傳的資料
 */
function drawEVxLAChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || data.length === 0) return;
  container.innerHTML = '';

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
  const xScale = d3.scaleLinear()
    .domain([50, 120])
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([-40, 60])
    .range([height, 0]);

  // 繪製 Barrel Zone 區域（EV >= 98, LA 26-30 附近）
  svg.append('rect')
    .attr('x', xScale(98))
    .attr('y', yScale(50))
    .attr('width', xScale(120) - xScale(98))
    .attr('height', yScale(8) - yScale(50))
    .attr('fill', 'rgba(245, 197, 66, 0.08)')
    .attr('stroke', 'rgba(245, 197, 66, 0.3)')
    .attr('stroke-dasharray', '4,4')
    .attr('rx', 4);

  // Barrel Zone 標籤
  svg.append('text')
    .attr('x', xScale(109))
    .attr('y', yScale(52))
    .attr('text-anchor', 'middle')
    .attr('fill', 'rgba(245, 197, 66, 0.5)')
    .attr('font-size', '10px')
    .text('Barrel Zone');

  // 座標軸
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(8))
    .append('text')
    .attr('class', 'axis-label')
    .attr('x', width / 2)
    .attr('y', 40)
    .attr('text-anchor', 'middle')
    .text('擊球初速 Exit Velocity (mph)');

  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(8))
    .append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -42)
    .attr('text-anchor', 'middle')
    .text('擊球仰角 Launch Angle (°)');

  // 顏色依結果分類
  const resultColor = (result) => {
    if (result === 'home_run') return '#f5c542';
    if (result === 'triple') return '#8338ec';
    if (result === 'double') return '#3a86ff';
    if (result === 'single') return '#06d6a0';
    return '#64748b'; // 出局
  };

  // 繪製散布點
  svg.selectAll('circle')
    .data(data)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.ev))
    .attr('cy', d => yScale(d.la))
    .attr('r', 5)
    .attr('fill', d => resultColor(d.result))
    .attr('fill-opacity', 0.75)
    .attr('stroke', d => resultColor(d.result))
    .attr('stroke-opacity', 0.9)
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 8).attr('fill-opacity', 1);
      const resultMap = {
        'home_run': '全壘打 💥', 'triple': '三壘安打', 'double': '二壘安打',
        'single': '一壘安打', 'field_out': '出局', 'grounded_into_double_play': '雙殺',
        'force_out': '封殺', 'fielders_choice': '野手選擇', 'sac_fly': '高飛犧牲打',
        'double_play': '雙殺', 'field_error': '失誤',
      };
      showTooltip(tip, event, `
        <div class="tooltip-title">${d.batter}</div>
        <div class="tooltip-row"><span class="tooltip-label">結果</span><span class="tooltip-value">${resultMap[d.result] || d.result}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">初速</span><span class="tooltip-value">${d.ev.toFixed(1)} mph</span></div>
        <div class="tooltip-row"><span class="tooltip-label">仰角</span><span class="tooltip-value">${d.la.toFixed(1)}°</span></div>
        ${d.distance ? `<div class="tooltip-row"><span class="tooltip-label">距離</span><span class="tooltip-value">${d.distance.toFixed(0)} ft</span></div>` : ''}
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 12) + 'px';
      tip.style.top = (event.clientY - 10) + 'px';
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 5).attr('fill-opacity', 0.75);
      hideTooltip(tip);
    });

  // 圖例
  const legendData = [
    { label: '全壘打', color: '#f5c542' },
    { label: '三壘打', color: '#8338ec' },
    { label: '二壘打', color: '#3a86ff' },
    { label: '安打', color: '#06d6a0' },
    { label: '出局', color: '#64748b' },
  ];

  const legend = svg.append('g')
    .attr('transform', `translate(${width - 80}, 5)`);

  legendData.forEach((d, i) => {
    const g = legend.append('g').attr('transform', `translate(0, ${i * 18})`);
    g.append('circle').attr('cx', 0).attr('cy', 0).attr('r', 4).attr('fill', d.color);
    g.append('text').attr('x', 10).attr('y', 4).attr('font-size', '10px').attr('fill', '#94a3b8').text(d.label);
  });
}

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
        <div class="tooltip-title">${d.typeName} (${d.type})</div>
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

/**
 * 好球帶圖的 Tooltip 共用函式
 */
function _showStrikeZoneTip(tip, event, d) {
  showTooltip(tip, event, `
    <div class="tooltip-title">${d.typeName}</div>
    <div class="tooltip-row"><span class="tooltip-label">結果</span><span class="tooltip-value">${d.description}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">球速</span><span class="tooltip-value">${d.speed ? d.speed.toFixed(1) : '—'} mph</span></div>
    <div class="tooltip-row"><span class="tooltip-label">打者</span><span class="tooltip-value">${d.batter}</span></div>
  `);
}

// ============================================================
// 4. 仰角分類堆疊橫條圖
// ============================================================

/**
 * 繪製打者擊球仰角帶分類分布圖
 * GB(滾地) / LD(平飛) / FB(飛球) / PU(內野飛球)
 * @param {string} containerId - 容器 ID
 * @param {Object[]} batterStats - 打者統計（含 launchAngles）
 */
function drawLADistributionChart(containerId, batterStats) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  // 過濾有仰角資料的打者
  const battersWithLA = batterStats.filter(b => b.launchAngles && b.launchAngles.length >= 2);
  if (battersWithLA.length === 0) return;

  // 計算各打者的仰角帶分布
  const chartData = battersWithLA.map(b => {
    const total = b.launchAngles.length;
    const gb = b.launchAngles.filter(la => la < 10).length;
    const ld = b.launchAngles.filter(la => la >= 10 && la < 25).length;
    const fb = b.launchAngles.filter(la => la >= 25 && la < 50).length;
    const pu = b.launchAngles.filter(la => la >= 50).length;
    return {
      name: b.name,
      gb: gb / total * 100,
      ld: ld / total * 100,
      fb: fb / total * 100,
      pu: pu / total * 100,
      total
    };
  }).sort((a, b) => b.total - a.total).slice(0, 12);

  const margin = { top: 20, right: 30, bottom: 30, left: 120 };
  const barHeight = 28;
  const height = chartData.length * barHeight + margin.top + margin.bottom;
  const width = container.clientWidth - margin.left - margin.right;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const tip = createTooltip();

  const xScale = d3.scaleLinear().domain([0, 100]).range([0, width]);
  const yScale = d3.scaleBand()
    .domain(chartData.map(d => d.name))
    .range([0, chartData.length * barHeight])
    .padding(0.25);

  const categories = [
    { key: 'gb', label: '滾地球 GB', color: '#3b82f6' },
    { key: 'ld', label: '平飛球 LD', color: '#06d6a0' },
    { key: 'fb', label: '飛球 FB', color: '#f5c542' },
    { key: 'pu', label: '內飛球 PU', color: '#e63946' },
  ];

  // 繪製堆疊橫條
  chartData.forEach(d => {
    let xOffset = 0;
    categories.forEach(cat => {
      const val = d[cat.key];
      if (val > 0) {
        svg.append('rect')
          .attr('x', xScale(xOffset))
          .attr('y', yScale(d.name))
          .attr('width', xScale(val))
          .attr('height', yScale.bandwidth())
          .attr('fill', cat.color)
          .attr('fill-opacity', 0.8)
          .attr('rx', 2)
          .style('cursor', 'pointer')
          .on('mouseover', function(event) {
            d3.select(this).attr('fill-opacity', 1);
            showTooltip(tip, event, `
              <div class="tooltip-title">${d.name}</div>
              <div class="tooltip-row"><span class="tooltip-label">${cat.label}</span><span class="tooltip-value">${val.toFixed(1)}%</span></div>
            `);
          })
          .on('mousemove', function(event) {
            tip.style.left = (event.clientX + 12) + 'px';
            tip.style.top = (event.clientY - 10) + 'px';
          })
          .on('mouseout', function() {
            d3.select(this).attr('fill-opacity', 0.8);
            hideTooltip(tip);
          });
        // 數值標籤（寬度夠時才顯示）
        if (xScale(val) > 28) {
          svg.append('text')
            .attr('x', xScale(xOffset) + xScale(val) / 2)
            .attr('y', yScale(d.name) + yScale.bandwidth() / 2 + 4)
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('fill', '#fff')
            .attr('font-weight', '600')
            .text(`${val.toFixed(0)}%`);
        }
        xOffset += val;
      }
    });
  });

  // Y 軸（打者姓名）
  svg.append('g')
    .call(d3.axisLeft(yScale))
    .selectAll('text')
    .attr('font-size', '10px')
    .attr('fill', '#94a3b8');

  svg.selectAll('.domain, .tick line').attr('stroke', 'transparent');
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

  // 好球帶
  const szTop = 3.5, szBot = 1.5, plateHalf = 0.83;
  svg.append('rect')
    .attr('x', xScale(-plateHalf)).attr('y', yScale(szTop))
    .attr('width', xScale(plateHalf) - xScale(-plateHalf))
    .attr('height', yScale(szBot) - yScale(szTop))
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.3)').attr('stroke-width', 2);

  // 投球點
  svg.selectAll('circle')
    .data(data)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.pX))
    .attr('cy', d => yScale(d.pZ))
    .attr('r', 4)
    .attr('fill', d => {
      if (d.isPhantomStrike) return '#e63946';
      if (d.isMissedStrike) return '#f5c542';
      if (d.isCorrect && d.calledStrike) return '#3a86ff';
      return '#06d6a0';
    })
    .attr('fill-opacity', 0.6)
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
        <div class="tooltip-row"><span class="tooltip-label">投手</span><span class="tooltip-value">${d.pitcher}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">打者</span><span class="tooltip-value">${d.batter}</span></div>
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
// 匯出
// ============================================================

window.Charts = {
  drawEVxLAChart,
  drawMovementChart,
  drawStrikeZoneChart,
  drawLADistributionChart,
  renderPitchMixBar,
  drawUmpireChart,
};

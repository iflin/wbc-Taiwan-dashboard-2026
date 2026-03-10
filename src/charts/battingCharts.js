window.Charts = window.Charts || {};

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

  const margin = { top: 60, right: 60, bottom: 50, left: 55 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // KDE 輔助函式
  function kernelDensityEstimator(kernel, X) {
    return function(V) {
      return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
    };
  }
  function kernelEpanechnikov(k) {
    return function(v) {
      return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
    };
  }

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
        <div class="tooltip-title">${escapeHTML(d.batter)}</div>
        <div class="tooltip-row"><span class="tooltip-label">結果</span><span class="tooltip-value">${escapeHTML(resultMap[d.result] || d.result)}</span></div>
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

  // 邊際分佈 - 上緣 (EV Density)
  const evData = data.map(d => d.ev).filter(v => v > 0);
  if (evData.length > 0) {
    const kdeEV = kernelDensityEstimator(kernelEpanechnikov(4), xScale.ticks(40));
    const densityEV = kdeEV(evData);
    const yTopScale = d3.scaleLinear().domain([0, d3.max(densityEV, d => d[1])]).range([0, margin.top - 10]);
    const areaTop = d3.area().x(d => xScale(d[0])).y0(0).y1(d => -yTopScale(d[1])).curve(d3.curveBasis);
    svg.append("path")
      .datum(densityEV)
      .attr("fill", "#3a86ff")
      .attr("fill-opacity", 0.4)
      .attr("stroke", "#3a86ff")
      .attr("stroke-width", 1.5)
      .attr("d", areaTop);
  }

  // 邊際分佈 - 右緣 (LA Density)
  const laData = data.map(d => d.la);
  if (laData.length > 0) {
    const kdeLA = kernelDensityEstimator(kernelEpanechnikov(4), yScale.ticks(40));
    const densityLA = kdeLA(laData);
    const xRightScale = d3.scaleLinear().domain([0, d3.max(densityLA, d => d[1])]).range([0, margin.right - 10]);
    const areaRight = d3.area().y(d => yScale(d[0])).x0(width).x1(d => width + xRightScale(d[1])).curve(d3.curveBasis);
    svg.append("path")
      .datum(densityLA)
      .attr("fill", "#06d6a0")
      .attr("fill-opacity", 0.4)
      .attr("stroke", "#06d6a0")
      .attr("stroke-width", 1.5)
      .attr("d", areaRight);
  }

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
              <div class="tooltip-title">${escapeHTML(d.name)}</div>
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
// 匯出
// ============================================================

// ============================================================
// 7. wOBA 綜合攻擊火力分佈
// ============================================================
function drawWOBABarChart(containerId, batterStats) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const data = batterStats.filter(b => b.pa >= 2 && b.wOBA !== null).sort((a, b) => b.wOBA - a.wOBA);
  if (data.length === 0) return;

  const margin = { top: 30, right: 30, bottom: 40, left: 100 };
  const barHeight = 25;
  const height = data.length * barHeight + margin.top + margin.bottom;
  const width = container.clientWidth - margin.left - margin.right;

  const svg = d3.select(`#${containerId}`)
    .append('svg').attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height}`)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const tip = createTooltip();
  const mlbAvgWoba = 0.315; // 參考點

  const xScale = d3.scaleLinear().domain([0, Math.max(0.6, d3.max(data, d => d.wOBA) + 0.05)]).range([0, width]);
  const yScale = d3.scaleBand().domain(data.map(d => d.name)).range([0, data.length * barHeight]).padding(0.3);

  // 基準線
  svg.append('line')
    .attr('x1', xScale(mlbAvgWoba)).attr('y1', 0)
    .attr('x2', xScale(mlbAvgWoba)).attr('y2', height - margin.bottom)
    .attr('stroke', '#94a3b8').attr('stroke-dasharray', '4,4').attr('stroke-width', 1.5);
  svg.append('text')
    .attr('x', xScale(mlbAvgWoba)).attr('y', -10).attr('text-anchor', 'middle')
    .attr('fill', '#94a3b8').attr('font-size', '10px').text('MLB Avg (.315)');

  // 橫條
  svg.selectAll('rect.bar')
    .data(data).enter().append('rect').attr('class', 'bar')
    .attr('y', d => yScale(d.name)).attr('height', yScale.bandwidth())
    .attr('x', 0).attr('width', d => xScale(d.wOBA))
    .attr('fill', d => d.wOBA >= mlbAvgWoba ? '#e63946' : '#3a86ff')
    .attr('rx', 2)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('fill-opacity', 0.8);
      showTooltip(tip, event, `<div class="tooltip-title">${escapeHTML(d.name)}</div><div class="tooltip-row"><span class="tooltip-label">wOBA</span><span class="tooltip-value">${d.wOBA.toFixed(3)}</span></div>`);
    })
    .on('mousemove', e => { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; })
    .on('mouseout', function() { d3.select(this).attr('fill-opacity', 1); hideTooltip(tip); });

  // 標籤
  svg.selectAll('text.val')
    .data(data).enter().append('text').attr('class', 'val')
    .attr('y', d => yScale(d.name) + yScale.bandwidth() / 2 + 4)
    .attr('x', d => xScale(d.wOBA) + 5)
    .attr('fill', '#fff').attr('font-size', '10px')
    .text(d => d.wOBA.toFixed(3));

  svg.append('g').call(d3.axisLeft(yScale)).selectAll('text').attr('fill', '#94a3b8').attr('font-size', '11px');
  svg.selectAll('.domain, .tick line').attr('stroke', 'transparent');
}

// ============================================================
// 8. 選球紀律四象限圖
// ============================================================
function drawDisciplineScatterChart(containerId, batterStats) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const data = batterStats.filter(b => b.pa >= 2 && b.bbRate !== null && b.kRate !== null);
  if (data.length === 0) return;

  const margin = { top: 20, right: 30, bottom: 50, left: 55 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 380 - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`).append('svg').attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const tip = createTooltip();

  const maxBB = Math.max(0.2, d3.max(data, d => d.bbRate) + 0.05);
  const maxK = Math.max(0.35, d3.max(data, d => d.kRate) + 0.05);
  const xScale = d3.scaleLinear().domain([0, maxBB]).range([0, width]);
  const yScale = d3.scaleLinear().domain([0, maxK]).range([height, 0]);

  const avgBB = d3.mean(data, d => d.bbRate);
  const avgK = d3.mean(data, d => d.kRate);

  // 四象限底色
  svg.append('rect').attr('x', xScale(avgBB)).attr('y', yScale(avgK)).attr('width', width - xScale(avgBB)).attr('height', height - yScale(avgK)).attr('fill', 'rgba(6,214,160,0.05)'); // 右下最佳
  svg.append('rect').attr('x', 0).attr('y', 0).attr('width', xScale(avgBB)).attr('height', yScale(avgK)).attr('fill', 'rgba(230,57,70,0.05)'); // 左上最差

  // 十字線
  svg.append('line').attr('x1', xScale(avgBB)).attr('y1', 0).attr('x2', xScale(avgBB)).attr('y2', height).attr('stroke', 'rgba(148,163,184,0.3)').attr('stroke-dasharray', '4,4');
  svg.append('line').attr('x1', 0).attr('y1', yScale(avgK)).attr('x2', width).attr('y2', yScale(avgK)).attr('stroke', 'rgba(148,163,184,0.3)').attr('stroke-dasharray', '4,4');

  // 座標軸
  svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(xScale).ticks(5).tickFormat(d => (d * 100).toFixed(0) + '%'))
    .append('text').attr('x', width/2).attr('y', 40).attr('fill','#94a3b8').attr('text-anchor','middle').text('保送率 BB% (越右越好)');
  svg.append('g').call(d3.axisLeft(yScale).ticks(5).tickFormat(d => (d * 100).toFixed(0) + '%'))
    .append('text').attr('transform', 'rotate(-90)').attr('x', -height/2).attr('y', -42).attr('fill','#94a3b8').attr('text-anchor','middle').text('三振率 K% (越低越好)');

  // 點
  const dots = svg.selectAll('g.dot').data(data).enter().append('g').attr('class', 'dot')
    .attr('transform', d => `translate(${xScale(d.bbRate)},${yScale(d.kRate)})`);

  dots.append('circle').attr('r', 6).attr('fill', '#f5c542').attr('stroke', '#fff').attr('stroke-width', 1)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 9);
      showTooltip(tip, event, `<div class="tooltip-title">${escapeHTML(d.name)}</div><div class="tooltip-row"><span class="tooltip-label">BB%</span><span class="tooltip-value">${(d.bbRate*100).toFixed(1)}%</span></div><div class="tooltip-row"><span class="tooltip-label">K%</span><span class="tooltip-value">${(d.kRate*100).toFixed(1)}%</span></div>`);
    })
    .on('mousemove', e => { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; })
    .on('mouseout', function() { d3.select(this).attr('r', 6); hideTooltip(tip); });

  dots.append('text').attr('x', 8).attr('y', 4).text(d => d.name).attr('font-size', '10px').attr('fill', '#cbd5e1');
}

/**
 * 球場擬真落點噴射圖 (Spray Chart Hexbin)
 */
function drawSprayChartHexbin(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !d3.hexbin) return;
  container.innerHTML = '';

  // 過濾掉沒有座標的資料
  const validData = data.filter(d => d.coordX !== null && d.coordY !== null);
  if (validData.length === 0) return;

  const width = Math.min(container.clientWidth, 600);
  const height = width; // 保持正方形比例較好看

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('max-width', '100%')
    .style('height', 'auto')
    .style('display', 'block')
    .style('margin', '0 auto');

  // 球場座標 (MLB statcast 預設大小：x0-250, y0-250)
  // 將這個座標系放大至 SVG 大小
  const xScale = d3.scaleLinear().domain([0, 250]).range([0, width]);
  const yScale = d3.scaleLinear().domain([0, 250]).range([0, height]);

  // 繪製球場背景線條 (近似)
  const homeX = xScale(125);
  const homeY = yScale(204);
  const leftPoleX = xScale(45);
  const leftPoleY = yScale(45);
  const rightPoleX = xScale(205);
  const rightPoleY = yScale(45);
  const secondBaseX = xScale(125);
  const secondBaseY = yScale(115);

  const fieldGroup = svg.append('g').attr('class', 'baseball-field');
  
  // 外野全壘打牆 (圓弧)
  fieldGroup.append('path')
    .attr('d', `M ${leftPoleX} ${leftPoleY} Q ${homeX} ${yScale(20)} ${rightPoleX} ${rightPoleY}`)
    .attr('fill', 'none')
    .attr('stroke', '#334155')
    .attr('stroke-width', 2);

  // 界外線
  fieldGroup.append('line').attr('x1', homeX).attr('y1', homeY).attr('x2', leftPoleX).attr('y2', leftPoleY).attr('stroke', '#475569').attr('stroke-width', 2);
  fieldGroup.append('line').attr('x1', homeX).attr('y1', homeY).attr('x2', rightPoleX).attr('y2', rightPoleY).attr('stroke', '#475569').attr('stroke-width', 2);

  // 內野紅土區外緣
  fieldGroup.append('path')
    .attr('d', `M ${xScale(85)} ${yScale(125)} Q ${homeX} ${yScale(80)} ${xScale(165)} ${yScale(125)}`)
    .attr('fill', 'none')
    .attr('stroke', '#334155')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,4');

  // 壘包菱形
  fieldGroup.append('polygon')
    .attr('points', `${homeX},${homeY} ${xScale(160)},${yScale(160)} ${secondBaseX},${secondBaseY} ${xScale(90)},${yScale(160)}`)
    .attr('fill', 'none')
    .attr('stroke', '#475569')
    .attr('stroke-width', 1.5);

  // Hexbin
  const hexbin = d3.hexbin()
    .x(d => xScale(d.coordX))
    .y(d => yScale(d.coordY))
    .radius(10 * (width / 400)) // 確保 hex 大小根據螢幕縮放
    .extent([[0, 0], [width, height]]);

  const bins = hexbin(validData);

  // 顏色比例尺：依據該區域的平均擊球初速 EV
  const colorScale = d3.scaleSequential(d3.interpolateInferno)
    .domain([70, Math.max(105, d3.max(bins, d => d3.mean(d, b => b.ev)))]);

  // 大小比例尺：依據該區域的落點頻率 (數量)
  const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(bins, d => d.length)])
    .range([0, hexbin.radius()]);

  const tip = createTooltip();

  svg.append('g')
    .selectAll('path')
    .data(bins)
    .enter().append('path')
    .attr('d', d => hexbin.hexagon(radiusScale(d.length)))
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .attr('fill', d => colorScale(d3.mean(d, b => b.ev)))
    .attr('fill-opacity', 0.8)
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.5)
    .attr('stroke-opacity', 0.5)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('stroke', '#000').attr('stroke-width', 1.5).attr('fill-opacity', 1);
      const avgEV = d3.mean(d, b => b.ev);
      const avgLA = d3.mean(d, b => b.la);
      
      const hitters = Array.from(d3.rollup(d, v => v.length, b => b.batter))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(h => `${escapeHTML(h[0])} (${h[1]})`)
        .join(', ');

      showTooltip(tip, event, `
        <div class="tooltip-title">該區域共 ${d.length} 次擊球</div>
        <div class="tooltip-row"><span class="tooltip-label">平均初速</span><span class="tooltip-value" style="color:${colorScale(avgEV)}">${avgEV.toFixed(1)} mph</span></div>
        <div class="tooltip-row"><span class="tooltip-label">平均仰角</span><span class="tooltip-value">${avgLA.toFixed(1)}°</span></div>
        <div class="tooltip-row"><span class="tooltip-label">主要打者</span><span class="tooltip-value">${hitters}</span></div>  <!-- hitters 已在 map 階段轉義 -->
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 12) + 'px';
      tip.style.top = (event.clientY - 10) + 'px';
    })
    .on('mouseout', function() {
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 0.5).attr('fill-opacity', 0.8);
      hideTooltip(tip);
    });
}

/**
 * 英雄五圍雷達圖 (Hero Radar Chart)
 */
function drawHeroRadarChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !data || data.length === 0) return;
  container.innerHTML = '';

  // 預設選取前四名球員來展示，避免畫面太混亂
  let displayPlayers = data.slice(0, Math.min(4, data.length));
  
  const w = Math.min(container.clientWidth || 500, 600);
  const h = Math.min(w * 1.2, 700);
  const margin = { top: 80, right: 100, bottom: 120, left: 100 };
  const radius = Math.min(w / 2, h / 2) - Math.max(margin.top, margin.right);

  console.log('Rendering Hero Radar Chart, data count:', data.length, 'w:', w, 'h:', h);

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('width', w)
    .attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .style('max-width', '100%')
    .style('height', 'auto')
    .append('g')
    .attr('transform', `translate(${w / 2},${(h / 2) - 30})`); // 往上偏移一點留給圖例空間

  const axes = data[0].axes.map(d => d.axis);
  const totalAxes = axes.length;
  const angleSlice = (Math.PI * 2) / totalAxes;

  // 半徑 Scale (0 ~ 1)
  const rScale = d3.scaleLinear()
    .range([0, radius])
    .domain([0, 1]);

  // 雷達專屬配色 (以台灣隊藍、紅、白為主色調衍伸)
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  const axisGrid = svg.append('g').attr('class', 'axisWrapper');

  // 圓圈層次 (分為 5 層)
  const levels = 5;
  for (let j = 0; j <= levels; j++) {
    const levelFactor = radius * (j / levels);
    
    // 多邊形網格
    axisGrid.append('polygon')
      .attr('points', axes.map((d, i) => `${levelFactor * Math.cos(angleSlice * i - Math.PI / 2)},${levelFactor * Math.sin(angleSlice * i - Math.PI / 2)}`).join(' '))
      .style('stroke', '#475569')
      .style('stroke-width', '1px')
      .style('stroke-dasharray', j === levels ? 'none' : '4,4')
      .style('fill', 'none');
      
    // 分數標籤 (0, 20, 40, 60, 80, 100)
    if (j > 0) {
      axisGrid.append('text')
        .attr('class', 'axisLabel')
        .attr('x', 4)
        .attr('y', -levelFactor)
        .attr('dy', '0.4em')
        .style('font-size', '10px')
        .attr('fill', '#94a3b8')
        .text(j * 20);
    }
  }

  // 四周屬性主軸線與文字
  const axis = axisGrid.selectAll('.axis')
    .data(axes)
    .enter()
    .append('g')
    .attr('class', 'axis');

  axis.append('line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', (d, i) => rScale(1.0) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr('y2', (d, i) => rScale(1.0) * Math.sin(angleSlice * i - Math.PI / 2))
    .attr('class', 'line')
    .style('stroke', '#64748b')
    .style('stroke-width', '1.5px');

  axis.append('text')
    .attr('class', 'legend')
    .style('font-size', '13px')
    .style('font-weight', 'bold')
    .attr('fill', '#f8fafc')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('x', (d, i) => rScale(1.18) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr('y', (d, i) => rScale(1.18) * Math.sin(angleSlice * i - Math.PI / 2))
    .text(d => d);

  // 畫雷達多邊形
  const radarLine = d3.lineRadial()
    .curve(d3.curveLinearClosed)
    .radius(d => rScale(d.value))
    .angle((d, i) => i * angleSlice);

  const blobWrapper = svg.selectAll('.radarWrapper')
    .data(displayPlayers)
    .enter().append('g')
    .attr('class', 'radarWrapper');

  const tip = createTooltip();

  // 填色區域與框線
  blobWrapper.append('path')
    .attr('class', 'radarArea')
    .attr('d', d => radarLine(d.axes))
    .style('fill', (d, i) => colors[i % colors.length])
    .style('fill-opacity', 0.15)
    .style('stroke', (d, i) => colors[i % colors.length])
    .style('stroke-width', '2.5px')
    .on('mouseover', function(event, d) {
      // 突顯當前 hover 的玩家，淡化其他
      svg.selectAll('.radarArea')
        .transition().duration(200)
        .style('fill-opacity', 0.05)
        .style('stroke-opacity', 0.2);
        
      d3.select(this)
        .transition().duration(200)
        .style('fill-opacity', 0.5)
        .style('stroke-opacity', 1)
        .style('stroke-width', '3.5px');
        
      const pIndex = displayPlayers.indexOf(d);
      const scoreRows = d.axes.map(a => `<div class="tooltip-row"><span class="tooltip-label">${a.axis}</span><span class="tooltip-value">${Math.round(a.score)}分</span></div>`).join('');
      showTooltip(tip, event, `
        <div class="tooltip-title" style="color:${colors[pIndex % colors.length]}; font-size:16px;">⭐ ${d.name}</div>
        ${scoreRows}
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 12) + 'px';
      tip.style.top = (event.clientY - 10) + 'px';
    })
    .on('mouseout', function(event, d) {
      svg.selectAll('.radarArea')
        .transition().duration(200)
        .style('fill-opacity', 0.15)
        .style('stroke-opacity', 1)
        .style('stroke-width', '2.5px');
      hideTooltip(tip);
    });

  // 節點圓圈
  blobWrapper.selectAll('.radarCircle')
    .data((d, i) => d.axes.map(a => ({...a, playerIndex: i})))
    .enter().append('circle')
    .attr('class', 'radarCircle')
    .attr('r', 4)
    .attr('cx', (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr('cy', (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2))
    .style('fill', d => colors[d.playerIndex % colors.length])
    .style('fill-opacity', 0.8)
    .style('stroke', '#fff')
    .style('stroke-width', '1px');
    
  // 底部繪製互動式圖例 (Legend) - 說明對應球員顏色
  const legendGroup = svg.append('g')
    .attr('transform', `translate(${-w/2 + 20}, ${radius + 60})`);
    
  const legends = legendGroup.selectAll('.legend-item')
    .data(displayPlayers)
    .enter().append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => `translate(0, ${i * 20})`)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
       // 透過圖例也可以 highlight
       const pIndex = displayPlayers.indexOf(d);
       svg.selectAll('.radarArea')
         .filter((data, i) => i !== pIndex)
         .transition().duration(200)
         .style('fill-opacity', 0.05)
         .style('stroke-opacity', 0.2);
       svg.selectAll('.radarArea')
         .filter((data, i) => i === pIndex)
         .transition().duration(200)
         .style('fill-opacity', 0.5)
         .style('stroke-width', '3.5px');
    })
    .on('mouseout', function() {
       svg.selectAll('.radarArea')
         .transition().duration(200)
         .style('fill-opacity', 0.15)
         .style('stroke-opacity', 1)
         .style('stroke-width', '2.5px');
    });

  legends.append('circle')
    .attr('r', 5)
    .attr('fill', (d, i) => colors[i % colors.length]);

  legends.append('text')
    .attr('x', 15)
    .attr('y', 4)
    .text(d => d.name)
    .attr('fill', '#e2e8f0')
    .style('font-size', '12px');
}

/**
 * ❤️ 得點圈心臟大顆指數 (RISP Clutch Bubble Chart)
 * X軸：得點圈打擊率 (AVG)
 * Y軸：得點圈打席數 (PA)
 * 泡泡大小：得點圈打點 (RBI)
 * 顏色：打擊率高低 (紅>藍)
 */
function drawRISPBubbleChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !d3) return;
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;">無足夠的得點圈打擊資料</div>';
    return;
  }

  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 400;
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

  // X 軸（打擊率 AVG），範圍 0.000 到 1.000 或最大值加一點
  const maxAvg = d3.max(data, d => d.avg) || 0.5;
  const xScale = d3.scaleLinear()
    .domain([-0.05, Math.max(1.0, maxAvg + 0.1)])
    .range([0, innerWidth])
    .nice();

  // Y 軸（得點圈打席數 PA）
  const maxPa = d3.max(data, d => d.pa) || 1;
  const yScale = d3.scaleLinear()
    .domain([0, maxPa + 1])
    .range([innerHeight, 0])
    .nice();

  // 泡泡半徑（打點 RBI），最低保障一點點大小
  const maxRbi = d3.max(data, d => d.rbi) || 1;
  const rScale = d3.scaleSqrt()
    .domain([0, maxRbi])
    .range([4, 25]); // rbi=0 時半徑為 4，最大 rbi 半徑為 25

  // 顏色尺度（打擊率對應顏色），低打率偏冷色，高打率偏火紅色
  const warmColorScale = d3.scaleLinear()
    .domain([0, 0.3, 0.6])
    .range(['#3b82f6', '#fcd34d', '#ef4444']); // 藍 -> 黃 -> 紅
    
  // 背景網格線
  g.append('g')
    .attr('class', 'grid-lines')
    .selectAll('line.horizontalGrid')
    .data(yScale.ticks(5))
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', d => yScale(d))
    .attr('y2', d => yScale(d))
    .attr('stroke', '#334155')
    .attr('stroke-dasharray', '3,3')
    .style('opacity', 0.5);
    
  g.append('g')
    .attr('class', 'grid-lines')
    .selectAll('line.verticalGrid')
    .data(xScale.ticks(5))
    .enter()
    .append('line')
    .attr('x1', d => xScale(d))
    .attr('x2', d => xScale(d))
    .attr('y1', 0)
    .attr('y2', innerHeight)
    .attr('stroke', '#334155')
    .attr('stroke-dasharray', '3,3')
    .style('opacity', 0.5);

  // 繪製座標軸
  const xAxis = d3.axisBottom(xScale).tickFormat(d => d.toFixed(3).replace(/^0/, ''));
  const yAxis = d3.axisLeft(yScale).ticks(maxPa > 5 ? 5 : maxPa);

  g.append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(xAxis)
    .selectAll('text')
    .attr('fill', '#94a3b8')
    .style('font-size', '12px');

  g.append('g')
    .call(yAxis)
    .selectAll('text')
    .attr('fill', '#94a3b8')
    .style('font-size', '12px');

  g.selectAll('.domain, .tick line').attr('stroke', '#334155');

  // 軸標題
  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 40)
    .attr('text-anchor', 'middle')
    .text('得點圈打擊率 (AVG)')
    .attr('fill', '#cbd5e1')
    .style('font-size', '13px')
    .style('font-weight', 'bold');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .text('得點圈打席數 (PA)')
    .attr('fill', '#cbd5e1')
    .style('font-size', '13px')
    .style('font-weight', 'bold');

  // 平均線輔助
  const avgLineGroup = g.append('g').attr('class', 'avg-guides');
  
  // 基準打擊率參考線 (e.g. 0.300)
  avgLineGroup.append('line')
    .attr('x1', xScale(0.300))
    .attr('x2', xScale(0.300))
    .attr('y1', 0)
    .attr('y2', innerHeight)
    .attr('stroke', '#ef4444')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4');
    
  avgLineGroup.append('text')
    .attr('x', xScale(0.300) + 5)
    .attr('y', 15)
    .text('.300 門檻')
    .attr('fill', '#ef4444')
    .style('font-size', '11px');

  // 繪製泡泡
  const bubbles = g.selectAll('.bubble')
    .data(data)
    .enter().append('g')
    .attr('class', 'bubble')
    .attr('transform', d => `translate(${xScale(0)}, ${yScale(d.pa)})`); // 動畫起點(X=0)

  // 泡泡外觀
  bubbles.append('circle')
    .attr('r', 0)
    .attr('fill', d => warmColorScale(Math.min(0.6, d.avg))) // 高於 0.6 用最紅
    .attr('stroke', '#f8fafc')
    .attr('stroke-width', 1.5)
    .style('opacity', 0.8)
    .transition()
    .duration(1000)
    .delay((d, i) => i * 100)
    .attr('r', d => rScale(d.rbi));

  // 從起點平移至實際位置
  bubbles.transition()
    .duration(1000)
    .delay((d, i) => i * 100)
    .attr('transform', d => `translate(${xScale(d.avg)}, ${yScale(d.pa)})`);

  // 球員姓名標籤 (加在泡泡旁邊)
  bubbles.append('text')
    .attr('x', d => rScale(d.rbi) + 5)
    .attr('y', 4)
    .text(d => d.name)
    .attr('fill', '#f1f5f9')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('opacity', 0)
    .transition()
    .duration(1000)
    .delay((d, i) => 800 + i * 100)
    .style('opacity', 1);

  // 互動設計 (Tooltip)
  const tip = createTooltip();
  
  bubbles.style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).select('circle')
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 3)
        .style('opacity', 1);
        
      showTooltip(tip, event, `
        <div style="font-size:14px; font-weight:bold; color:#f8fafc; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:4px;">
          ${d.name}
        </div>
        <div style="margin-top:4px"><span style="display:inline-block;width:10px;height:10px;background:#ef4444;margin-right:5px;border-radius:2px;"></span>得點圈打點：<strong style="color:#f87171">${d.rbi}</strong></div>
        <div style="margin-top:2px"><span style="display:inline-block;width:10px;height:10px;background:#3b82f6;margin-right:5px;border-radius:2px;"></span>得點圈打席：<strong style="color:#60a5fa">${d.pa}</strong></div>
        <div style="margin-top:2px"><span style="display:inline-block;width:10px;height:10px;background:#fcd34d;margin-right:5px;border-radius:2px;"></span>得點圈打擊率：<strong style="color:#fbbf24">${(d.avg).toFixed(3).replace(/^0/, '')}</strong></div>
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 15) + 'px';
      tip.style.top = (event.clientY - 15) + 'px';
    })
    .on('mouseout', function() {
      d3.select(this).select('circle')
        .attr('stroke', '#f8fafc')
        .attr('stroke-width', 1.5)
        .style('opacity', 0.8);
      hideTooltip(tip);
    });
}

/**
 * 逆境抗壓王 — 兩好球落後抗壓長條圖 (Two-Strike Clutch Bar Chart)
 * 比較球員「整體打擊率」與「兩好球落後」時的打擊率
 */
function drawTwoStrikeChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !d3 || !data || data.length === 0) return;

  container.innerHTML = '';

  const margin = { top: 40, right: 30, bottom: 40, left: 180 };
  const width = container.clientWidth || 800;
  const height = Math.max(400, data.length * 60 + margin.top + margin.bottom);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // 定義群組的 Y 軸尺度 (每個球員的高)
  const y0Scale = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([0, innerHeight])
    .padding(0.2);

  const subgroups = ['overallAvg', 'twoStrikeAvg'];
  
  // 定義各個長條的內部 Y 軸尺度
  const y1Scale = d3.scaleBand()
    .domain(subgroups)
    .range([0, y0Scale.bandwidth()])
    .padding(0.05);

  const maxAvg = d3.max(data, d => Math.max(d.overallAvg, d.twoStrikeAvg)) || 0.4;
  
  // 定義 X 軸尺度 (打擊率)
  const xScale = d3.scaleLinear()
    .domain([0, maxAvg + 0.05])
    .range([0, innerWidth]);

  // 定義顏色
  const colorScale = d3.scaleOrdinal()
    .domain(subgroups)
    .range(['#64748b', '#ef4444']); // 整體灰色，兩好球紅色

  // 繪製背景網格線
  g.append('g')
    .attr('class', 'grid-lines')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''))
    .selectAll('line').style('stroke', '#334155').style('stroke-dasharray', '3,3');

  // X 軸標籤與格式
  const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d => d.toFixed(3).replace(/^0/, ''));
  g.append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(xAxis)
    .selectAll('text')
    .attr('fill', '#94a3b8')
    .style('font-size', '12px');

  // Y 軸標籤
  const yAxis = d3.axisLeft(y0Scale);
  const yGroup = g.append('g').call(yAxis);
  yGroup.selectAll('text')
    .attr('fill', '#f1f5f9')
    .style('font-size', '13px')
    .style('font-weight', '500');
  yGroup.selectAll('line').style('stroke', '#475569');
  yGroup.select('.domain').style('stroke', '#475569');

  // Tooltip
  const tip = createTooltip();

  // 繪製長條圖
  const playerGroups = g.selectAll('.player-group')
    .data(data)
    .enter().append('g')
    .attr('class', 'player-group')
    .attr('transform', d => `translate(0,${y0Scale(d.name)})`);

  const bars = playerGroups.selectAll('rect')
    .data(d => subgroups.map(key => ({ key, value: d[key], parent: d })))
    .enter().append('rect')
    .attr('y', d => y1Scale(d.key))
    .attr('height', y1Scale.bandwidth())
    .attr('x', 0)
    .attr('width', 0)
    .attr('fill', d => colorScale(d.key))
    .attr('rx', 3);

  // 初次渲染動畫
  bars.transition()
    .duration(800)
    .delay((d, i) => i * 100)
    .attr('width', d => xScale(d.value));

  // 長條上的標籤
  playerGroups.selectAll('.bar-label')
    .data(d => subgroups.map(key => ({ key, value: d[key], parent: d })))
    .enter().append('text')
    .attr('class', 'bar-label')
    .attr('y', d => y1Scale(d.key) + y1Scale.bandwidth() / 2 + 4)
    .attr('x', d => xScale(d.value) + 5)
    .text(d => d.value.toFixed(3).replace(/^0/, ''))
    .attr('fill', '#cbd5e1')
    .style('font-size', '11px')
    .style('opacity', 0)
    .transition()
    .duration(800)
    .delay(800)
    .style('opacity', 1);

  // 互動設計
  bars.style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('filter', 'brightness(1.2)');
      const label = d.key === 'overallAvg' ? '整體' : '兩好球';
      const pa = d.key === 'overallAvg' ? d.parent.overallPA : d.parent.twoStrikePA;
      const hits = d.key === 'overallAvg' ? Math.round(d.value * d.parent.overallAB || 0) : Math.round(d.value * d.parent.twoStrikeAB || 0);
      
      showTooltip(tip, event, `
        <div style="font-size:14px; font-weight:bold; color:#f8fafc; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:4px;">
          ${d.parent.name} - ${label}
        </div>
        <div style="margin-top:2px">打點打擊率：<strong style="color:${colorScale(d.key)}">${d.value.toFixed(3).replace(/^0/, '')}</strong></div>
        <div style="margin-top:2px; font-size:11px; color:#94a3b8;">(${hits} 安打 / ${pa} 打席)</div>
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 15) + 'px';
      tip.style.top = (event.clientY - 15) + 'px';
    })
    .on('mouseout', function() {
      d3.select(this).attr('filter', 'none');
      hideTooltip(tip);
    });

  // 圖例
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 150}, 15)`);

  const legendsData = [
    { label: '整體打擊率', color: '#64748b' },
    { label: '兩好球打擊率', color: '#ef4444' }
  ];

  legend.selectAll('.legend-item')
    .data(legendsData)
    .enter().append('g')
    .attr('transform', (d, i) => `translate(0, ${i * 20})`)
    .call(g => {
      g.append('rect')
        .attr('width', 12).attr('height', 12)
        .attr('fill', d => d.color).attr('rx', 2);
      g.append('text')
        .attr('x', 20).attr('y', 10)
        .text(d => d.label)
        .attr('fill', '#94a3b8')
        .style('font-size', '12px');
    });
}

/**
 * 台灣隊的剋星與最愛 (Pitch Type Kryptonite Bar Chart)
 * 顯示面對不同球種的打擊率 (AVG) 與揮空率 (Whiff%) 雙面板長條圖
 */
function drawKryptoniteChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !d3 || !data || data.length === 0) return;

  container.innerHTML = '';

  // 取得球種顏色對照表
  const colorMap = typeof DataProcessor !== 'undefined' ? DataProcessor.PITCH_COLOR_MAP : {};
  const getColor = (type) => colorMap[type] || '#cbd5e1';

  const margin = { top: 40, right: 30, bottom: 40, left: 140 };
  const width = container.clientWidth || 800;
  const height = Math.max(400, data.length * 40 + margin.top + margin.bottom);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // 切分為兩個面板 (左：打擊率，右：揮空率)
  const panelGap = 40;
  const panelWidth = (innerWidth - panelGap) / 2;

  // 共同的 Y 軸尺度 (球種名稱)
  const yScale = d3.scaleBand()
    .domain(data.map(d => d.desc))
    .range([0, innerHeight])
    .padding(0.3);

  // 分別的 X 軸尺度
  const maxAvg = d3.max(data, d => d.avg) || 0.4;
  const maxWhiff = d3.max(data, d => d.whiffPct) || 0.5;

  const xAvgScale = d3.scaleLinear()
    .domain([0, Math.max(0.4, maxAvg + 0.05)])
    .range([0, panelWidth]);

  const xWhiffScale = d3.scaleLinear()
    .domain([0, Math.max(0.5, maxWhiff + 0.1)])
    .range([0, panelWidth]);

  // Y 軸繪製 (靠左)
  const yAxis = d3.axisLeft(yScale);
  const yGroup = g.append('g').call(yAxis);
  yGroup.selectAll('text')
    .attr('fill', '#f1f5f9')
    .style('font-size', '12px')
    .style('font-weight', '500');
  yGroup.selectAll('line').style('stroke', '#475569');
  yGroup.select('.domain').style('stroke', '#475569');

  const tip = createTooltip();

  // ============================================
  // 左邊面板：打擊率 (AVG)
  // ============================================
  const gAvg = g.append('g');
  
  // 背景網格線 (AVG)
  gAvg.append('g')
    .attr('class', 'grid-lines')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xAvgScale).ticks(5).tickSize(-innerHeight).tickFormat(''))
    .selectAll('line').style('stroke', '#334155').style('stroke-dasharray', '3,3');
    
  // X 軸標籤 (AVG)
  gAvg.append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xAvgScale).ticks(5).tickFormat(d => d.toFixed(3).replace(/^0/, '')))
    .selectAll('text').attr('fill', '#94a3b8').style('font-size', '11px');
  gAvg.select('.domain').style('stroke', '#475569');

  // 面板標題 (AVG)
  gAvg.append('text')
    .attr('x', panelWidth / 2)
    .attr('y', -10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#cbd5e1')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .text('打擊率 (AVG)');

  const avgBars = gAvg.selectAll('.bar-avg')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar-avg')
    .attr('y', d => yScale(d.desc))
    .attr('height', yScale.bandwidth())
    .attr('x', 0)
    .attr('width', 0)
    .attr('fill', d => getColor(d.type))
    .attr('rx', 3)
    .style('opacity', 0.9);

  avgBars.transition().duration(800).delay((d, i) => i * 100)
    .attr('width', d => xAvgScale(d.avg));

  gAvg.selectAll('.label-avg')
    .data(data)
    .enter().append('text')
    .attr('y', d => yScale(d.desc) + yScale.bandwidth() / 2 + 4)
    .attr('x', d => xAvgScale(d.avg) + 5)
    .text(d => d.avg.toFixed(3).replace(/^0/, ''))
    .attr('fill', '#cbd5e1')
    .style('font-size', '11px')
    .style('font-weight', '600')
    .style('opacity', 0)
    .transition().duration(800).delay(800).style('opacity', 1);

  // ============================================
  // 右邊面板：揮空率 (Whiff%)
  // ============================================
  const gWhiff = g.append('g')
    .attr('transform', `translate(${panelWidth + panelGap}, 0)`);
    
  // 背景網格線 (Whiff)
  gWhiff.append('g')
    .attr('class', 'grid-lines')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xWhiffScale).ticks(5).tickSize(-innerHeight).tickFormat(''))
    .selectAll('line').style('stroke', '#334155').style('stroke-dasharray', '3,3');

  // X 軸標籤 (Whiff)
  gWhiff.append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xWhiffScale).ticks(5).tickFormat(d => (d * 100).toFixed(0) + '%'))
    .selectAll('text').attr('fill', '#94a3b8').style('font-size', '11px');
  gWhiff.select('.domain').style('stroke', '#475569');

  // 面板標題 (Whiff)
  gWhiff.append('text')
    .attr('x', panelWidth / 2)
    .attr('y', -10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#cbd5e1')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .text('揮空率 (Whiff%)');

  const whiffBars = gWhiff.selectAll('.bar-whiff')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar-whiff')
    .attr('y', d => yScale(d.desc))
    .attr('height', yScale.bandwidth())
    .attr('x', 0)
    .attr('width', 0)
    .attr('fill', d => getColor(d.type))
    .attr('rx', 3)
    .style('opacity', 0.8);

  whiffBars.transition().duration(800).delay((d, i) => i * 100)
    .attr('width', d => xWhiffScale(d.whiffPct));

  gWhiff.selectAll('.label-whiff')
    .data(data)
    .enter().append('text')
    .attr('y', d => yScale(d.desc) + yScale.bandwidth() / 2 + 4)
    .attr('x', d => xWhiffScale(d.whiffPct) + 5)
    .text(d => (d.whiffPct * 100).toFixed(1) + '%')
    .attr('fill', '#cbd5e1')
    .style('font-size', '11px')
    .style('font-weight', '600')
    .style('opacity', 0)
    .transition().duration(800).delay(800).style('opacity', 1);

  // 互動設計 (Tooltip)
  const allBars = svg.selectAll('rect.bar-avg, rect.bar-whiff');
  
  allBars.style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('filter', 'brightness(1.2)');
      
      showTooltip(tip, event, `
        <div style="font-size:14px; font-weight:bold; color:#f8fafc; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:4px;">
          ${d.desc} (${d.type})
        </div>
        <div style="margin-top:2px; display:flex; align-items:center;">
          <span style="display:inline-block;width:10px;height:10px;background:${getColor(d.type)};margin-right:5px;border-radius:2px;"></span>
          打擊率：<strong style="color:#f8fafc; margin-left:4px;">${d.avg.toFixed(3).replace(/^0/, '')}</strong> 
          <span style="color:#94a3b8; margin-left:4px;">(${d.hits}/${d.ab})</span>
        </div>
        <div style="margin-top:2px; display:flex; align-items:center;">
          <span style="display:inline-block;width:10px;height:10px;background:${getColor(d.type)};margin-right:5px;border-radius:2px;opacity:0.8;"></span>
          揮空率：<strong style="color:#f8fafc; margin-left:4px;">${(d.whiffPct * 100).toFixed(1)}%</strong> 
          <span style="color:#94a3b8; margin-left:4px;">(${d.whiffs}/${d.swings})</span>
        </div>
        <div style="margin-top:4px; font-size:11px; color:#cbd5e1;">總共面對：${d.seen} 球</div>
      `);
    })
    .on('mousemove', function(event) {
      tip.style.left = (event.clientX + 15) + 'px';
      tip.style.top = (event.clientY - 15) + 'px';
    })
    .on('mouseout', function() {
      d3.select(this).attr('filter', 'none');
      hideTooltip(tip);
    });
}

// 匯出至全域 Charts 物件
window.Charts.drawEVxLAChart = drawEVxLAChart;
window.Charts.drawLADistributionChart = drawLADistributionChart;
window.Charts.drawWOBABarChart = drawWOBABarChart;
window.Charts.drawDisciplineScatterChart = drawDisciplineScatterChart;
window.Charts.drawSprayChartHexbin = drawSprayChartHexbin;
window.Charts.drawHeroRadarChart = drawHeroRadarChart;
window.Charts.drawRISPBubbleChart = drawRISPBubbleChart;
window.Charts.drawTwoStrikeChart = drawTwoStrikeChart;
window.Charts.drawKryptoniteChart = drawKryptoniteChart;

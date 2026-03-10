window.Charts = window.Charts || {};

/**
 * 戰術結果流向圖 (Sankey Diagram)
 */
function drawStrategySankeyChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !data || data.nodes.length === 0) return;
  container.innerHTML = '';

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const sankey = d3.sankey()
    .nodeId(d => d.index)
    .nodeAlign(d3.sankeyJustify)
    .nodeWidth(20)
    .nodePadding(30)
    .extent([[0, 0], [width, height]]);

  // d3-sankey 可能會修改原始資料，這裡做一次深拷貝
  const graph = sankey({
    nodes: data.nodes.map(d => Object.assign({}, d)),
    links: data.links.map(d => Object.assign({}, d))
  });

  // 顏色映射
  const color = d3.scaleOrdinal(d3.schemeCategory10);
  const colorMap = {
    "無出局上壘": "#3a86ff",
    "犧牲觸擊": "#f5c542",
    "盜壘戰術": "#8338ec",
    "正常攻擊": "#06d6a0",
    "有得分": "#e63946",
    "無得分": "#64748b"
  };

  const tip = createTooltip();

  // 畫出連線 Links
  const link = svg.append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.4)
    .selectAll("g")
    .data(graph.links)
    .enter()
    .append("g")
    .style("mix-blend-mode", "screen");

  // 使用漸層使連線顏色從來源過渡到達目標
  const gradient = link.append("linearGradient")
    .attr("id", (d, i) => `sankey-grad-${i}`)
    .attr("gradientUnits", "userSpaceOnUse")
    .attr("x1", d => d.source.x1)
    .attr("x2", d => d.target.x0);

  gradient.append("stop").attr("offset", "0%").attr("stop-color", d => colorMap[d.source.name] || color(d.source.name));
  gradient.append("stop").attr("offset", "100%").attr("stop-color", d => colorMap[d.target.name] || color(d.target.name));

  link.append("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d, i) => `url(#sankey-grad-${i})`)
    .attr("stroke-width", d => Math.max(1, d.width))
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this).attr("stroke-opacity", 0.8);
      showTooltip(tip, event, `
        <div class="tooltip-row"><span class="tooltip-label">${escapeHTML(d.source.name)} → ${escapeHTML(d.target.name)}</span></div>
        <div class="tooltip-row"><span class="tooltip-value">${d.value} 次</span></div>
      `);
    })
    .on('mousemove', e => { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; })
    .on('mouseout', function() { d3.select(this).attr("stroke-opacity", 0.4); hideTooltip(tip); });

  // 畫出節點 Nodes
  const node = svg.append("g")
    .selectAll("g")
    .data(graph.nodes)
    .enter()
    .append("g");

  node.append("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => Math.max(2, d.y1 - d.y0))
    .attr("width", d => d.x1 - d.x0)
    .attr("fill", d => colorMap[d.name] || color(d.name))
    .attr("rx", 3)
    .on('mouseover', function(event, d) {
      d3.select(this).attr("stroke", "#fff").attr("stroke-width", 2);
      showTooltip(tip, event, `
        <div class="tooltip-title">${escapeHTML(d.name)}</div>
        <div class="tooltip-row"><span class="tooltip-value">共 ${d.value} 次</span></div>
      `);
    })
    .on('mousemove', e => { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; })
    .on('mouseout', function() { d3.select(this).attr("stroke", "none"); hideTooltip(tip); });

  // 節點文字
  node.append("text")
    .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(d => `${d.name} (${d.value})`)
    .attr("fill", "#fff")
    .attr("font-size", 12)
    .attr("font-weight", "bold");
}

// 匯出至全域 Charts 物件
window.Charts.drawStrategySankeyChart = drawStrategySankeyChart;

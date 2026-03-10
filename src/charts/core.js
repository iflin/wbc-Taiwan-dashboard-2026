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
// HTML 轉義工具函式（若 app.js 尚未定義則提供 fallback）
// ============================================================
if (typeof escapeHTML === 'undefined') {
  /**
   * 將字串中的 HTML 特殊字元轉義，防止 XSS 注入
   * @param {*} str - 要轉義的原始值
   * @returns {string} 轉義後的安全字串
   */
  window.escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}

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

/**
 * 好球帶圖的 Tooltip 共用函式
 */
function _showStrikeZoneTip(tip, event, d) {
  showTooltip(tip, event, `
    <div class="tooltip-title">${escapeHTML(d.typeName)}</div>
    <div class="tooltip-row"><span class="tooltip-label">結果</span><span class="tooltip-value">${escapeHTML(d.description)}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">球速</span><span class="tooltip-value">${d.speed ? d.speed.toFixed(1) : '—'} mph</span></div>
    <div class="tooltip-row"><span class="tooltip-label">打者</span><span class="tooltip-value">${escapeHTML(d.batter)}</span></div>
  `);
}

// 匯出至全域 Charts 物件
window.Charts = window.Charts || {};
window.Charts.createTooltip = createTooltip;
window.Charts.showTooltip = showTooltip;
window.Charts.hideTooltip = hideTooltip;

/**
 * WBC 台灣隊 2026 預賽 C 組 — 應用程式主邏輯
 * 
 * 負責：
 * 1. 頁面 Tab 切換導覽
 * 2. 資料載入流程控制
 * 3. 各頁面內容渲染（賽事總覽、打擊分析、投球分析、對戰比較）
 */

// ============================================================
// 全域狀態
// ============================================================
let allGamesData = null;  // 所有比賽原始資料
let extendedData = null;  // 第 14 專案擴充之歷史與極端數據

/** 追蹤各頁面是否已渲染（延遲渲染用） */
const pageRendered = {
  'page-overview': false,
  'page-batting': false,
  'page-pitching': false,
  'page-comparison': false,
};

/** 隊伍 → 國旗 emoji 對照 */
const TEAM_FLAGS = {
  'Japan': '🇯🇵',
  'Korea': '🇰🇷',
  'Chinese Taipei': '🇹🇼',
  'Australia': '🇦🇺',
  'Czechia': '🇨🇿',
};

/** 隊伍 → 中文名稱 */
const TEAM_NAMES_ZH = {
  'Japan': '日本',
  'Korea': '韓國',
  'Chinese Taipei': '台灣',
  'Australia': '澳洲',
  'Czechia': '捷克',
};

/**
 * 渲染統一防呆空狀態 (Empty State)
 * 供進階圖表資料不足或無資料時使用。
 */
function renderEmptyState(containerId, message = '目前樣本數不足，無法繪製此圖表') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <div class="icon">⚾</div>
      <h3>無足夠數據</h3>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

// ============================================================
// HTML 轉義工具函式（防止 XSS 注入）
// ============================================================

/**
 * 將字串中的 HTML 特殊字元轉義，防止 XSS 注入
 * 當我們使用 innerHTML 或模板字串組裝 HTML 時，
 * 所有來自外部資料（CSV、API、使用者輸入）的動態值都應該先經過此函式
 * @param {*} str - 要轉義的原始值（非字串會先被轉為字串）
 * @returns {string} 轉義後的安全字串
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// Tab 導覽
// ============================================================

/** 初始化 Tab 導覽切換功能 */
function initTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.page-section');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      // 切換 active 狀態
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      sections.forEach(s => s.classList.remove('active'));
      document.getElementById(target).classList.add('active');
      // 延遲渲染：首次切換到該頁面時才渲染圖表
      setTimeout(() => renderPageIfNeeded(target), 50);
    });
  });
}

/**
 * 核心應用程式邏輯：負責頁面狀態管理、資料載入、以及各項 UI 元件的對接渲染。
 */

// ============================================================
// 全域狀態與設定
// ============================================================
window.APP_VERSION = "2026.03.10"; // 用於資源載入的統一版本號，取代激進的 Date.now()
/**
 * 延遲渲染：只在頁面首次可見時才渲染其內容
 * 這樣可以避免 D3 在隱藏容器中計算到寬度 0 的問題
 */
function renderPageIfNeeded(pageId) {
  if (pageRendered[pageId]) return;
  pageRendered[pageId] = true;

  switch (pageId) {
    case 'page-overview':
      renderOverviewPage();
      break;
    case 'page-batting':
      renderBattingPage();
      break;
    case 'page-pitching':
      renderPitchingPage();
      break;
    case 'page-comparison':
      renderComparisonPage();
      break;
  }
}

// ============================================================
// P1：賽事總覽頁面
// ============================================================

/** 渲染賽事總覽頁面 */
function renderOverviewPage() {
  renderStandings();
  
  // 局數得分熱區 (Inning Scoring Patterns)
  const scoringData = DataProcessor.computeInningScoringData(allGamesData, DataProcessor.TAIWAN_TEAM);
  Charts.drawInningScoringBarChart('inning-scoring-chart', scoringData);

  // 歷屆戰績進化圖 (DE-02)
  if (extendedData && extendedData.history) {
    Charts.drawHistoryEvolutionChart('history-evolution-chart', extendedData.history);
  }

  renderGameCards();
}

/** 渲染 C 組戰績表 */
function renderStandings() {
  const standings = DataProcessor.computeStandings(allGamesData);
  const container = document.getElementById('standings-table-body');
  if (!container) return;

  container.innerHTML = standings.map((s, i) => {
    const flag = TEAM_FLAGS[s.team] || '';
    const nameZH = escapeHTML(TEAM_NAMES_ZH[s.team] || s.team);
    const isTaiwan = s.team === DataProcessor.TAIWAN_TEAM;
    const diff = s.runsScored - s.runsAllowed;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    // 勝率計算
    const winPct = s.gamesPlayed > 0 ? (s.wins / s.gamesPlayed).toFixed(3).replace(/^0/, '') : '—';

    return `
      <tr class="${isTaiwan ? 'team-row-highlight' : ''}">
        <td><span class="rank-num">${i + 1}</span></td>
        <td><span class="team-cell">${flag} ${nameZH}</span></td>
        <td class="record">${s.wins}</td>
        <td class="record">${s.losses}</td>
        <td>${winPct}</td>
        <td>${s.gamesPlayed}</td>
        <td>${s.runsScored}</td>
        <td>${s.runsAllowed}</td>
        <td style="color: ${diff > 0 ? 'var(--accent-green)' : diff < 0 ? 'var(--accent-red)' : 'var(--text-secondary)'}">${diffStr}</td>
      </tr>
    `;
  }).join('');
}

/** 渲染各場比賽卡片 */
function renderGameCards() {
  const container = document.getElementById('game-cards-container');
  if (!container) return;

  // 只顯示台灣隊的比賽
  const taiwanGames = Object.values(allGamesData).filter(({ rows }) => {
    return rows.some(r => r['batting_team'] === DataProcessor.TAIWAN_TEAM || r['fielding_team'] === DataProcessor.TAIWAN_TEAM);
  });

  const renderData = taiwanGames.map(({ rows, meta }) => {
    const summary = DataProcessor.computeGameSummary(rows, meta);
    return { rows, meta, summary };
  }).filter(d => d.summary);

  container.innerHTML = renderData.map(({ summary }) => {
    const { homeTeam, awayTeam, homeScore, awayScore, inningScores, date, label } = summary;
    const isTaiwanHome = homeTeam === DataProcessor.TAIWAN_TEAM;
    const taiwanScore = isTaiwanHome ? homeScore : awayScore;
    const opponentScore = isTaiwanHome ? awayScore : homeScore;
    const isWin = taiwanScore > opponentScore;
    const opponent = isTaiwanHome ? awayTeam : homeTeam;

    // 各局比分表格
    let inningHTML = '<table><tr><th></th>';
    for (let i = 1; i <= summary.displayInnings; i++) inningHTML += `<th>${i}</th>`;
    inningHTML += '<th class="total-col">R</th></tr>';

    // 客隊
    inningHTML += `<tr><td>${TEAM_FLAGS[awayTeam] || ''} ${escapeHTML(TEAM_NAMES_ZH[awayTeam] || awayTeam)}</td>`;
    for (let i = 1; i <= summary.displayInnings; i++) {
      const s = inningScores.away[i];
      const displayStr = s === undefined ? 0 : s;
      const highlightCls = (typeof s === 'number' && s > 0) ? 'score-highlight' : (s === 'X' ? 'score-x' : '');
      inningHTML += `<td class="${highlightCls}">${displayStr}</td>`;
    }
    inningHTML += `<td class="total-col">${awayScore}</td></tr>`;

    // 主隊
    inningHTML += `<tr><td>${TEAM_FLAGS[homeTeam] || ''} ${escapeHTML(TEAM_NAMES_ZH[homeTeam] || homeTeam)}</td>`;
    for (let i = 1; i <= summary.displayInnings; i++) {
      const s = inningScores.home[i];
      const displayStr = s === undefined ? 0 : s;
      const highlightCls = (typeof s === 'number' && s > 0) ? 'score-highlight' : (s === 'X' ? 'score-x' : '');
      inningHTML += `<td class="${highlightCls}">${displayStr}</td>`;
    }
    inningHTML += `<td class="total-col">${homeScore}</td></tr></table>`;

    return `
      <div class="game-card ${isWin ? 'win' : 'loss'}">
        <div class="game-card-header">
          <span>📅 ${escapeHTML(date)}</span>
          <span class="badge ${isWin ? 'badge-win' : 'badge-loss'}">${isWin ? '✓ 勝' : '✗ 敗'}</span>
        </div>
        <div class="game-card-body">
          <div class="game-score-row">
            <div class="team-info">
              <span class="team-flag">${TEAM_FLAGS[awayTeam] || ''}</span>
              <span class="team-name ${awayTeam === DataProcessor.TAIWAN_TEAM ? 'highlight' : ''}">${escapeHTML(TEAM_NAMES_ZH[awayTeam] || awayTeam)}</span>
            </div>
            <span class="score-value ${awayScore > homeScore ? 'winner' : 'loser'}">${awayScore}</span>
          </div>
          <div class="game-score-row">
            <div class="team-info">
              <span class="team-flag">${TEAM_FLAGS[homeTeam] || ''}</span>
              <span class="team-name ${homeTeam === DataProcessor.TAIWAN_TEAM ? 'highlight' : ''}">${escapeHTML(TEAM_NAMES_ZH[homeTeam] || homeTeam)}</span>
            </div>
            <span class="score-value ${homeScore > awayScore ? 'winner' : 'loser'}">${homeScore}</span>
          </div>
          <div class="inning-scores">${inningHTML}</div>
          <div class="game-re24-container">
            <h4>📈 台灣隊期望值(RE24)起伏變化</h4>
            <div id="re24-chart-${summary.gameId}" class="game-re24-chart"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 渲染 D3.js RE24 趨勢圖 (直接重用剛才算好的 summary)
  renderData.forEach(({ summary }) => {
    if (!summary.re24Timeline || summary.re24Timeline.length === 0) return;
    const isWin = summary.homeTeam === DataProcessor.TAIWAN_TEAM ? summary.homeScore > summary.awayScore : summary.awayScore > summary.homeScore;
    window.Charts.drawRE24WormChart(`re24-chart-${summary.gameId}`, summary.re24Timeline, isWin);
  });
}

// ============================================================
// P2：打擊分析頁面
// ============================================================

/** 渲染打擊分析頁面 */
function renderBattingPage() {
  const team = DataProcessor.TAIWAN_TEAM;
  const cumStats = DataProcessor.computeCumulativeBattingStats(allGamesData, team);

  // 全隊 KPI
  renderBattingKPIs(cumStats);
  // 打者成績表
  renderBattingTable(cumStats);
  // EV × LA 散布圖、wOBA 等
  renderBattingCharts(cumStats);


  // 兩好球逆境抗壓王 (Two-Strike Clutch Bar Chart)
  const twoStrikeData = DataProcessor.computeTwoStrikeData(allGamesData, team);
  Charts.drawTwoStrikeChart('two-strike-chart', twoStrikeData);

  // 台灣隊的剋星與最愛 (Pitch Type Kryptonite Bar Chart)
  const kData = DataProcessor.computeKryptoniteData(allGamesData, team);
  Charts.drawKryptoniteChart('kryptonite-chart', kData);
}

/** 渲染打擊 KPI 卡片 */
function renderBattingKPIs(stats) {
  const container = document.getElementById('batting-kpis');
  if (!container) return;

  // 全隊合計
  const totalPA = stats.reduce((s, b) => s + b.pa, 0);
  const totalAB = stats.reduce((s, b) => s + b.ab, 0);
  const totalHits = stats.reduce((s, b) => s + b.hits, 0);
  const totalHR = stats.reduce((s, b) => s + b.hr, 0);
  const totalRBI = stats.reduce((s, b) => s + b.rbi, 0);
  const totalBB = stats.reduce((s, b) => s + b.bb, 0);
  const totalSO = stats.reduce((s, b) => s + b.so, 0);
  const teamAVG = totalAB > 0 ? totalHits / totalAB : 0;
  const allEVs = stats.flatMap(b => b.launchSpeeds);
  const teamAvgEV = DataProcessor.avg(allEVs);
  const teamHardHit = allEVs.length > 0 ? allEVs.filter(v => v >= 95).length / allEVs.length : 0;

  const kpis = [
    { value: DataProcessor.fmtAvg(teamAVG), label: '團隊打擊率', sub: 'Team AVG' },
    { value: totalHits, label: '安打數', sub: 'Hits' },
    { value: totalHR, label: '全壘打', sub: 'Home Runs' },
    { value: totalRBI, label: '打點', sub: 'RBI' },
    { value: totalBB, label: '保送', sub: 'BB' },
    { value: totalSO, label: '三振', sub: 'SO' },
    { value: teamAvgEV ? teamAvgEV.toFixed(1) : '—', label: '平均擊球初速', sub: 'Avg EV (mph)' },
    { value: (teamHardHit * 100).toFixed(1) + '%', label: '強擊率', sub: 'Hard Hit%' },
  ];

  container.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-sublabel">${k.sub}</div>
    </div>
  `).join('');
}

/** 渲染打者成績表格 */
function renderBattingTable(stats) {
  const container = document.getElementById('batting-table-body');
  if (!container) return;

  container.innerHTML = stats.map(b => `
    <tr>
      <td>${escapeHTML(b.name)}</td>
      <td>${b.pa}</td>
      <td>${b.ab}</td>
      <td>${b.hits}</td>
      <td>${b.hr}</td>
      <td>${b.rbi}</td>
      <td class="${b.avg !== null && b.avg >= 0.300 ? 'stat-highlight' : ''}">${DataProcessor.fmtAvg(b.avg)}</td>
      <td class="${b.ops !== null && b.ops >= 0.800 ? 'stat-highlight' : ''}">${b.ops !== null ? b.ops.toFixed(3) : '—'}</td>
      <td style="color:var(--accent-gold); font-weight:bold;">${b.wOBA !== null ? b.wOBA.toFixed(3) : '—'}</td>
      <td>${b.bbRate !== null ? (b.bbRate * 100).toFixed(1) + '%' : '—'}</td>
      <td>${b.kRate !== null ? (b.kRate * 100).toFixed(1) + '%' : '—'}</td>
      <td>${b.whiffPct !== null ? (b.whiffPct * 100).toFixed(1) + '%' : '—'}</td>
      <td>${b.sweetSpotPct !== null ? (b.sweetSpotPct * 100).toFixed(1) + '%' : '—'}</td>
      <td>${b.avgEV ? b.avgEV.toFixed(1) : '—'}</td>
      <td>${b.hardHitPct !== null ? (b.hardHitPct * 100).toFixed(0) + '%' : '—'}</td>
      <td>${b.ppa ? b.ppa.toFixed(1) : '—'}</td>
    </tr>
  `).join('');
}

/** 渲染打擊視覺化圖表 */
function renderBattingCharts(cumStats) {
  const team = DataProcessor.TAIWAN_TEAM;
  // 收集所有比賽的擊球品質資料
  let allBattedBalls = [];
  Object.values(allGamesData).forEach(({ rows }) => {
    allBattedBalls = allBattedBalls.concat(DataProcessor.collectBattedBallData(rows, team));
  });

  // EV × LA 散布圖
  Charts.drawEVxLAChart('ev-la-chart', allBattedBalls);

  // 仰角分類分布圖
  Charts.drawLADistributionChart('la-distribution-chart', cumStats);

  // wOBA 長條圖
  Charts.drawWOBABarChart('woba-bar-chart', cumStats);

  // 戰術流向圖 (Sankey Diagram)
  const sankeyData = DataProcessor.computeSankeyData(allGamesData, team);
  Charts.drawStrategySankeyChart('strategy-sankey-chart', sankeyData);

  // 噴射落點圖 (Spray Chart)
  Charts.drawSprayChartHexbin('spray-chart-hexbin', allBattedBalls);

  // 英雄五圍雷達圖 (Hero Radar Chart)
  const heroData = DataProcessor.computeHeroRadarStats(allGamesData, team);
  Charts.drawHeroRadarChart('hero-radar-chart', heroData);


  // 選球四象限圖
  Charts.drawDisciplineScatterChart('discipline-scatter-chart', cumStats);

  // 進階打線火力專題 (DE-03, DE-04)
  if (extendedData) {
    if (extendedData.extreme && extendedData.extreme.top_homeruns) {
      Charts.drawMonsterHitsList('monster-hits-list', extendedData.extreme.top_homeruns);
    }
    if (extendedData.tactics && extendedData.tactics.rbi_source) {
      Charts.drawRBISourceChart('rbi-source-chart', extendedData.tactics.rbi_source);
    }
  }
}

// ============================================================
// P3：投球分析頁面
// ============================================================

/** 渲染投球分析頁面 */
function renderPitchingPage() {
  const team = DataProcessor.TAIWAN_TEAM;
  const cumStats = DataProcessor.computeCumulativePitchingStats(allGamesData, team);

  // 投手 KPI
  renderPitchingKPIs(cumStats);
  // 投手成績表
  renderPitchingTable(cumStats);
  // 投手選單
  renderPitcherSelector(cumStats);
  // 預設顯示第一位投手的圖表
  if (cumStats.length > 0) {
    renderPitcherCharts(cumStats[0]);
  }

  // 牛棚拆彈專家圓餅圖 (Reliever Crisis Donut)
  try {
    const rcData = DataProcessor.computeRelieverCrisisData(allGamesData, team);
    if (!rcData || rcData.length === 0) throw new Error("無中繼投手危機處理數據");
    Charts.drawRelieverCrisisChart('reliever-crisis-chart', rcData);
  } catch(e) {
    console.warn("牛棚拆彈專家圖表略過:", e.message);
    renderEmptyState('reliever-crisis-chart', '本預賽尚無牛棚於得點圈危機登板之數據');
  }

  // 火球男儀表板 (Fireball Speedometer)
  try {
    const fbData = DataProcessor.computeFireballData(allGamesData, team);
    if (!fbData || fbData.length === 0) throw new Error("無火球男相關投球數據");
    Charts.drawFireballSpeedometer('fireball-speedometer', fbData);
  } catch(e) {
    console.warn("火球男儀表板略過:", e.message);
    renderEmptyState('fireball-speedometer', '目前沒有達到火球標準的高速投球紀錄');
  }

  // 投手陣容專題 (DE-03, DE-04)
  if (extendedData) {
    if (extendedData.extreme && extendedData.extreme.top_fastballs) {
      Charts.drawTopFastballsList('top-fastballs-list', extendedData.extreme.top_fastballs);
    }
    if (extendedData.tactics && extendedData.tactics.pitch_arsenal) {
      Charts.drawTeamPitchArsenalChart('team-pitch-arsenal-chart', extendedData.tactics.pitch_arsenal);
    }
  }
}

/** 渲染投球 KPI 卡片 */
function renderPitchingKPIs(stats) {
  const container = document.getElementById('pitching-kpis');
  if (!container) return;

  const totalPitches = stats.reduce((s, p) => s + p.pitchCount, 0);
  const totalIP = stats.reduce((s, p) => s + p.ip, 0);
  const totalK = stats.reduce((s, p) => s + p.strikeouts, 0);
  const totalBB = stats.reduce((s, p) => s + p.walksAllowed, 0);
  const allSpeeds = stats.flatMap(p => p.speeds);
  const avgSpeed = DataProcessor.avg(allSpeeds);
  const maxSpeed = DataProcessor.maxVal(allSpeeds);
  const totalStrikes = stats.reduce((s, p) => s + p.strikes, 0);
  const strikePct = totalPitches > 0 ? totalStrikes / totalPitches : 0;

  const kpis = [
    { value: totalPitches, label: '總投球數', sub: 'Total Pitches' },
    { value: totalK, label: '三振', sub: 'Strikeouts' },
    { value: totalBB, label: '保送', sub: 'Walks' },
    { value: avgSpeed ? avgSpeed.toFixed(1) : '—', label: '平均球速', sub: 'Avg Velo (mph)' },
    { value: maxSpeed ? maxSpeed.toFixed(1) : '—', label: '最高球速', sub: 'Max Velo (mph)' },
    { value: (strikePct * 100).toFixed(1) + '%', label: '好球率', sub: 'Strike%' },
  ];

  container.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-sublabel">${k.sub}</div>
    </div>
  `).join('');
}

/** 渲染投手成績表格 */
function renderPitchingTable(stats) {
  const container = document.getElementById('pitching-table-body');
  if (!container) return;

  container.innerHTML = stats.map(p => {
    const topTypes = Object.values(p.pitchTypes)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(t => `${escapeHTML(t.name)}`)
      .join(', ');

    return `
      <tr>
        <td>${escapeHTML(p.name)}</td>
        <td>${p.ipDisplay}</td>
        <td>${p.pitchCount}</td>
        <td style="color:var(--accent-gold); font-weight:bold;">${p.ra9 !== null ? p.ra9.toFixed(2) : '—'}</td>
        <td style="color:var(--accent-gold); font-weight:bold;">${p.fip !== null ? p.fip.toFixed(2) : '—'}</td>
        <td>${p.whip !== null ? p.whip.toFixed(2) : '—'}</td>
        <td>${p.strikeouts}</td>
        <td>${p.walksAllowed || 0}</td>
        <td>${p.hitsAllowed || 0}</td>
        <td>${p.kRate !== null ? (p.kRate * 100).toFixed(1) + '%' : '—'}</td>
        <td style="color:var(--accent-gold); font-weight:bold;">${p.cswPct !== null ? (p.cswPct * 100).toFixed(1) + '%' : '—'}</td>
        <td>${p.avgSpeed ? p.avgSpeed.toFixed(1) : '—'}</td>
        <td>${p.strikePct ? (p.strikePct * 100).toFixed(1) + '%' : '—'}</td>
        <td>${p.pip ? p.pip.toFixed(1) : '—'}</td>
        <td style="font-size:0.75rem;color:var(--text-secondary)">${topTypes}</td>  <!-- topTypes 已在 map 階段轉義 -->
      </tr>
    `;
  }).join('');
}

/** 渲染投手選擇器 */
function renderPitcherSelector(stats) {
  const select = document.getElementById('pitcher-select');
  if (!select) return;

  select.innerHTML = stats.map(p =>
    `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${p.pitchCount}球)</option>`
  ).join('');

  select.addEventListener('change', () => {
    const selected = stats.find(p => p.id === select.value);
    if (selected) renderPitcherCharts(selected);
  });
}

/** 渲染選定投手的圖表 */
function renderPitcherCharts(pitcherStats) {
  // 更新投手名稱標題
  const nameEl = document.getElementById('selected-pitcher-name');
  if (nameEl) nameEl.textContent = pitcherStats.name;

  // 球種分布條
  const mixContainer = document.getElementById('pitch-mix-container');
  if (mixContainer) {
    mixContainer.innerHTML = '';
    Charts.renderPitchMixBar(mixContainer, pitcherStats.pitchTypes);
  }

  // 投球位移圖
  Charts.drawMovementChart('movement-chart', pitcherStats.pitchDetails, pitcherStats.name);

  // 好球帶進壘圖
  Charts.drawStrikeZoneChart('strike-zone-chart', pitcherStats.pitchDetails);

  // 新增 CSW% 圓環圖
  Charts.drawCSWDonutChart('csw-donut-chart', pitcherStats);

  // 球種統計表
  renderPitchTypeTable(pitcherStats);
}

/** 渲染球種詳細統計表 */
function renderPitchTypeTable(pitcher) {
  const container = document.getElementById('pitch-type-table-body');
  if (!container) return;

  const types = Object.values(pitcher.pitchTypes).sort((a, b) => b.count - a.count);

  container.innerHTML = types.map(pt => `
    <tr>
      <td>
        <span class="pitch-legend-dot" style="background:${DataProcessor.PITCH_COLOR_MAP[pt.code] || '#64748b'};display:inline-block;margin-right:6px"></span>
        ${escapeHTML(pt.name)} (${escapeHTML(pt.code)})
      </td>
      <td>${pt.count}</td>
      <td>${(pt.pct * 100).toFixed(1)}%</td>
      <td>${pt.avgSpeed ? pt.avgSpeed.toFixed(1) : '—'}</td>
      <td>${pt.maxSpeed ? pt.maxSpeed.toFixed(1) : '—'}</td>
      <td>${pt.avgSpin ? Math.round(pt.avgSpin) : '—'}</td>
      <td>${pt.avgPfxX ? pt.avgPfxX.toFixed(1) : '—'}</td>
      <td>${pt.avgPfxZ ? pt.avgPfxZ.toFixed(1) : '—'}</td>
    </tr>
  `).join('');
}

// ============================================================
// P4：對戰比較頁面
// ============================================================

/** 渲染對戰比較頁面 */
function renderComparisonPage() {
  const team = DataProcessor.TAIWAN_TEAM;

  // 各場比賽的數據對比
  const taiwanGames = Object.values(allGamesData).filter(({ rows }) => {
    return rows.some(r => r['batting_team'] === team || r['fielding_team'] === team);
  });

  const container = document.getElementById('comparison-content');
  if (!container) return;

  let html = '';

  // 各場打擊紀律對比
  html += '<div class="section-title"><span class="icon">📊</span> 各場比賽打擊數據對比</div>';
  html += '<div class="stats-table-wrapper"><table class="stats-table">';
  html += `<thead><tr>
    <th>比賽</th><th>比分</th><th>安打</th><th>全壘打</th><th>打點</th><th>保送</th><th>三振</th><th>打擊率</th><th>團隊 P/PA</th>
  </tr></thead><tbody>`;

  taiwanGames.forEach(({ rows, meta }) => {
    const summary = DataProcessor.computeGameSummary(rows, meta);
    const battingStats = DataProcessor.computeBattingStats(rows, team);
    const discipline = DataProcessor.computeDisciplineStats(rows, team);

    if (!summary) return;

    const isTaiwanHome = summary.homeTeam === team;
    const taiwanScore = isTaiwanHome ? summary.homeScore : summary.awayScore;
    const oppScore = isTaiwanHome ? summary.awayScore : summary.homeScore;
    const opponent = isTaiwanHome ? summary.awayTeam : summary.homeTeam;
    const isWin = taiwanScore > oppScore;

    const totalHits = battingStats.reduce((s, b) => s + b.hits, 0);
    const totalHR = battingStats.reduce((s, b) => s + b.hr, 0);
    const totalRBI = battingStats.reduce((s, b) => s + b.rbi, 0);
    const totalBB = battingStats.reduce((s, b) => s + b.bb, 0);
    const totalSO = battingStats.reduce((s, b) => s + b.so, 0);
    const totalAB = battingStats.reduce((s, b) => s + b.ab, 0);
    const totalHitsForAvg = battingStats.reduce((s, b) => s + b.hits, 0);
    const teamAVG = totalAB > 0 ? totalHitsForAvg / totalAB : 0;
    const avgPPA = DataProcessor.avg(battingStats.flatMap(b => b.pitchesPerPA));

    html += `<tr>
      <td>${TEAM_FLAGS[opponent] || ''} vs ${escapeHTML(TEAM_NAMES_ZH[opponent])}</td>
      <td><span class="badge ${isWin ? 'badge-win' : 'badge-loss'}">${taiwanScore}-${oppScore}</span></td>
      <td>${totalHits}</td>
      <td>${totalHR}</td>
      <td>${totalRBI}</td>
      <td>${totalBB}</td>
      <td>${totalSO}</td>
      <td class="${teamAVG >= 0.300 ? 'stat-highlight' : ''}">${DataProcessor.fmtAvg(teamAVG)}</td>
      <td>${avgPPA ? avgPPA.toFixed(1) : '—'}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';

  // 各場投球數據對比
  html += '<div class="section-title" style="margin-top:var(--space-2xl)"><span class="icon">⚾</span> 各場比賽投球數據對比</div>';
  html += '<div class="stats-table-wrapper"><table class="stats-table">';
  html += `<thead><tr>
    <th>比賽</th><th>總投球數</th><th>三振</th><th>保送</th><th>被安打</th><th>平均球速</th><th>最快球速</th><th>好球率</th>
  </tr></thead><tbody>`;

  taiwanGames.forEach(({ rows, meta }) => {
    const summary = DataProcessor.computeGameSummary(rows, meta);
    const pitchingStats = DataProcessor.computePitchingStats(rows, team);

    if (!summary) return;

    const isTaiwanHome = summary.homeTeam === team;
    const opponent = isTaiwanHome ? summary.awayTeam : summary.homeTeam;

    const totalPitches = pitchingStats.reduce((s, p) => s + p.pitchCount, 0);
    const totalK = pitchingStats.reduce((s, p) => s + p.strikeouts, 0);
    const totalBB = pitchingStats.reduce((s, p) => s + (p.walksAllowed || 0), 0);
    const totalH = pitchingStats.reduce((s, p) => s + (p.hitsAllowed || 0), 0);
    const allSpeeds = pitchingStats.flatMap(p => p.speeds);
    const avgSpd = DataProcessor.avg(allSpeeds);
    const maxSpd = DataProcessor.maxVal(allSpeeds);
    const totalStrikes = pitchingStats.reduce((s, p) => s + p.strikes, 0);
    const strikePct = totalPitches > 0 ? totalStrikes / totalPitches : 0;

    html += `<tr>
      <td>${TEAM_FLAGS[opponent] || ''} vs ${escapeHTML(TEAM_NAMES_ZH[opponent])}</td>
      <td>${totalPitches}</td>
      <td>${totalK}</td>
      <td>${totalBB}</td>
      <td>${totalH}</td>
      <td>${avgSpd ? avgSpd.toFixed(1) : '—'}</td>
      <td>${maxSpd ? maxSpd.toFixed(1) : '—'}</td>
      <td>${(strikePct * 100).toFixed(1)}%</td>
    </tr>`;
  });

  html += '</tbody></table></div>';

  container.innerHTML = html;
}

// ============================================================
// 應用程式啟動
// ============================================================

async function initApp() {
  // 顯示載入中
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('app-content').style.display = 'none';

  try {
    // 載入所有比賽逐球資料 以及 R預編譯進階資料
    const [gamesData, extData] = await Promise.all([
      DataProcessor.loadAllGames(),
      DataProcessor.loadExtendedStats()
    ]);
    allGamesData = gamesData;
    extendedData = extData;

    // 隱藏載入畫面，顯示主內容
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';

    // 初始化導覽
    initTabNavigation();

    // 僅渲染賽事總覽（預設可見頁面）
    // 其他頁面在首次切換到時才渲染（延遲渲染模式）
    renderPageIfNeeded('page-overview');

  } catch (err) {
    document.getElementById('loading').innerHTML = `
      <div style="color: var(--accent-red); text-align: center;">
        <p>❌ 資料載入失敗</p>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">${escapeHTML(err.message)}</p>
      </div>
    `;
    console.error('App init failed:', err);
  }
}

// 頁面載入完成後啟動
document.addEventListener('DOMContentLoaded', initApp);

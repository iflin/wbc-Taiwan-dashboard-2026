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
  renderGameCards();
}

/** 渲染 C 組戰績表 */
function renderStandings() {
  const standings = DataProcessor.computeStandings(allGamesData);
  const container = document.getElementById('standings-table-body');
  if (!container) return;

  container.innerHTML = standings.map((s, i) => {
    const flag = TEAM_FLAGS[s.team] || '';
    const nameZH = TEAM_NAMES_ZH[s.team] || s.team;
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

  container.innerHTML = taiwanGames.map(({ rows, meta }) => {
    const summary = DataProcessor.computeGameSummary(rows, meta);
    if (!summary) return '';

    const { homeTeam, awayTeam, homeScore, awayScore, inningScores, date, label } = summary;
    const isTaiwanHome = homeTeam === DataProcessor.TAIWAN_TEAM;
    const taiwanScore = isTaiwanHome ? homeScore : awayScore;
    const opponentScore = isTaiwanHome ? awayScore : homeScore;
    const isWin = taiwanScore > opponentScore;
    const opponent = isTaiwanHome ? awayTeam : homeTeam;

    // 各局比分表格
    let inningHTML = '<table><tr><th></th>';
    for (let i = 1; i <= 9; i++) inningHTML += `<th>${i}</th>`;
    inningHTML += '<th class="total-col">R</th></tr>';

    // 客隊
    inningHTML += `<tr><td>${TEAM_FLAGS[awayTeam] || ''} ${TEAM_NAMES_ZH[awayTeam] || awayTeam}</td>`;
    for (let i = 1; i <= 9; i++) {
      const s = inningScores.away[i] || 0;
      inningHTML += `<td class="${s > 0 ? 'score-highlight' : ''}">${s}</td>`;
    }
    inningHTML += `<td class="total-col">${awayScore}</td></tr>`;

    // 主隊
    inningHTML += `<tr><td>${TEAM_FLAGS[homeTeam] || ''} ${TEAM_NAMES_ZH[homeTeam] || homeTeam}</td>`;
    for (let i = 1; i <= 9; i++) {
      const s = inningScores.home[i] || 0;
      inningHTML += `<td class="${s > 0 ? 'score-highlight' : ''}">${s}</td>`;
    }
    inningHTML += `<td class="total-col">${homeScore}</td></tr></table>`;

    return `
      <div class="game-card ${isWin ? 'win' : 'loss'}">
        <div class="game-card-header">
          <span>📅 ${date}</span>
          <span class="badge ${isWin ? 'badge-win' : 'badge-loss'}">${isWin ? '✓ 勝' : '✗ 敗'}</span>
        </div>
        <div class="game-card-body">
          <div class="game-score-row">
            <div class="team-info">
              <span class="team-flag">${TEAM_FLAGS[awayTeam] || ''}</span>
              <span class="team-name ${awayTeam === DataProcessor.TAIWAN_TEAM ? 'highlight' : ''}">${TEAM_NAMES_ZH[awayTeam] || awayTeam}</span>
            </div>
            <span class="score-value ${awayScore > homeScore ? 'winner' : 'loser'}">${awayScore}</span>
          </div>
          <div class="game-score-row">
            <div class="team-info">
              <span class="team-flag">${TEAM_FLAGS[homeTeam] || ''}</span>
              <span class="team-name ${homeTeam === DataProcessor.TAIWAN_TEAM ? 'highlight' : ''}">${TEAM_NAMES_ZH[homeTeam] || homeTeam}</span>
            </div>
            <span class="score-value ${homeScore > awayScore ? 'winner' : 'loser'}">${homeScore}</span>
          </div>
          <div class="inning-scores">${inningHTML}</div>
        </div>
      </div>
    `;
  }).join('');


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
  // EV × LA 散布圖
  renderBattingCharts();
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
      <td>${b.name}</td>
      <td>${b.pa}</td>
      <td>${b.ab}</td>
      <td>${b.hits}</td>
      <td>${b.doubles}</td>
      <td>${b.triples}</td>
      <td>${b.hr}</td>
      <td>${b.rbi}</td>
      <td>${b.bb}</td>
      <td>${b.so}</td>
      <td class="${b.avg !== null && b.avg >= 0.300 ? 'stat-highlight' : ''}">${DataProcessor.fmtAvg(b.avg)}</td>
      <td>${DataProcessor.fmtAvg(b.obp)}</td>
      <td>${DataProcessor.fmtAvg(b.slg)}</td>
      <td class="${b.ops !== null && b.ops >= 0.800 ? 'stat-highlight' : ''}">${b.ops !== null ? b.ops.toFixed(3) : '—'}</td>
      <td>${b.avgEV ? b.avgEV.toFixed(1) : '—'}</td>
      <td>${b.hardHitPct !== null ? (b.hardHitPct * 100).toFixed(0) + '%' : '—'}</td>
      <td>${b.ppa ? b.ppa.toFixed(1) : '—'}</td>
    </tr>
  `).join('');
}

/** 渲染打擊視覺化圖表 */
function renderBattingCharts() {
  const team = DataProcessor.TAIWAN_TEAM;
  // 收集所有比賽的擊球品質資料
  let allBattedBalls = [];
  Object.values(allGamesData).forEach(({ rows }) => {
    allBattedBalls = allBattedBalls.concat(DataProcessor.collectBattedBallData(rows, team));
  });

  // EV × LA 散布圖
  Charts.drawEVxLAChart('ev-la-chart', allBattedBalls);

  // 仰角分類分布圖
  const cumStats = DataProcessor.computeCumulativeBattingStats(allGamesData, team);
  Charts.drawLADistributionChart('la-distribution-chart', cumStats);
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
      .map(t => `${t.name}`)
      .join(', ');

    return `
      <tr>
        <td>${p.name}</td>
        <td>${p.ipDisplay}</td>
        <td>${p.pitchCount}</td>
        <td>${p.strikeouts}</td>
        <td>${p.walksAllowed || 0}</td>
        <td>${p.hitsAllowed || 0}</td>
        <td>${p.avgSpeed ? p.avgSpeed.toFixed(1) : '—'}</td>
        <td>${p.maxSpeed ? p.maxSpeed.toFixed(1) : '—'}</td>
        <td>${p.strikePct ? (p.strikePct * 100).toFixed(1) + '%' : '—'}</td>
        <td>${p.pip ? p.pip.toFixed(1) : '—'}</td>
        <td>${p.firstPitchStrikePct !== null ? (p.firstPitchStrikePct * 100).toFixed(0) + '%' : '—'}</td>
        <td style="font-size:0.75rem;color:var(--text-secondary)">${topTypes}</td>
      </tr>
    `;
  }).join('');
}

/** 渲染投手選擇器 */
function renderPitcherSelector(stats) {
  const select = document.getElementById('pitcher-select');
  if (!select) return;

  select.innerHTML = stats.map(p =>
    `<option value="${p.id}">${p.name} (${p.pitchCount}球)</option>`
  ).join('');

  select.addEventListener('change', () => {
    const selected = stats.find(p => p.id === select.value);
    if (selected) renderPitcherCharts(selected);
  });
}

/** 渲染選定投手的圖表 */
function renderPitcherCharts(pitcher) {
  // 更新投手名稱標題
  const nameEl = document.getElementById('selected-pitcher-name');
  if (nameEl) nameEl.textContent = pitcher.name;

  // 球種分布條
  const mixContainer = document.getElementById('pitch-mix-container');
  if (mixContainer) {
    mixContainer.innerHTML = '';
    Charts.renderPitchMixBar(mixContainer, pitcher.pitchTypes);
  }

  // 投球位移圖
  Charts.drawMovementChart('movement-chart', pitcher.pitchDetails, pitcher.name);

  // 好球帶進壘圖
  Charts.drawStrikeZoneChart('strike-zone-chart', pitcher.pitchDetails);

  // 球種統計表
  renderPitchTypeTable(pitcher);
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
        ${pt.name} (${pt.code})
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
      <td>${TEAM_FLAGS[opponent] || ''} vs ${TEAM_NAMES_ZH[opponent]}</td>
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
      <td>${TEAM_FLAGS[opponent] || ''} vs ${TEAM_NAMES_ZH[opponent]}</td>
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

  // 主審分析
  html += '<div class="section-title" style="margin-top:var(--space-2xl)"><span class="icon">⚖️</span> 各場主審判決分析</div>';
  html += '<div class="game-cards-grid">';

  taiwanGames.forEach(({ rows, meta }) => {
    const summary = DataProcessor.computeGameSummary(rows, meta);
    const umpireData = DataProcessor.computeUmpireAnalysis(rows);
    if (!summary || !umpireData) return;

    const isTaiwanHome = summary.homeTeam === team;
    const opponent = isTaiwanHome ? summary.awayTeam : summary.homeTeam;
    const chartId = `umpire-chart-${meta.date.replace(/-/g, '')}`;

    const favTW = umpireData.pitches.filter(p => {
      const isTWBatting = p.battingTeam === team;
      return (isTWBatting && p.isMissedStrike) || (!isTWBatting && p.isPhantomStrike);
    }).length;
    const againstTW = umpireData.pitches.filter(p => {
      const isTWBatting = p.battingTeam === team;
      return (isTWBatting && p.isPhantomStrike) || (!isTWBatting && p.isMissedStrike);
    }).length;

    html += `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${TEAM_FLAGS[opponent]} vs ${TEAM_NAMES_ZH[opponent]}</div>
            <div class="card-subtitle">${meta.date}</div>
          </div>
        </div>
        <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
          <div class="kpi-card">
            <div class="kpi-value">${umpireData.correctPct !== null ? (umpireData.correctPct * 100).toFixed(1) + '%' : '—'}</div>
            <div class="kpi-label">判決正確率</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" style="background:linear-gradient(135deg,#e63946,#c1121f);-webkit-background-clip:text">${umpireData.phantomStrikes}</div>
            <div class="kpi-label">幽靈好球</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" style="background:linear-gradient(135deg,#f5c542,#e8a317);-webkit-background-clip:text">${umpireData.missedStrikes}</div>
            <div class="kpi-label">漏判好球</div>
          </div>
        </div>
        <div id="${chartId}" style="min-height:300px;"></div>
      </div>
    `;
  });

  html += '</div>';

  container.innerHTML = html;

  // 渲染主審圖表（需在 DOM 更新後）
  setTimeout(() => {
    taiwanGames.forEach(({ rows, meta }) => {
      const umpireData = DataProcessor.computeUmpireAnalysis(rows);
      const chartId = `umpire-chart-${meta.date.replace(/-/g, '')}`;
      Charts.drawUmpireChart(chartId, umpireData);
    });
  }, 100);
}

// ============================================================
// 應用程式啟動
// ============================================================

async function initApp() {
  // 顯示載入中
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('app-content').style.display = 'none';

  try {
    // 載入所有比賽資料
    allGamesData = await DataProcessor.loadAllGames();

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
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">${err.message}</p>
      </div>
    `;
    console.error('App init failed:', err);
  }
}

// 頁面載入完成後啟動
document.addEventListener('DOMContentLoaded', initApp);

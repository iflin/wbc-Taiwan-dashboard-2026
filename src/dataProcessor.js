/**
 * WBC 台灣隊 2026 預賽 C 組 — 資料處理模組
 *
 * 負責：
 * 1. 載入並解析 CSV 逐球資料
 * 2. 計算所有打擊、投球、選球指標
 * 3. 提供結構化資料給前端頁面使用
 */

// ============================================================
// 全域常數定義
// ============================================================

/** C 組所有隊伍 */
const GROUP_C_TEAMS = [
  "Japan",
  "Korea",
  "Chinese Taipei",
  "Australia",
  "Czechia",
];

/** 台灣隊在資料中的名稱 */
const TAIWAN_TEAM = "Chinese Taipei";

/** CSV 檔案路徑對照（game_pk → 檔名） */
const GAME_FILES = [
  {
    file: "data/788120_ChineseTaipei_vs_Australia_pbp.csv",
    label: "台灣 vs 澳洲",
    date: "2026-03-05",
  },
  {
    file: "data/788115_Czechia_vs_Korea_pbp.csv",
    label: "捷克 vs 韓國",
    date: "2026-03-05",
  },
  {
    file: "data/788116_Australia_vs_Czechia_pbp.csv",
    label: "澳洲 vs 捷克",
    date: "2026-03-06",
  },
  {
    file: "data/788114_Japan_vs_ChineseTaipei_pbp.csv",
    label: "日本 vs 台灣",
    date: "2026-03-06",
  },
  {
    file: "data/788117_ChineseTaipei_vs_Czechia_pbp.csv",
    label: "台灣 vs 捷克",
    date: "2026-03-07",
  },
  {
    file: "data/788118_Korea_vs_Japan_pbp.csv",
    label: "韓國 vs 日本",
    date: "2026-03-07",
  },
  {
    file: "data/788113_ChineseTaipei_vs_Korea_pbp.csv",
    label: "台灣 vs 韓國",
    date: "2026-03-08",
  },
  {
    file: "data/788109_Australia_vs_Japan_pbp.csv",
    label: "澳洲 vs 日本",
    date: "2026-03-08",
  },
  {
    file: "data/788112_Korea_vs_Australia_pbp.csv",
    label: "韓國 vs 澳洲",
    date: "2026-03-09",
  }
];

/** 球種代碼 → 中文名稱對照 */
const PITCH_TYPE_MAP = {
  FF: "四縫線速球",
  SI: "伸卡球",
  FC: "切球",
  SL: "滑球",
  CU: "曲球",
  CH: "變速球",
  FS: "指叉球",
  ST: "掃掠滑球",
  KC: "彎曲球",
  KN: "蝴蝶球",
  EP: "慢速曲球",
};

/** 台灣球員中英文姓名對照表 */
const TAIWAN_PLAYER_NAMES = {
  "An-Ko Lin": "林安可 (An-Ko Lin)",
  "Chen Zhong-Ao Zhuang": "莊陳仲敖 (Chen Zhong-Ao Zhuang)",
  "Cheng-Hui Sung": "宋晟睿 (Cheng-Hui Sung)",
  "Chieh-Hsien Chen": "陳傑憲 (Chieh-Hsien Chen)",
  "Chih-Wei Hu": "胡智為 (Chih-Wei Hu)",
  "Hao-Chun Cheng": "鄭浩均 (Hao-Chun Cheng)",
  "Jo-Hsi Hsu": "徐若熙 (Jo-Hsi Hsu)",
  "Jun-Wei Zhang": "張峻瑋 (Jun-Wei Zhang)",
  "Jyun-Yue Tseng": "曾峻岳 (Jyun-Yue Tseng)",
  "Kai-Wei Lin": "林凱威 (Kai-Wei Lin)",
  "Kungkuan Giljegiljaw": "吉力吉撈．鞏冠 (Kungkuan Giljegiljaw)",
  "Lyle Lin": "林家正 (Lyle Lin)",
  "Nien-Ting Wu": "吳念庭 (Nien-Ting Wu)",
  "Po-Yu Chen": "陳柏毓 (Po-Yu Chen)",
  "Shao-Hung Chiang": "蔣少宏 (Shao-Hung Chiang)",
  "Shih-Hsiang Lin": "林詩翔 (Shih-Hsiang Lin)",
  "Stuart Fairchild": "費爾柴德 (Stuart Fairchild)",
  "Tsung-Che Cheng": "鄭宗哲 (Tsung-Che Cheng)",
  "Tzu-Chen Sha": "沙子宸 (Tzu-Chen Sha)",
  "Yi Chang": "張奕 (Yi Chang)",
  "Yi-Lei Sun": "孫易磊 (Yi-Lei Sun)",
  "Yu Chang": "張育成 (Yu Chang)",
  "Yu-Min Lin": "林昱珉 (Yu-Min Lin)",
  "Chen-Wei Chen": "陳晨威 (Chen-Wei Chen)",
  "Kun-Yu Chiang": "江坤宇 (Kun-Yu Chiang)",
  "Tzu-Wei Lin": "林子偉 (Tzu-Wei Lin)",
  "Hao-Yu Lee": "李灝宇 (Hao-Yu Lee)",
  "Cheng-Yu Chang": "張政禹 (Cheng-Yu Chang)",
  "Ruei-Yang Gu Lin": "古林睿煬 (Ruei-Yang Gu Lin)",
  "Wei-En Lin": "林維恩 (Wei-En Lin)",
  "Kuan-Yu Chen": "陳冠宇 (Kuan-Yu Chen)",
};

/**
 * 取得球員的中英對照姓名並進行排版降級標記
 * 回傳例如: 林安可 (不再顯示英文拼音)
 */
function getPlayerLocalName(engName) {
  if (!engName) return "";
  const mapped = TAIWAN_PLAYER_NAMES[engName];
  if (!mapped) return engName; // 非台灣隊只顯示英文

  // 將 "中文 (English)" 拆解，運用 Regex 分離中英，並僅回傳中文部分
  const match = mapped.match(/^(.+?)\s*(\(.+\))$/);
  if (match) {
    return match[1].trim();
  }
  return mapped;
}

/** 球種代碼 → 統一色碼（用於圖表） */
const PITCH_COLOR_MAP = {
  FF: "#ef4444",
  SI: "#f97316",
  FC: "#eab308",
  SL: "#3b82f6",
  CU: "#22c55e",
  CH: "#a855f7",
  FS: "#14b8a6",
  ST: "#6366f1",
  KC: "#10b981",
  KN: "#64748b",
  EP: "#94a3b8",
};

// ============================================================
// CSV 載入
// ============================================================

/**
 * 載入所有比賽 CSV 檔案，回傳結構化資料
 * 使用 PapaParse 進行 CSV 解析
 * 首先會讀取 data/game_list.json 獲取最新的動態賽事清單
 * @returns {Promise<Object>} 包含所有比賽原始列資料的物件
 */
async function loadAllGames() {
  const results = {};
  
  // 第一步：從 game_list.json 取得要下載的檔案清單
  let gameFiles = [];
  try {
    const listUrl = `data/game_list.json?v=${window.APP_VERSION || '1.0'}`;
    const listRes = await fetch(listUrl);
    if (listRes.ok) {
      gameFiles = await listRes.json();
    } else {
      console.warn("無法取得 game_list.json，可能尚未產生或路徑錯誤。");
      return results;
    }
  } catch (e) {
    console.error("讀取 game_list.json 失敗", e);
    return results;
  }

  // 第二步：改為序列式下載（Sequential Await）
  // 由於本機端 python -m http.server 為單執行緒，一次發出 9 個並行請求將會導致 Socket Queue 塞車並強制中斷 (net::ERR_ABORTED)
  const loadedGames = [];
  for (const game of gameFiles) {
    try {
      // 加上資源版本號控制快取，取代原有的時間戳以利 CDN 快取
      const nocacheUrl = `${game.file}?v=${window.APP_VERSION || '1.0'}`;
      const response = await fetch(nocacheUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      
      const text = await response.text();
      // 使用 PapaParse 解析 CSV
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      loadedGames.push({ key: game.file, value: { rows: parsed.data, meta: game } });
    } catch (err) {
      console.error(`載入 ${game.file} 失敗:`, err);
    }
  }

  loadedGames.forEach(item => {
    if (item) results[item.key] = item.value;
  });

  return results;
}

/**
 * 載入預先由 R 腳本整理出來的進階專題數據
 * 來源：WBC_2026_更多數據整理.xlsx -> wbc_extended_stats.json
 * @returns {Promise<Object>} 包含歷史對比、極端數據與戰術結構的物件
 */
async function loadExtendedStats() {
  try {
    const url = `data/wbc_extended_stats.json?v=${window.APP_VERSION || '1.0'}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("載入進階專題數據失敗:", err);
    return null;
  }
}

// ============================================================
// 進階數據矩陣與參數 (Sabermetrics & Probability Data)
// ============================================================

/**
 * 2024 MLB Run Expectancy Matrix (RE24)
 * 24 種狀態得分期望值矩陣 (0~2 出局, 8 種壘包狀態)
 * 陣列結構: [無出局, 一出局, 兩出局]
 * 壘包狀態索引:
 * 0: --- (壘上無人)
 * 1: 1-- (一壘)
 * 2: -2- (二壘)
 * 3: 12- (一二壘)
 * 4: --3 (三壘)
 * 5: 1-3 (一三壘)
 * 6: -23 (二三壘)
 * 7: 123 (滿壘)
 */
const BASE_RE24 = [
  [0.490, 0.263, 0.100], // 0: ---
  [0.871, 0.519, 0.222], // 1: 1--
  [1.111, 0.672, 0.316], // 2: -2-
  [1.458, 0.913, 0.443], // 3: 12-
  [1.334, 0.957, 0.362], // 4: --3
  [1.714, 1.157, 0.485], // 5: 1-3
  [1.956, 1.349, 0.584], // 6: -23
  [2.285, 1.517, 0.749], // 7: 123
];

/**
 * 給予出局數與壘包狀態，取得當前的 RE 值
 * @param {number} outs - 出局數 (0-2)
 * @param {number} bases - 壘包狀態 (0-7)
 * @returns {number} 得分期望值
 */
function getRE(outs, bases) {
  if (outs >= 3) return 0;
  return BASE_RE24[bases] ? BASE_RE24[bases][outs] || 0 : 0;
}

/**
 * 判讀單一 Play 的壘包狀態
 * 回傳 0 到 7，對應 BASE_RE24 的陣列行數
 */
function getBasesMask(r) {
  const on1b = r["matchup.postOnFirst.id"] && r["matchup.postOnFirst.id"] !== "NA" ? 1 : 0;
  const on2b = r["matchup.postOnSecond.id"] && r["matchup.postOnSecond.id"] !== "NA" ? 1 : 0;
  const on3b = r["matchup.postOnThird.id"] && r["matchup.postOnThird.id"] !== "NA" ? 1 : 0;

  // 0: ---, 1: 1--, 2: -2-, 3: 12-, 4: --3, 5: 1-3, 6: -23, 7: 123
  if (on1b && !on2b && !on3b) return 1;
  if (!on1b && on2b && !on3b) return 2;
  if (on1b && on2b && !on3b) return 3;
  if (!on1b && !on2b && on3b) return 4;
  if (on1b && !on2b && on3b) return 5;
  if (!on1b && on2b && on3b) return 6;
  if (on1b && on2b && on3b) return 7;
  return 0; // 空壘
}

// ============================================================
// 工具函式
// ============================================================

/**
 * 安全地將字串轉為數字，無效值回傳 null
 * @param {string} val - 原始字串值
 * @returns {number|null}
 */
function toNum(val) {
  if (val === undefined || val === null || val === "" || val === "NA")
    return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/**
 * 計算陣列平均值（忽略 null）
 * @param {number[]} arr
 * @returns {number|null}
 */
function avg(arr) {
  const valid = arr.filter((v) => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * 計算陣列最大值（忽略 null）
 */
function maxVal(arr) {
  const valid = arr.filter((v) => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

/**
 * 格式化數字為固定小數位字串
 */
function fmt(val, decimals = 3) {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

/**
 * 格式化打擊率風格（不顯示前導 0）
 * 例：0.333 → .333
 */
function fmtAvg(val) {
  if (val === null || val === undefined) return "—";
  return val.toFixed(3).replace(/^0/, "");
}

// ============================================================
// 比賽概況計算
// ============================================================

/**
 * 計算單場比賽的基本概況
 * 包含最終比分、各局得分、先發投手、打線等資訊
 * @param {Object[]} rows - 該場比賽所有逐球資料列
 * @param {Object} meta - 比賽元資料
 * @returns {Object} 比賽概況物件
 */
function computeGameSummary(rows, meta) {
  if (!rows || rows.length === 0) return null;

  // 找出最終打席（最大 atBatIndex）以取得最終比分
  let maxABI = -1;
  let finalRow = rows[0];
  rows.forEach((r) => {
    const abi = toNum(r["about.atBatIndex"]);
    if (abi !== null && abi > maxABI) {
      maxABI = abi;
      finalRow = r;
    }
  });

  const homeTeam = finalRow["home_team"] || "";
  const awayTeam = finalRow["away_team"] || "";
  const homeScore = toNum(finalRow["result.homeScore"]) || 0;
  const awayScore = toNum(finalRow["result.awayScore"]) || 0;

  // 各局得分計算：找每局最後一個打席的比分差值
  const inningScores = { home: {}, away: {} };
  const inningLastABI = {};

  rows.forEach((r) => {
    const inning = toNum(r["about.inning"]);
    const half = r["about.halfInning"];
    const abi = toNum(r["about.atBatIndex"]);
    const hs = toNum(r["result.homeScore"]);
    const as = toNum(r["result.awayScore"]);
    if (inning === null || abi === null) return;

    const key = `${inning}_${half}`;
    if (!inningLastABI[key] || abi > inningLastABI[key].abi) {
      inningLastABI[key] = { abi, hs, as };
    }
  });

  // 計算每半局的得分
  let prevHomeScore = 0;
  let prevAwayScore = 0;
  const maxInning = Math.max(
    ...Object.keys(inningLastABI).map((k) => parseInt(k)),
    0
  );

  const displayInnings = Math.max(9, maxInning);

  for (let i = 1; i <= displayInnings; i++) {
    const topKey = `${i}_top`;
    const botKey = `${i}_bottom`;

    if (inningLastABI[topKey]) {
      const topEnd = inningLastABI[topKey];
      inningScores.away[i] = (topEnd.as || 0) - prevAwayScore;
      prevAwayScore = topEnd.as || 0;
      prevHomeScore = topEnd.hs || 0;
    } else {
      inningScores.away[i] = i <= maxInning ? 0 : 'X';
    }

    if (inningLastABI[botKey]) {
      const botEnd = inningLastABI[botKey];
      inningScores.home[i] = (botEnd.hs || 0) - prevHomeScore;
      prevHomeScore = botEnd.hs || 0;
       // We MUST read the score that the away team had at this bottom-of-inning AB, 
       // but typically away score doesn't change in bottom half.
      prevAwayScore = botEnd.as || prevAwayScore; 
    } else {
      inningScores.home[i] = i < maxInning ? 0 : 'X';
    }
  }

  // 計算全場 RE24 變化曲線（以台灣隊視角）
  const atBats = {};
  rows.forEach(r => {
    const abi = toNum(r["about.atBatIndex"]);
    if (abi !== null) {
      if (!atBats[abi]) atBats[abi] = [];
      atBats[abi].push(r);
    }
  });

  const re24Timeline = [];
  let currentRe24 = 0;
  const targetTeam = "Chinese Taipei";

  Object.values(atBats).forEach(abRows => {
    const firstRow = abRows[0];
    const isTaiwanBatting = firstRow["batting_team"] === targetTeam;
    const isTaiwanFielding = firstRow["fielding_team"] === targetTeam;
    // 若該場比賽無台灣隊參與，則預設以主隊視角
    const isOffense = (isTaiwanBatting || isTaiwanFielding) ? isTaiwanBatting : (firstRow["batting_team"] === homeTeam);

    const event = abRows[abRows.length - 1]["result.eventType"] || "";
    let outsStart = toNum(firstRow["count.outs.start"]) || 0;
    let outsEnd = toNum(abRows[abRows.length - 1]["count.outs.end"]);
    if (outsEnd === null || outsEnd === undefined) {
      outsEnd = outsStart + (event.includes("out") || event.includes("sacrifice") ? 1 : 0);
      if (event.includes("double_play")) outsEnd += 1;
    }
    
    const startBases = getBasesMask(firstRow);
    let endBases = 0;
    const lastRowIndex = rows.indexOf(abRows[abRows.length - 1]);
    if (lastRowIndex >= 0 && lastRowIndex + 1 < rows.length) {
      const nextRow = rows[lastRowIndex + 1];
      if (nextRow["about.halfInning"] === firstRow["about.halfInning"] && 
          nextRow["about.inning"] === firstRow["about.inning"]) {
        endBases = getBasesMask(nextRow);
      }
    }

    const startHomeScore = toNum(firstRow["details.homeScore"]) || 0;
    const startAwayScore = toNum(firstRow["details.awayScore"]) || 0;
    const endRow = abRows[abRows.length - 1];
    const endHomeScore = toNum(endRow["result.homeScore"]) || startHomeScore;
    const endAwayScore = toNum(endRow["result.awayScore"]) || startAwayScore;
    const runScored = (endHomeScore - startHomeScore) + (endAwayScore - startAwayScore);

    const startRE = getRE(outsStart, startBases);
    const endRE = getRE(outsEnd, endBases);
    const re24 = endRE - startRE + runScored;
    
    const diff = isOffense ? re24 : -re24;
    currentRe24 += diff;
    
    re24Timeline.push({
      inning: firstRow["about.inning"],
      half: firstRow["about.halfInning"],
      batter: getPlayerLocalName(firstRow["matchup.batter.fullName"]),
      pitcher: getPlayerLocalName(firstRow["matchup.pitcher.fullName"]),
      event: event,
      diff: diff,
      cumulativeRe24: currentRe24,
      isOffense: isOffense
    });
  });

  return {
    gameId: rows[0]["game_pk"],
    date: meta.date,
    label: meta.label,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    inningScores,
    displayInnings,
    totalPitches: rows.filter((r) => r["isPitch"] === "TRUE").length,
    re24Timeline,
  };
}

// ============================================================
// C 組戰績表計算
// ============================================================

/**
 * 從所有比賽資料中計算 C 組戰績表
 * @param {Object} allGames - loadAllGames() 回傳的所有比賽資料
 * @returns {Object[]} 各隊戰績陣列，依勝場排序
 */
function computeStandings(allGames) {
  const standings = {};
  GROUP_C_TEAMS.forEach((team) => {
    standings[team] = {
      team,
      wins: 0,
      losses: 0,
      ties: 0,
      runsScored: 0,
      runsAllowed: 0,
      gamesPlayed: 0,
    };
  });

  Object.values(allGames).forEach(({ rows, meta }) => {
    const summary = computeGameSummary(rows, meta);
    if (!summary) return;

    const { homeTeam, awayTeam, homeScore, awayScore } = summary;

    // 主隊
    if (standings[homeTeam]) {
      standings[homeTeam].gamesPlayed++;
      standings[homeTeam].runsScored += homeScore;
      standings[homeTeam].runsAllowed += awayScore;
      if (homeScore > awayScore) standings[homeTeam].wins++;
      else if (homeScore < awayScore) standings[homeTeam].losses++;
      else standings[homeTeam].ties++;
    }

    // 客隊
    if (standings[awayTeam]) {
      standings[awayTeam].gamesPlayed++;
      standings[awayTeam].runsScored += awayScore;
      standings[awayTeam].runsAllowed += homeScore;
      if (awayScore > homeScore) standings[awayTeam].wins++;
      else if (awayScore < homeScore) standings[awayTeam].losses++;
      else standings[awayTeam].ties++;
    }
  });

  // 依勝場數、得失分差排序
  return Object.values(standings).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.runsScored - b.runsAllowed - (a.runsScored - a.runsAllowed);
  });
}

// ============================================================
// 打擊指標計算
// ============================================================

/**
 * 計算指定隊伍在指定比賽中的打擊指標
 * @param {Object[]} rows - 比賽逐球資料
 * @param {string} team - 隊伍名稱
 * @returns {Object} 包含全隊與個人打擊指標
 */
function computeBattingStats(rows, team) {
  // 過濾出該隊打擊時的逐球資料
  const teamBatting = rows.filter((r) => r["batting_team"] === team);

  // 只取投球資料（排除換人等動作列）
  const pitchRows = teamBatting.filter((r) => r["isPitch"] === "TRUE");

  // 取出每個打席的最後一球（即打席結果）
  const atBats = {};
  teamBatting.forEach((r) => {
    const abi = r["about.atBatIndex"];
    if (!abi) return;
    if (!atBats[abi]) atBats[abi] = [];
    atBats[abi].push(r);
  });

  // 個別打者統計
  const batterStats = {};

  Object.values(atBats).forEach((abRows) => {
    // 找到此打席的最後一筆有事件結果的資料
    const resultRow = abRows.find(
      (r) => r["result.eventType"] && r["result.eventType"] !== "NA",
    );
    if (!resultRow) return;

    const batterName = getPlayerLocalName(resultRow["matchup.batter.fullName"]);
    const batterId = resultRow["matchup.batter.id"];
    const event = resultRow["result.eventType"] || "";
    const rbi = toNum(resultRow["result.rbi"]) || 0;

    if (!batterStats[batterId]) {
      batterStats[batterId] = {
        name: batterName,
        id: batterId,
        pa: 0,
        ab: 0,
        hits: 0,
        doubles: 0,
        triples: 0,
        hr: 0,
        rbi: 0,
        bb: 0,
        hbp: 0,
        so: 0,
        sf: 0,
        sac: 0,
        ibb: 0,
        swings: 0,
        whiffs: 0,
        outOfZonePitches: 0,
        chases: 0,
        battedBalls: 0,
        sweetSpots: 0,
        launchSpeeds: [], // 擊球初速陣列
        launchAngles: [], // 擊球仰角陣列
        pitchesPerPA: [], // 每打席球數
        re24: 0,          // 得分期望值增加量
      };
    }

    const bs = batterStats[batterId];
    bs.pa++;
    bs.rbi += rbi;

    // 計算每打席被投球數
    const pitchesInAB = abRows.filter((r) => r["isPitch"] === "TRUE").length;
    bs.pitchesPerPA.push(pitchesInAB);

    // 根據事件分類打擊結果
    const isHit = ["single", "double", "triple", "home_run"].includes(event);
    const isAB = ![
      "walk",
      "hit_by_pitch",
      "sac_fly",
      "sac_bunt",
      "sac_fly_double_play",
      "catcher_interf",
      "intent_walk",
    ].includes(event);

    if (isAB) bs.ab++;
    if (isHit) bs.hits++;
    if (event === "double") bs.doubles++;
    if (event === "triple") bs.triples++;
    if (event === "home_run") bs.hr++;
    if (event === "walk" || event === "intent_walk") bs.bb++;
    if (event === "intent_walk") bs.ibb++;
    if (event === "hit_by_pitch") bs.hbp++;
    if (event === "strikeout" || event === "strikeout_double_play") bs.so++;
    if (event === "sac_fly" || event === "sac_fly_double_play") bs.sf++;
    if (event === "sac_bunt") bs.sac++;

    // 收集擊球品質與選球資料
    abRows.forEach((r) => {
      // 處理所有投球（計算 Swing, Whiff, Chase）
      if (r["isPitch"] === "TRUE") {
        const desc = r["details.description"] || "";
        const isSwing = desc.includes("Swinging") || desc.includes("Foul") || desc.includes("In play");
        const isWhiff = desc.includes("Swinging Strike") || desc === "Swinging Strike (Blocked)" || desc.includes("Missed Bunt");
        const zone = toNum(r["pitchData.zone"]);
        const isOutOfZone = zone > 9; // 1-9 為好球帶，11-14 為壞球帶
        
        if (isSwing) bs.swings++;
        if (isWhiff) bs.whiffs++;
        if (isOutOfZone) {
          bs.outOfZonePitches++;
          if (isSwing) bs.chases++;
        }
      }

      // 處理打入場內的球（In Play）
      if (r["details.isInPlay"] === "TRUE") {
        bs.battedBalls++;
        const ev = toNum(r["hitData.launchSpeed"]);
        const la = toNum(r["hitData.launchAngle"]);
        if (ev !== null) bs.launchSpeeds.push(ev);
        if (la !== null) bs.launchAngles.push(la);
        if (la !== null && la >= 8 && la <= 32) bs.sweetSpots++;
      }
    });

    // 計算打席 RE24
    let startOuts = toNum(abRows[0]["count.outs.start"]) || 0;
    let endOuts = toNum(abRows[abRows.length - 1]["count.outs.end"]);
    if (endOuts === null || endOuts === undefined) {
      endOuts = startOuts + (event.includes("out") || event.includes("sacrifice") ? 1 : 0);
      if (event.includes("double_play")) endOuts += 1;
    }
    const startBases = getBasesMask(abRows[0]);
    // 若為打席最後一球，需尋找次一打席的第一球狀況作為 endBases
    let endBases = 0;
    const lastRowIndex = rows.indexOf(abRows[abRows.length - 1]);
    if (lastRowIndex >= 0 && lastRowIndex + 1 < rows.length) {
      const nextRow = rows[lastRowIndex + 1];
      // 如果還在同半局
      if (nextRow["about.halfInning"] === abRows[0]["about.halfInning"] && 
          nextRow["about.inning"] === abRows[0]["about.inning"]) {
        endBases = getBasesMask(nextRow);
      }
    }
    
    // 計算此打席間產生的得分 (Runs Scored)
    const startHomeScore = toNum(abRows[0]["details.homeScore"]) || 0;
    const startAwayScore = toNum(abRows[0]["details.awayScore"]) || 0;
    const endHomeScore = toNum(abRows[abRows.length - 1]["result.homeScore"]) || startHomeScore;
    const endAwayScore = toNum(abRows[abRows.length - 1]["result.awayScore"]) || startAwayScore;
    const runScored = (endHomeScore - startHomeScore) + (endAwayScore - startAwayScore);

    const startRE = getRE(startOuts, startBases);
    const endRE = getRE(endOuts, endBases);
    const re24 = endRE - startRE + runScored;

    bs.tot_re24 = (bs.tot_re24 || 0) + re24;
  });

  // 計算衍生指標
  Object.values(batterStats).forEach((bs) => {
    bs.avg = bs.ab > 0 ? bs.hits / bs.ab : null;
    bs.obp = bs.pa > 0 ? (bs.hits + bs.bb + bs.hbp) / bs.pa : null;
    // SLG = (1B + 2×2B + 3×3B + 4×HR) / AB
    const singles = bs.hits - bs.doubles - bs.triples - bs.hr;
    bs.slg = bs.ab > 0 ? (singles + 2 * bs.doubles + 3 * bs.triples + 4 * bs.hr) / bs.ab : null;
    bs.ops = (bs.obp || 0) + (bs.slg || 0);

    // 新增 wOBA (近似 2024 MLB 權重)
    const uBB = bs.bb - bs.ibb;
    const wOBA_denom = bs.ab + bs.bb - bs.ibb + bs.sf + bs.hbp;
    bs.wOBA = wOBA_denom > 0 ? (0.69 * uBB + 0.72 * bs.hbp + 0.89 * singles + 1.27 * bs.doubles + 1.62 * bs.triples + 2.10 * bs.hr) / wOBA_denom : null;

    bs.bbRate = bs.pa > 0 ? bs.bb / bs.pa : null;
    bs.kRate = bs.pa > 0 ? bs.so / bs.pa : null;
    bs.chasePct = bs.outOfZonePitches > 0 ? bs.chases / bs.outOfZonePitches : null;
    bs.whiffPct = bs.swings > 0 ? bs.whiffs / bs.swings : null;
    bs.sweetSpotPct = bs.battedBalls > 0 ? bs.sweetSpots / bs.battedBalls : null;
    bs.avgEV = avg(bs.launchSpeeds);
    bs.maxEV = maxVal(bs.launchSpeeds);
    bs.avgLA = avg(bs.launchAngles);
    // Hard Hit%: 擊球初速 >= 95 mph 的比例
    const hardHits = bs.launchSpeeds.filter((v) => v >= 95).length;
    bs.hardHitPct =
      bs.launchSpeeds.length > 0 ? hardHits / bs.launchSpeeds.length : null;
    // Barrel%: 最佳擊球品質的比例（EV >= 98 且 LA 在 26-30° 附近）
    // 簡化版 Barrel 定義
    const barrels = bs.launchSpeeds.filter((ev, i) => {
      const la = bs.launchAngles[i];
      if (ev === null || la === null) return false;
      return (
        ev >= 98 &&
        la >= 8 &&
        la <= 50 &&
        la >= 26 - (ev - 98) * 0.5 &&
        la <= 30 + (ev - 98) * 0.5
      );
    }).length;
    bs.barrelPct =
      bs.launchSpeeds.length > 0 ? barrels / bs.launchSpeeds.length : null;
    // P/PA 平均每打席球數
    bs.ppa = avg(bs.pitchesPerPA);
  });

  return Object.values(batterStats).sort((a, b) => b.pa - a.pa);
}


/**
 * 匯總多場比賽的打擊指標
 * @param {Object} allGames - 所有比賽資料
 * @param {string} team - 隊伍名稱
 * @returns {Object[]} 打者累積統計陣列
 */
function computeCumulativeBattingStats(allGames, team) {
  const cumulative = {};

  // 收集台灣隊比賽
  const taiwanGames = Object.values(allGames).filter(({ rows }) => {
    return rows.some(
      (r) => r["batting_team"] === team || r["fielding_team"] === team,
    );
  });

  taiwanGames.forEach(({ rows }) => {
    const gameStats = computeBattingStats(rows, team);
    gameStats.forEach((bs) => {
      if (!cumulative[bs.id]) {
        cumulative[bs.id] = {
          name: bs.name,
          id: bs.id,
          pa: 0,
          ab: 0,
          hits: 0,
          doubles: 0,
          triples: 0,
          hr: 0,
          rbi: 0,
          bb: 0,
          hbp: 0,
          so: 0,
          sf: 0,
          sac: 0,
          ibb: 0,
          swings: 0,
          whiffs: 0,
          outOfZonePitches: 0,
          chases: 0,
          battedBalls: 0,
          sweetSpots: 0,
          launchSpeeds: [],
          launchAngles: [],
          pitchesPerPA: [],
        };
      }
      const c = cumulative[bs.id];
      c.pa += bs.pa;
      c.ab += bs.ab;
      c.hits += bs.hits;
      c.doubles += bs.doubles;
      c.triples += bs.triples;
      c.hr += bs.hr;
      c.rbi += bs.rbi;
      c.bb += bs.bb;
      c.hbp += bs.hbp;
      c.so += bs.so;
      c.sf += bs.sf;
      c.sac += bs.sac;
      c.ibb += bs.ibb;
      c.swings += bs.swings;
      c.whiffs += bs.whiffs;
      c.outOfZonePitches += bs.outOfZonePitches;
      c.chases += bs.chases;
      c.battedBalls += bs.battedBalls;
      c.sweetSpots += bs.sweetSpots;
      c.launchSpeeds.push(...bs.launchSpeeds);
      c.launchAngles.push(...bs.launchAngles);
      c.pitchesPerPA.push(...bs.pitchesPerPA);
      c.tot_re24 = (c.tot_re24 || 0) + bs.tot_re24;
    });
  });

  // 計算累積的平均 RE24
  Object.values(cumulative).forEach(c => {
    c.re24 = c.pa > 0 ? (c.tot_re24 / c.pa) : null;
  });

  // 計算衍生指標
  Object.values(cumulative).forEach((bs) => {
    bs.avg = bs.ab > 0 ? bs.hits / bs.ab : null;
    const obpDenom = bs.ab + bs.bb + bs.hbp + bs.sf;
    bs.obp = obpDenom > 0 ? (bs.hits + bs.bb + bs.hbp) / obpDenom : null;
    const singles = bs.hits - bs.doubles - bs.triples - bs.hr;
    bs.slg = bs.ab > 0 ? (singles + 2 * bs.doubles + 3 * bs.triples + 4 * bs.hr) / bs.ab : null;
    bs.ops = (bs.obp || 0) + (bs.slg || 0);
    
    // wOBA
    const uBB = bs.bb - bs.ibb;
    const wOBA_denom = bs.ab + bs.bb - bs.ibb + bs.sf + bs.hbp;
    bs.wOBA = wOBA_denom > 0 ? (0.69 * uBB + 0.72 * bs.hbp + 0.89 * singles + 1.27 * bs.doubles + 1.62 * bs.triples + 2.10 * bs.hr) / wOBA_denom : null;

    bs.bbRate = bs.pa > 0 ? bs.bb / bs.pa : null;
    bs.kRate = bs.pa > 0 ? bs.so / bs.pa : null;
    bs.chasePct = bs.outOfZonePitches > 0 ? bs.chases / bs.outOfZonePitches : null;
    bs.whiffPct = bs.swings > 0 ? bs.whiffs / bs.swings : null;
    bs.sweetSpotPct = bs.battedBalls > 0 ? bs.sweetSpots / bs.battedBalls : null;
    bs.avgEV = avg(bs.launchSpeeds);
    bs.maxEV = maxVal(bs.launchSpeeds);
    bs.avgLA = avg(bs.launchAngles);
    const hardHits = bs.launchSpeeds.filter((v) => v >= 95).length;
    bs.hardHitPct =
      bs.launchSpeeds.length > 0 ? hardHits / bs.launchSpeeds.length : null;
    bs.ppa = avg(bs.pitchesPerPA);
  });

  return Object.values(cumulative).sort((a, b) => b.pa - a.pa);
}

// ============================================================
// 投球指標計算
// ============================================================

/**
 * 計算指定隊伍在指定比賽中的投球指標
 * @param {Object[]} rows - 比賽逐球資料
 * @param {string} team - 投球隊伍名稱（守備方）
 * @returns {Object[]} 投手統計陣列
 */
function computePitchingStats(rows, team) {
  // 過濾出該隊防守時的投球資料
  const teamPitching = rows.filter(
    (r) => r["fielding_team"] === team && r["isPitch"] === "TRUE",
  );

  // 以打席分組
  const atBats = {};
  rows
    .filter((r) => r["fielding_team"] === team)
    .forEach((r) => {
      const abi = r["about.atBatIndex"];
      if (!abi) return;
      if (!atBats[abi]) atBats[abi] = [];
      atBats[abi].push(r);
    });

  // 按投手分組統計
  const pitcherStats = {};

  // 先處理逐球數據（球速、球種等）
  teamPitching.forEach((r) => {
    const pitcherId = r["matchup.pitcher.id"];
    const pitcherName = getPlayerLocalName(r["matchup.pitcher.fullName"]);

    if (!pitcherStats[pitcherId]) {
      pitcherStats[pitcherId] = {
        name: pitcherName,
        id: pitcherId,
        pitchCount: 0,
        strikes: 0,
        balls: 0,
        swingingStrikes: 0,
        calledStrikes: 0,
        inPlay: 0,
        // 球種統計
        pitchTypes: {},
        // 球速陣列
        speeds: [],
        // 各球種詳細資料（用於圖表）
        pitchDetails: [],
        pitchSequence: { transitions: {} },
      };
    }

    const ps = pitcherStats[pitcherId];
    ps.pitchCount++;

    // 好壞球統計
    if (r["details.isStrike"] === "TRUE") ps.strikes++;
    if (r["details.isBall"] === "TRUE") ps.balls++;
    if (r["details.isInPlay"] === "TRUE") ps.inPlay++;

    // 揮空統計
    const desc = r["details.description"] || "";
    if (
      desc.includes("Swinging Strike") ||
      desc === "Swinging Strike (Blocked)"
    ) {
      ps.swingingStrikes++;
    }
    if (desc === "Called Strike") {
      ps.calledStrikes++;
    }

    // 球種統計
    const pitchType = r["details.type.code"];
    if (pitchType && pitchType !== "NA") {
      if (!ps.pitchTypes[pitchType]) {
        ps.pitchTypes[pitchType] = {
          code: pitchType,
          name: PITCH_TYPE_MAP[pitchType] || pitchType,
          count: 0,
          speeds: [],
          spinRates: [],
          pfxX: [],
          pfxZ: [],
        };
      }
      const pt = ps.pitchTypes[pitchType];
      pt.count++;

      const speed = toNum(r["pitchData.startSpeed"]);
      const spin = toNum(r["pitchData.breaks.spinRate"]);
      const pfxX = toNum(r["pitchData.coordinates.pfxX"]);
      const pfxZ = toNum(r["pitchData.coordinates.pfxZ"]);

      if (speed !== null) {
        pt.speeds.push(speed);
        ps.speeds.push(speed);
      }
      if (spin !== null) pt.spinRates.push(spin);
      if (pfxX !== null) pt.pfxX.push(pfxX);
      if (pfxZ !== null) pt.pfxZ.push(pfxZ);

      // 收集每球詳細（用於位移圖）
      ps.pitchDetails.push({
        type: pitchType,
        typeName: PITCH_TYPE_MAP[pitchType] || pitchType,
        speed: speed,
        spin: spin,
        pfxX: pfxX,
        pfxZ: pfxZ,
        pX: toNum(r["pitchData.coordinates.pX"]),
        pZ: toNum(r["pitchData.coordinates.pZ"]),
        zone: toNum(r["pitchData.zone"]),
        description: desc,
        isStrike: r["details.isStrike"] === "TRUE",
        isBall: r["details.isBall"] === "TRUE",
        isInPlay: r["details.isInPlay"] === "TRUE",
        batter: getPlayerLocalName(r["matchup.batter.fullName"]),
      });
    }
  });

  // 處理打席結果以計算出局數（用於 ERA、P/IP）
  Object.values(atBats).forEach((abRows) => {
    const resultRow = abRows.find(
      (r) => r["result.eventType"] && r["result.eventType"] !== "NA",
    );
    if (!resultRow) return;

    const pitcherId = resultRow["matchup.pitcher.id"];
    if (!pitcherStats[pitcherId]) return;
    const ps = pitcherStats[pitcherId];

    const event = resultRow["result.eventType"] || "";
    let outsStart = toNum(resultRow["count.outs.start"]) || 0;
    let outsEnd = toNum(resultRow["count.outs.end"]);
    if (outsEnd === null || outsEnd === undefined) {
      outsEnd = outsStart + (event.includes("out") || event.includes("sacrifice") ? 1 : 0);
      if (event.includes("double_play")) outsEnd += 1;
    }

    // 初始化額外投手統計
    if (ps.outsRecorded === undefined) {
      ps.outsRecorded = 0;
      ps.earnedRuns = 0;
      ps.hitsAllowed = 0;
      ps.homeRunsAllowed = 0;
      ps.walksAllowed = 0;
      ps.hitByPitch = 0;
      ps.strikeouts = 0;
      ps.tbf = 0;
      ps.firstPitchStrikes = 0;
      ps.firstPitchCount = 0;
      ps.totalRV = 0; // 總 Run Value
    }

    // 出局數
    ps.outsRecorded += outsEnd - outsStart;
    ps.tbf++; // 面對總打席數

    // 安打
    if (["single", "double", "triple", "home_run"].includes(event)) {
      ps.hitsAllowed++;
      if (event === "home_run") ps.homeRunsAllowed++;
    }
    // 保送
    if (["walk", "intent_walk"].includes(event)) ps.walksAllowed++;
    // 觸身死球
    if (event === "hit_by_pitch") ps.hitByPitch++;
    // 三振
    if (["strikeout", "strikeout_double_play"].includes(event)) ps.strikeouts++;

    // 計算此打席的 RE24 防守端減損 (投手的 Run Value)
    const startBases = getBasesMask(abRows[0]);
    let endBases = 0;
    const lastRowIndex = rows.indexOf(abRows[abRows.length - 1]);
    if (lastRowIndex >= 0 && lastRowIndex + 1 < rows.length) {
      const nextRow = rows[lastRowIndex + 1];
      if (nextRow["about.halfInning"] === abRows[0]["about.halfInning"] && 
          nextRow["about.inning"] === abRows[0]["about.inning"]) {
        endBases = getBasesMask(nextRow);
      }
    }
    
    let runScored = 0;
    if (
      resultRow["about.isScoringPlay"] === "TRUE" ||
      resultRow["details.isScoringPlay"] === "TRUE"
    ) {
      runScored = toNum(resultRow["result.rbi"]) || 0;
      ps.earnedRuns += runScored;
    }

    const startRE = getRE(outsStart, startBases);
    const endRE = getRE(outsEnd, endBases);
    const re24_against = endRE - startRE + runScored; 
    // 對投手而言，阻止打者提升 RE 就是貢獻，因此 RV = -(RE24 變化)
    const runValue = -re24_against;
    ps.totalRV += runValue;

    // 將該打席的 RV 平均分配給此打席每個被投出的球 (這是一種簡化的 Pitch RV 分配法)
    const pitchedRows = abRows.filter(r => r["isPitch"] === "TRUE" && r["details.type.code"] !== "NA");
    if (pitchedRows.length > 0) {
      const rvPerPitch = runValue / pitchedRows.length;
      pitchedRows.forEach(r => {
        const pType = r["details.type.code"];
        if (ps.pitchTypes[pType]) {
          ps.pitchTypes[pType].totalRV = (ps.pitchTypes[pType].totalRV || 0) + rvPerPitch;
        }
      });

      // 紀錄配球轉移矩陣 (Pitch Sequencing)
      for (let i = 0; i < pitchedRows.length - 1; i++) {
        const p1 = pitchedRows[i]["details.type.code"];
        const p2 = pitchedRows[i + 1]["details.type.code"];
        if (!ps.pitchSequence.transitions[p1]) ps.pitchSequence.transitions[p1] = {};
        ps.pitchSequence.transitions[p1][p2] = (ps.pitchSequence.transitions[p1][p2] || 0) + 1;
      }
    }

    // 首球好球率
    const firstPitch = abRows.find(
      (r) => r["isPitch"] === "TRUE" && r["pitchNumber"] === "1",
    );
    if (firstPitch) {
      ps.firstPitchCount++;
      if (firstPitch["details.isStrike"] === "TRUE") ps.firstPitchStrikes++;
    }
  });

  // 計算衍生投球指標
  Object.values(pitcherStats).forEach((ps) => {
    const ip = (ps.outsRecorded || 0) / 3;
    ps.ip = ip;
    // 以局數呈現（如 5.2 代表 5⅔ 局）
    ps.ipDisplay = Math.floor(ip) + "." + ((ps.outsRecorded || 0) % 3);
    
    // RA9 (Est. ERA) = (失分 / 局數) × 9
    ps.ra9 = ip > 0 ? (ps.earnedRuns / ip) * 9 : null;
    ps.era = ps.ra9; // 為了前端顯示相容保留這屬性

    // WHIP = (安打 + 保送) / 局數
    ps.whip = ip > 0 ? (ps.hitsAllowed + ps.walksAllowed) / ip : null;

    // FIP = ((13 * HR) + (3 * (BB + HBP)) - (2 * K)) / IP + 3.20 (MLB average Constant)
    ps.fip = ip > 0 ? ((13 * ps.homeRunsAllowed) + (3 * (ps.walksAllowed + ps.hitByPitch)) - (2 * ps.strikeouts)) / ip + 3.20 : null;

    // P/IP 每局投球數
    ps.pip = ip > 0 ? ps.pitchCount / ip : null;
    
    // K% 三振率（以總面對打席數 TBF 為分母）
    ps.kRate = ps.tbf > 0 ? ps.strikeouts / ps.tbf : null;
    
    // 首球好球率
    ps.firstPitchStrikePct = ps.firstPitchCount > 0 ? ps.firstPitchStrikes / ps.firstPitchCount : null;
    
    // 好球率
    ps.strikePct = ps.pitchCount > 0 ? ps.strikes / ps.pitchCount : null;

    // CSW% = (Called Strikes + Swinging Strikes) / Total Pitches
    ps.cswPct = ps.pitchCount > 0 ? (ps.calledStrikes + ps.swingingStrikes) / ps.pitchCount : null;
    // 揮空率 Whiff% = 揮空次數 / 總揮棒次數
    // 平均球速
    ps.avgSpeed = avg(ps.speeds);
    ps.maxSpeed = maxVal(ps.speeds);

    // 各球種衍生指標
    Object.values(ps.pitchTypes).forEach((pt) => {
      pt.avgSpeed = avg(pt.speeds);
      pt.maxSpeed = maxVal(pt.speeds);
      pt.avgSpin = avg(pt.spinRates);
      pt.avgPfxX = avg(pt.pfxX);
      pt.avgPfxZ = avg(pt.pfxZ);
      pt.pct = ps.pitchCount > 0 ? pt.count / ps.pitchCount : 0;
      pt.rv100 = pt.count > 0 ? (pt.totalRV / pt.count) * 100 : 0;
    });
  });

  return Object.values(pitcherStats).sort(
    (a, b) => b.pitchCount - a.pitchCount,
  );
}

/**
 * 匯總多場比賽的投球指標
 * @param {Object} allGames - 所有比賽資料
 * @param {string} team - 隊伍名稱
 * @returns {Object[]} 投手累積統計陣列
 */
function computeCumulativePitchingStats(allGames, team) {
  const cumulative = {};

  const taiwanGames = Object.values(allGames).filter(({ rows }) => {
    return rows.some(
      (r) => r["batting_team"] === team || r["fielding_team"] === team,
    );
  });

  taiwanGames.forEach(({ rows }) => {
    const gameStats = computePitchingStats(rows, team);
    gameStats.forEach((ps) => {
      if (!cumulative[ps.id]) {
        cumulative[ps.id] = {
          name: ps.name,
          id: ps.id,
          pitchCount: 0,
          strikes: 0,
          balls: 0,
          swingingStrikes: 0,
          calledStrikes: 0,
          inPlay: 0,
          speeds: [],
          pitchTypes: {},
          pitchDetails: [],
          outsRecorded: 0,
          earnedRuns: 0,
          hitsAllowed: 0,
          homeRunsAllowed: 0,
          walksAllowed: 0,
          hitByPitch: 0,
          strikeouts: 0,
          tbf: 0,
          firstPitchStrikes: 0,
          firstPitchCount: 0,
          totalRV: 0,
          pitchSequence: { transitions: {} },
        };
      }
      const c = cumulative[ps.id];
      c.pitchCount += ps.pitchCount;
      c.strikes += ps.strikes;
      c.balls += ps.balls;
      c.swingingStrikes += ps.swingingStrikes;
      c.calledStrikes += ps.calledStrikes;
      c.inPlay += ps.inPlay;
      c.speeds.push(...ps.speeds);
      c.pitchDetails.push(...ps.pitchDetails);
      c.outsRecorded += ps.outsRecorded || 0;
      c.earnedRuns += ps.earnedRuns || 0;
      c.hitsAllowed += ps.hitsAllowed || 0;
      c.homeRunsAllowed += ps.homeRunsAllowed || 0;
      c.walksAllowed += ps.walksAllowed || 0;
      c.hitByPitch += ps.hitByPitch || 0;
      c.strikeouts += ps.strikeouts || 0;
      c.tbf += ps.tbf || 0;
      c.firstPitchStrikes += ps.firstPitchStrikes || 0;
      c.firstPitchCount += ps.firstPitchCount || 0;
      c.totalRV += ps.totalRV || 0;

      // 合併球種統計
      Object.entries(ps.pitchTypes).forEach(([code, pt]) => {
        if (!c.pitchTypes[code]) {
          c.pitchTypes[code] = {
            code,
            name: pt.name,
            count: 0,
            speeds: [],
            spinRates: [],
            pfxX: [],
            pfxZ: [],
            totalRV: 0
          };
        }
        const ct = c.pitchTypes[code];
        ct.count += pt.count;
        ct.speeds.push(...pt.speeds);
        ct.spinRates.push(...pt.spinRates);
        ct.pfxX.push(...pt.pfxX);
        ct.pfxZ.push(...pt.pfxZ);
        ct.totalRV += pt.totalRV || 0;
      });

      // 合併配球序列
      if (ps.pitchSequence && ps.pitchSequence.transitions) {
        Object.entries(ps.pitchSequence.transitions).forEach(([p1, targets]) => {
          if (!c.pitchSequence.transitions[p1]) c.pitchSequence.transitions[p1] = {};
          Object.entries(targets).forEach(([p2, count]) => {
            c.pitchSequence.transitions[p1][p2] = (c.pitchSequence.transitions[p1][p2] || 0) + count;
          });
        });
      }
    });
  });

  // 計算衍生指標
  Object.values(cumulative).forEach((ps) => {
    const ip = ps.outsRecorded / 3;
    ps.ip = ip;
    ps.ipDisplay = Math.floor(ip) + "." + (ps.outsRecorded % 3);
    ps.ra9 = ip > 0 ? (ps.earnedRuns / ip) * 9 : null;
    ps.era = ps.ra9;
    ps.whip = ip > 0 ? (ps.hitsAllowed + ps.walksAllowed) / ip : null;
    ps.fip = ip > 0 ? ((13 * ps.homeRunsAllowed) + (3 * (ps.walksAllowed + ps.hitByPitch)) - (2 * ps.strikeouts)) / ip + 3.20 : null;
    ps.pip = ip > 0 ? ps.pitchCount / ip : null;
    ps.kRate = ps.tbf > 0 ? ps.strikeouts / ps.tbf : null;
    ps.firstPitchStrikePct = ps.firstPitchCount > 0 ? ps.firstPitchStrikes / ps.firstPitchCount : null;
    ps.strikePct = ps.pitchCount > 0 ? ps.strikes / ps.pitchCount : null;
    ps.cswPct = ps.pitchCount > 0 ? (ps.calledStrikes + ps.swingingStrikes) / ps.pitchCount : null;
    ps.avgSpeed = avg(ps.speeds);
    ps.maxSpeed = maxVal(ps.speeds);

    Object.values(ps.pitchTypes).forEach((pt) => {
      pt.avgSpeed = avg(pt.speeds);
      pt.maxSpeed = maxVal(pt.speeds);
      pt.avgSpin = avg(pt.spinRates);
      pt.avgPfxX = avg(pt.pfxX);
      pt.avgPfxZ = avg(pt.pfxZ);
      pt.pct = ps.pitchCount > 0 ? pt.count / ps.pitchCount : 0;
      pt.rv100 = pt.count > 0 ? (pt.totalRV / pt.count) * 100 : 0;
    });
  });

  return Object.values(cumulative).sort((a, b) => b.pitchCount - a.pitchCount);
}

// ============================================================
// 選球紀律指標
// ============================================================

/**
 * 計算打者選球紀律指標（Chase%、Whiff%、Contact%）
 * @param {Object[]} rows - 比賽逐球資料
 * @param {string} team - 打者隊伍名稱
 * @returns {Object[]} 打者選球指標陣列
 */
function computeDisciplineStats(rows, team) {
  const teamBatting = rows.filter(
    (r) => r["batting_team"] === team && r["isPitch"] === "TRUE",
  );
  const batterDiscipline = {};

  teamBatting.forEach((r) => {
    const batterId = r["matchup.batter.id"];
    const batterName = getPlayerLocalName(r["matchup.batter.fullName"]);

    if (!batterDiscipline[batterId]) {
      batterDiscipline[batterId] = {
        name: batterName,
        id: batterId,
        totalPitches: 0,
        swings: 0, // 總揮棒
        whiffs: 0, // 揮空
        zonePitches: 0, // 好球帶內投球
        outZonePitches: 0, // 好球帶外投球
        zoneSwings: 0, // 好球帶內揮棒
        outZoneSwings: 0, // 好球帶外揮棒（追打）
      };
    }

    const bd = batterDiscipline[batterId];
    bd.totalPitches++;

    const desc = r["details.description"] || "";
    const zone = toNum(r["pitchData.zone"]);
    const isInZone = zone !== null && zone >= 1 && zone <= 9;
    const isOutZone = zone !== null && zone >= 11 && zone <= 14;

    if (isInZone) bd.zonePitches++;
    if (isOutZone) bd.outZonePitches++;

    // 判斷是否揮棒
    const isSwing =
      desc.includes("Swinging") ||
      desc.includes("Foul") ||
      desc.includes("In play") ||
      r["details.isInPlay"] === "TRUE";

    if (isSwing) {
      bd.swings++;
      if (isInZone) bd.zoneSwings++;
      if (isOutZone) bd.outZoneSwings++;
    }

    // 揮空
    if (
      desc.includes("Swinging Strike") ||
      desc === "Swinging Strike (Blocked)"
    ) {
      bd.whiffs++;
    }
  });

  // 計算衍生選球指標
  Object.values(batterDiscipline).forEach((bd) => {
    // Chase%: 壞球帶揮棒率
    bd.chasePct =
      bd.outZonePitches > 0 ? bd.outZoneSwings / bd.outZonePitches : null;
    // Whiff%: 揮空率
    bd.whiffPct = bd.swings > 0 ? bd.whiffs / bd.swings : null;
    // Contact%: 接觸率
    bd.contactPct = bd.swings > 0 ? 1 - bd.whiffs / bd.swings : null;
    // Z-Swing%: 好球帶出手率
    bd.zSwingPct = bd.zonePitches > 0 ? bd.zoneSwings / bd.zonePitches : null;
  });

  return Object.values(batterDiscipline).sort(
    (a, b) => b.totalPitches - a.totalPitches,
  );
}

// ============================================================
// 擊球品質 — EV × LA 資料（用於散布圖）
// ============================================================

/**
 * 收集所有擊球進場球的 EV/LA 資料（散布圖用）
 * @param {Object[]} rows - 比賽逐球資料
 * @param {string} team - 打擊隊伍名稱
 * @returns {Object[]} 擊球品質資料點陣列
 */
function collectBattedBallData(rows, team) {
  return rows
    .filter(
      (r) => r["batting_team"] === team && r["details.isInPlay"] === "TRUE",
    )
    .map((r) => ({
      batter: getPlayerLocalName(r["matchup.batter.fullName"]),
      batterId: r["matchup.batter.id"],
      pitcher: getPlayerLocalName(r["matchup.pitcher.fullName"]),
      ev: toNum(r["hitData.launchSpeed"]),
      la: toNum(r["hitData.launchAngle"]),
      distance: toNum(r["hitData.totalDistance"]),
      result: r["result.eventType"] || "",
      description: r["result.description"] || "",
      trajectory: r["hitData.trajectory"] || "",
      coordX: toNum(r["hitData.coordinates.coordX"]),
      coordY: toNum(r["hitData.coordinates.coordY"]),
    }))
    .filter((d) => d.ev !== null && d.la !== null);
}

// ============================================================
// 主審好球帶分析
// ============================================================

/**
 * 計算主審好球帶判決資料（用於熱圖）
 * @param {Object[]} rows - 比賽逐球資料
 * @returns {Object} 含正確/誤判投球位置清單
 */
function computeUmpireAnalysis(rows) {
  const pitches = rows.filter((r) => r["isPitch"] === "TRUE");
  const calledPitches = []; // 被判好球或壞球的投球

  pitches.forEach((r) => {
    const desc = r["details.description"] || "";
    const pX = toNum(r["pitchData.coordinates.pX"]);
    const pZ = toNum(r["pitchData.coordinates.pZ"]);
    const szTop = toNum(r["pitchData.strikeZoneTop"]);
    const szBot = toNum(r["pitchData.strikeZoneBottom"]);

    if (pX === null || pZ === null || szTop === null || szBot === null) return;

    // 只分析被判好球(Called Strike)或壞球(Ball)的投球
    if (desc !== "Called Strike" && desc !== "Ball") return;

    // 判定球是否在好球帶內（以本壘板寬度 ±0.83 英尺為邊界）
    const plateHalfWidth = 0.83; // 本壘板半寬（約 10 英寸）
    const isInZone =
      pX >= -plateHalfWidth &&
      pX <= plateHalfWidth &&
      pZ >= szBot &&
      pZ <= szTop;

    const calledStrike = desc === "Called Strike";

    // 判定正確性
    const isCorrect =
      (isInZone && calledStrike) || (!isInZone && !calledStrike);
    const isPhantomStrike = !isInZone && calledStrike; // 幽靈好球
    const isMissedStrike = isInZone && !calledStrike; // 漏判好球

    calledPitches.push({
      pX,
      pZ,
      szTop,
      szBot,
      calledStrike,
      isInZone,
      isCorrect,
      isPhantomStrike,
      isMissedStrike,
      batter: getPlayerLocalName(r["matchup.batter.fullName"]),
      pitcher: getPlayerLocalName(r["matchup.pitcher.fullName"]),
      battingTeam: r["batting_team"],
      inning: toNum(r["about.inning"]),
    });
  });

  // 統計
  const total = calledPitches.length;
  const correct = calledPitches.filter((p) => p.isCorrect).length;
  const phantom = calledPitches.filter((p) => p.isPhantomStrike).length;
  const missed = calledPitches.filter((p) => p.isMissedStrike).length;

  return {
    pitches: calledPitches,
    total,
    correct,
    correctPct: total > 0 ? correct / total : null,
    phantomStrikes: phantom,
    missedStrikes: missed,
  };
}

// ============================================================
// 進階分析：戰術與得分流向 (Sankey Data)
// ============================================================

/**
 * 解析無出局上壘後的戰術效益 (用於 Sankey 圖)
 * @param {Object} allGames - 所有比賽資料
 * @param {string} team - 隊伍名稱
 * @returns {Object} 包含 nodes 與 links 的資料結構
 */
function computeSankeyData(allGames, team) {
  const paths = {
    "犧牲觸擊": { "有得分": 0, "無得分": 0 },
    "盜壘戰術": { "有得分": 0, "無得分": 0 },
    "正常攻擊": { "有得分": 0, "無得分": 0 }
  };

  Object.values(allGames).forEach(({ rows }) => {
    const atBats = {};
    rows.forEach(r => {
      const abi = toNum(r["about.atBatIndex"]);
      if (abi !== null) {
        if (!atBats[abi]) atBats[abi] = [];
        atBats[abi].push(r);
      }
    });

    const atBatKeys = Object.keys(atBats).sort((a,b) => parseInt(a) - parseInt(b));
    let trackedInning = null;
    
    for (let i = 0; i < atBatKeys.length; i++) {
      const abRowList = atBats[atBatKeys[i]];
      const firstRow = abRowList[0];
      if (firstRow["batting_team"] !== team) continue;
      
      const outsStart = toNum(firstRow["count.outs.start"]);
      const inningId = `${firstRow["about.inning"]}_${firstRow["about.halfInning"]}`;
      const bases = getBasesMask(firstRow); // >0 表示有跑者

      if (outsStart === 0 && bases > 0 && trackedInning !== inningId) {
        trackedInning = inningId; 
        const event = abRowList[abRowList.length-1]["result.eventType"] || "";
        
        let strat = "正常攻擊";
        const hasSteal = abRowList.some(r => r["details.event"] && (r["details.event"].includes("Stolen Base") || r["details.event"].includes("Caught Stealing") || r["details.event"].includes("Pickoff")));
        
        if (event.includes("sac_bunt") || event.includes("bunt") || abRowList.some(r => (r["details.description"] || "").includes("Bunt"))) {
            strat = "犧牲觸擊";
        } else if (hasSteal) {
            strat = "盜壘戰術";
        }
        
        // 尋找該半局最終得分
        const isHome = team === firstRow["details.homeTeam"];
        const startScore = isHome ? toNum(firstRow["details.homeScore"]) : toNum(firstRow["details.awayScore"]);
        let endScore = startScore;
        
        for (let j = i; j < atBatKeys.length; j++) {
          const nextAB = atBats[atBatKeys[j]];
          if (nextAB[0]["about.inning"] !== firstRow["about.inning"] || nextAB[0]["about.halfInning"] !== firstRow["about.halfInning"]) {
            break;
          }
          const resRow = nextAB[nextAB.length-1];
          const finalScoreKey = isHome ? "result.homeScore" : "result.awayScore";
          if (resRow[finalScoreKey]) {
            endScore = Math.max(endScore, toNum(resRow[finalScoreKey]));
          }
        }
        
        const scored = (endScore > startScore) ? "有得分" : "無得分";
        paths[strat][scored]++;
      }
    }
  });

  const nodesMap = {};
  const links = [];
  
  function getNode(name) {
    if (nodesMap[name] === undefined) {
      nodesMap[name] = Object.keys(nodesMap).length;
    }
    return nodesMap[name];
  }
  
  const rootName = "無出局上壘";
  Object.keys(paths).forEach(strat => {
    let totalStrat = paths[strat]["有得分"] + paths[strat]["無得分"];
    if (totalStrat > 0) {
      links.push({ source: getNode(rootName), target: getNode(strat), value: totalStrat });
      if (paths[strat]["有得分"] > 0) links.push({ source: getNode(strat), target: getNode("有得分"), value: paths[strat]["有得分"] });
      if (paths[strat]["無得分"] > 0) links.push({ source: getNode(strat), target: getNode("無得分"), value: paths[strat]["無得分"] });
    }
  });

  const nodes = Object.keys(nodesMap).map(k => ({ name: k }));
  return { nodes, links };
}

  /**
   * 計算逆境抗壓王 (兩好球狀態時的打擊表現，並對比常規整體表現)
   * @param {Object} allGamesData
   * @param {string} team
   */
  function computeTwoStrikeData(allGamesData, team) {
    const stats = {};

    Object.values(allGamesData).forEach(({ rows }) => {
      const atBats = {};
      rows.forEach(r => {
        const abIndex = r['about.atBatIndex'];
        if (!atBats[abIndex]) atBats[abIndex] = [];
        atBats[abIndex].push(r);
      });

      Object.values(atBats).forEach(abRows => {
        const resultRow = abRows.find(r => r["result.eventType"] && r["result.eventType"] !== "NA");
        if (!resultRow) return;

        // 確認是否為目標球隊打者 (透過是否有中文姓名翻譯判斷)
        const batterName = getPlayerLocalName(resultRow['matchup.batter.fullName']);
        const assumedTeam = resultRow['about.inningHalf'] === 'top' ? resultRow['away_team'] : resultRow['home_team'];
        const isFocusTeam = batterName !== resultRow['matchup.batter.fullName'] || assumedTeam === team;
        if (!isFocusTeam) return;

        const batterId = resultRow['matchup.batter.id'];
        
        if (!stats[batterId]) {
          stats[batterId] = {
            name: batterName,
            overallPA: 0, overallAB: 0, overallHits: 0,
            twoStrikePA: 0, twoStrikeAB: 0, twoStrikeHits: 0
          };
        }

        const s = stats[batterId];
        const ev = resultRow['result.eventType'].toLowerCase();
        const isAB = !["walk", "hit_by_pitch", "sac_bunt", "sac_fly"].includes(ev);
        const isHit = ["single", "double", "triple", "home_run"].includes(ev);

        // 總計成績
        s.overallPA++;
        if (isAB) s.overallAB++;
        if (isHit) s.overallHits++;

        // 判斷此打席是否曾經遭遇兩好球
        // 如果這個打席內有一球的投球前球數 (count.strikes.start) 為 2，或結果是三振，就代表陷入過兩好球
        const isTwoStrike = abRows.some(r => r['count.strikes.start'] === "2" || (r['result.eventType'] && r['result.eventType'].toLowerCase() === "strikeout"));
        
        if (isTwoStrike) {
          s.twoStrikePA++;
          if (isAB) s.twoStrikeAB++;
          if (isHit) s.twoStrikeHits++;
        }
      });
    });

    const result = Object.values(stats)
      .map(s => {
        const overallAvg = s.overallAB > 0 ? s.overallHits / s.overallAB : 0;
        const twoStrikeAvg = s.twoStrikeAB > 0 ? s.twoStrikeHits / s.twoStrikeAB : 0;
        return {
          name: s.name,
          overallAvg,
          twoStrikeAvg,
          overallPA: s.overallPA,
          twoStrikePA: s.twoStrikePA,
          overallAB: s.overallAB,
          twoStrikeAB: s.twoStrikeAB
        };
      })
      .filter(s => s.overallPA >= 5) // 過濾可用樣本
      .sort((a, b) => b.twoStrikeAvg - a.twoStrikeAvg || b.overallAvg - a.overallAvg);

    return result;
  }

  /**
   * 計算台灣隊的剋星與最愛 (對各球種的打擊率與揮空率)
   * 將球種分為速球系(Fastball)、變化球系(Breaking)、變速球系(Offspeed)
   * 或是直接以單一球種 (FF, SL, CH, CU, FS...) 分類來計算。
   * @param {Object} allGamesData
   * @param {string} team
   */
  function computeKryptoniteData(allGamesData, team) {
    const stats = {};

    Object.values(allGamesData).forEach(({ rows }) => {
      rows.forEach(r => {
        if (r["isPitch"] !== "TRUE") return;

        // 確認是否為目標球隊打者
        const batterName = getPlayerLocalName(r['matchup.batter.fullName']);
        const assumedTeam = r['about.inningHalf'] === 'top' ? r['away_team'] : r['home_team'];
        const isFocusTeam = batterName !== r['matchup.batter.fullName'] || assumedTeam === team;
        if (!isFocusTeam) return;

        const pitchType = r['details.type.code'];
        if (!pitchType || pitchType === "UN" || pitchType === "PO") return; // 忽略未知球種或牽制

        if (!stats[pitchType]) {
          stats[pitchType] = {
            type: pitchType,
            desc: r['details.type.description'] || pitchType,
            ab: 0, hits: 0, 
            swings: 0, whiffs: 0,
            seen: 0
          };
        }

        const s = stats[pitchType];
        s.seen++;

        const call = r['details.description'] || "";
        
        // 揮空計算 (使用與 computeDisciplineStats 一致的判定邏輯)
        const isSwing = call.includes("Swinging") || call.includes("Foul") || call.includes("In play");
        const isWhiff = call.includes("Swinging Strike") || call === "Swinging Strike (Blocked)" || call.includes("Missed Bunt");

        if (isSwing) s.swings++;
        if (isWhiff) {
          s.whiffs++;
        }

        // 當這個 pitch 也是打席結束結果時 (即這球被打出去了或是三振)
        if (r['result.eventType'] && r['result.eventType'] !== "NA") {
            const ev = r['result.eventType'].toLowerCase();
            const isAB = !["walk", "hit_by_pitch", "sac_bunt", "sac_fly"].includes(ev);
            const isHit = ["single", "double", "triple", "home_run"].includes(ev);

            if (isAB) s.ab++;
            if (isHit) s.hits++;
        }
      });
    });

    const result = Object.values(stats)
      .map(s => {
        return {
          type: s.type,
          desc: s.desc,
          seen: s.seen,
          avg: s.ab > 0 ? s.hits / s.ab : 0,
          whiffPct: s.swings > 0 ? s.whiffs / s.swings : 0,
          ab: s.ab
        };
      })
      .filter(s => s.seen >= 10) // 過濾太少見的球種
      .sort((a, b) => b.seen - a.seen);

    return result;
  }

  /**
   * 計算牛棚拆彈圓餅圖與排行 (後援投手在壘上有人時的表現)
   * 成功：出局 / 失敗：被安打、保送、高飛犧牲打
   * @param {Object} allGamesData
   * @param {string} team
   */
  function computeRelieverCrisisData(allGamesData, team) {
    const stats = {
      overall: { crisisPA: 0, success: 0, fail: 0 },
      pitchers: {}
    };

    Object.values(allGamesData).forEach(({ rows }) => {
      // statcast 可能會將近期的資料放前面，為了循序追蹤壘上狀態，必須重排為「由舊到新」
      const sortedRows = [...rows].sort((a, b) => {
         const abA = parseInt(a['about.atBatIndex'] || "0", 10);
         const abB = parseInt(b['about.atBatIndex'] || "0", 10);
         if (abA !== abB) return abA - abB;
         const pA = parseInt(a['pitchNumber'] || "0", 10);
         const pB = parseInt(b['pitchNumber'] || "0", 10);
         return pA - pB;
      });

      let currentHalfInning = "";
      let runnersOnBase = false; // 紀錄前一球結束後的壘上狀態
      let starters = new Set(); // 記錄該場比賽的先發投手

      sortedRows.forEach(r => {
        if (r["isPitch"] !== "TRUE") return;

        const halfInningStr = `${r['about.inning']}-${r['about.inningHalf']}`;
        const pitcherId = r['matchup.pitcher.id'];
        const pitcherName = getPlayerLocalName(r['matchup.pitcher.fullName']);
        
        const assumedDefense = r['about.inningHalf'] === 'top' ? r['home_team'] : r['away_team'];
        const isFocusPitcher = pitcherName !== r['matchup.pitcher.fullName'] || assumedDefense === team;

        if (halfInningStr !== currentHalfInning) {
          currentHalfInning = halfInningStr;
          runnersOnBase = false; // 換局壘上清空
          // 第一局出現的第一個我方投手視為先發
          if (r['about.inning'] === "1" && isFocusPitcher && !starters.has(pitcherId)) {
             starters.add(pitcherId);
          }
        }

        const isReliever = isFocusPitcher && !starters.has(pitcherId);

        // 如果這個 pitch 是打席結束結果時
        if (r['result.eventType'] && r['result.eventType'] !== "NA") {
          // 在壘上有人時，後援投手面對的打席
          if (isReliever && runnersOnBase) {
             if (!stats.pitchers[pitcherId]) {
               stats.pitchers[pitcherId] = { name: pitcherName, crisisPA: 0, success: 0, fail: 0 };
             }
             
             const ev = r['result.eventType'].toLowerCase();
             // 廣義的防線失守：安打、四壞、觸身、高飛犧牲打
             const isFail = ["single", "double", "triple", "home_run", "walk", "hit_by_pitch", "sac_fly"].includes(ev);
             
             stats.overall.crisisPA++;
             stats.pitchers[pitcherId].crisisPA++;

             if (isFail) {
               stats.overall.fail++;
               stats.pitchers[pitcherId].fail++;
             } else {
               stats.overall.success++;
               stats.pitchers[pitcherId].success++;
             }
          }
        }

        // 更新壘上狀態供下一球評估 (過濾掉空殼或 NA)
        const validOn = val => !!val && val !== "NA" && val !== "null";
        const on1b = validOn(r['matchup.postOnFirst.id']);
        const on2b = validOn(r['matchup.postOnSecond.id']);
        const on3b = validOn(r['matchup.postOnThird.id']);
        runnersOnBase = (on1b || on2b || on3b); 
      });
    });

    const pitchersArr = Object.values(stats.pitchers)
      .sort((a, b) => b.crisisPA - a.crisisPA);

    return {
      overall: stats.overall,
      pitchers: pitchersArr
    };
  }

// ============================================================
// 匯出（全域使用）
// ============================================================

window.DataProcessor = {
  GAME_FILES,
  TAIWAN_TEAM,
  GROUP_C_TEAMS,
  PITCH_TYPE_MAP,
  PITCH_COLOR_MAP,
  loadAllGames,
  loadExtendedStats,
  computeGameSummary,
  computeStandings,
  computeBattingStats,
  computeCumulativeBattingStats,
  computePitchingStats,
  computeCumulativePitchingStats,
  computeDisciplineStats,
  collectBattedBallData,
  computeUmpireAnalysis,
  computeSankeyData, // Added this line
  toNum,
  avg,
  maxVal,
  fmt,
  fmtAvg,
  computeHeroRadarStats,
  computeFireballData,
  computeInningScoringData,
  computeRISPData,
  computeTwoStrikeData,
  computeKryptoniteData,
  computeRelieverCrisisData
};

// ============================================================
// Phase 3: 大眾化資料新聞圖表計算 (Data Journalism)
// ============================================================

/**
 * 計算打者的「英雄五圍」能力值 (0~100 分)
 * 五圍：
 * 1. 安打製造機 (AVG): .150 ~ .400
 * 2. 巨砲長打力 (ISO): .000 ~ .300
 * 3. 鷹眼選球 (BB%): 0.0 ~ .15
 * 4. 暴力擊球 (Avg EV): 83mph ~ 95mph
 * 5. 關鍵殺傷力 (wOBA): .250 ~ .450
 */
function computeHeroRadarStats(allGamesData, team) {
  // 取得累積打擊成績
  const cumStats = computeCumulativeBattingStats(allGamesData, team);
  // 只取打席數 pa >= 10 的主力球員
  const qualifiedHitters = cumStats.filter(s => s.pa >= 10);

  // 線性映射 0~100
  const scaleScore = (val, min, max) => {
    if (val === undefined || isNaN(val) || val === null) return 0;
    let score = ((val - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  return qualifiedHitters.map(player => {
    // 安打、長打與整體攻擊的基準分數
    const avgScore = scaleScore(player.avg, 0.150, 0.400);
    const isoScore = scaleScore(player.slg - player.avg, 0.000, 0.300);
    const bbPercentScore = scaleScore(player.bbRate, 0.0, 0.15);
    const evScore = scaleScore(player.avgEV, 83, 95);
    const wobaScore = scaleScore(player.wOBA, 0.250, 0.450);

    return {
      name: player.name,
      id: player.id,
      pa: player.pa,
      axes: [
        { axis: "安打製造機 (AVG)", value: avgScore / 100, score: avgScore },
        { axis: "巨砲長打力 (ISO)", value: isoScore / 100, score: isoScore },
        { axis: "鷹眼選球 (BB%)", value: bbPercentScore / 100, score: bbPercentScore },
        { axis: "暴力擊球 (EV)", value: evScore / 100, score: evScore },
        { axis: "大心臟/長槍 (wOBA)", value: wobaScore / 100, score: wobaScore }
      ]
    };
  }).sort((a, b) => b.pa - a.pa);
}

/**
 * 擷取本賽事台灣隊投手投出的最快 10 顆火球 (Fireball Speedometer)
 * @param {Object} allGamesData - 所有比賽資料
 * @param {string} team - 隊伍名稱
 * @returns {Object[]} 最快的前 10 顆球
 */
function computeFireballData(allGamesData, team) {
  let allPitches = [];
  
  Object.values(allGamesData).forEach(game => {
    // 找出投手為我們隊伍的球
    const myPitches = game.rows.filter(r => r["isPitch"] === "TRUE" && r["fielding_team"] === team);
    
    myPitches.forEach(p => {
      // 速度轉換: mph to km/h (1 mph = 1.60934)
      const speedMph = parseFloat(p["pitchData.startSpeed"] || p.start_speed);
      if (!isNaN(speedMph)) {
        const playerName = p["matchup.pitcher.fullName"] || p.player_name;
        const pitchType = p["details.type.description"] || p.pitch_type;
        const batterName = p["matchup.batter.fullName"] || "";
        const result = p["result.description"] || p.events || "";
        
        allPitches.push({
          pitcherName: getPlayerLocalName(playerName),
          speedMph: speedMph,
          speedKmh: speedMph * 1.60934,
          pitchType: pitchType,
          batterName: getPlayerLocalName(batterName),
          result: result,
          gameDate: p["game_date"]
        });
      }
    });
  });

  // 排序：球速由大到小
  allPitches.sort((a, b) => b.speedKmh - a.speedKmh);

  // 取前 10 名
  return allPitches.slice(0, 10);
}

/**
 * 擷取台灣隊每局總得分與總失分 (Inning Scoring Bar Chart)
 * @param {Object} allGamesData - 所有比賽資料
 * @param {string} team - 隊伍名稱
 * @returns {Object[]} 陣列包含各局得分與失分
 */
function computeInningScoringData(allGamesData, team) {
  let result = [];
  
  Object.values(allGamesData).forEach(({ rows, meta }) => {
    const summary = computeGameSummary(rows, meta);
    if (!summary) return;
    
    const isHome = summary.homeTeam === team;
    const isAway = summary.awayTeam === team;
    if (!isHome && !isAway) return;

    // 確保至少畫到 9 局，若進入延長賽則擴充陣列
    const gameMaxInning = Math.max(
      ...Object.keys(summary.inningScores.home).map(k => parseInt(k, 10)),
      ...Object.keys(summary.inningScores.away).map(k => parseInt(k, 10))
    );
    const targetMaxInning = Math.max(9, gameMaxInning);

    while (result.length < targetMaxInning) {
      result.push({ inning: result.length + 1, scored: 0, allowed: 0 });
    }

    for (let i = 1; i <= targetMaxInning; i++) {
      if (isHome) {
        result[i-1].scored += summary.inningScores.home[i] || 0;
        result[i-1].allowed += summary.inningScores.away[i] || 0;
      } else if (isAway) {
        result[i-1].scored += summary.inningScores.away[i] || 0;
        result[i-1].allowed += summary.inningScores.home[i] || 0;
      }
    }
  });

  return result;
}

/**
 * 計算打者得點圈打擊數據 (RISP Clutch Bubble Chart)
 * @param {Object} allGamesData - 所有比賽資料
 * @param {string} team - 隊伍名稱
 * @returns {Object[]} 陣列包含各打者得點圈數據
 */
function computeRISPData(allGamesData, team) {
  const stats = {};

  Object.values(allGamesData).forEach(({ rows }) => {
    // 僅保留台灣隊為打擊方的資料
    const battingRows = rows.filter(r => r["batting_team"] === team);
    if(battingRows.length === 0) return;

    // 依據半局分組
    const innings = {};
    battingRows.forEach(r => {
      const inningKey = `${r["about.inning"]}_${r["about.halfInning"]}`;
      if (!innings[inningKey]) innings[inningKey] = [];
      innings[inningKey].push(r);
    });

    Object.values(innings).forEach(halfInningRows => {
      // 確保按時間排序
      halfInningRows.sort((a, b) => {
        const abA = parseInt(a["about.atBatIndex"]) || 0;
        const abB = parseInt(b["about.atBatIndex"]) || 0;
        if(abA !== abB) return abA - abB;
        const pA = parseInt(a["pitchNumber"]) || 0;
        const pB = parseInt(b["pitchNumber"]) || 0;
        return pA - pB;
      });

      // 依 atBatIndex 分組
      const atBats = {};
      halfInningRows.forEach(r => {
        const abi = r["about.atBatIndex"];
        if (!atBats[abi]) atBats[abi] = [];
        atBats[abi].push(r);
      });

      const abKeys = Object.keys(atBats).map(Number).sort((a,b)=>a-b);
      
      let prevOn2B = false;
      let prevOn3B = false;

      abKeys.forEach(abi => {
        const abRows = atBats[abi];
        const lastRow = abRows.find(r => r["result.eventType"] && r["result.eventType"] !== "NA") || abRows[abRows.length - 1];
        
        // 判斷這個打席開始時，得點圈是否有人 (透過上一打席的最後一球狀態)
        const isRISP = prevOn2B || prevOn3B;

        if (isRISP && lastRow["result.eventType"]) {
          const rawName = lastRow["matchup.batter.fullName"];
          if (rawName) {
            const batterName = getPlayerLocalName(rawName);
            
            if (!stats[batterName]) {
              stats[batterName] = { name: batterName, pa: 0, ab: 0, hits: 0, rbi: 0 };
            }
            
            const s = stats[batterName];
            s.pa++;
            
            const ev = lastRow["result.eventType"];
            const isHit = ["single", "double", "triple", "home_run"].includes(ev);
            const isAB = !["walk", "hit_by_pitch", "sac_fly", "sac_bunt", "intent_walk"].includes(ev);
            
            if (isAB) s.ab++;
            if (isHit) s.hits++;
            s.rbi += (parseInt(lastRow["result.rbi"]) || 0);
          }
        }
        
        // 更新下一打席的壘上狀態
        prevOn2B = !!(lastRow["matchup.postOnSecond.id"] && lastRow["matchup.postOnSecond.id"] !== "NA");
        prevOn3B = !!(lastRow["matchup.postOnThird.id"] && lastRow["matchup.postOnThird.id"] !== "NA");
      });
    });
  });

  // 計算 AVG 並回傳
  let result = Object.values(stats).map(s => {
    return {
      name: s.name,
      pa: s.pa,
      rbi: s.rbi,
      avg: s.ab > 0 ? s.hits / s.ab : 0
    };
  }).filter(s => s.pa >= 2); // 至少得點圈有2次打席，避免單一隨機事件

  // 排序：先比打點，再比打擊率
  result.sort((a, b) => b.rbi === a.rbi ? b.avg - a.avg : b.rbi - a.rbi);

  return result;
}

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
    file: "data/788118_Korea_vs_Japan_pbp.csv",
    label: "韓國 vs 日本",
    date: "2026-03-07",
  },
  {
    file: "data/788113_ChineseTaipei_vs_Korea_pbp.csv",
    label: "台灣 vs 韓國",
    date: "2026-03-08",
  },
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
 * 取得球員的中英對照姓名
 */
function getPlayerLocalName(engName) {
  if (!engName) return "";
  return TAIWAN_PLAYER_NAMES[engName] || engName;
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
 * @returns {Promise<Object>} 包含所有比賽原始列資料的物件
 */
async function loadAllGames() {
  const results = {};

  for (const game of GAME_FILES) {
    try {
      const response = await fetch(game.file);
      const text = await response.text();
      // 使用 PapaParse 解析 CSV
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      results[game.file] = {
        rows: parsed.data,
        meta: game,
      };
    } catch (err) {
      console.error(`載入 ${game.file} 失敗:`, err);
    }
  }

  return results;
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
  );

  for (let i = 1; i <= 9; i++) {
    const topKey = `${i}_top`;
    const botKey = `${i}_bottom`;

    if (inningLastABI[topKey]) {
      const topEnd = inningLastABI[topKey];
      inningScores.away[i] = (topEnd.as || 0) - prevAwayScore;
      prevAwayScore = topEnd.as || 0;
      prevHomeScore = topEnd.hs || 0;
    } else {
      inningScores.away[i] = 0;
    }

    if (inningLastABI[botKey]) {
      const botEnd = inningLastABI[botKey];
      inningScores.home[i] = (botEnd.hs || 0) - prevHomeScore;
      prevHomeScore = botEnd.hs || 0;
      prevAwayScore = botEnd.as || 0;
    } else {
      inningScores.home[i] = 0;
    }
  }

  return {
    gameId: rows[0]["game_pk"],
    date: meta.date,
    label: meta.label,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    inningScores,
    totalPitches: rows.filter((r) => r["isPitch"] === "TRUE").length,
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
        launchSpeeds: [], // 擊球初速
        launchAngles: [], // 擊球仰角
        pitchesPerPA: [], // 每打席球數
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
    // 計算打數（排除保送、觸身、犧牲等非打數打席）
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
    if (event === "hit_by_pitch") bs.hbp++;
    if (event === "strikeout" || event === "strikeout_double_play") bs.so++;
    if (event === "sac_fly" || event === "sac_fly_double_play") bs.sf++;
    if (event === "sac_bunt") bs.sac++;

    // 收集擊球品質資料（僅限 in-play 的球）
    abRows.forEach((r) => {
      if (r["details.isInPlay"] === "TRUE") {
        const ev = toNum(r["hitData.launchSpeed"]);
        const la = toNum(r["hitData.launchAngle"]);
        if (ev !== null) bs.launchSpeeds.push(ev);
        if (la !== null) bs.launchAngles.push(la);
      }
    });
  });

  // 計算衍生指標
  Object.values(batterStats).forEach((bs) => {
    bs.avg = bs.ab > 0 ? bs.hits / bs.ab : null;
    bs.obp = bs.pa > 0 ? (bs.hits + bs.bb + bs.hbp) / bs.pa : null;
    // SLG = (1B + 2×2B + 3×3B + 4×HR) / AB
    const singles = bs.hits - bs.doubles - bs.triples - bs.hr;
    bs.slg =
      bs.ab > 0
        ? (singles + 2 * bs.doubles + 3 * bs.triples + 4 * bs.hr) / bs.ab
        : null;
    bs.ops = (bs.obp || 0) + (bs.slg || 0);
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
      c.launchSpeeds.push(...bs.launchSpeeds);
      c.launchAngles.push(...bs.launchAngles);
      c.pitchesPerPA.push(...bs.pitchesPerPA);
    });
  });

  // 計算衍生指標
  Object.values(cumulative).forEach((bs) => {
    bs.avg = bs.ab > 0 ? bs.hits / bs.ab : null;
    bs.obp = bs.pa > 0 ? (bs.hits + bs.bb + bs.hbp) / bs.pa : null;
    const singles = bs.hits - bs.doubles - bs.triples - bs.hr;
    bs.slg =
      bs.ab > 0
        ? (singles + 2 * bs.doubles + 3 * bs.triples + 4 * bs.hr) / bs.ab
        : null;
    bs.ops = (bs.obp || 0) + (bs.slg || 0);
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
    const outsEnd = toNum(resultRow["count.outs.end"]) || 0;
    const outsStart = toNum(resultRow["count.outs.start"]) || 0;

    // 初始化額外投手統計
    if (ps.outsRecorded === undefined) {
      ps.outsRecorded = 0;
      ps.earnedRuns = 0;
      ps.hitsAllowed = 0;
      ps.walksAllowed = 0;
      ps.strikeouts = 0;
      ps.battersRetired = 0;
      ps.firstPitchStrikes = 0;
      ps.firstPitchCount = 0;
    }

    // 出局數
    ps.outsRecorded += outsEnd - outsStart;

    // 安打
    if (["single", "double", "triple", "home_run"].includes(event)) {
      ps.hitsAllowed++;
    }
    // 保送
    if (["walk", "intent_walk"].includes(event)) ps.walksAllowed++;
    // 三振
    if (["strikeout", "strikeout_double_play"].includes(event)) ps.strikeouts++;

    // 失分（簡化：使用比分差計算）
    if (
      resultRow["about.isScoringPlay"] === "TRUE" ||
      resultRow["details.isScoringPlay"] === "TRUE"
    ) {
      ps.earnedRuns += toNum(resultRow["result.rbi"]) || 0;
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
    // ERA = (失分 / 局數) × 9
    ps.era = ip > 0 ? (ps.earnedRuns / ip) * 9 : null;
    // P/IP 每局投球數
    ps.pip = ip > 0 ? ps.pitchCount / ip : null;
    // K% 三振率（以打席面對計算）
    ps.kRate =
      ps.pitchCount > 0 ? ps.strikeouts / (ps.firstPitchCount || 1) : null;
    // 首球好球率
    ps.firstPitchStrikePct =
      ps.firstPitchCount > 0 ? ps.firstPitchStrikes / ps.firstPitchCount : null;
    // 好球率
    ps.strikePct = ps.pitchCount > 0 ? ps.strikes / ps.pitchCount : null;
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
          walksAllowed: 0,
          strikeouts: 0,
          firstPitchStrikes: 0,
          firstPitchCount: 0,
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
      c.walksAllowed += ps.walksAllowed || 0;
      c.strikeouts += ps.strikeouts || 0;
      c.firstPitchStrikes += ps.firstPitchStrikes || 0;
      c.firstPitchCount += ps.firstPitchCount || 0;

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
          };
        }
        const ct = c.pitchTypes[code];
        ct.count += pt.count;
        ct.speeds.push(...pt.speeds);
        ct.spinRates.push(...pt.spinRates);
        ct.pfxX.push(...pt.pfxX);
        ct.pfxZ.push(...pt.pfxZ);
      });
    });
  });

  // 計算衍生指標
  Object.values(cumulative).forEach((ps) => {
    const ip = ps.outsRecorded / 3;
    ps.ip = ip;
    ps.ipDisplay = Math.floor(ip) + "." + (ps.outsRecorded % 3);
    ps.era = ip > 0 ? (ps.earnedRuns / ip) * 9 : null;
    ps.pip = ip > 0 ? ps.pitchCount / ip : null;
    ps.kRate =
      ps.firstPitchCount > 0 ? ps.strikeouts / ps.firstPitchCount : null;
    ps.firstPitchStrikePct =
      ps.firstPitchCount > 0 ? ps.firstPitchStrikes / ps.firstPitchCount : null;
    ps.strikePct = ps.pitchCount > 0 ? ps.strikes / ps.pitchCount : null;
    ps.avgSpeed = avg(ps.speeds);
    ps.maxSpeed = maxVal(ps.speeds);

    Object.values(ps.pitchTypes).forEach((pt) => {
      pt.avgSpeed = avg(pt.speeds);
      pt.maxSpeed = maxVal(pt.speeds);
      pt.avgSpin = avg(pt.spinRates);
      pt.avgPfxX = avg(pt.pfxX);
      pt.avgPfxZ = avg(pt.pfxZ);
      pt.pct = ps.pitchCount > 0 ? pt.count / ps.pitchCount : 0;
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
// 匯出（全域使用）
// ============================================================

window.DataProcessor = {
  GAME_FILES,
  TAIWAN_TEAM,
  GROUP_C_TEAMS,
  PITCH_TYPE_MAP,
  PITCH_COLOR_MAP,
  loadAllGames,
  computeGameSummary,
  computeStandings,
  computeBattingStats,
  computeCumulativeBattingStats,
  computePitchingStats,
  computeCumulativePitchingStats,
  computeDisciplineStats,
  collectBattedBallData,
  computeUmpireAnalysis,
  toNum,
  avg,
  maxVal,
  fmt,
  fmtAvg,
};

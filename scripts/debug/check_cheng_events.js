const fs = require('fs');
global.window = {};
eval(fs.readFileSync('./src/dataProcessor.js', 'utf8'));
const Papa = require('papaparse');
const dt = JSON.parse(fs.readFileSync('./data/game_list.json', 'utf8'));
let allData = {};
dt.forEach(g => {
  const content = fs.readFileSync(g.file, 'utf8');
  const parsed = Papa.parse(content, {header: true, skipEmptyLines: true});
  allData[g.file] = { info: g, rows: parsed.data };
});

const team = 'Chinese Taipei';

// Re-implement a bit of the logic from dataProcessor to log Cheng's PAs
const taiwanGames = Object.values(allData).filter(({ rows }) => {
  return rows.some(r => r["batting_team"] === team || r["fielding_team"] === team);
});

console.log("Cheng's At Bats detail:");
let seq = 1;
taiwanGames.forEach(({ info, rows }) => {
  const teamRows = rows.filter(r => r["batting_team"] === team);
  const abs = {};
  teamRows.forEach(r => {
    const abi = r["about.atBatIndex"];
    if (abi !== undefined && abi !== "") {
      if (!abs[abi]) abs[abi] = [];
      abs[abi].push(r);
    }
  });

  Object.values(abs).forEach(abRows => {
    // Determine batter ID
    const pitchRow = abRows.find(r => r["isPitch"] === "TRUE" && r["matchup.batter.id"]);
    const batterId = pitchRow ? pitchRow["matchup.batter.id"] : 
                   (abRows[0]["matchup.batter.id"] || "");
                   
    if (batterId === '691907') {
      let maxEventRow = abRows[0];
      abRows.forEach(r => {
        if (r["about.endTime"] && (!maxEventRow["about.endTime"] || new Date(r["about.endTime"]) > new Date(maxEventRow["about.endTime"]))) {
            maxEventRow = r;
        }
      });
      const event = maxEventRow["result.eventType"];
      const desc = maxEventRow["result.description"];
      console.log(`[${seq++}] ${info.label} - ${event}: ${desc}`);
    }
  });
});

const cumStats = window.DataProcessor.computeCumulativeBattingStats(allData, team);
const cheng = cumStats.find(p => p.id == '691907');
console.log("\nSummary:");
console.log(JSON.stringify({
  pa: cheng.pa,
  ab: cheng.ab,
  hits: cheng.hits,
  doubles: cheng.doubles,
  triples: cheng.triples,
  hr: cheng.hr,
  bb: cheng.bb,
  hbp: cheng.hbp,
  sf: cheng.sf,
  tb: (cheng.hits - cheng.doubles - cheng.triples - cheng.hr) + 2*cheng.doubles + 3*cheng.triples + 4*cheng.hr,
  obp: cheng.obp,
  slg: cheng.slg,
  ops: cheng.ops
}, null, 2));

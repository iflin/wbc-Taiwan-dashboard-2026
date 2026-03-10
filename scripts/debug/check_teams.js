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
const cumStats = window.DataProcessor.computeCumulativeBattingStats(allData, 'Chinese Taipei');
console.log("Total batters:", cumStats.length);
console.log(cumStats.map(p => ({
  name: p.name, 
  pa: p.pa,
  ab: p.ab,
  bb: p.bb,
  hits: p.hits,
  hr: p.hr,
  tb: (p.hits - p.doubles - p.triples - p.hr) + 2*p.doubles + 3*p.triples + 4*p.hr,
  obp: p.obp,
  slg: p.slg,
  ops: p.ops
})));

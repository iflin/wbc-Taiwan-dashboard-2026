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
console.log(cumStats.map(p => ({
  name: p.name,
  pa: p.pa,
  re24: p.re24,
  ops: p.ops
})).sort((a, b) => b.re24 - a.re24));

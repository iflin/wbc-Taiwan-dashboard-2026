const fs = require('fs');
const Papa = require('papaparse');

global.window = {};

const dpCode = fs.readFileSync('./src/dataProcessor.js', 'utf8');
eval(dpCode);

const DataProcessor = window.DataProcessor || global.DataProcessor;

const gameFile = fs.readFileSync('./data/game_list.json', 'utf8');
const gamesList = JSON.parse(gameFile);

let allData = {};
gamesList.forEach(g => {
  const content = fs.readFileSync('./' + g.file, 'utf8');
  const parsed = Papa.parse(content, {header: true, dynamicTyping: true, skipEmptyLines: true});
  allData[g.id] = { info: g, rows: parsed.data };
});

const team = 'TPE';
const cumStats = DataProcessor.computeCumulativeBattingStats(allData, team);

console.log(cumStats.map(p => p.name));
const cheng = cumStats.find(p => p.name.includes('Tsung-Che Cheng') || p.name.includes('鄭宗哲'));
console.log(JSON.stringify(cheng, null, 2));

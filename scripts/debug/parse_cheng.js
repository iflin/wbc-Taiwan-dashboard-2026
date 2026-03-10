const fs = require('fs');
const Papa = require('papaparse');
const path = './data';

const gameFile = fs.readFileSync(path + '/game_list.json', 'utf8');
const gamesList = JSON.parse(gameFile);

let pa = 0;
let ab = 0;
let hits = 0;
let _1b = 0;
let _2b = 0;
let _3b = 0;
let hr = 0;
let bb = 0;
let hbp = 0;
let sf = 0;
let tb = 0;

let atBatsDetails = [];

gamesList.forEach(g => {
  const content = fs.readFileSync(g.file, 'utf8');
  const d = Papa.parse(content, {header: true}).data;
  
  d.forEach(r => {
    // Check if the row belongs to Tsung-Che Cheng
    if (r['matchup.batter.id'] == '691907') { // Tsung-Che Cheng's MLB ID
      const isLastPitch = r['last.pitch.of.ab'] === 'true' || r['last.pitch.of.ab'] === true;
      const isEvent = r['result.eventType'] && r['result.eventType'] !== 'null' && r['result.eventType'] !== '';
      if (isLastPitch && isEvent) {
        pa++;
        const ev = r['result.eventType'];
        let isAB = true;
        
        let paDetail = { game: g.label, event: ev, desc: r['result.description'] };

        if (ev === 'walk') { bb++; isAB = false; }
        else if (ev === 'hit_by_pitch') { hbp++; isAB = false; }
        else if (ev === 'sac_fly') { sf++; isAB = false; }
        else if (ev === 'sac_bunt' || ev === 'sac_bunt_double_play') { isAB = false; }
        
        if (isAB) ab++;

        if (ev === 'single') { hits++; tb += 1; _1b++; }
        else if (ev === 'double') { hits++; tb += 2; _2b++; }
        else if (ev === 'triple') { hits++; tb += 3; _3b++; }
        else if (ev === 'home_run') { hits++; tb += 4; hr++; }
        
        atBatsDetails.push(paDetail);
      }
    }
  });
});

const obp = (ab + bb + hbp + sf) > 0 ? (hits + bb + hbp) / (ab + bb + hbp + sf) : 0;
const slg = ab > 0 ? tb / ab : 0;
const ops = obp + slg;

console.log(JSON.stringify({
  pa, ab, hits, _1b, _2b, _3b, hr, bb, hbp, sf, tb, obp: obp.toFixed(3), slg: slg.toFixed(3), ops: ops.toFixed(3)
}, null, 2));

console.log("\nPAs:");
atBatsDetails.forEach((d, i) => {
  console.log(`[${i+1}] ${d.game} - ${d.event}: ${d.desc}`);
});

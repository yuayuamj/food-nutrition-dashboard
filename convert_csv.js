const fs = require('fs');

function parseFloat2(val) {
  const v = parseFloat(val);
  return isNaN(v) ? null : Math.round(v * 1000) / 1000;
}

// Simple CSV parser that handles quoted fields with commas
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

const raw = fs.readFileSync('nilai-gizi.csv', 'utf8');
const lines = raw.split('\n').filter(l => l.trim() !== '');
const headers = parseCSVLine(lines[0]);
console.log('Headers:', headers);
console.log('Total data rows:', lines.length - 1);

const data = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  if (cols.length < 10) continue;
  const item = {
    name: cols[0] || '',
    manufacturer: cols[1] || '',
    serving_size: cols[2] || '',
    energy_kcal: parseFloat2(cols[3]),
    protein_g: parseFloat2(cols[4]),
    carbohydrate_g: parseFloat2(cols[5]),
    fat_g: parseFloat2(cols[6]),
    sugar_g: parseFloat2(cols[7]),
    sodium_mg: parseFloat2(cols[8]),
    fiber_g: parseFloat2(cols[9]),
    energy_pct_dv: parseFloat2(cols[10]),
    protein_pct_dv: parseFloat2(cols[11]),
    carbohydrate_pct_dv: parseFloat2(cols[12]),
    fat_pct_dv: parseFloat2(cols[13]),
    sodium_pct_dv: parseFloat2(cols[14]),
  };
  data.push(item);
}

fs.writeFileSync('data.json', JSON.stringify(data, null, 2), 'utf8');
console.log(`Wrote ${data.length} records to data.json`);

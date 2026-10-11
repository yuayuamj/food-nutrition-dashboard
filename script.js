/**
 * script.js — Nutrition Food Explorer Dashboard
 * ================================================
 * Vanilla JavaScript (ES6+) — no framework required.
 * Depends on: Chart.js (loaded via CDN in index.html)
 *
 * Architecture:
 *  1.  State    — single source of truth for all UI state
 *  2.  Data     — load & parse data.json, assign unique IDs
 *  3.  Init     — populate filters, compute summaries
 *  4.  Filter   — apply all active filters to allData
 *  5.  Sort     — sort filteredData by selected column
 *  6.  Render   — render summary cards, table, pagination
 *  7.  Modal    — detail nutrition panel
 *  8.  Compare  — select up to 3 items, table + Chart.js
 *  9.  Events   — wire all interactive elements
 *  10. Utils    — helpers (escHtml, fmt, uid)
 */

'use strict';

/* ============================================================
   1. STATE  — mutated by filter/sort/page/compare actions
   ============================================================ */
const state = {
  allData:       [],     // full dataset from data.json
  filteredData:  [],     // subset after applying filters & sort
  currentPage:   1,
  pageSize:      25,

  sortCol: null,         // field name | null
  sortDir: 'asc',        // 'asc' | 'desc'

  filters: {
    name:        '',
    manufacturer:'',
    servingSize: '',
    energyMin:  '', energyMax:  '',
    proteinMin: '', proteinMax: '',
    carbMin:    '', carbMax:    '',
    fatMin:     '', fatMax:     '',
    sugarMin:   '', sugarMax:   '',
    sodiumMax:  '',
    fiberMin:   '',
  },

  compareItems:  [],     // max 3 item objects
};

/* ============================================================
   2. DATA — fetch data.json, assign _uid, boot dashboard
   ============================================================ */
async function loadData() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('File data.json kosong atau tidak berisi array.');
    }
    // Assign a stable unique id to each item
    data.forEach((item, i) => { item._uid = `item-${i}`; });
    state.allData = data;
    initDashboard();
  } catch (err) {
    showErrorBanner(
      `Gagal memuat data: ${err.message}. ` +
      `Pastikan file data.json berada di folder yang sama dengan index.html ` +
      `dan buka melalui Live Server (bukan file://).`
    );
  }
}

/** Render an inline error banner at the top of <main> */
function showErrorBanner(msg) {
  document.getElementById('dataStatus').textContent = 'Error';
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = msg;
  document.querySelector('main').prepend(banner);
}

/* ============================================================
   3. INIT — called once after data loads
   ============================================================ */
function initDashboard() {
  document.getElementById('dataStatus').textContent =
    `${state.allData.length.toLocaleString('id-ID')} item dimuat`;

  populateManufacturerDropdown();
  renderSummaryCards(state.allData); // always full dataset
  applyFilters();                    // sets filteredData + renders table
  wireEvents();
}

/** Build manufacturer <select> options from unique values */
function populateManufacturerDropdown() {
  const select = document.getElementById('filterManufacturer');
  const unique = [...new Set(
    state.allData.map(d => d.manufacturer || 'Tidak Diketahui')
  )].sort((a, b) => a.localeCompare(b, 'id'));

  unique.forEach(mfr => {
    const opt = document.createElement('option');
    opt.value       = mfr;
    opt.textContent = mfr;
    select.appendChild(opt);
  });
}

/* ============================================================
   4. SUMMARY CARDS
   ============================================================ */
function renderSummaryCards(data) {
  document.getElementById('statTotal').textContent =
    data.length.toLocaleString('id-ID');

  /** Compute average of a numeric field, skipping nulls */
  function avg(field) {
    const vals = data
      .map(d => d[field])
      .filter(v => v !== null && v !== undefined && !isNaN(v));
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }

  const e = avg('energy_kcal');
  const p = avg('protein_g');
  const f = avg('fiber_g');

  document.getElementById('statEnergy').textContent  = e !== null ? e.toFixed(1) : '—';
  document.getElementById('statProtein').textContent = p !== null ? p.toFixed(2) : '—';
  document.getElementById('statFiber').textContent   = f !== null ? f.toFixed(2) : '—';
}

/* ============================================================
   5. FILTER
   ============================================================ */
function applyFilters() {
  const f = state.filters;

  state.filteredData = state.allData.filter(item => {

    // Text: name search
    if (f.name &&
        !item.name.toLowerCase().includes(f.name.toLowerCase())) return false;

    // Exact: manufacturer
    if (f.manufacturer && item.manufacturer !== f.manufacturer) return false;

    // Text: serving size contains
    if (f.servingSize &&
        !(item.serving_size || '').toLowerCase()
          .includes(f.servingSize.toLowerCase())) return false;

    /** Returns false if val is outside [min, max], treating empty string as no bound */
    function outOfRange(val, min, max) {
      if (val === null || val === undefined) return true; // exclude nulls when a range is active
      if (min !== '' && !isNaN(min) && val < parseFloat(min)) return true;
      if (max !== '' && !isNaN(max) && val > parseFloat(max)) return true;
      return false;
    }

    // Numeric ranges — only filter when at least one bound is set
    if ((f.energyMin  !== '' || f.energyMax  !== '') && outOfRange(item.energy_kcal,    f.energyMin,  f.energyMax))  return false;
    if ((f.proteinMin !== '' || f.proteinMax !== '') && outOfRange(item.protein_g,       f.proteinMin, f.proteinMax)) return false;
    if ((f.carbMin    !== '' || f.carbMax    !== '') && outOfRange(item.carbohydrate_g,  f.carbMin,    f.carbMax))    return false;
    if ((f.fatMin     !== '' || f.fatMax     !== '') && outOfRange(item.fat_g,           f.fatMin,     f.fatMax))     return false;
    if ((f.sugarMin   !== '' || f.sugarMax   !== '') && outOfRange(item.sugar_g,         f.sugarMin,   f.sugarMax))   return false;

    // Sodium: max only
    if (f.sodiumMax !== '' && !isNaN(f.sodiumMax) &&
        (item.sodium_mg === null || item.sodium_mg > parseFloat(f.sodiumMax))) return false;

    // Fiber: min only
    if (f.fiberMin !== '' && !isNaN(f.fiberMin) &&
        (item.fiber_g === null || item.fiber_g < parseFloat(f.fiberMin))) return false;

    return true;
  });

  state.currentPage = 1;
  applySort();           // sorts in-place then calls renderTable()
}

/* ============================================================
   6. SORT
   ============================================================ */
function applySort() {
  if (state.sortCol) {
    const col = state.sortCol;
    const dir = state.sortDir === 'asc' ? 1 : -1;
    state.filteredData.sort((a, b) => {
      const va = a[col], vb = b[col];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (typeof va === 'string')
        ? va.localeCompare(vb, 'id') * dir
        : (va - vb) * dir;
    });
  }
  renderTable();
}

/** Change active sort column / direction, update header icons */
function setSort(col) {
  if (state.sortCol === col) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortCol = col;
    state.sortDir = 'asc';
  }
  // Reflect in TH elements
  document.querySelectorAll('.sortable-th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === col) {
      th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
  applySort();
}

/* ============================================================
   7. RENDER TABLE + PAGINATION
   ============================================================ */
function renderTable() {
  const tbody      = document.getElementById('tableBody');
  const countEl    = document.getElementById('resultCount');
  const emptyEl    = document.getElementById('emptyState');
  const tableEl    = document.getElementById('foodTable');
  const total      = state.filteredData.length;

  countEl.textContent = `${total.toLocaleString('id-ID')} hasil`;

  // Empty state
  if (total === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    emptyEl.classList.add('flex');
    tableEl.style.display = 'none';
    renderPagination(0);
    return;
  }

  emptyEl.classList.add('hidden');
  emptyEl.classList.remove('flex');
  tableEl.style.display = '';

  // Paginate
  const start  = (state.currentPage - 1) * state.pageSize;
  const end    = Math.min(start + state.pageSize, total);
  const slice  = state.filteredData.slice(start, end);

  // Build set of selected UIDs for fast lookup
  const selectedUIDs = new Set(state.compareItems.map(ci => ci._uid));

  tbody.innerHTML = slice.map(item => {
    const isSelected = selectedUIDs.has(item._uid);
    return `
<tr class="${isSelected ? 'row-selected' : ''}">
  <td class="px-3 py-3 text-center">
    <input
      type="checkbox"
      class="compare-checkbox"
      data-uid="${item._uid}"
      ${isSelected ? 'checked' : ''}
      ${!isSelected && state.compareItems.length >= 3 ? 'disabled' : ''}
      title="Tambahkan ke perbandingan"
    />
  </td>
  <td class="px-4 py-3 font-medium text-gray-800 max-w-xs">
    <span class="block leading-snug">${escHtml(item.name)}</span>
  </td>
  <td class="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">${escHtml(item.manufacturer || '—')}</td>
  <td class="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">${escHtml(item.serving_size || '—')}</td>
  <td class="px-4 py-3 text-right font-mono text-amber-700 tabular-nums">${fmt(item.energy_kcal, 1)}</td>
  <td class="px-4 py-3 text-right font-mono text-blue-700 tabular-nums">${fmt(item.protein_g, 2)}</td>
  <td class="px-4 py-3 text-right font-mono text-purple-700 tabular-nums">${fmt(item.carbohydrate_g, 1)}</td>
  <td class="px-4 py-3 text-right font-mono text-red-600 tabular-nums">${fmt(item.fat_g, 2)}</td>
  <td class="px-4 py-3 text-right font-mono text-pink-600 tabular-nums">${fmt(item.sugar_g, 1)}</td>
  <td class="px-4 py-3 text-right font-mono text-orange-600 tabular-nums">${fmt(item.sodium_mg, 1)}</td>
  <td class="px-4 py-3 text-right font-mono text-green-700 tabular-nums">${fmt(item.fiber_g, 2)}</td>
  <td class="px-4 py-3 text-center">
    <button class="btn-detail" data-uid="${item._uid}">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>
      Lihat
    </button>
  </td>
</tr>`;
  }).join('');

  renderPagination(total);
}

/* ── Pagination ── */
function renderPagination(total) {
  const infoEl     = document.getElementById('paginationInfo');
  const ctrlsEl   = document.getElementById('paginationControls');
  const { currentPage: cur, pageSize } = state;
  const totalPages  = Math.ceil(total / pageSize);
  const start       = total === 0 ? 0 : (cur - 1) * pageSize + 1;
  const end         = Math.min(cur * pageSize, total);

  infoEl.textContent = total === 0
    ? 'Tidak ada hasil'
    : `Menampilkan ${start.toLocaleString('id-ID')}–${end.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} item`;

  if (totalPages <= 1) { ctrlsEl.innerHTML = ''; return; }

  // Build page number list with ellipsis (window of ±2 around current page)
  function buildPages(cur, total) {
    const set   = new Set([1, total]);
    const delta = 2;
    for (let p = Math.max(2, cur - delta); p <= Math.min(total - 1, cur + delta); p++) set.add(p);
    const sorted = [...set].sort((a, b) => a - b);
    const result = [];
    let prev = 0;
    sorted.forEach(p => {
      if (p - prev > 1) result.push('…');
      result.push(p);
      prev = p;
    });
    return result;
  }

  const pages = buildPages(cur, totalPages);
  const html  = [
    `<button class="page-btn" data-page="${cur - 1}" ${cur === 1 ? 'disabled' : ''}>‹</button>`,
    ...pages.map(p =>
      p === '…'
        ? `<span class="page-btn" style="pointer-events:none;border:none;color:#ccc">…</span>`
        : `<button class="page-btn ${p === cur ? 'active' : ''}" data-page="${p}">${p}</button>`
    ),
    `<button class="page-btn" data-page="${cur + 1}" ${cur === totalPages ? 'disabled' : ''}>›</button>`,
  ];
  ctrlsEl.innerHTML = html.join('');
}

/* ============================================================
   8. MODAL — Detail Nutrisi
   ============================================================ */

// Max reference values for 100% bar width (realistic daily upper bounds)
const NUTRIENT_MAX_REF = {
  energy_kcal:    2000,
  protein_g:      60,
  carbohydrate_g: 325,
  fat_g:          67,
  sugar_g:        50,
  sodium_mg:      1500,
  fiber_g:        30,
};

const NUTRIENT_DEFS = [
  { key: 'energy_kcal',    label: 'Energi',      unit: 'kcal', cls: 'bar-energy'  },
  { key: 'protein_g',      label: 'Protein',     unit: 'g',    cls: 'bar-protein' },
  { key: 'carbohydrate_g', label: 'Karbohidrat', unit: 'g',    cls: 'bar-carb'    },
  { key: 'fat_g',          label: 'Lemak',       unit: 'g',    cls: 'bar-fat'     },
  { key: 'sugar_g',        label: 'Gula',        unit: 'g',    cls: 'bar-sugar'   },
  { key: 'sodium_mg',      label: 'Natrium',     unit: 'mg',   cls: 'bar-sodium'  },
  { key: 'fiber_g',        label: 'Serat',       unit: 'g',    cls: 'bar-fiber'   },
];

const DV_DEFS = [
  { key: 'energy_pct_dv',       label: 'Energi'      },
  { key: 'protein_pct_dv',      label: 'Protein'     },
  { key: 'carbohydrate_pct_dv', label: 'Karbohidrat' },
  { key: 'fat_pct_dv',          label: 'Lemak'       },
  { key: 'sodium_pct_dv',       label: 'Natrium'     },
];

function openDetailModal(item) {
  document.getElementById('modalFoodName').textContent     = item.name || '—';
  document.getElementById('modalManufacturer').textContent = `Produsen: ${item.manufacturer || 'Tidak Diketahui'}`;
  document.getElementById('modalServingSize').textContent  = item.serving_size || '—';

  // Nutrient progress bars
  document.getElementById('modalNutrientBars').innerHTML = NUTRIENT_DEFS.map(n => {
    const val     = item[n.key];
    const display = (val !== null && val !== undefined) ? `${val} ${n.unit}` : '—';
    const pct     = (val !== null && val !== undefined)
      ? Math.min(100, (val / NUTRIENT_MAX_REF[n.key]) * 100).toFixed(1)
      : 0;
    return `
<div class="nutrient-bar-wrap">
  <div class="nutrient-bar-label">
    <span>${n.label}</span>
    <span class="font-semibold text-gray-700">${display}</span>
  </div>
  <div class="nutrient-bar-track">
    <div class="nutrient-bar-fill ${n.cls}" style="width:${pct}%"></div>
  </div>
</div>`;
  }).join('');

  // % AKG grid
  document.getElementById('modalDVGrid').innerHTML = DV_DEFS.map(f => {
    const val = item[f.key];
    return `
<div class="dv-card">
  <div class="dv-pct">${(val !== null && val !== undefined) ? val + '%' : '—'}</div>
  <div class="dv-label">${f.label}</div>
</div>`;
  }).join('');

  document.getElementById('modalDetail').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
  document.getElementById('modalDetail').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ============================================================
   9. COMPARISON
   ============================================================ */
let compareChartInstance = null;

function toggleCompare(uid) {
  const idx = state.compareItems.findIndex(ci => ci._uid === uid);
  if (idx !== -1) {
    state.compareItems.splice(idx, 1);
  } else {
    if (state.compareItems.length >= 3) return;
    const item = state.allData.find(d => d._uid === uid);
    if (item) state.compareItems.push(item);
  }
  updateCompareCount();
  renderTable(); // refresh checkboxes + row highlight
}

function updateCompareCount() {
  document.getElementById('compareCount').textContent = state.compareItems.length;
}

function openCompareModal() {
  renderCompareModal();
  document.getElementById('modalCompare').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCompareModal() {
  document.getElementById('modalCompare').classList.add('hidden');
  document.body.style.overflow = '';
}

function renderCompareModal() {
  const items  = state.compareItems;
  const emptyEl    = document.getElementById('compareEmpty');
  const tableWrap  = document.getElementById('compareTableWrapper');

  if (items.length === 0) {
    emptyEl.classList.remove('hidden');
    tableWrap.classList.add('hidden');
    destroyCompareChart();
    document.getElementById('compareSelectedList').innerHTML =
      '<p class="text-xs text-gray-400">Belum ada makanan dipilih.</p>';
    return;
  }

  emptyEl.classList.add('hidden');
  tableWrap.classList.remove('hidden');

  // ── Compare table ──
  const rowDefs = [
    { label: 'Produsen',         key: 'manufacturer',   suffix: ''     },
    { label: 'Ukuran Sajian',    key: 'serving_size',   suffix: ''     },
    { label: 'Energi (kcal)',    key: 'energy_kcal',    suffix: ' kcal'},
    { label: 'Protein (g)',      key: 'protein_g',      suffix: ' g'   },
    { label: 'Karbohidrat (g)',  key: 'carbohydrate_g', suffix: ' g'   },
    { label: 'Lemak (g)',        key: 'fat_g',          suffix: ' g'   },
    { label: 'Gula (g)',         key: 'sugar_g',        suffix: ' g'   },
    { label: 'Natrium (mg)',     key: 'sodium_mg',      suffix: ' mg'  },
    { label: 'Serat (g)',        key: 'fiber_g',        suffix: ' g'   },
    { label: '% AKG Energi',    key: 'energy_pct_dv',  suffix: '%'    },
    { label: '% AKG Protein',   key: 'protein_pct_dv', suffix: '%'    },
  ];

  // Header: label col + food name cols
  document.getElementById('compareHeaderRow').innerHTML =
    '<th class="px-4 py-3 text-left w-36">Nutrisi</th>' +
    items.map(item =>
      `<th class="px-4 py-3 text-right">
        <span class="block font-semibold text-gray-700 leading-snug"
              title="${escHtml(item.name)}">${escHtml(truncate(item.name, 28))}</span>
        <span class="block text-gray-400 font-normal normal-case tracking-normal text-xs">${escHtml(item.serving_size || '—')}</span>
       </th>`
    ).join('');

  // Body rows
  document.getElementById('compareTableBody').innerHTML = rowDefs.map(r => {
    const cells = items.map(item => {
      const v = item[r.key];
      let display;
      if (v === null || v === undefined || v === '') {
        display = '<span class="text-gray-300">—</span>';
      } else if (typeof v === 'string') {
        display = escHtml(v);
      } else {
        display = Number(v).toFixed(1) + escHtml(r.suffix);
      }
      return `<td class="px-4 py-2 text-right">${display}</td>`;
    }).join('');
    return `<tr><td class="px-4 py-2">${r.label}</td>${cells}</tr>`;
  }).join('');

  // Chart
  buildCompareChart(items);

  // Selected badges
  document.getElementById('compareSelectedList').innerHTML = items.map(item => `
<div class="compare-badge">
  <span class="text-gray-700 font-medium">${escHtml(truncate(item.name, 50))}</span>
  <button data-remove-uid="${item._uid}">✕ Hapus</button>
</div>`).join('');
}

/* ── Chart.js grouped bar chart ── */
function buildCompareChart(items) {
  destroyCompareChart();
  if (!items.length) return;

  const ctx = document.getElementById('compareChart');
  const chartNutrients = [
    { label: 'Energi (kcal)', key: 'energy_kcal'   },
    { label: 'Protein (g)',   key: 'protein_g'      },
    { label: 'Karbo (g)',     key: 'carbohydrate_g' },
    { label: 'Lemak (g)',     key: 'fat_g'          },
    { label: 'Natrium (mg)',  key: 'sodium_mg'      },
    { label: 'Serat (g)',     key: 'fiber_g'        },
  ];

  const palette = [
    { bg: 'rgba(78,125,76,0.7)',  border: '#4e7d4c' },
    { bg: 'rgba(59,130,246,0.7)', border: '#3b82f6' },
    { bg: 'rgba(245,158,11,0.7)', border: '#f59e0b' },
  ];

  compareChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   chartNutrients.map(n => n.label),
      datasets: items.map((item, i) => ({
        label:           truncate(item.name, 32),
        data:            chartNutrients.map(n => item[n.key] ?? 0),
        backgroundColor: palette[i].bg,
        borderColor:     palette[i].border,
        borderWidth:     1.5,
        borderRadius:    4,
      })),
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels:   { font: { size: 11 }, boxWidth: 14, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          beginAtZero: true,
          grid:  { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 11 } },
        },
      },
    },
  });
}

function destroyCompareChart() {
  if (compareChartInstance) {
    compareChartInstance.destroy();
    compareChartInstance = null;
  }
}

/* ============================================================
   10. EVENT WIRING
   ============================================================ */
function wireEvents() {

  // ── Debounce helper for text inputs ──
  let filterTimer;
  function scheduleFilter() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(applyFilters, 280);
  }

  // Text filters
  document.getElementById('searchName').addEventListener('input', e => {
    state.filters.name = e.target.value; scheduleFilter();
  });
  document.getElementById('filterServingSize').addEventListener('input', e => {
    state.filters.servingSize = e.target.value; scheduleFilter();
  });

  // Manufacturer select
  document.getElementById('filterManufacturer').addEventListener('change', e => {
    state.filters.manufacturer = e.target.value; applyFilters();
  });

  // Numeric range inputs
  [
    ['filterEnergyMin',  'energyMin'],  ['filterEnergyMax',  'energyMax'],
    ['filterProteinMin', 'proteinMin'], ['filterProteinMax', 'proteinMax'],
    ['filterCarbMin',    'carbMin'],    ['filterCarbMax',    'carbMax'],
    ['filterFatMin',     'fatMin'],     ['filterFatMax',     'fatMax'],
    ['filterSugarMin',   'sugarMin'],   ['filterSugarMax',   'sugarMax'],
    ['filterSodiumMax',  'sodiumMax'],
    ['filterFiberMin',   'fiberMin'],
  ].forEach(([id, key]) => {
    document.getElementById(id).addEventListener('input', e => {
      state.filters[key] = e.target.value; scheduleFilter();
    });
  });

  // ── Reset all filters ──
  document.getElementById('btnResetFilter').addEventListener('click', () => {
    Object.keys(state.filters).forEach(k => { state.filters[k] = ''; });
    document.getElementById('searchName').value         = '';
    document.getElementById('filterManufacturer').value = '';
    document.getElementById('filterServingSize').value  = '';
    [
      'filterEnergyMin','filterEnergyMax',
      'filterProteinMin','filterProteinMax',
      'filterCarbMin','filterCarbMax',
      'filterFatMin','filterFatMax',
      'filterSugarMin','filterSugarMax',
      'filterSodiumMax','filterFiberMin',
    ].forEach(id => { document.getElementById(id).value = ''; });
    applyFilters();
  });

  // ── Page size ──
  document.getElementById('pageSize').addEventListener('change', e => {
    state.pageSize    = parseInt(e.target.value, 10);
    state.currentPage = 1;
    renderTable();
  });

  // ── Column sort (delegated to thead) ──
  document.getElementById('foodTable').querySelector('thead')
    .addEventListener('click', e => {
      const th = e.target.closest('.sortable-th');
      if (th) setSort(th.dataset.col);
    });

  // ── Table body (delegated) — detail button + checkbox ──
  document.getElementById('tableBody').addEventListener('click', e => {
    const detailBtn = e.target.closest('.btn-detail');
    if (detailBtn) {
      const item = state.allData.find(d => d._uid === detailBtn.dataset.uid);
      if (item) openDetailModal(item);
      return;
    }
    const chk = e.target.closest('.compare-checkbox');
    if (chk) toggleCompare(chk.dataset.uid);
  });

  // ── Pagination (delegated) ──
  document.getElementById('paginationControls').addEventListener('click', e => {
    const btn  = e.target.closest('.page-btn');
    if (!btn || btn.disabled) return;
    const page = parseInt(btn.dataset.page, 10);
    if (!page || isNaN(page)) return;
    state.currentPage = page;
    renderTable();
    document.querySelector('[aria-label="Tabel Data Makanan"]')
      .scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Modal detail ──
  document.getElementById('btnCloseModal').addEventListener('click', closeDetailModal);
  document.getElementById('modalBackdrop').addEventListener('click', closeDetailModal);

  // ── Modal compare ──
  document.getElementById('btnOpenCompare').addEventListener('click', openCompareModal);
  document.getElementById('btnCloseCompare').addEventListener('click', closeCompareModal);
  document.getElementById('compareBackdrop').addEventListener('click', closeCompareModal);

  // ── Remove from compare (delegated inside modal) ──
  document.getElementById('compareSelectedList').addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-uid]');
    if (!btn) return;
    toggleCompare(btn.dataset.removeUid);
    renderCompareModal(); // refresh modal contents
  });

  // ── Escape key closes any open modal ──
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeDetailModal();
    closeCompareModal();
  });
}

/* ============================================================
   11. UTILITIES
   ============================================================ */

/** Format a numeric value to fixed decimals; return em-dash markup for null/undefined */
function fmt(val, decimals = 1) {
  if (val === null || val === undefined) return '<span class="text-gray-300">—</span>';
  return Number(val).toFixed(decimals);
}

/** Escape HTML special characters to prevent XSS */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Truncate string to maxLen with ellipsis */
function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

/* ============================================================
   BOOTSTRAP — start everything when DOM is ready
   ============================================================ */
document.addEventListener('DOMContentLoaded', loadData);

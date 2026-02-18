function riskClass(thaiRisk) {
  if (thaiRisk === 'สูง') return 'high';
  if (thaiRisk === 'กลาง') return 'medium';
  return 'low';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

let map;
let provinceLayer;
let provinceGeoJson;

function initMap() {
  if (map) return;
  map = L.map('riskMap', { zoomControl: true, scrollWheelZoom: true }).setView([13.5, 101], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
}

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

function provinceRiskModel(overallRisk, provinceName) {
  // สร้างความต่างรายจังหวัดแบบ deterministic เพื่อเดโม
  const seed = hashString(String(provinceName || '')) % 100;
  if (overallRisk === 'สูง') {
    if (seed < 45) return 'สูง';
    if (seed < 80) return 'กลาง';
    return 'ต่ำ';
  }
  if (overallRisk === 'กลาง') {
    if (seed < 20) return 'สูง';
    if (seed < 70) return 'กลาง';
    return 'ต่ำ';
  }
  // overall ต่ำ
  if (seed < 8) return 'สูง';
  if (seed < 32) return 'กลาง';
  return 'ต่ำ';
}

function colorByRisk(risk) {
  if (risk === 'สูง') return '#ff657d';
  if (risk === 'กลาง') return '#f8c14b';
  return '#35d49a';
}

async function loadProvinceGeoJson() {
  if (provinceGeoJson) return provinceGeoJson;
  const res = await fetch('./data/th-provinces.geojson', { cache: 'force-cache' });
  if (!res.ok) throw new Error(`โหลดชั้นข้อมูลจังหวัดไม่สำเร็จ: ${res.status}`);
  provinceGeoJson = await res.json();
  return provinceGeoJson;
}

async function renderProvinceLayer(overallRisk) {
  initMap();
  const fc = await loadProvinceGeoJson();

  if (provinceLayer) provinceLayer.remove();

  provinceLayer = L.geoJSON(fc, {
    style: (feature) => {
      const name = feature.properties?.name || 'Unknown';
      const risk = provinceRiskModel(overallRisk, name);
      return {
        color: '#e5eeff',
        weight: 0.8,
        fillColor: colorByRisk(risk),
        fillOpacity: 0.62,
      };
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.name || 'Unknown';
      const region = feature.properties?.region || '-';
      const risk = provinceRiskModel(overallRisk, name);
      layer.bindPopup(`<b>${name}</b><br/>ภูมิภาค: ${region}<br/>ระดับความเสี่ยง: <b>${risk}</b>`);
    },
  }).addTo(map);

  const bounds = provinceLayer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [14, 14] });
  }
}

function renderTimeline(items) {
  const box = document.getElementById('timeline');
  box.innerHTML = '';
  (items || []).forEach((item) => {
    const div = document.createElement('div');
    div.className = `event ${item.level || 'low'}`;
    div.innerHTML = `<div style="color:#9fb4dd;font-size:.82rem">${item.time || '-'}</div><div>${item.text || '-'}</div>`;
    box.appendChild(div);
  });
}

function renderIncidents(rows) {
  const body = document.getElementById('incidentBody');
  body.innerHTML = '';
  (rows || []).forEach((r) => {
    const tr = document.createElement('tr');
    const cls = riskClass(r.risk);
    tr.innerHTML = `<td>${r.time || '-'}</td><td>${r.event || '-'}</td><td class="${cls}">${r.risk || '-'}</td><td>${r.impact || '-'}</td>`;
    body.appendChild(tr);
  });
}

async function applyData(data) {
  setText('kp', Number.isFinite(data.kp) ? data.kp.toFixed(1) : '-');
  setText('sw', Number.isFinite(data.solarWind) ? Math.round(data.solarWind) : '-');
  setText('xr', data.xrayClass || '-');
  setText('risk', data.riskLevel || '-');

  const rcls = riskClass(data.riskLevel);
  const riskEl = document.getElementById('risk');
  riskEl.className = `value ${rcls}`;

  setText('kpHint', 'ข้อมูล NOAA ล่าสุด');
  setText('swHint', 'ความเร็วลมสุริยะ');
  setText('xrHint', 'ช่วงพลังงาน 0.1-0.8nm');
  setText('riskHint', data.error ? `โหมดสำรอง: ${data.error}` : 'ประเมินจาก Kp + Solar Wind + X-ray');

  document.getElementById('overall').innerHTML = `สถานะรวม: <b class="${rcls}">${data.riskLevel || '-'}</b>`;
  setText('meta', `แหล่งข้อมูล: ${data.source || '-'} • อัปเดต: ${new Date(data.updatedAt || Date.now()).toLocaleString('th-TH')}`);

  renderTimeline(data.timeline || []);
  renderIncidents(data.incidents || []);
  try {
    await renderProvinceLayer(data.riskLevel || 'ต่ำ');
  } catch (e) {
    console.error(e);
  }
}

async function refreshData() {
  setText('meta', 'กำลังอัปเดตข้อมูลจริง...');
  try {
    const res = await fetch('/api/space-weather', { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    await applyData(data);
  } catch (err) {
    await applyData({
      kp: 4.0,
      solarWind: 500,
      xrayClass: 'C2.0',
      riskLevel: 'กลาง',
      updatedAt: new Date().toISOString(),
      source: 'frontend-fallback',
      error: String(err.message || err),
      timeline: [{ time: new Date().toLocaleTimeString('th-TH'), level: 'medium', text: 'เชื่อม API ไม่สำเร็จ ใช้ข้อมูลสำรอง' }],
      incidents: [{ time: new Date().toLocaleString('th-TH'), event: 'Network Error', risk: 'กลาง', impact: 'ตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์' }],
    });
  }
}

setInterval(refreshData, 5 * 60 * 1000);
refreshData();

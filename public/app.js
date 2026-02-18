function riskClass(thaiRisk) {
  if (thaiRisk === 'สูง') return 'high';
  if (thaiRisk === 'กลาง') return 'medium';
  return 'low';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

const provinceFeatures = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'เชียงใหม่' }, geometry: { type: 'Polygon', coordinates: [[[98.72,18.95],[99.22,18.95],[99.22,18.55],[98.72,18.55],[98.72,18.95]]] } },
    { type: 'Feature', properties: { name: 'ขอนแก่น' }, geometry: { type: 'Polygon', coordinates: [[[102.65,16.65],[103.15,16.65],[103.15,16.25],[102.65,16.25],[102.65,16.65]]] } },
    { type: 'Feature', properties: { name: 'กรุงเทพมหานคร' }, geometry: { type: 'Polygon', coordinates: [[[100.35,13.95],[100.75,13.95],[100.75,13.55],[100.35,13.55],[100.35,13.95]]] } },
    { type: 'Feature', properties: { name: 'ชลบุรี' }, geometry: { type: 'Polygon', coordinates: [[[100.78,13.45],[101.28,13.45],[101.28,13.05],[100.78,13.05],[100.78,13.45]]] } },
    { type: 'Feature', properties: { name: 'สงขลา' }, geometry: { type: 'Polygon', coordinates: [[[100.3,7.3],[100.9,7.3],[100.9,6.9],[100.3,6.9],[100.3,7.3]]] } },
    { type: 'Feature', properties: { name: 'ภูเก็ต' }, geometry: { type: 'Polygon', coordinates: [[[98.2,8.0],[98.5,8.0],[98.5,7.7],[98.2,7.7],[98.2,8.0]]] } },
  ]
};

let map;
let provinceLayer;

function initMap() {
  if (map) return;
  map = L.map('riskMap', { zoomControl: true, scrollWheelZoom: false }).setView([13.6, 101], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
}

function provinceRiskModel(overallRisk) {
  if (overallRisk === 'สูง') {
    return {
      'กรุงเทพมหานคร': 'สูง',
      'ชลบุรี': 'สูง',
      'ขอนแก่น': 'กลาง',
      'เชียงใหม่': 'กลาง',
      'สงขลา': 'กลาง',
      'ภูเก็ต': 'ต่ำ',
    };
  }
  if (overallRisk === 'กลาง') {
    return {
      'กรุงเทพมหานคร': 'กลาง',
      'ชลบุรี': 'กลาง',
      'ขอนแก่น': 'กลาง',
      'เชียงใหม่': 'ต่ำ',
      'สงขลา': 'ต่ำ',
      'ภูเก็ต': 'ต่ำ',
    };
  }
  return {
    'กรุงเทพมหานคร': 'ต่ำ',
    'ชลบุรี': 'ต่ำ',
    'ขอนแก่น': 'ต่ำ',
    'เชียงใหม่': 'ต่ำ',
    'สงขลา': 'ต่ำ',
    'ภูเก็ต': 'ต่ำ',
  };
}

function colorByRisk(risk) {
  if (risk === 'สูง') return '#ff657d';
  if (risk === 'กลาง') return '#f8c14b';
  return '#35d49a';
}

function renderProvinceLayer(overallRisk) {
  initMap();
  const riskByProvince = provinceRiskModel(overallRisk);

  if (provinceLayer) {
    provinceLayer.remove();
  }

  provinceLayer = L.geoJSON(provinceFeatures, {
    style: (feature) => {
      const risk = riskByProvince[feature.properties.name] || 'ต่ำ';
      return {
        color: '#dce7ff',
        weight: 1,
        fillColor: colorByRisk(risk),
        fillOpacity: 0.58,
      };
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties.name;
      const risk = riskByProvince[name] || 'ต่ำ';
      layer.bindPopup(`<b>${name}</b><br/>ระดับความเสี่ยง: <b>${risk}</b>`);
    },
  }).addTo(map);
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

function applyData(data) {
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
  renderProvinceLayer(data.riskLevel || 'ต่ำ');
}

async function refreshData() {
  setText('meta', 'กำลังอัปเดตข้อมูลจริง...');
  try {
    const res = await fetch('/api/space-weather', { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    applyData(data);
  } catch (err) {
    applyData({
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

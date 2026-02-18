function riskClass(thaiRisk) {
  if (thaiRisk === 'สูง') return 'high';
  if (thaiRisk === 'กลาง') return 'medium';
  return 'low';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
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

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 8787;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MOCK = {
  kp: 4.2,
  solarWind: 520,
  xrayClass: 'C3.4',
  riskLevel: 'กลาง',
  updatedAt: new Date().toISOString(),
  source: 'mock-fallback',
  timeline: [{ time: 'เมื่อสักครู่', level: 'medium', text: 'ใช้ข้อมูลสำรองชั่วคราว (API ภายนอกไม่พร้อมใช้งาน)' }],
  incidents: [{ time: 'ล่าสุด', event: 'Fallback Mode', risk: 'กลาง', impact: 'ระบบยังใช้งานได้ด้วยข้อมูลสำรอง' }],
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function serveFile(reqPath, res) {
  let filePath = reqPath === '/' ? '/index.html' : reqPath;
  filePath = path.normalize(filePath).replace(/^\.\.(\/|\\|$)/, '');
  const abs = path.join(PUBLIC_DIR, filePath);
  if (!abs.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(abs, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    const ext = path.extname(abs).toLowerCase();
    const type = ({
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    })[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'openclaw-space-weather-demo' } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function fluxToClass(flux) {
  if (!Number.isFinite(flux) || flux <= 0) return 'A0.0';
  const bands = [
    ['X', 1e-4], ['M', 1e-5], ['C', 1e-6], ['B', 1e-7], ['A', 1e-8],
  ];
  for (const [prefix, base] of bands) {
    if (flux >= base) return `${prefix}${(flux / base).toFixed(1)}`;
  }
  return `A${(flux / 1e-8).toFixed(1)}`;
}

function pickLatestKp(data) {
  const rows = Array.isArray(data) ? data.slice(1) : [];
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  return { time: last[0], value: Number(last[1]) };
}

function pickLatestSolarWind(data) {
  const rows = Array.isArray(data) ? data.slice(1) : [];
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  return { time: last[0], speed: Number(last[2]) };
}

function pickLatestXray(data) {
  const rows = (Array.isArray(data) ? data : []).filter((r) => r?.energy === '0.1-0.8nm' && Number.isFinite(r?.flux));
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  return { time: last.time_tag, className: fluxToClass(Number(last.flux)) };
}

function riskFrom(kp, wind, xrayClass) {
  let score = 0;
  if (kp >= 5) score += 2;
  if (kp >= 7) score += 2;
  if (wind >= 600) score += 1;
  if (wind >= 750) score += 1;
  if (xrayClass.startsWith('M')) score += 1;
  if (xrayClass.startsWith('X')) score += 2;
  if (score >= 5) return 'สูง';
  if (score >= 3) return 'กลาง';
  return 'ต่ำ';
}

function level(risk) {
  return risk === 'สูง' ? 'high' : risk === 'กลาง' ? 'medium' : 'low';
}

function makePayload(kp, wind, xray, updatedAt) {
  const riskLevel = riskFrom(kp, wind, xray);
  const displayTime = new Date(updatedAt).toLocaleString('th-TH');
  return {
    kp,
    solarWind: wind,
    xrayClass: xray,
    riskLevel,
    updatedAt,
    source: 'NOAA SWPC',
    timeline: [
      { time: displayTime, level: level(riskLevel), text: `ระบบประเมินความเสี่ยงรวม: ${riskLevel}` },
      { time: displayTime, level: kp >= 5 ? 'medium' : 'low', text: `Kp Index ปัจจุบัน ${kp.toFixed(1)}` },
      { time: displayTime, level: wind >= 650 ? 'medium' : 'low', text: `Solar Wind ${Math.round(wind)} km/s • X-ray ${xray}` },
    ],
    incidents: [
      { time: displayTime, event: 'Geomagnetic Activity', risk: kp >= 6 ? 'สูง' : kp >= 4 ? 'กลาง' : 'ต่ำ', impact: kp >= 6 ? 'เฝ้าระวัง GNSS และดาวเทียม' : 'ผลกระทบจำกัด' },
      { time: displayTime, event: 'Solar Wind', risk: wind >= 700 ? 'สูง' : wind >= 550 ? 'กลาง' : 'ต่ำ', impact: wind >= 700 ? 'อาจกระทบ ionosphere' : 'ติดตามต่อเนื่อง' },
      { time: displayTime, event: `X-ray Burst (${xray})`, risk: xray.startsWith('X') ? 'สูง' : xray.startsWith('M') ? 'กลาง' : 'ต่ำ', impact: xray.startsWith('X') ? 'อาจรบกวน HF มีนัยสำคัญ' : 'เฝ้าระวังสัญญาณ' },
    ],
  };
}

async function loadSpaceWeather() {
  const [kpRaw, swRaw, xrRaw] = await Promise.all([
    fetchJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
    fetchJson('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json'),
    fetchJson('https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json'),
  ]);

  const kp = pickLatestKp(kpRaw);
  const sw = pickLatestSolarWind(swRaw);
  const xr = pickLatestXray(xrRaw);
  if (!kp || !sw || !xr) throw new Error('Incomplete upstream data');
  return makePayload(kp.value, sw.speed, xr.className, kp.time || sw.time || xr.time || new Date().toISOString());
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);

  if (parsed.pathname === '/health') {
    return sendJson(res, 200, { ok: true, service: 'space-weather-demo', time: new Date().toISOString() });
  }

  if (parsed.pathname === '/api/space-weather') {
    try {
      return sendJson(res, 200, await loadSpaceWeather());
    } catch (err) {
      return sendJson(res, 200, { ...MOCK, error: String(err.message || err) });
    }
  }

  return serveFile(parsed.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Space Weather demo running at http://localhost:${PORT}`);
});

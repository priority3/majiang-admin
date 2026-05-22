import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ========== Server-side IP Geolocation ==========
// Client-side IP lookup removed for security; server resolves IP via ip-api.com
const geoCache = new Map(); // ip → { country, region, city, expire }
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function resolveIP(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: '本地', region: '', city: '' }
  }
  const cached = geoCache.get(ip)
  if (cached && cached.expire > Date.now()) return cached

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`)
    const data = await res.json()
    if (data.status === 'success') {
      const geo = { country: data.country || '', region: data.regionName || '', city: data.city || '', expire: Date.now() + GEO_CACHE_TTL }
      geoCache.set(ip, geo)
      return geo
    }
  } catch {}
  return { country: '', region: '', city: '' }
}

// Extract real client IP from request
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || ''
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3210;
const DATA_DIR = path.resolve(__dirname, '../data');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PUBLIC_DIR = path.resolve(__dirname, '../public');
app.use(express.static(PUBLIC_DIR));

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// 数据文件路径
const TRACK_FILE = path.join(DATA_DIR, 'track.json');
const PV_FILE = path.join(DATA_DIR, 'pv.json');

// 加载数据
function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {}
  return fallback;
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data));
}

// 初始化数据存储
let trackData = loadJSON(TRACK_FILE, { events: [] });
let pvData = loadJSON(PV_FILE, { total: 0, daily: {}, pages: {} });

// ========== 数据上报接口 ==========
app.post('/api/track', async (req, res) => {
  try {
    const event = req.body;

    // 确保 visitorId 存在
    if (!event.visitorId) {
      event.visitorId = `fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }

    event._serverTime = Date.now();

    // Server-side IP geolocation (client-side was removed for security)
    const clientIP = getClientIP(req)
    const geo = await resolveIP(clientIP)
    if (geo.country) event.country = geo.country
    if (geo.region) event.region = geo.region
    if (geo.city) event.city = geo.city
    event._clientIP = clientIP

    trackData.events.push(event);

    // 限制内存：保留最近 50000 条
    if (trackData.events.length > 50000) {
      trackData.events = trackData.events.slice(-50000);
    }

    // 更新 PV 统计
    const today = new Date(event.timestamp).toISOString().slice(0, 10);
    pvData.total++;
    pvData.daily[today] = (pvData.daily[today] || 0) + 1;
    pvData.pages[event.path || '/'] = (pvData.pages[event.path || '/'] || 0) + 1;

    // 定期保存（每 100 条）
    if (trackData.events.length % 100 === 0) {
      saveJSON(TRACK_FILE, trackData);
      saveJSON(PV_FILE, pvData);
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== 数据查询接口 ==========

// 总览数据（支持日期筛选）
app.get('/api/overview', (req, res) => {
  const { startDate, endDate } = req.query;
  let events = trackData.events;
  const now = Date.now();
  const dayMs = 86400000;
  const today = new Date(now).toISOString().slice(0, 10);

  // 日期筛选
  if (startDate) {
    const start = new Date(startDate).getTime();
    events = events.filter(e => e.timestamp >= start);
  }
  if (endDate) {
    const end = new Date(endDate).getTime() + dayMs;
    events = events.filter(e => e.timestamp < end);
  }

  // UV: 去重 visitorId
  const allVisitors = new Set(events.map(e => e.visitorId));
  const todayEvents = events.filter(e => e.timestamp > now - dayMs);
  const todayVisitors = new Set(todayEvents.map(e => e.visitorId));
  const weekEvents = events.filter(e => e.timestamp > now - 7 * dayMs);
  const weekVisitors = new Set(weekEvents.map(e => e.visitorId));

  // PV
  const totalPV = pvData.total;
  const todayPV = pvData.daily[today] || 0;
  const weekPV = Object.entries(pvData.daily)
    .filter(([d]) => d >= new Date(now - 7 * dayMs).toISOString().slice(0, 10))
    .reduce((s, [, c]) => s + c, 0);

  // 游戏数据
  const gameEvents = events.filter(e => e.event === 'game_complete');
  const totalGames = gameEvents.length;
  const todayGames = gameEvents.filter(e => e.timestamp > now - dayMs).length;
  const wins = gameEvents.filter(e => e.isWin).length;
  const avgScore = gameEvents.length > 0
    ? Math.round(gameEvents.reduce((s, e) => s + e.score, 0) / gameEvents.length)
    : 0;

  // 模式分布
  const modeEvents = events.filter(e => e.event === 'mode_select');
  const modeCounts = {};
  modeEvents.forEach(e => { modeCounts[e.mode] = (modeCounts[e.mode] || 0) + 1; });

  // 答题数据
  const answerEvents = events.filter(e => e.event === 'answer');
  const correctAnswers = answerEvents.filter(e => e.correct).length;
  const accuracy = answerEvents.length > 0 ? Math.round(correctAnswers / answerEvents.length * 100) : 0;

  // 设备分布
  const mobileCount = events.filter(e => e.isMobile).length;
  const desktopCount = events.length - mobileCount;

  res.json({
    uv: { total: allVisitors.size, today: todayVisitors.size, week: weekVisitors.size },
    pv: { total: totalPV, today: todayPV, week: weekPV },
    games: { total: totalGames, today: todayGames, winRate: totalGames > 0 ? Math.round(wins / totalGames * 100) : 0, avgScore },
    accuracy: { total: answerEvents.length, correct: correctAnswers, rate: accuracy },
    modes: modeCounts,
    devices: { mobile: mobileCount, desktop: desktopCount },
    today,
  });
});

// PV 趋势（按日）
app.get('/api/pv/trend', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const now = Date.now();
  const trend = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    trend.push({ date: d, pv: pvData.daily[d] || 0 });
  }

  res.json(trend);
});

// 游戏详情
app.get('/api/games', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const games = trackData.events
    .filter(e => e.event === 'game_complete')
    .slice(-limit)
    .reverse()
    .map(e => ({
      mode: e.mode,
      score: e.score,
      isWin: e.isWin,
      duration: e.duration,
      timestamp: e.timestamp,
      visitorId: e.visitorId?.slice(0, 8),
    }));
  res.json(games);
});

// 模式分析
app.get('/api/modes', (req, res) => {
  const events = trackData.events;
  const gameEvents = events.filter(e => e.event === 'game_complete');
  const answerEvents = events.filter(e => e.event === 'answer');

  const modes = ['ting', 'discard', 'pattern', 'speed'];
  const modeNames = { ting: '听牌练习', discard: '出牌练习', pattern: '牌型识别', speed: '速度挑战' };

  const result = modes.map(mode => {
    const mg = gameEvents.filter(e => e.mode === mode);
    const ma = answerEvents.filter(e => e.mode === mode);
    const correct = ma.filter(e => e.correct).length;
    return {
      id: mode,
      name: modeNames[mode],
      games: mg.length,
      wins: mg.filter(e => e.isWin).length,
      avgScore: mg.length > 0 ? Math.round(mg.reduce((s, e) => s + e.score, 0) / mg.length) : 0,
      answers: ma.length,
      correct,
      accuracy: ma.length > 0 ? Math.round(correct / ma.length * 100) : 0,
    };
  });

  res.json(result);
});

// 用户留存（简易版：按日活跃用户）
app.get('/api/retention', (req, res) => {
  const events = trackData.events;
  const dailyUsers = {};

  events.forEach(e => {
    const day = new Date(e.timestamp).toISOString().slice(0, 10);
    if (!dailyUsers[day]) dailyUsers[day] = new Set();
    dailyUsers[day].add(e.visitorId);
  });

  const result = Object.entries(dailyUsers)
    .map(([date, users]) => ({ date, users: users.size }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  res.json(result);
});

// 原始事件（分页）
app.get('/api/events', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const offset = (page - 1) * limit;
  const events = trackData.events.slice().reverse();
  res.json({
    total: events.length,
    page,
    limit,
    data: events.slice(offset, offset + limit),
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    events: trackData.events.length,
    timestamp: new Date().toISOString(),
  });
});

// 用户行为路径分析
app.get('/api/user-journey', (req, res) => {
  const { visitorId } = req.query;
  let events = trackData.events;

  if (visitorId) {
    events = events.filter(e => e.visitorId === visitorId);
  }

  // 按用户分组
  const userMap = {};
  events.forEach(e => {
    if (!userMap[e.visitorId]) {
      userMap[e.visitorId] = { events: [], firstSeen: e.timestamp, lastSeen: e.timestamp };
    }
    userMap[e.visitorId].events.push(e);
    userMap[e.visitorId].lastSeen = Math.max(userMap[e.visitorId].lastSeen, e.timestamp);
    userMap[e.visitorId].firstSeen = Math.min(userMap[e.visitorId].firstSeen, e.timestamp);
  });

  // 计算每个用户的行为摘要
  const users = Object.entries(userMap).map(([id, data]) => {
    const firstEvent = data.events[0] || {};
    const games = data.events.filter(e => e.event === 'game_complete');
    const answers = data.events.filter(e => e.event === 'answer');
    const correct = answers.filter(e => e.correct).length;
    return {
      visitorId: id.slice(0, 8),
      fullVisitorId: id,
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
      totalEvents: data.events.length,
      games: games.length,
      wins: games.filter(e => e.isWin).length,
      answers: answers.length,
      correctAnswers: correct,
      accuracy: answers.length > 0 ? Math.round(correct / answers.length * 100) : 0,
      sessionDuration: Math.round((data.lastSeen - data.firstSeen) / 1000),
      modes: [...new Set(games.map(e => e.mode))],
      // 用户归属信息
      country: firstEvent.country || '',
      region: firstEvent.region || '',
      city: firstEvent.city || '',
      isp: firstEvent.isp || '',
      browser: firstEvent.browser || '',
      os: firstEvent.os || '',
      referrer: firstEvent.referrer || '',
    };
  }).sort((a, b) => b.totalEvents - a.totalEvents);

  res.json({ total: users.length, users: users.slice(0, 100) });
});

// ========== 用户归属分析 ==========

// 地域分布
app.get('/api/attribution/geo', (req, res) => {
  const events = trackData.events;
  const countryMap = {};
  const regionMap = {};
  const cityMap = {};

  events.forEach(e => {
    if (e.country) countryMap[e.country] = (countryMap[e.country] || 0) + 1;
    if (e.region) regionMap[e.region] = (regionMap[e.region] || 0) + 1;
    if (e.city) cityMap[e.city] = (cityMap[e.city] || 0) + 1;
  });

  const sortByCount = (map) => Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  res.json({
    countries: sortByCount(countryMap),
    regions: sortByCount(regionMap),
    cities: sortByCount(cityMap),
  });
});

// 浏览器 & OS 分布
app.get('/api/attribution/browser', (req, res) => {
  const events = trackData.events;
  const browserMap = {};
  const osMap = {};

  events.forEach(e => {
    if (e.browser) browserMap[e.browser] = (browserMap[e.browser] || 0) + 1;
    if (e.os) osMap[e.os] = (osMap[e.os] || 0) + 1;
  });

  const sortByCount = (map) => Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  res.json({
    browsers: sortByCount(browserMap),
    operatingSystems: sortByCount(osMap),
  });
});

// 来源分析（Referrer / UTM）
app.get('/api/attribution/source', (req, res) => {
  const events = trackData.events;
  const referrerMap = {};
  const utmSourceMap = {};

  events.forEach(e => {
    const ref = e.referrer || 'direct';
    // 提取域名
    let domain = ref;
    try {
      if (ref !== 'direct') domain = new URL(ref).hostname;
    } catch {}
    referrerMap[domain] = (referrerMap[domain] || 0) + 1;

    if (e.utmSource) utmSourceMap[e.utmSource] = (utmSourceMap[e.utmSource] || 0) + 1;
  });

  const sortByCount = (map) => Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  res.json({
    referrers: sortByCount(referrerMap),
    utmSources: sortByCount(utmSourceMap),
  });
});

// 设备 & 屏幕分布
app.get('/api/attribution/device', (req, res) => {
  const events = trackData.events;
  const screenMap = {};
  const langMap = {};
  let mobile = 0, desktop = 0, tablet = 0;

  events.forEach(e => {
    if (e.isMobile) mobile++;
    else if (e.isTablet) tablet++;
    else desktop++;

    if (e.screen) screenMap[e.screen] = (screenMap[e.screen] || 0) + 1;
    if (e.lang) langMap[e.lang] = (langMap[e.lang] || 0) + 1;
  });

  const sortByCount = (map) => Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  res.json({
    deviceTypes: { mobile, desktop, tablet },
    screens: sortByCount(screenMap),
    languages: sortByCount(langMap),
  });
});

// 数据导出 - JSON
app.get('/api/export/json', (req, res) => {
  const { type = 'all', days } = req.query;
  let events = trackData.events;

  if (days) {
    const cutoff = Date.now() - parseInt(days) * 86400000;
    events = events.filter(e => e.timestamp > cutoff);
  }

  if (type !== 'all') {
    events = events.filter(e => e.event === type);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="majiang-data-${new Date().toISOString().slice(0,10)}.json"`);
  res.json({ exportTime: new Date().toISOString(), count: events.length, events });
});

// 数据导出 - CSV
app.get('/api/export/csv', (req, res) => {
  const { type = 'all', days } = req.query;
  let events = trackData.events;

  if (days) {
    const cutoff = Date.now() - parseInt(days) * 86400000;
    events = events.filter(e => e.timestamp > cutoff);
  }

  if (type !== 'all') {
    events = events.filter(e => e.event === type);
  }

  const headers = ['timestamp', 'event', 'visitorId', 'sessionId', 'mode', 'score', 'isWin', 'correct', 'duration', 'path', 'isMobile', 'screen'];
  const rows = events.map(e => headers.map(h => {
    const val = e[h];
    if (val === undefined || val === null) return '';
    return String(val).replace(/"/g, '""');
  }).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="majiang-data-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(csv);
});

// 手动保存
app.post('/api/save', (req, res) => {
  saveJSON(TRACK_FILE, trackData);
  saveJSON(PV_FILE, pvData);
  res.json({ ok: true, events: trackData.events.length });
});

// 定期保存（每 5 分钟）
setInterval(() => {
  saveJSON(TRACK_FILE, trackData);
  saveJSON(PV_FILE, pvData);
}, 300000);

// SPA catch-all: serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎯 Majiang Admin running at http://localhost:${PORT}`);
});

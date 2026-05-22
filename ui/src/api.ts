const API_BASE = import.meta.env.VITE_API_URL || '';

export interface OverviewData {
  uv: { total: number; today: number; week: number };
  pv: { total: number; today: number; week: number };
  games: { total: number; today: number; winRate: number; avgScore: number };
  accuracy: { total: number; correct: number; rate: number };
  modes: Record<string, number>;
  devices: { mobile: number; desktop: number };
}

export interface ModeData {
  id: string;
  name: string;
  games: number;
  wins: number;
  avgScore: number;
  answers: number;
  accuracy: number;
}

export interface GameData {
  mode: string;
  score: number;
  isWin: boolean;
  duration: number;
  timestamp: number;
  visitorId: string;
}

export interface UserData {
  visitorId: string;
  fullVisitorId: string;
  firstSeen: number;
  lastSeen: number;
  games: number;
  wins: number;
  answers: number;
  accuracy: number;
  modes: string[];
  country: string;
  region: string;
  city: string;
  browser: string;
  os: string;
  referrer: string;
}

export interface GeoData {
  countries: { name: string; count: number }[];
  regions: { name: string; count: number }[];
  cities: { name: string; count: number }[];
}

export interface BrowserData {
  browsers: { name: string; count: number }[];
  operatingSystems: { name: string; count: number }[];
}

export interface SourceData {
  referrers: { name: string; count: number }[];
  utmSources: { name: string; count: number }[];
}

export interface DeviceData {
  deviceTypes: { mobile: number; desktop: number; tablet: number };
  screens: { name: string; count: number }[];
  languages: { name: string; count: number }[];
}

export interface PvTrend {
  date: string;
  pv: number;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  getOverview: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString();
    return fetchJSON<OverviewData>(`/api/overview${qs ? '?' + qs : ''}`);
  },
  getPvTrend: (days = 14) => fetchJSON<PvTrend[]>(`/api/pv/trend?days=${days}`),
  getModes: () => fetchJSON<ModeData[]>('/api/modes'),
  getGames: (limit = 50) => fetchJSON<GameData[]>(`/api/games?limit=${limit}`),
  getUsers: () => fetchJSON<{ total: number; users: UserData[] }>('/api/user-journey'),
  getGeo: () => fetchJSON<GeoData>('/api/attribution/geo'),
  getBrowser: () => fetchJSON<BrowserData>('/api/attribution/browser'),
  getSource: () => fetchJSON<SourceData>('/api/attribution/source'),
  getDevice: () => fetchJSON<DeviceData>('/api/attribution/device'),
  getEvents: (limit = 100) => fetchJSON<{ total: number; data: Record<string, unknown>[] }>(`/api/events?limit=${limit}`),
};

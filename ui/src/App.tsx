import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import WorldMap from './components/WorldMap'
import { api, type OverviewData, type ModeData, type UserData, type GeoData, type BrowserData, type SourceData, type DeviceData, type PvTrend, type GameData } from './api'

const MODE_ICONS: Record<string, string> = { ting: '🀄', discard: '🎯', pattern: '🧩', speed: '⚡' }
const MODE_NAMES: Record<string, string> = { ting: '听牌练习', discard: '出牌练习', pattern: '牌型识别', speed: '速度挑战' }
const MODE_COLORS: Record<string, string> = { ting: '#38bdf8', discard: '#a78bfa', pattern: '#fbbf24', speed: '#4ade80' }
const CHART_COLORS = ['#38bdf8', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']

function fmt(n?: number) { return n?.toLocaleString() ?? '-' }

function BarChart({ data, height = 100 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all relative group cursor-pointer hover:opacity-80"
          style={{ height: `${(d.value / max) * 100}%`, background: d.color || 'var(--color-primary)', minWidth: 4 }}
        >
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {d.label}: {d.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{icon} {value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

export default function App() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [pvTrend, setPvTrend] = useState<PvTrend[]>([])
  const [modes, setModes] = useState<ModeData[]>([])
  const [games, setGames] = useState<GameData[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [geo, setGeo] = useState<GeoData | null>(null)
  const [browser, setBrowser] = useState<BrowserData | null>(null)
  const [source, setSource] = useState<SourceData | null>(null)
  const [device, setDevice] = useState<DeviceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [o, p, m, g, u, ge, b, s, d] = await Promise.all([
        api.getOverview(),
        api.getPvTrend(14),
        api.getModes(),
        api.getGames(50),
        api.getUsers(),
        api.getGeo(),
        api.getBrowser(),
        api.getSource(),
        api.getDevice(),
      ])
      setOverview(o)
      setPvTrend(p)
      setModes(m)
      setGames(g)
      setUsers(u.users || [])
      setGeo(ge)
      setBrowser(b)
      setSource(s)
      setDevice(d)
      setLastUpdate(new Date().toLocaleString('zh-CN'))
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🀄 麻将练习场 <span className="text-primary">管理后台</span></h1>
            <p className="text-xs text-muted-foreground">{lastUpdate}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              实时追踪
            </span>
            <Button size="sm" onClick={loadData}>刷新</Button>
            <a href="/api/export/json" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80">导出 JSON</a>
            <a href="/api/export/csv" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 bg-success/15 text-success hover:bg-success/25">导出 CSV</a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="pv">PV/UV</TabsTrigger>
            <TabsTrigger value="games">游戏数据</TabsTrigger>
            <TabsTrigger value="modes">模式分析</TabsTrigger>
            <TabsTrigger value="users">用户分析</TabsTrigger>
            <TabsTrigger value="attribution">用户归属</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard title="今日 PV" value={fmt(overview?.pv.today)} subtitle={`总 PV: ${fmt(overview?.pv.total)}`} icon="👁" />
              <StatCard title="今日 UV" value={fmt(overview?.uv.today)} subtitle={`总 UV: ${fmt(overview?.uv.total)}`} icon="👤" />
              <StatCard title="今日游戏" value={fmt(overview?.games.today)} subtitle={`总游戏: ${fmt(overview?.games.total)}`} icon="🎮" />
              <StatCard title="总胜率" value={`${overview?.games.winRate ?? 0}%`} subtitle={`平均分: ${overview?.games.avgScore ?? 0}`} icon="🏆" />
            </div>
            <Card className="mb-6">
              <CardHeader><CardTitle className="text-base">📈 PV 趋势（近 14 天）</CardTitle></CardHeader>
              <CardContent><BarChart data={pvTrend.map(d => ({ label: d.date.slice(5), value: d.pv }))} height={120} /></CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">🎯 答题准确率</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-success">{overview?.accuracy.rate ?? 0}%</div>
                  <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full transition-all" style={{ width: `${overview?.accuracy.rate ?? 0}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">答对 {overview?.accuracy.correct ?? 0} / {overview?.accuracy.total ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">📱 设备分布</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex gap-8">
                    <div className="flex-1 text-center">
                      <div className="text-2xl">📱</div>
                      <div className="text-2xl font-bold text-primary">{overview?.devices.mobile ?? 0}</div>
                      <div className="text-xs text-muted-foreground">移动端</div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-2xl">🖥️</div>
                      <div className="text-2xl font-bold text-purple">{overview?.devices.desktop ?? 0}</div>
                      <div className="text-xs text-muted-foreground">桌面端</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pv">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard title="总 PV" value={fmt(overview?.pv.total)} icon="👁" />
              <StatCard title="本周 PV" value={fmt(overview?.pv.week)} icon="📊" />
              <StatCard title="今日 PV" value={fmt(overview?.pv.today)} icon="📅" />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">📊 每日 PV 趋势</CardTitle></CardHeader>
              <CardContent><BarChart data={pvTrend.map(d => ({ label: d.date.slice(5), value: d.pv }))} height={160} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="games">
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard title="总游戏数" value={fmt(overview?.games.total)} icon="🎮" />
              <StatCard title="胜率" value={`${overview?.games.winRate ?? 0}%`} icon="🏆" />
              <StatCard title="平均分" value={fmt(overview?.games.avgScore)} icon="⭐" />
              <StatCard title="今日游戏" value={fmt(overview?.games.today)} icon="📅" />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">🎮 最近游戏</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground">模式</th>
                      <th className="text-left py-2 text-muted-foreground">得分</th>
                      <th className="text-left py-2 text-muted-foreground">结果</th>
                      <th className="text-left py-2 text-muted-foreground">时间</th>
                    </tr></thead>
                    <tbody>
                      {games.map((g, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2"><Badge variant="info">{MODE_ICONS[g.mode]} {MODE_NAMES[g.mode]}</Badge></td>
                          <td className="py-2 font-bold" style={{ color: g.score > 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}>{g.score}</td>
                          <td className="py-2">{g.isWin ? <Badge variant="success">胜</Badge> : <Badge variant="destructive">负</Badge>}</td>
                          <td className="py-2 text-muted-foreground">{new Date(g.timestamp).toLocaleString('zh-CN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modes">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {modes.map(m => (
                <Card key={m.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: `${MODE_COLORS[m.id]}20` }}>{MODE_ICONS[m.id]}</div>
                      <div>
                        <div className="font-semibold">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.games} 场游戏</div>
                      </div>
                    </div>
                    <div className="text-3xl font-bold" style={{ color: MODE_COLORS[m.id] }}>{m.accuracy}%</div>
                    <div className="text-xs text-muted-foreground">准确率 · {m.answers} 次答题</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">📊 准确率对比</CardTitle></CardHeader>
                <CardContent><BarChart data={modes.map(m => ({ label: m.name, value: m.accuracy, color: MODE_COLORS[m.id] }))} height={120} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">🎮 游戏数对比</CardTitle></CardHeader>
                <CardContent><BarChart data={modes.map(m => ({ label: m.name, value: m.games, color: MODE_COLORS[m.id] }))} height={120} /></CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard title="总用户数" value={users.length} icon="👤" />
              <StatCard title="活跃用户（今日）" value={overview?.uv.today ?? 0} icon="🔥" />
              <StatCard title="平均游戏数" value={users.length > 0 ? Math.round(users.reduce((s, u) => s + u.games, 0) / users.length) : 0} icon="🎮" />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">👤 用户行为摘要</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground">用户 ID</th>
                      <th className="text-left py-2 text-muted-foreground">地区</th>
                      <th className="text-left py-2 text-muted-foreground">浏览器</th>
                      <th className="text-left py-2 text-muted-foreground">来源</th>
                      <th className="text-left py-2 text-muted-foreground">游戏数</th>
                      <th className="text-left py-2 text-muted-foreground">准确率</th>
                      <th className="text-left py-2 text-muted-foreground">偏好模式</th>
                    </tr></thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 font-mono text-xs text-primary">{u.visitorId}</td>
                          <td className="py-2">{u.city || u.region || u.country || '-'}</td>
                          <td className="py-2">{u.browser || '-'}</td>
                          <td className="py-2 max-w-[120px] truncate text-muted-foreground" title={u.referrer}>{u.referrer === 'direct' ? '直接访问' : u.referrer}</td>
                          <td className="py-2">{u.games}</td>
                          <td className="py-2"><Badge variant={u.accuracy >= 70 ? 'success' : u.accuracy >= 40 ? 'warning' : 'destructive'}>{u.accuracy}%</Badge></td>
                          <td className="py-2">{u.modes.map(m => <Badge key={m} variant="info" className="mr-1">{MODE_ICONS[m]} {MODE_NAMES[m]}</Badge>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attribution">
            <Card className="mb-6">
              <CardHeader><CardTitle className="text-base">🌍 全球访问分布</CardTitle></CardHeader>
              <CardContent>
                <WorldMap countries={geo?.countries || []} height={360} />
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card>
                <CardHeader><CardTitle className="text-base">🗺️ 国家/地区排名</CardTitle></CardHeader>
                <CardContent>
                  <BarChart data={(geo?.countries || []).slice(0, 10).map((c, i) => ({ label: c.name, value: c.count, color: CHART_COLORS[i % 6] }))} height={140} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">📱 设备类型</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex gap-6 justify-center">
                    <div className="text-center"><div className="text-2xl">📱</div><div className="text-xl font-bold text-primary">{device?.deviceTypes.mobile ?? 0}</div><div className="text-xs text-muted-foreground">移动端</div></div>
                    <div className="text-center"><div className="text-2xl">🖥️</div><div className="text-xl font-bold text-purple">{device?.deviceTypes.desktop ?? 0}</div><div className="text-xs text-muted-foreground">桌面端</div></div>
                    <div className="text-center"><div className="text-2xl">📋</div><div className="text-xl font-bold text-warning">{device?.deviceTypes.tablet ?? 0}</div><div className="text-xs text-muted-foreground">平板</div></div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card>
                <CardHeader><CardTitle className="text-base">🌐 浏览器分布</CardTitle></CardHeader>
                <CardContent><BarChart data={(browser?.browsers || []).slice(0, 6).map((b, i) => ({ label: b.name, value: b.count, color: CHART_COLORS[i % 6] }))} height={100} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">💻 操作系统分布</CardTitle></CardHeader>
                <CardContent><BarChart data={(browser?.operatingSystems || []).slice(0, 6).map((o, i) => ({ label: o.name, value: o.count, color: CHART_COLORS[i % 6] }))} height={100} /></CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">🔗 来源分析</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(source?.referrers || []).slice(0, 8).map((r, i) => {
                      const total = source?.referrers.reduce((s, x) => s + x.count, 0) || 1
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-sm w-32 truncate">{r.name === 'direct' ? '🔗 直接访问' : r.name}</span>
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(r.count / total) * 100}%` }} /></div>
                          <span className="text-xs text-muted-foreground w-12 text-right">{r.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">🗣️ 语言分布</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(device?.languages || []).slice(0, 8).map((l, i) => {
                      const total = device?.languages.reduce((s, x) => s + x.count, 0) || 1
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-sm w-32 truncate">{l.name}</span>
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-success rounded-full" style={{ width: `${(l.count / total) * 100}%` }} /></div>
                          <span className="text-xs text-muted-foreground w-12 text-right">{l.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

import { useState, useMemo } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Common country name mapping (topojson names → Chinese)
const COUNTRY_CN: Record<string, string> = {
  'China': '中国', 'Japan': '日本', 'South Korea': '韩国', 'Korea': '韩国',
  'United States of America': '美国', 'United States': '美国',
  'United Kingdom': '英国', 'France': '法国', 'Germany': '德国',
  'Russia': '俄罗斯', 'Canada': '加拿大', 'Australia': '澳大利亚',
  'Brazil': '巴西', 'India': '印度', 'Italy': '意大利', 'Spain': '西班牙',
  'Mexico': '墨西哥', 'Indonesia': '印度尼西亚', 'Turkey': '土耳其',
  'Saudi Arabia': '沙特阿拉伯', 'Thailand': '泰国', 'Vietnam': '越南',
  'Singapore': '新加坡', 'Malaysia': '马来西亚', 'Philippines': '菲律宾',
  'Netherlands': '荷兰', 'Sweden': '瑞典', 'Switzerland': '瑞士',
  'Poland': '波兰', 'Belgium': '比利时', 'Austria': '奥地利',
  'Norway': '挪威', 'Denmark': '丹麦', 'Finland': '芬兰',
  'Ireland': '爱尔兰', 'Portugal': '葡萄牙', 'Czech Republic': '捷克',
  'Romania': '罗马尼亚', 'Hungary': '匈牙利', 'New Zealand': '新西兰',
  'Argentina': '阿根廷', 'Chile': '智利', 'Colombia': '哥伦比亚',
  'Peru': '秘鲁', 'South Africa': '南非', 'Egypt': '埃及',
  'Nigeria': '尼日利亚', 'Kenya': '肯尼亚', 'Morocco': '摩洛哥',
  'Ukraine': '乌克兰', 'Greece': '希腊', 'Israel': '以色列',
  'UAE': '阿联酋', 'Pakistan': '巴基斯坦', 'Bangladesh': '孟加拉国',
  'Sri Lanka': '斯里兰卡', 'Nepal': '尼泊尔', 'Cambodia': '柬埔寨',
  'Myanmar': '缅甸', 'Laos': '老挝', 'Mongolia': '蒙古',
  'Taiwan': '台湾', 'Hong Kong': '香港', 'Macau': '澳门',
}

interface GeoEntry {
  name: string
  count: number
}

interface WorldMapProps {
  countries: GeoEntry[]
  height?: number
}

export default function WorldMap({ countries, height = 360 }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null)

  const countMap = useMemo(() => {
    const m: Record<string, number> = {}
    countries.forEach(c => { m[c.name] = c.count })
    return m
  }, [countries])

  const maxCount = useMemo(() => Math.max(...countries.map(c => c.count), 1), [countries])

  const getCountryName = (geo: { properties?: { name?: string } }) => {
    return geo.properties?.name || ''
  }

  const getCount = (geo: { properties?: { name?: string } }) => {
    const name = getCountryName(geo)
    // Try direct match, then Chinese name reverse lookup
    if (countMap[name]) return countMap[name]
    // Try matching by country code or alternate names
    for (const [key, val] of Object.entries(countMap)) {
      if (COUNTRY_CN[key] === name || key === name) return val
    }
    return 0
  }

  const getColor = (count: number) => {
    if (count === 0) return '#1e293b'
    const ratio = count / maxCount
    if (ratio > 0.7) return '#22c55e'
    if (ratio > 0.4) return '#38bdf8'
    if (ratio > 0.15) return '#a78bfa'
    return '#475569'
  }

  return (
    <div className="relative" style={{ height }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 120,
          center: [105, 35],
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const count = getCount(geo)
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getColor(count)}
                    stroke="#334155"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none', fill: '#60a5fa', cursor: 'pointer' },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={(e) => {
                      const name = getCountryName(geo)
                      setTooltip({
                        name: COUNTRY_CN[name] || name,
                        count,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }}
                    onMouseMove={(e) => {
                      setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-black/90 text-white text-sm rounded-lg shadow-lg pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          <div className="font-semibold">{tooltip.name}</div>
          <div className="text-xs text-gray-300">{tooltip.count} 次访问</div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex items-center gap-2 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: '#22c55e' }} />高</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: '#38bdf8' }} />中</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: '#a78bfa' }} />低</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: '#1e293b' }} />无</span>
      </div>
    </div>
  )
}

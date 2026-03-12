import { useEffect, useMemo, useState } from 'react'
import { getDailyCosts, getTodayCost, getMonthlyCost } from '../../utils/cost-tracker'

interface StatsData {
  totalSessions: number
  topTags: { tag: string; count: number }[]
  dailyCounts: number[]
  dailyCountsMap: Record<string, number>
  recentCount: number
  totalMessages?: number
  avgMessagesPerSession?: number
  dailyMessageCounts?: number[]
  topSessions?: Array<{ id: string; title: string; messageCount: number }>
}

const STOPWORDS = new Set([
  '이', '가', '을', '를', '의', '에', '은', '는', '로', '으로',
  '와', '과', '이나', '에서', '까지', '부터', '한', '하다', '있다', '없다', '그', '그것',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
])

function getTopWords(texts: string[], topN = 20): Array<{ word: string; count: number }> {
  const freq: Record<string, number> = {}
  for (const text of texts) {
    const words = text.split(/[\s\p{P}]+/u)
    for (const raw of words) {
      const word = raw.trim()
      if (word.length < 2) continue
      if (/^\d+$/.test(word)) continue
      if (STOPWORDS.has(word)) continue
      freq[word] = (freq[word] ?? 0) + 1
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }))
}

export function StatsPanel() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [wordFreqOpen, setWordFreqOpen] = useState(false)
  const [topSessionsOpen, setTopSessionsOpen] = useState(false)
  const [sessionTitles, setSessionTitles] = useState<string[]>([])
  const [dailyCosts, setDailyCosts] = useState<{ date: string; usd: number }[]>([])
  const [todayCost, setTodayCost] = useState(0)
  const [monthlyCost, setMonthlyCost] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = useMemo(() => async () => {
    setRefreshing(true)
    setTodayCost(getTodayCost())
    setMonthlyCost(getMonthlyCost())
    setDailyCosts(getDailyCosts(7))
    await Promise.all([
      window.api.sessionGlobalStats().then(setStats),
      window.api.sessionList().then((sessions) => {
        const titles = (sessions as Array<{ title?: string }>)
          .map((s) => s.title ?? '')
          .filter(Boolean)
        setSessionTitles(titles)
      }),
    ])
    setRefreshing(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const heatmapDays = useMemo(() => {
    if (!stats) return []
    const result: Array<{ date: string; count: number }> = []
    const now = new Date()
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      result.push({ date: key, count: stats.dailyCountsMap?.[key] ?? 0 })
    }
    return result
  }, [stats])

  const totalTokens = useMemo(() => {
    return heatmapDays.reduce((sum, d) => sum + d.count, 0) * 500
  }, [heatmapDays])

  const topHours = useMemo(() => {
    const now = new Date()
    const hour = now.getHours()
    const candidates = [hour - 1, hour, hour + 1].map(h => ((h % 24) + 24) % 24)
    return candidates
  }, [])

  const peakDay = useMemo(() => {
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
    const daySums = Array(7).fill(0)
    heatmapDays.forEach(d => {
      const dow = new Date(d.date).getDay()
      daySums[dow] += d.count
    })
    const maxIdx = daySums.indexOf(Math.max(...daySums))
    return dayNames[maxIdx]
  }, [heatmapDays])

  const topWords = useMemo(() => getTopWords(sessionTitles), [sessionTitles])

  // 요일별 누적 세션 수 (0=일 ~ 6=토)
  const weekdayStats = useMemo(() => {
    const sums = Array(7).fill(0)
    heatmapDays.forEach(d => { sums[new Date(d.date).getDay()] += d.count })
    return sums
  }, [heatmapDays])

  // 연속 사용일 스트릭 계산
  const { currentStreak, longestStreak } = useMemo(() => {
    const days = [...heatmapDays].reverse() // 최신 → 과거
    let cur = 0
    for (const d of days) {
      if (d.count > 0) cur++
      else break
    }
    let maxStreak = 0, run = 0
    for (const d of heatmapDays) {
      if (d.count > 0) { run++; maxStreak = Math.max(maxStreak, run) }
      else run = 0
    }
    return { currentStreak: cur, longestStreak: maxStreak }
  }, [heatmapDays])

  if (!stats) return <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>로딩 중...</div>

  const maxDay = Math.max(...stats.dailyCounts, 1)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const today = new Date().getDay()

  const maxCount = Math.max(1, ...heatmapDays.map(d => d.count))

  const getColor = (count: number): string => {
    if (count === 0) return 'var(--bg-secondary, #2a2a2a)'
    const intensity = count / maxCount
    if (intensity < 0.25) return '#0e4429'
    if (intensity < 0.5) return '#006d32'
    if (intensity < 0.75) return '#26a641'
    return '#39d353'
  }

  const avgTokensPerSession = stats.totalSessions > 0
    ? Math.round(totalTokens / stats.totalSessions)
    : 0

  const totalDays = heatmapDays.filter(d => d.count > 0).length

  const handleGenerateInsights = async () => {
    setInsightLoading(true)
    try {
      const result = await window.api.generateInsights({
        totalSessions: stats.totalSessions,
        totalTokens,
        avgTokensPerSession,
        topHours,
        peakDay,
        totalDays,
      })
      setInsight(result)
    } finally {
      setInsightLoading(false)
    }
  }

  return (
    <div style={{ padding: 12, fontSize: 12, color: 'var(--text-primary)' }}>
      {/* 새로고침 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={() => loadStats()}
          disabled={refreshing}
          title="통계 새로고침"
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 4,
            cursor: refreshing ? 'not-allowed' : 'pointer', color: 'var(--text-muted)',
            fontSize: 10, padding: '2px 7px', opacity: refreshing ? 0.5 : 1,
          }}
        >
          {refreshing ? '⟳' : '↻'} 새로고침
        </button>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{stats.totalSessions}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>전체 세션</div>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{stats.recentCount}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>최근 7일</div>
        </div>
        {stats.totalMessages != null && (
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{stats.totalMessages}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>전체 메시지</div>
          </div>
        )}
        {stats.avgMessagesPerSession != null && (
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{stats.avgMessagesPerSession}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>평균 메시지</div>
          </div>
        )}
      </div>

      {/* 연속 사용일 스트릭 */}
      {(currentStreak > 0 || longestStreak > 0) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: currentStreak >= 7 ? '#fbbf24' : 'var(--accent)' }}>
              {currentStreak > 0 ? `🔥 ${currentStreak}` : '0'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>현재 연속</div>
          </div>
          <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)' }}>{longestStreak}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>최장 연속</div>
          </div>
          {totalDays > 0 && (
            <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                {(stats.totalSessions / totalDays).toFixed(1)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>일평균 세션</div>
            </div>
          )}
        </div>
      )}

      {/* 요일별 활동 분포 */}
      {weekdayStats.some(v => v > 0) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>요일별 활동 분포 (최근 12주)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}>
            {weekdayStats.map((count, i) => {
              const dayNames = ['일', '월', '화', '수', '목', '금', '토']
              const maxWd = Math.max(...weekdayStats, 1)
              const isPeak = count === maxWd && count > 0
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%',
                    height: `${(count / maxWd) * 32 + (count > 0 ? 4 : 0)}px`,
                    background: isPeak ? '#f59e0b' : count > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
                    borderRadius: 2, minHeight: 2, transition: 'height 0.3s',
                  }} title={`${dayNames[i]}요일: ${count}회`} />
                  <span style={{ fontSize: 9, color: isPeak ? '#f59e0b' : 'var(--text-muted)', fontWeight: isPeak ? 700 : 400 }}>{dayNames[i]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 7일 활동 바 차트 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>최근 7일 활동</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
          {stats.dailyCounts.map((count, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{
                width: '100%',
                height: `${(count / maxDay) * 40 + (count > 0 ? 4 : 0)}px`,
                background: count > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
                borderRadius: 2,
                minHeight: 2,
                transition: 'height 0.3s',
              }} title={`${count}개 세션`} />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                {days[(today - 6 + i + 7) % 7]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 7일 메시지 수 차트 */}
      {stats.dailyMessageCounts && stats.dailyMessageCounts.some(v => v > 0) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>최근 7일 메시지 수</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
            {stats.dailyMessageCounts.map((count, i) => {
              const maxMsg = Math.max(...stats.dailyMessageCounts!, 1)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%',
                    height: `${(count / maxMsg) * 40 + (count > 0 ? 4 : 0)}px`,
                    background: count > 0 ? '#7c3aed' : 'var(--bg-tertiary)',
                    borderRadius: 2, minHeight: 2, transition: 'height 0.3s',
                  }} title={`${count}개 메시지`} />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {days[(today - 6 + i + 7) % 7]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* API 비용 */}
      {(monthlyCost > 0 || todayCost > 0) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>💰 API 비용</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>${todayCost.toFixed(4)}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>오늘</div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>${monthlyCost.toFixed(4)}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>이번달</div>
            </div>
          </div>
          {dailyCosts.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>최근 7일 비용</div>
              {(() => {
                const maxCost = Math.max(...dailyCosts.map(d => d.usd), 0.0001)
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
                    {dailyCosts.map(d => (
                      <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{
                          width: '100%',
                          height: `${(d.usd / maxCost) * 32 + (d.usd > 0 ? 4 : 0)}px`,
                          background: d.usd > 0 ? '#f59e0b' : 'var(--bg-tertiary)',
                          borderRadius: 2, minHeight: 2, transition: 'height 0.3s',
                        }} title={`${d.date}: $${d.usd.toFixed(4)}`} />
                        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>
                          {d.date.slice(5)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* 활동 히트맵 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>활동 히트맵 (최근 12주)</span>
          {totalDays > 0 && (
            <span style={{ fontWeight: 400, color: 'var(--accent)' }}>
              {totalDays}일 · {(totalDays / heatmapDays.length * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
          {Array.from({ length: 12 }, (_, weekIdx) => (
            <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {heatmapDays.slice(weekIdx * 7, weekIdx * 7 + 7).map(day => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count}개 세션`}
                  style={{
                    width: '100%', aspectRatio: '1', borderRadius: 2,
                    background: getColor(day.count),
                    cursor: 'default'
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          <span>적음</span>
          {(['#0e4429', '#006d32', '#26a641', '#39d353'] as const).map(c => (
            <div key={c} style={{ width: 10, height: 10, background: c, borderRadius: 1 }} />
          ))}
          <span>많음</span>
        </div>
      </div>

      {/* AI 인사이트 */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setInsightsOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 10, fontWeight: 600,
            padding: '0 0 4px 0', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 9 }}>{insightsOpen ? '▼' : '▶'}</span>
          💡 AI 인사이트
        </button>

        {insightsOpen && (
          <div>
            <button
              onClick={handleGenerateInsights}
              disabled={insightLoading}
              style={{
                marginBottom: 8,
                padding: '4px 10px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 11,
                cursor: insightLoading ? 'not-allowed' : 'pointer',
                opacity: insightLoading ? 0.7 : 1,
              }}
            >
              {insightLoading ? '분석 중...' : '분석 생성'}
            </button>

            {insightLoading && (
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>
                AI가 통계를 분석하고 있습니다...
              </div>
            )}

            {insight && !insightLoading && (
              <div style={{
                background: 'var(--bg-secondary, #1e1e1e)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: 4,
                padding: '8px 10px',
                fontSize: 11,
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {insight}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 자주 쓴 단어 */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setWordFreqOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 10, fontWeight: 600,
            padding: '0 0 4px 0', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 9 }}>{wordFreqOpen ? '▼' : '▶'}</span>
          📊 자주 쓴 단어
        </button>

        {wordFreqOpen && (
          <div>
            {topWords.length === 0 ? (
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>데이터 없음</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {topWords.map(({ word, count }) => {
                  const maxCount = topWords[0].count
                  const ratio = count / maxCount
                  const fontSize = Math.round(10 + ratio * 8)
                  const fontWeight = ratio > 0.6 ? 700 : ratio > 0.3 ? 600 : 400
                  const color = ratio > 0.6 ? '#527bff' : ratio > 0.3 ? '#3d5cbf' : '#2a3d7a'
                  return (
                    <span
                      key={word}
                      title={`${count}회`}
                      style={{
                        fontSize,
                        fontWeight,
                        color,
                        background: 'rgba(82,139,255,0.1)',
                        borderRadius: 12,
                        padding: '2px 8px',
                        cursor: 'default',
                        lineHeight: 1.6,
                      }}
                    >
                      {word}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 상위 세션 (메시지 수 기준) */}
      {stats.topSessions && stats.topSessions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setTopSessionsOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 10, fontWeight: 600,
              padding: '0 0 4px 0', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 9 }}>{topSessionsOpen ? '▼' : '▶'}</span>
            💬 메시지 많은 세션 TOP 5
          </button>
          {topSessionsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stats.topSessions.map((s, i) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-tertiary)', borderRadius: 4, padding: '4px 8px',
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 14 }}>{i + 1}.</span>
                  <span style={{ flex: 1, fontSize: 10, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || '제목 없음'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>{s.messageCount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 상위 태그 */}
      {stats.topTags.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>자주 쓰는 태그</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {stats.topTags.map(({ tag, count }) => (
              <span key={tag} style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '2px 8px',
                fontSize: 10,
                color: 'var(--text-primary)',
              }}>
                {tag} <span style={{ color: 'var(--accent)' }}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.topTags.length === 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>태그 없음</div>
      )}
    </div>
  )
}

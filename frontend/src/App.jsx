import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart as RechartsBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Sector,
} from 'recharts'

const API = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
const url = (p) => `${API}${p}`

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

function fmtDate(v) {
  if (!v) return ''
  return new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function scoreTone(s) { return s >= 80 ? 'Excellent' : s >= 50 ? 'Steady' : 'Needs work' }
function scoreClass(s) { return s >= 80 ? 'is-excellent' : s >= 50 ? 'is-steady' : 'is-needs-attention' }

const LANG_COLORS = {
  JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  'C++': '#f34b7d', C: '#555', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
  PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', HTML: '#e34c26', CSS: '#563d7c',
  Dart: '#00B4AB', Shell: '#89e051', 'Jupyter Notebook': '#F37626', Vue: '#41b883',
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.88 8.37 6.86 9.72.5.09.68-.22.68-.48v-1.68c-2.79.62-3.38-1.38-3.38-1.38-.46-1.2-1.12-1.52-1.12-1.52-.92-.65.07-.64.07-.64 1.02.07 1.56 1.07 1.56 1.07.9 1.58 2.37 1.12 2.95.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.13-4.56-5.03 0-1.11.38-2.02 1.01-2.73-.1-.26-.44-1.31.1-2.72 0 0 .82-.27 2.7 1.04A9.2 9.2 0 0 1 12 6.84c.83 0 1.67.12 2.45.34 1.88-1.31 2.69-1.04 2.69-1.04.55 1.41.2 2.46.1 2.72.63.71 1 1.62 1 2.73 0 3.91-2.34 4.77-4.57 5.02.36.32.67.94.67 1.89v2.8c0 .26.18.57.69.48A10.1 10.1 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"
      />
    </svg>
  )
}

function LeetCodeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M13.24 2.45 9.7 6.02l4.8 4.83-1.87 1.86-4.8-4.82-3.8 3.82 7.78 7.8-1.85 1.85L1.9 11.71l-.01-.01 9.4-9.25 1.95 1.99z" />
      <path fill="currentColor" d="M21.5 11.83h-7.2v2.34h7.2v-2.34z" />
    </svg>
  )
}

function KaggleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M10.8 2.5H8.2v19h2.6v-4.8l1.46-1.58 4.22 6.38h3.1l-5.56-8.28 5.14-5.52H16.1l-5.3 5.7V2.5z" />
    </svg>
  )
}

function PlatformIcon({ platform }) {
  if (platform === 'github') return <GitHubIcon />
  if (platform === 'leetcode') return <LeetCodeIcon />
  return <KaggleIcon />
}

const GITHUB_RANGE_OPTIONS = [
  { value: '6m', label: '6 months' },
  { value: '12m', label: '12 months' },
]

const PIE_PALETTE = ['#274C77', '#6096BA', '#A3CEF1', '#4F5D95', '#8B8C89', '#34d399', '#fbbf24', '#fb7185']

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum))
}

function shortDateLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.toLocaleString('en', { month: 'short' })} ${date.getDate()}`
}

function buildGitHubTimeline(githubData) {
  const weeklyData = githubData?.consistency?.weekly_data || []
  return weeklyData.map((week, index) => {
    const base = Number(week.contributions || 0)
    return {
      label: shortDateLabel(week.week || `W${index + 1}`),
      commits: base,
      prs: Math.max(0, Math.round(base * 0.28)),
      issues: Math.max(0, Math.round(base * 0.16)),
    }
  })
}

function buildSkillDistribution(githubData) {
  const languages = githubData?.profile?.languages || {}
  return Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, value: count }))
}

function buildProjectQuality(githubData) {
  const repos = githubData?.top_repositories || []
  return repos.map((repo, index) => {
    const stars = Number(repo.stars || 0)
    const forks = Number(repo.forks || 0)
    const freshness = repo.pushed_at ? Math.max(0, 12 - Math.min(12, Math.floor((Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24 * 30)))) : 4
    const score = clamp(Math.round(30 + stars * 2.2 + forks * 3.2 + freshness * 2), 0, 100)

    return {
      name: repo.name || `Repo ${index + 1}`,
      score,
      explanation: `${stars} stars, ${forks} forks, freshness ${freshness}/12`,
    }
  })
}

function buildCollaborationActivity(githubData) {
  const contributions = githubData?.contributions || {}
  const prs = Number(contributions.total_prs || 0)
  const issues = Number(contributions.total_issues || 0)
  const repos = Number(contributions.total_repos_created || 0)

  if (!prs && !issues && !repos) return []

  return [
    { label: 'Open', prs: Math.max(1, Math.round(prs * 0.55)), issues: Math.max(1, Math.round(issues * 0.7)), repos: Math.max(0, repos) },
    { label: 'Merged / Closed', prs: Math.max(0, Math.round(prs * 0.45)), issues: Math.max(0, Math.round(issues * 0.3)), repos: Math.max(0, Math.round(repos * 0.25)) },
  ]
}

function buildTeacherInsight(githubData) {
  const score = Number(githubData?.profile?.score || 0)
  const consistency = Number(githubData?.consistency?.consistency_pct || 0)
  const activeWeeks = Number(githubData?.consistency?.active_weeks || 0)
  const totalWeeks = Number(githubData?.consistency?.total_weeks || 0)
  const topRepos = Number((githubData?.top_repositories || []).length || 0)

  if (!githubData?.profile || githubData.profile.error) {
    return 'No GitHub data is available yet. Enter a valid username to unlock the dashboard.'
  }

  if (score >= 80 && consistency >= 60) {
    return `Strong profile: ${activeWeeks}/${totalWeeks || 52} active weeks and ${topRepos} highlighted repositories show sustained engineering output.`
  }

  if (score >= 50) {
    return `Steady profile: the student has usable activity, but consistency and depth can improve. Focus on regular weekly contributions and more collaborative work.`
  }

  return 'Early-stage profile: activity is limited, so the best next step is consistent commits, a few well-documented repositories, and more collaborative contributions.'
}

function RangeSelector({ value, onChange, disabled = false }) {
  return (
    <div className="range-selector" role="tablist" aria-label="GitHub analysis range">
      {GITHUB_RANGE_OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          className={`range-pill ${value === option.value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function MetricTile({ label, value, detail }) {
  return (
    <div className="metric-tile">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {detail && <p className="metric-detail">{detail}</p>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════════════════════ */

function LandingPage({ onAnalyze, loading }) {
  const [form, setForm] = useState({ github: '', leetcode: '', kaggle: '' })
  const [err, setErr] = useState('')

  const hasInput = Object.values(form).some(v => v.trim())

  function submit(e) {
    e.preventDefault()
    if (!hasInput) { setErr('Enter at least one username.'); return }
    setErr('')
    onAnalyze(form)
  }

  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="landing-content">
        <div className="landing-badge-row">
          <span className="landing-badge-line" />
          <div className="landing-badge">Student Performance Analyzer</div>
          <span className="landing-badge-line" />
        </div>

        <div className="landing-split">
          <div className="landing-copy">
            <h1 className="landing-title">Analyze your student's<br /><span>coding journey</span></h1>
            <p className="landing-sub">
              Enter platform usernames to generate a comprehensive dashboard with
              contribution heatmaps, consistency metrics, problem-solving timelines,
              and a downloadable PDF report.
            </p>
          </div>

          <div className="landing-form-shell">
            <form className="landing-form" onSubmit={submit}>
              <div className="landing-fields">
                {['github', 'leetcode', 'kaggle'].map(p => (
                  <div key={p} className="landing-field">
                    <label>{p[0].toUpperCase() + p.slice(1)}</label>
                    <div className="input-wrap">
                      <span className={`input-icon input-icon-${p}`}><PlatformIcon platform={p} /></span>
                      <input
                        placeholder={`${p} username`}
                        value={form[p]}
                        onChange={e => setForm(f => ({ ...f, [p]: e.target.value }))}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {err && <p className="landing-err">{err}</p>}

              <button className="cta-btn" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" /> Analyzing…</> : 'Analyze Student →'}
              </button>
            </form>
          </div>
        </div>

        <div className="landing-badge-row landing-badge-row-bottom">
          <span className="landing-badge-line" />
          <div className="landing-badge landing-badge-bottom">GitHub · LeetCode · Kaggle</div>
          <span className="landing-badge-line" />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   DONUT CHART (SVG)
   ═══════════════════════════════════════════════════════════════════════ */

function DonutChart({ segments, size = 160, thickness = 20, label, sublabel }) {
  const r = (size - thickness) / 2
  const c = Math.PI * 2 * r
  const total = segments.reduce((a, s) => a + s.value, 0) || 1

  let offset = 0
  const arcs = segments.map(seg => {
    const pct = seg.value / total
    const dash = pct * c
    const arc = { ...seg, dash, gap: c - dash, offset }
    offset += dash
    return arc
  })

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth={thickness} />
        {arcs.map((a, i) => (
          <circle
            key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={a.color} strokeWidth={thickness}
            strokeDasharray={`${a.dash} ${a.gap}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dasharray 0.8s ease' }}
          />
        ))}
      </svg>
      <div className="donut-center">
        <strong>{label}</strong>
        {sublabel && <span>{sublabel}</span>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   HEATMAP (GitHub / LeetCode)
   ═══════════════════════════════════════════════════════════════════════ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function Heatmap({ weeks, colorScheme = 'green', title, theme }) {
  const [tip, setTip] = useState(null)
  if (!weeks || weeks.length === 0) return <div className="heatmap-empty"><p className="muted">No data available.</p></div>

  const colors = theme === 'dark'
    ? (colorScheme === 'green'
      ? ['rgba(30,38,54,0.6)', '#0e4429', '#006d32', '#26a641', '#39d353']
      : ['rgba(30,38,54,0.6)', '#4a2006', '#92400e', '#d97706', '#fbbf24'])
    : (colorScheme === 'green'
      ? ['rgba(24, 50, 74, 0.08)', '#c6f6d5', '#9ae6b4', '#48bb78', '#2f855a']
      : ['rgba(24, 50, 74, 0.08)', '#feebc8', '#fbd38d', '#f6ad55', '#dd6b20'])

  function level(count) {
    if (count === 0) return 0
    if (count <= 2) return 1
    if (count <= 5) return 2
    if (count <= 8) return 3
    return 4
  }

  const monthPos = []
  let lastM = -1
  weeks.forEach((w, i) => {
    const days = w.contributionDays || w.days || []
    if (days.length > 0) {
      const d = new Date(days[0].date)
      if (d.getMonth() !== lastM) { monthPos.push({ m: d.getMonth(), i }); lastM = d.getMonth() }
    }
  })

  return (
    <div className="heatmap-section">
      {title && <h4 className="heatmap-title">{title}</h4>}
      <div className="heatmap-scroll">
        <div className="hm-months" style={{ gridTemplateColumns: `24px repeat(${weeks.length}, 1fr)` }}>
          <span />
          {weeks.map((_, i) => { const m = monthPos.find(p => p.i === i); return <span key={i} className="hm-mlabel">{m ? MONTHS[m.m] : ''}</span> })}
        </div>
        <div className="hm-grid" style={{ gridTemplateColumns: `24px repeat(${weeks.length}, 1fr)` }}>
          {[0, 1, 2, 3, 4, 5, 6].map(day => (
            <>
              <span key={`l${day}`} className="hm-dlabel">{['', 'M', '', 'W', '', 'F', ''][day]}</span>
              {weeks.map((w, wi) => {
                const d = (w.contributionDays || w.days || [])[day]
                if (!d) return <span key={`${wi}-${day}`} className="hm-cell" />
                const lv = level(d.count ?? d.contributionCount ?? 0)
                const cnt = d.count ?? d.contributionCount ?? 0
                return (
                  <span
                    key={`${wi}-${day}`}
                    className="hm-cell hm-filled"
                    style={{ background: colors[lv] }}
                    onMouseEnter={e => {
                      const r = e.target.getBoundingClientRect()
                      setTip({ text: `${cnt} on ${fmtDate(d.date)}`, x: r.left + r.width / 2, y: r.top - 6 })
                    }}
                    onMouseLeave={() => setTip(null)}
                  />
                )
              })}
            </>
          ))}
        </div>
      </div>
      <div className="hm-legend">
        <span className="muted" style={{ fontSize: '0.7rem' }}>Less</span>
        {colors.map((c, i) => <span key={i} className="hm-legend-cell" style={{ background: c }} />)}
        <span className="muted" style={{ fontSize: '0.7rem' }}>More</span>
      </div>
      {tip && <div className="hm-tip" style={{ position: 'fixed', left: tip.x, top: tip.y, transform: 'translate(-50%,-100%)' }}>{tip.text}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   BAR CHART
   ═══════════════════════════════════════════════════════════════════════ */

function BarChart({ data, labelKey, valueKey, color = 'var(--accent-strong)', height = 140, title }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d[valueKey]), 1)

  return (
    <div className="bar-chart-section">
      {title && <h4 className="chart-title">{title}</h4>}
      <div className="bar-chart" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.max((d[valueKey] / max) * 100, 2)
          const isLabeled = data.length <= 20 || i % Math.ceil(data.length / 12) === 0
          return (
            <div key={i} className="bar-col" title={`${d[labelKey]}: ${d[valueKey]}`}>
              <div className="bar" style={{ height: `${h}%`, background: color }} />
              {isLabeled && <span className="bar-label">{typeof d[labelKey] === 'string' && d[labelKey].length > 5 ? d[labelKey].slice(5) : d[labelKey]}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════════════ */

function StatCard({ icon, value, label }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div>
        <p className="stat-value">{value}</p>
        <p className="stat-label">{label}</p>
      </div>
    </div>
  )
}

function ChartEmpty({ title, message }) {
  return (
    <div className="chart-empty">
      <h4>{title}</h4>
      <p>{message}</p>
    </div>
  )
}

function GitHubAnalyticsPanel({ data, canRefresh, onRangeChange }) {
  const range = data?.range || '12m'
  const [timelinePeriod, setTimelinePeriod] = useState('monthly')

  const timeline = useMemo(() => {
    const rawData = data?.consistency?.weekly_data || []
    const groups = {}
    rawData.forEach(item => {
      const date = new Date(item.week)
      if (Number.isNaN(date.getTime())) return

      let key = ''
      if (timelinePeriod === 'weekly') {
        key = shortDateLabel(item.week)
      } else if (timelinePeriod === 'monthly') {
        key = date.toLocaleString('en', { month: 'short', year: '2-digit' })
      } else if (timelinePeriod === 'quaterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        key = `Q${quarter} ${date.getFullYear().toString().slice(-2)}`
      }

      if (!groups[key]) {
        groups[key] = { label: key, contributions: 0, rawDate: date }
      }
      groups[key].contributions += Number(item.contributions || 0)
    })

    const sortedGroups = Object.values(groups).sort((a, b) => a.rawDate - b.rawDate)
    
    return sortedGroups.map(g => {
      const base = g.contributions
      return {
        label: g.label,
        commits: base,
        prs: Math.max(0, Math.round(base * 0.28)),
        issues: Math.max(0, Math.round(base * 0.16)),
      }
    })
  }, [data, timelinePeriod])

  const skillData = useMemo(() => buildSkillDistribution(data), [data])
  const projectQuality = useMemo(() => buildProjectQuality(data), [data])
  const collaboration = useMemo(() => buildCollaborationActivity(data), [data])
  const insight = useMemo(() => buildTeacherInsight(data), [data])
  const timelineEstimated = timeline.length > 0 && !data?.activity_timeline

  const [activeSkillIndex, setActiveSkillIndex] = useState(-1)

  const renderActiveSkillShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

  return (
    <div className="github-analytics">
      <div className="github-analytics-head">
        <div>
          <p className="eyebrow">GitHub intelligence</p>
          <h3>Development activity over time</h3>
          <p className="muted github-analytics-note">
            {timelineEstimated ? 'Using contribution history while the GitHub timeline API is being extended.' : 'Showing the selected GitHub range.'}
          </p>
        </div>
        {canRefresh && <RangeSelector value={range} onChange={onRangeChange} />}
      </div>

      <div className="card chart-card chart-card-wide">
        {timeline.length > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>Activity timeline</h3>
              <div className="range-selector">
                {[
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'quaterly', label: 'Quarterly' }
                ].map(p => (
                  <button
                    key={p.value}
                    type="button"
                    className={`range-pill ${timelinePeriod === p.value ? 'is-active' : ''}`}
                    onClick={() => setTimelinePeriod(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <RechartsLineChart data={timeline} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} />
                <Legend />
                <Line type="monotone" dataKey="commits" stroke="var(--accent)" strokeWidth={2.5} dot={false} name="Commits" />
                <Line type="monotone" dataKey="prs" stroke="var(--good)" strokeWidth={2.5} dot={false} name="PRs" />
                <Line type="monotone" dataKey="issues" stroke="var(--warn)" strokeWidth={2.5} dot={false} name="Issues" />
              </RechartsLineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <ChartEmpty title="Development activity over time" message="No GitHub activity data is available for this account yet." />
        )}
      </div>

      <div className="github-metrics-grid">
        <MetricTile label="Score" value={`${data?.profile?.score || 0}/100`} detail={scoreTone(data?.profile?.score || 0)} />
        <MetricTile label="Consistency" value={`${data?.consistency?.consistency_pct || 0}%`} detail={`${data?.consistency?.active_weeks || 0} active weeks`} />
        <MetricTile label="Current streak" value={`${data?.consistency?.current_streak || 0}d`} detail="Consecutive active days" />
        <MetricTile label="Top repositories" value={`${(data?.top_repositories || []).length || 0}`} detail="Highlighted by quality signals" />
      </div>

      {/* Teacher Insight */}
      <div className="card github-insight-card">
        <p className="eyebrow">Teacher insight</p>
        <p className="teacher-insight">{insight}</p>
      </div>

      {/* Horizontal grid below teacher insight: upper row = tech skill + project quality */}
      <div className="insight-below-row">
        <div className="card chart-card">
          <p className="eyebrow">Technical skill distribution</p>
          <h3>Repository language mix</h3>
          {skillData.length > 0 ? (
            <div className="donut-row github-donut-row">
              <div className="github-pie-wrap">
                <div className="donut-wrap" style={{ width: '100%', height: 240, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={skillData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={3}
                        activeIndex={activeSkillIndex}
                        activeShape={renderActiveSkillShape}
                        onMouseEnter={(_, index) => setActiveSkillIndex(index)}
                        onMouseLeave={() => setActiveSkillIndex(-1)}
                      >
                        {skillData.map((entry, index) => <Cell key={entry.name} fill={PIE_PALETTE[index % PIE_PALETTE.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center">
                    <strong>
                      {activeSkillIndex !== -1 ? skillData[activeSkillIndex]?.name : `${skillData.length}`}
                    </strong>
                    <span>
                      {activeSkillIndex !== -1 ? `${skillData[activeSkillIndex]?.value} repos` : 'Languages'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ChartEmpty title="Technical skill distribution" message="Add GitHub repositories to reveal language distribution." />
          )}
        </div>

        <div className="card chart-card">
          <p className="eyebrow">Project quality</p>
          <h3>Explainable repo scoring</h3>
          {projectQuality.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <RechartsBarChart data={projectQuality} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} formatter={(value, name, payload) => [payload?.payload?.explanation || value, 'Quality signals']} />
                <Bar dataKey="score" fill="var(--accent)" radius={[0, 10, 10, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty title="Project quality" message="Top repositories will appear here once GitHub repository metadata is available." />
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   GITHUB SECTION
   ═══════════════════════════════════════════════════════════════════════ */

function GitHubSection({ data, canRefresh = false, onRangeChange, theme }) {
  if (!data) return null
  const { profile, contributions, consistency, top_repositories } = data
  if (profile?.error) return <div className="section-err">GitHub: {profile.error}</div>

  const [activityPeriod, setActivityPeriod] = useState('monthly')

  const periods = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quaterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ]

  const aggregatedData = useMemo(() => {
    const rawData = consistency?.weekly_data || []
    if (activityPeriod === 'weekly') {
      return rawData.map(d => ({
        ...d,
        label: shortDateLabel(d.week)
      }))
    }

    const groups = {}
    rawData.forEach(item => {
      const date = new Date(item.week)
      if (Number.isNaN(date.getTime())) return

      let key = ''
      if (activityPeriod === 'monthly') {
        key = date.toLocaleString('en', { month: 'short', year: '2-digit' })
      } else if (activityPeriod === 'quaterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        key = `Q${quarter} ${date.getFullYear().toString().slice(-2)}`
      } else if (activityPeriod === 'yearly') {
        key = date.getFullYear().toString()
      }

      if (!groups[key]) {
        groups[key] = { label: key, contributions: 0, rawDate: date }
      }
      groups[key].contributions += Number(item.contributions || 0)
    })

    return Object.values(groups).sort((a, b) => a.rawDate - b.rawDate)
  }, [consistency?.weekly_data, activityPeriod])

  const langs = profile?.languages || {}
  const langEntries = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const langSegments = langEntries.map(([name, count]) => ({
    value: count, color: LANG_COLORS[name] || '#8b949e', label: name,
  }))

  return (
    <section className="platform-section" id="section-github">
      {/* Profile header + stats ABOVE analytics */}
      <div className="platform-header">
        <div className="platform-id">
          {profile?.avatar && <img src={profile.avatar} alt="" className="platform-avatar" />}
          <div>
            <h2>{profile?.name || profile?.username}</h2>
            <p className="muted">{profile?.bio || 'GitHub user'}</p>
          </div>
        </div>
        <div className={`platform-score ${scoreClass(profile?.score || 0)}`}>
          <span>{profile?.score || 0}</span>
          <small>/100</small>
        </div>
      </div>

      <div className="stats-row">
        <StatCard icon="📦" value={profile?.public_repos || 0} label="Repositories" />
        <StatCard icon="⭐" value={profile?.stars || 0} label="Total Stars" />
        <StatCard icon="🍴" value={profile?.forks || 0} label="Total Forks" />
        <StatCard icon="👥" value={profile?.followers || 0} label="Followers" />
      </div>

      {/* Analytics panel now comes after profile */}
      <GitHubAnalyticsPanel data={data} canRefresh={canRefresh} onRangeChange={onRangeChange} />

      {/* Contribution Heatmap */}
      <div className="card">
        <p className="eyebrow">Contribution graph</p>
        <h3>{contributions?.total_contributions || 0} contributions in the last year</h3>
        <Heatmap weeks={contributions?.calendar?.weeks} colorScheme="green" />
      </div>

      {/* Consistency Analysis */}
      <div className="card">
        <p className="eyebrow">Commit consistency</p>
        <h3>How constant is this student on GitHub?</h3>

        <div className="consistency-layout">
          <DonutChart
            segments={[
              { value: consistency?.active_weeks || 0, color: 'var(--good)' },
              { value: (consistency?.total_weeks || 52) - (consistency?.active_weeks || 0), color: 'rgba(148,163,184,0.1)' },
            ]}
            label={`${consistency?.consistency_pct || 0}%`}
            sublabel="Consistency"
          />

          <div className="consistency-stats">
            <StatCard icon="🔥" value={`${consistency?.current_streak || 0}d`} label="Current Streak" />
            <StatCard icon="🏆" value={`${consistency?.longest_streak || 0}d`} label="Longest Streak" />
            <StatCard icon="📅" value={`${consistency?.active_weeks || 0}/${consistency?.total_weeks || 0}`} label="Active Weeks" />
            <StatCard icon="📊" value={consistency?.avg_per_week || 0} label="Avg/Week" />
            <StatCard icon="⏸️" value={`${consistency?.longest_gap || 0}d`} label="Longest Gap" />
            <StatCard icon="📈" value={consistency?.active_days || 0} label="Active Days" />
          </div>
        </div>
      </div>

      {/* Weekly Activity — smooth filled area chart */}
      {consistency?.weekly_data && consistency.weekly_data.length > 0 && (
        <div className="card">
          <div className="weekly-activity-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Weekly activity</p>
              <h3 style={{ margin: '0.2rem 0 0 0' }}>Contributions to Repositories</h3>
            </div>
            <div className="range-selector">
              {periods.map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={`range-pill ${activityPeriod === p.value ? 'is-active' : ''}`}
                  onClick={() => setActivityPeriod(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={aggregatedData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--good)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--good)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} />
              <Area
                type="monotone"
                dataKey="contributions"
                stroke="var(--good)"
                strokeWidth={2.5}
                fill="url(#weeklyFill)"
                dot={false}
                activeDot={{ r: 4, fill: '#34d399', stroke: '#09111d', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Language Distribution (left) + Top Repos (right) — side by side */}
      {(langSegments.length > 0 || (top_repositories && top_repositories.length > 0)) && (
        <div className="lang-repos-row">
          {langSegments.length > 0 && (
            <div className="card lang-repos-card">
              <p className="eyebrow">Languages used</p>
              <h3>Repository language distribution</h3>
              <div className="lang-repos-scroll">
                <div className="lang-layout">
                  <div className="github-pie-wrap compact">
                    <DonutChart segments={langSegments} label={langEntries.length} sublabel="Languages" />
                  </div>
                  <div className="lang-list">
                    {langEntries.map(([name, count]) => (
                      <div key={name} className="lang-item">
                        <span className="lang-dot" style={{ background: LANG_COLORS[name] || '#8b949e' }} />
                        <span className="lang-name">{name}</span>
                        <span className="lang-count">{count} repos</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {top_repositories && top_repositories.length > 0 && (
            <div className="card lang-repos-card">
              <p className="eyebrow">Top repositories</p>
              <h3>Most popular projects</h3>
              <div className="lang-repos-scroll">
                <div className="repos-grid repos-grid-vertical">
                  {top_repositories.map(r => (
                    <a key={r.name} href={r.url} target="_blank" rel="noreferrer" className="repo-card">
                      <h4 className="repo-name">📁 {r.name}</h4>
                      {r.description && <p className="repo-desc">{r.description.slice(0, 80)}{r.description.length > 80 ? '…' : ''}</p>}
                      <div className="repo-meta">
                        {r.language && <span className="repo-lang"><span className="lang-dot" style={{ background: LANG_COLORS[r.language] || '#8b949e' }} />{r.language}</span>}
                        <span>⭐ {r.stars}</span>
                        <span>🍴 {r.forks}</span>
                      </div>
                      <p className="repo-date">Updated {fmtDate(r.pushed_at)}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   LEETCODE SECTION
   ═══════════════════════════════════════════════════════════════════════ */

function LeetCodeSection({ data, theme }) {
  if (!data) return null
  const { profile, calendar, snapshots } = data
  if (profile?.error) return <div className="section-err">LeetCode: {profile.error}</div>

  const easy = profile?.easy_solved || 0
  const med = profile?.medium_solved || 0
  const hard = profile?.hard_solved || 0
  const total = easy + med + hard

  // 1. Problem-Solving Growth Over Time
  const [growthPeriod, setGrowthPeriod] = useState('12m')
  const [resolution, setResolution] = useState('monthly')
  const growthData = useMemo(() => {
    const snaps = snapshots || []
    if (snaps.length === 0) return []

    // Filter snapshots based on growthPeriod
    const cutoff = new Date()
    const monthsBack = growthPeriod === '6m' ? 6 : 12;
    cutoff.setMonth(cutoff.getMonth() - monthsBack)

    const filtered = snaps.filter(s => new Date(s.date) >= cutoff)
    const sortedFiltered = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date))

    if (resolution === 'weekly') {
      return sortedFiltered.map(s => ({
        ...s,
        originalDate: s.date,
        date: s.date
      }))
    }

    const groups = {}
    sortedFiltered.forEach(s => {
      const date = new Date(s.date)
      if (Number.isNaN(date.getTime())) return

      let key = ''
      if (resolution === 'monthly') {
        key = date.toLocaleString('en', { month: 'short', year: '2-digit' })
      } else if (resolution === 'quaterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        key = `Q${quarter} ${date.getFullYear().toString().slice(-2)}`
      } else if (resolution === 'yearly') {
        key = date.getFullYear().toString()
      }

      groups[key] = {
        ...s,
        originalDate: s.date,
        date: key,
        rawDate: date
      }
    })

    return Object.values(groups).sort((a, b) => a.rawDate - b.rawDate)
  }, [snapshots, growthPeriod, resolution])

  // Detect periods of rapid improvement, stagnation, or inactivity
  const growthInsight = useMemo(() => {
    if (growthData.length < 2) return "Stagnant profile (requires more observations)."

    let maxFlatWeeks = 0
    let currentFlatWeeks = 0
    let flatStartMonth = ""
    let maxFlatMonth = ""

    let lastVal = growthData[0].total
    for (let i = 1; i < growthData.length; i++) {
      const currVal = growthData[i].total
      if (currVal === lastVal) {
        currentFlatWeeks++
        if (currentFlatWeeks > maxFlatWeeks) {
          maxFlatWeeks = currentFlatWeeks
          const dateObj = new Date(growthData[i].originalDate || growthData[i].date)
          maxFlatMonth = dateObj.toLocaleString('en-US', { month: 'long' })
        }
      } else {
        currentFlatWeeks = 0
        lastVal = currVal
      }
    }

    let maxGrowthWeekly = 0
    let maxGrowthMonth = ""
    for (let i = 1; i < growthData.length; i++) {
      const delta = growthData[i].total - growthData[i - 1].total
      if (delta > maxGrowthWeekly) {
        maxGrowthWeekly = delta
        const dateObj = new Date(growthData[i].originalDate || growthData[i].date)
        maxGrowthMonth = dateObj.toLocaleString('en-US', { month: 'long' })
      }
    }

    let msg = ""
    if (maxGrowthWeekly > 3) {
      msg += `Rapid improvement detected in ${maxGrowthMonth} (+${maxGrowthWeekly} solved in a week). `
    }
    if (maxFlatWeeks >= 4) {
      msg += `Flat stretch of ${maxFlatWeeks} weeks recorded around ${maxFlatMonth}, indicating temporary stagnation/inactivity.`
    } else {
      msg += "Practiced relatively consistently with no major blocks of long stagnation."
    }
    return msg
  }, [growthData])

  // 2. Difficulty Distribution Donut Chart Hover State
  const [activeLCIndex, setActiveLCIndex] = useState(-1)
  const donutData = useMemo(() => [
    { name: 'Easy', value: easy },
    { name: 'Medium', value: med },
    { name: 'Hard', value: hard }
  ], [easy, med, hard])

  const renderActiveLCShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

  // 3. Topic Strength Analysis
  const topicData = useMemo(() => {
    const raw = profile?.topic_distribution || []

    const targetTopics = {
      "Arrays": ["Array", "Hash Table", "Matrix"],
      "Strings": ["String", "String Matching"],
      "Linked Lists": ["Linked List", "Doubly-Linked List"],
      "Stacks and Queues": ["Stack", "Queue", "Monotonic Stack", "Monotonic Queue"],
      "Trees": ["Tree", "Binary Tree", "Binary Search Tree", "Segment Tree"],
      "Graphs": ["Graph", "Depth-First Search", "Breadth-First Search", "Union Find", "Shortest Path"],
      "Greedy Algorithms": ["Greedy"],
      "Backtracking": ["Backtracking"],
      "Dynamic Programming": ["Dynamic Programming", "Memoization"]
    }

    const counts = {}
    Object.keys(targetTopics).forEach(topic => { counts[topic] = 0 })
    counts["Other"] = 0

    raw.forEach(tag => {
      const name = tag.tag_name
      const score = tag.solved_count

      let matched = false
      for (const [key, aliases] of Object.entries(targetTopics)) {
        if (aliases.includes(name)) {
          counts[key] += score
          matched = true
          break
        }
      }
      if (!matched) {
        if (name && !["Easy", "Medium", "Hard", "All"].includes(name)) {
          counts["Other"] += score
        }
      }
    })

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [profile])

  // 4. Practice Consistency Heatmap
  const heatmapWeeks = useMemo(() => {
    const subs = calendar?.daily_submissions || []
    if (subs.length === 0) return []

    const dateMap = {}
    subs.forEach(s => { dateMap[s.date] = s.count })

    const today = new Date()
    const weeks = []
    const start = new Date(today)
    start.setDate(start.getDate() - 363 - start.getDay())

    for (let w = 0; w < 53; w++) {
      const days = []
      for (let d = 0; d < 7; d++) {
        const current = new Date(start)
        current.setDate(start.getDate() + w * 7 + d)
        if (current > today) { days.push({ date: current.toISOString().slice(0, 10), count: 0 }); continue }
        const key = current.toISOString().slice(0, 10)
        days.push({ date: key, count: dateMap[key] || 0 })
      }
      weeks.push({ days })
    }
    return weeks
  }, [calendar])

  const consistencyLevel = useMemo(() => {
    const active = calendar?.total_active_days || 0
    if (active >= 120) return "Excellent Consistency"
    if (active >= 40) return "Moderate Consistency"
    return "Needs Active Routine"
  }, [calendar])

  // 5. Contest Performance
  const contestTrend = profile?.contest_trend || []
  const maxContestRating = useMemo(() => {
    if (contestTrend.length === 0) return 0
    return Math.round(Math.max(...contestTrend.map(c => c.rating || 0)))
  }, [contestTrend])
  const currentContestRating = Math.round(profile?.contest_rating || 0)

  // 6. Dynamic Teacher Insights Summary
  const teacherInsight = useMemo(() => {
    let summaryText = ""

    const solvedVal = profile?.total_solved || 0
    let level = "Beginner"
    if (solvedVal >= 500) level = "Advanced Problem Solver"
    else if (solvedVal >= 150) level = "Intermediate Problem Solver"

    summaryText += `The student functions at an ${level} level, with a cumulative total of ${total} problems solved. `

    const hardPct = total > 0 ? Math.round((hard / total) * 100) : 0
    const medPct = total > 0 ? Math.round((med / total) * 100) : 0
    if (hardPct > 10) {
      summaryText += `Excellent progression towards advanced algorithmic questions, solving a notable fraction of hard challenges (${hardPct}%). `
    } else if (medPct > 35) {
      summaryText += `Good progression, showing solid comfort with Medium-level problem distributions (${medPct}%). `
    } else {
      summaryText += `Focus remains primarily concentrated on basic Easy-level challenges. Encouragement is needed to transition towards Intermediate (Medium) level tasks. `
    }

    const strongestList = topicData.filter(t => t.name !== "Other" && t.value > 0)
    if (strongestList.length > 0) {
      summaryText += `Strongest data structure concepts reside in ${strongestList.slice(0, 2).map(t => t.name).join(' and ')}. `
    }

    const gapTopics = topicData.filter(t => t.name !== "Other" && t.value === 0).map(t => t.name)
    if (gapTopics.length > 0) {
      summaryText += `Immediate curriculum support or practice should target learning gaps in ${gapTopics.slice(0, 3).join(', ')}. `
    }

    summaryText += `Practice profile indicates: ${consistencyLevel} with ${calendar?.total_active_days || 0} active days in the past year. `

    if (contestTrend.length > 0) {
      summaryText += `Participated in ${contestTrend.length} contests, reaching a peak competitive ranking rating of ${maxContestRating} (Currently ${currentContestRating}).`
    } else {
      summaryText += `No competitive rating activity detected yet.`
    }

    return summaryText
  }, [profile, total, hard, med, topicData, consistencyLevel, calendar, contestTrend, maxContestRating, currentContestRating])

  return (
    <section className="platform-section" id="section-leetcode">
      <div className="platform-header">
        <div className="platform-id">
          <div className="platform-icon lc-icon">LC</div>
          <div>
            <h2>{profile?.name || profile?.username || 'LeetCode'}</h2>
            <p className="muted">
              {profile?.profile_url && <a href={profile.profile_url} target="_blank" rel="noreferrer" className="link">View LeetCode Profile ↗</a>}
            </p>
          </div>
        </div>
        <div className={`platform-score ${scoreClass(profile?.score || 0)}`}>
          <span>{profile?.score || 0}</span>
          <small>/100</small>
        </div>
      </div>

      {/* Metric 1: Problem-Solving Growth Over Time */}
      <div className="card" style={{ gridColumn: 'span 2' }}>
        <div className="weekly-activity-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Progress timeline</p>
            <h3 style={{ margin: '0.2rem 0 0 0' }}>Problem-Solving Growth Over Time</h3>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="range-selector">
              {[
                { id: '6m', label: '6 Months' },
                { id: '12m', label: '12 Months' }
              ].map(p => (
                <button
                  key={p.id}
                  className={`range-pill ${growthPeriod === p.id ? 'is-active' : ''}`}
                  onClick={() => setGrowthPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="range-selector">
              {[
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
                { id: 'quaterly', label: 'Quarterly' },
                { id: 'yearly', label: 'Yearly' }
              ].map(r => (
                <button
                  key={r.id}
                  className={`range-pill ${resolution === r.id ? 'is-active' : ''}`}
                  onClick={() => setResolution(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {growthData.length > 0 ? (
          <div>
            <ResponsiveContainer width="100%" height={260}>
              <RechartsLineChart data={growthData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line type="monotone" name="Total Solved" dataKey="total" stroke="var(--primary)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Easy" dataKey="easy" stroke="var(--good)" strokeWidth={2} dot={false} />
                <Line type="monotone" name="Medium" dataKey="medium" stroke="var(--warn)" strokeWidth={2} dot={false} />
                <Line type="monotone" name="Hard" dataKey="hard" stroke="var(--bad)" strokeWidth={2} dot={false} />
              </RechartsLineChart>
            </ResponsiveContainer>
            <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: 'rgba(39, 76, 119, 0.06)', border: '1px solid var(--border)', borderRadius: 12, fontSize: '0.82rem', color: 'var(--text)' }}>
              <strong>Timeline Diagnostics:</strong> {growthInsight}
            </div>
          </div>
        ) : (
          <ChartEmpty title="Problem-Solving Growth" message="Snapshot timeline history is compiling. Fresh snapshots will register on daily updates." />
        )}
      </div>

      {/* Responsive Grid Layout */}
      <div className="insight-below-row" style={{ marginTop: '0.5rem', width: '100%' }}>
        {/* Metric 2: Difficulty Distribution (Progression analysis) */}
        <div className="card chart-card">
          <p className="eyebrow">Progression analysis</p>
          <h3>Difficulty Distribution</h3>
          <div className="donut-row github-donut-row" style={{ minHeight: 240 }}>
            <div className="github-pie-wrap">
              <div className="donut-wrap" style={{ width: '100%', height: 210, position: 'relative' }}>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={4}
                      activeIndex={activeLCIndex}
                      activeShape={renderActiveLCShape}
                      onMouseEnter={(_, index) => setActiveLCIndex(index)}
                      onMouseLeave={() => setActiveLCIndex(-1)}
                    >
                      <Cell fill="var(--good)" />
                      <Cell fill="var(--warn)" />
                      <Cell fill="var(--bad)" />
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center" style={{ pointerEvents: 'none' }}>
                  <strong>
                    {activeLCIndex !== -1 ? donutData[activeLCIndex]?.name : total}
                  </strong>
                  <span>
                    {activeLCIndex !== -1 ? `${donutData[activeLCIndex]?.value} solved` : 'Solved'}
                  </span>
                </div>
              </div>
            </div>
            <div className="difficulty-legend" style={{ minWidth: 100 }}>
              <div className="diff-item"><span className="diff-dot" style={{ background: 'var(--good)' }} /> Easy <strong>{easy}</strong></div>
              <div className="diff-item"><span className="diff-dot" style={{ background: 'var(--warn)' }} /> Med <strong>{med}</strong></div>
              <div className="diff-item"><span className="diff-dot" style={{ background: 'var(--bad)' }} /> Hard <strong>{hard}</strong></div>
            </div>
          </div>
        </div>

        {/* Metric 3: Topic Strength (Syllabus gaps) */}
        <div className="card chart-card">
          <p className="eyebrow">Syllabus gaps</p>
          <h3>DSA Topic Strength Analysis</h3>
          {topicData.some(t => t.value > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <RechartsBarChart data={topicData} layout="vertical" margin={{ top: 8, right: 12, left: 16, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--text)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} />
                <Bar dataKey="value" fill="var(--warn)" radius={[0, 4, 4, 0]}>
                  {topicData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : 'rgba(226, 138, 0, 0.7)'} />
                  ))}
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty title="Topic Strength" message="Topic tags data is empty or public view is restricted." />
          )}
        </div>

        {/* Metric 4: Practice Consistency (Activity habits - extended to full width) */}
        <div className="card chart-card chart-card-wide">
          <p className="eyebrow">Activity habits</p>
          <h3>Practice Consistency</h3>
          {heatmapWeeks.length > 0 ? (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <Heatmap weeks={heatmapWeeks} colorScheme="amber" title="" theme={theme} />
              </div>
              <div className="stats-row inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <StatCard icon="🔥" value={`${calendar?.streak || 0}d`} label="Streak" />
                <StatCard icon="📅" value={calendar?.total_active_days || 0} label="Active Days" />
                <StatCard icon="💡" value={consistencyLevel.replace(" Consistency", "")} label="Consistency" />
              </div>
            </div>
          ) : (
            <ChartEmpty title="Submission heat map" message="No submission calendar is available." />
          )}
        </div>

        {/* Teacher Diagnostics (Academic context & advice - extended to full width) */}
        <div className="card chart-card github-insight-card chart-card-wide">
          <p className="eyebrow">Academic context &amp; advice</p>
          <h3>Teacher Problem-Solving Diagnostics</h3>
          <p className="teacher-insight" style={{ lineHeight: '1.6', fontSize: '0.92rem' }}>
            {teacherInsight}
          </p>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   KAGGLE SECTION
   ═══════════════════════════════════════════════════════════════════════ */

function KaggleSection({ data, theme }) {
  if (!data) return null
  const { profile, activity } = data
  if (profile?.error) return <div className="section-err">Kaggle: {profile.error}</div>

  return (
    <section className="platform-section" id="section-kaggle">
      <div className="platform-header">
        <div className="platform-id">
          <div className="platform-icon kg-icon">K</div>
          <div>
            <h2>{profile?.name || profile?.username || 'Kaggle'}</h2>
            <p className="muted">
              {profile?.profile_url && <a href={profile.profile_url} target="_blank" rel="noreferrer" className="link">View profile ↗</a>}
            </p>
          </div>
        </div>
        <div className={`platform-score ${scoreClass(profile?.score || 0)}`}>
          <span>{profile?.score || 0}</span>
          <small>/100</small>
        </div>
      </div>

      {/* Overview */}
      <div className="stats-row">
        <StatCard icon="🏆" value={profile?.competitions_participated || 0} label="Competitions" />
        <StatCard icon="📁" value={profile?.datasets || 0} label="Datasets" />
        <StatCard icon="📓" value={profile?.notebooks || 0} label="Notebooks" />
        <StatCard icon="🥇" value={profile?.medals || 0} label="Medals" />
      </div>

      {/* Activity Distribution Donut */}
      <div className="card">
        <p className="eyebrow">Activity breakdown</p>
        <h3>What does this student do on Kaggle?</h3>
        <div className="donut-row">
          <DonutChart
            segments={[
              { value: profile?.competitions_participated || 0, color: 'var(--primary)', label: 'Competitions' },
              { value: profile?.datasets || 0, color: 'var(--secondary)', label: 'Datasets' },
              { value: profile?.notebooks || 0, color: 'var(--accent-base)', label: 'Notebooks' },
            ]}
            label={(profile?.competitions_participated || 0) + (profile?.datasets || 0) + (profile?.notebooks || 0)}
            sublabel="Total Work"
          />
          <div className="difficulty-legend">
            <div className="diff-item"><span className="diff-dot" style={{ background: 'var(--primary)' }} />Competitions <strong>{profile?.competitions_participated || 0}</strong></div>
            <div className="diff-item"><span className="diff-dot" style={{ background: 'var(--secondary)' }} />Datasets <strong>{profile?.datasets || 0}</strong></div>
            <div className="diff-item"><span className="diff-dot" style={{ background: 'var(--accent-base)' }} />Notebooks <strong>{profile?.notebooks || 0}</strong></div>
          </div>
        </div>
      </div>

      {/* Engagement Stats */}
      {(profile?.total_dataset_votes > 0 || profile?.total_notebook_votes > 0) && (
        <div className="card">
          <p className="eyebrow">Community engagement</p>
          <h3>Votes &amp; recognition</h3>
          <div className="stats-row inner">
            <StatCard icon="👍" value={profile?.total_dataset_votes || 0} label="Dataset Votes" />
            <StatCard icon="❤️" value={profile?.total_notebook_votes || 0} label="Notebook Votes" />
            <StatCard icon="👥" value={profile?.followers || 0} label="Followers" />
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      {activity?.activity_timeline && activity.activity_timeline.length > 0 && (
        <div className="card">
          <p className="eyebrow">Activity timeline</p>
          <h3>Monthly notebook activity</h3>
          <BarChart
            data={activity.activity_timeline}
            labelKey="month" valueKey="count"
            color="var(--secondary)" height={120}
          />
        </div>
      )}

      {/* Datasets List */}
      {activity?.datasets_list && activity.datasets_list.length > 0 && (
        <div className="card">
          <p className="eyebrow">Published datasets</p>
          <h3>Datasets by this student</h3>
          <div className="repos-grid">
            {activity.datasets_list.slice(0, 4).map((d, i) => (
              <a key={i} href={d.url} target="_blank" rel="noreferrer" className="repo-card">
                <h4 className="repo-name">📊 {d.title}</h4>
                <div className="repo-meta">
                  <span>👍 {d.votes}</span>
                  <span>⬇️ {d.downloads}</span>
                </div>
                {d.last_updated && <p className="repo-date">Updated {fmtDate(d.last_updated)}</p>}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Notebooks List */}
      {activity?.notebooks_list && activity.notebooks_list.length > 0 && (
        <div className="card">
          <p className="eyebrow">Published notebooks</p>
          <h3>Notebooks by this student</h3>
          <div className="repos-grid">
            {activity.notebooks_list.slice(0, 4).map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noreferrer" className="repo-card">
                <h4 className="repo-name">📓 {n.title}</h4>
                <div className="repo-meta">
                  <span>👍 {n.votes}</span>
                  {n.language && <span>{n.language}</span>}
                </div>
                {n.last_run && <p className="repo-date">Last run {fmtDate(n.last_run)}</p>}
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   FLOATING PLATFORM NAV (right-side buttons)
   ═══════════════════════════════════════════════════════════════════════ */

const PLATFORM_NAV = [
  { id: 'github', label: 'GitHub', icon: <GitHubIcon />, color: '#2E7D32' },
  { id: 'leetcode', label: 'LeetCode', icon: <LeetCodeIcon />, color: '#E28A00' },
  { id: 'kaggle', label: 'Kaggle', icon: <KaggleIcon />, color: '#274C77' },
]

function FloatingPlatformNav({ activePlatforms, activePlatform, onPlatformChange }) {
  return (
    <div className="floating-platform-nav">
      {PLATFORM_NAV.filter(p => activePlatforms.includes(p.id)).map(p => (
        <button
          key={p.id}
          className={`floating-nav-btn floating-nav-${p.id}${activePlatform === p.id ? ' is-active' : ''}`}
          onClick={() => onPlatformChange(p.id)}
          title={p.label}
          style={{ '--nav-accent': p.color }}
        >
          <span className="floating-nav-icon">{p.icon}</span>
          <span className="floating-nav-label">{p.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════════════════ */

function Dashboard({ data, form, onBack, canRefreshGithub, onRefreshGitHub, theme, toggleTheme }) {
  const dashRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const githubData = data?.github || (data?.profile ? data : null)

  const activePlatforms = [
    githubData ? 'github' : null,
    data?.leetcode ? 'leetcode' : null,
    data?.kaggle ? 'kaggle' : null,
  ].filter(Boolean)

  // Default to github, fallback to first available platform
  const [activePlatform, setActivePlatform] = useState(
    activePlatforms.includes('github') ? 'github' : activePlatforms[0] || 'github'
  )

  async function downloadPDF() {
    if (!dashRef.current || exporting) return
    setExporting(true)

    try {
      const el = dashRef.current
      const canvas = await html2canvas(el, {
        backgroundColor: theme === 'dark' ? '#06090f' : '#E7ECEF',
        scale: 1.5,
        useCORS: true,
        logging: false,
        windowWidth: 1200,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 8
      const contentW = pageW - margin * 2
      const imgH = (canvas.height * contentW) / canvas.width

      let y = 0
      let pageNum = 1

      while (y < imgH) {
        if (pageNum > 1) pdf.addPage()
        const srcY = (y / imgH) * canvas.height
        const srcH = Math.min(((pageH - margin * 2) / imgH) * canvas.height, canvas.height - srcY)
        const drawH = (srcH / canvas.height) * imgH

        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = srcH
        const ctx = pageCanvas.getContext('2d')
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

        const pageImg = pageCanvas.toDataURL('image/jpeg', 0.92)
        pdf.addImage(pageImg, 'JPEG', margin, margin, contentW, drawH)
        y += drawH
        pageNum++
      }

      const name = form.github || form.leetcode || form.kaggle || 'student'
      pdf.save(`${name}_performance_report.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  function handlePlatformChange(platformId) {
    setActivePlatform(platformId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="dashboard">
      <div className="dash-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      {/* Floating platform nav buttons on the right */}
      <FloatingPlatformNav
        activePlatforms={activePlatforms}
        activePlatform={activePlatform}
        onPlatformChange={handlePlatformChange}
      />

      {/* Top bar */}
      <nav className="dash-nav">
        <button className="back-btn" onClick={onBack}>← New Analysis</button>
        <div className="dash-nav-center">
          <h1>Student Performance Analysis</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button className="pdf-btn" onClick={downloadPDF} disabled={exporting}>
            {exporting ? <><span className="spinner" /> Generating…</> : '📄 Download PDF'}
          </button>
        </div>
      </nav>

      <div className="dash-content" ref={dashRef}>
        {/* Render only the active platform page */}
        {activePlatform === 'github' && (
          <GitHubSection data={githubData} canRefresh={canRefreshGithub} onRangeChange={onRefreshGitHub} theme={theme} />
        )}
        {activePlatform === 'leetcode' && (
          <LeetCodeSection data={data.leetcode} theme={theme} />
        )}
        {activePlatform === 'kaggle' && (
          <KaggleSection data={data.kaggle} theme={theme} />
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   APP — MAIN ROUTER
   ═══════════════════════════════════════════════════════════════════════ */

export default function App() {
  const [page, setPage] = useState('landing') // 'landing' | 'dashboard'
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ github: '', leetcode: '', kaggle: '' })
  const [loading, setLoading] = useState(false)
  const [analysisMode, setAnalysisMode] = useState('multi') // 'multi' | 'github'
  const [githubRange, setGithubRange] = useState('12m')
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'light')

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('app-theme', theme)
  }, [theme])

  const handleAnalyze = useCallback(async (formData, requestedRange = githubRange) => {
    setForm(formData)
    setLoading(true)
    try {
      const githubOnly = Boolean(formData.github?.trim()) && !formData.leetcode?.trim() && !formData.kaggle?.trim()
      const range = githubOnly ? requestedRange : '12m'
      const endpoint = githubOnly ? '/dashboard/github' : '/dashboard'
      const requestPayload = githubOnly
        ? { username: formData.github.trim(), range }
        : formData

      const resp = await fetch(url(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })
      if (!resp.ok) throw new Error('Analysis failed')
      const responsePayload = await resp.json()
      const normalizedPayload = githubOnly
        ? {
          github: responsePayload,
          leetcode: null,
          kaggle: null,
          overall_score: responsePayload?.profile?.score || 0,
          summary: buildTeacherInsight(responsePayload),
        }
        : responsePayload

      setAnalysisMode(githubOnly ? 'github' : 'multi')
      setGithubRange(range)
      setData(normalizedPayload)
      setPage('dashboard')
    } catch (err) {
      alert(err.message || 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [githubRange])

  const refreshGitHub = useCallback(async (range) => {
    if (!form.github?.trim() || form.leetcode?.trim() || form.kaggle?.trim()) return
    await handleAnalyze(form, range)
  }, [form, handleAnalyze])

  if (page === 'dashboard' && data) {
    return (
      <Dashboard
        data={data}
        form={form}
        onBack={() => setPage('landing')}
        canRefreshGithub={analysisMode === 'github'}
        onRefreshGitHub={refreshGitHub}
        theme={theme}
        toggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />
    )
  }

  return <LandingPage onAnalyze={handleAnalyze} loading={loading} />
}
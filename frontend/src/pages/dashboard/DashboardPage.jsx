import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, MoreHorizontal, Sparkles, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import ComplaintTable from '../../components/complaints/ComplaintTable'

const fallback = { metrics: { total_complaints: 0, pending_verification: 0, high_priority: 0, completed_this_month: 0 }, monthly: [], distribution: [], recent_complaints: [], notice: 'Belum ada data pengaduan di database.' }

function Metric({ icon: Icon, label, value, note, tone }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={20} /></div><div className="metric-content"><span>{label}</span><strong>{value.toLocaleString('id-ID')}</strong><small>{note}</small></div><MoreHorizontal size={18} className="metric-more" /></div>
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    fetch('/api/dashboard').then(response => { if (!response.ok) throw new Error('Dashboard API gagal diakses'); return response.json() }).then(data => { if (active) setDashboard({ ...fallback, ...data }) }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const metrics = dashboard.metrics || fallback.metrics
  const total = metrics.total_complaints || 0
  const distribution = dashboard.distribution || []
  const complaints = useMemo(() => (dashboard.recent_complaints || []).map(row => ({ ...row, citizen: row.citizen_name })), [dashboard.recent_complaints])
  return <>
    {error && <div className="dashboard-notice error">{error}. Pastikan backend dan database aktif.</div>}
    {dashboard.notice && !loading && <div className="dashboard-notice">{dashboard.notice}</div>}
    <section className="metrics"><Metric icon={ClipboardList} label="Total Pengaduan" value={metrics.total_complaints} note="Data dari database" tone="red" /><Metric icon={Clock3} label="Menunggu Verifikasi" value={metrics.pending_verification} note="Data dari database" tone="amber" /><Metric icon={Zap} label="Prioritas Tinggi" value={metrics.high_priority} note="Data dari database" tone="purple" /><Metric icon={CheckCircle2} label="Selesai Bulan Ini" value={metrics.completed_this_month} note="Data dari database" tone="green" /></section>
    <section className="chart-grid"><div className="panel chart-panel"><div className="panel-head"><div><h2>Tren Pengaduan</h2><p>Jumlah pengaduan masuk dalam 6 bulan terakhir</p></div><button className="select">6 Bulan <ChevronDown size={14} /></button></div><div className="legend"><span><i className="dot red-dot" /> Pengaduan Masuk</span></div><ResponsiveContainer width="100%" height={220}><BarChart data={dashboard.monthly || []} barGap={8}><CartesianGrid vertical={false} stroke="#eef0f3" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8a919c', fontSize: 12 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8a919c', fontSize: 12 }} /><Tooltip cursor={{ fill: '#fff5f5' }} /><Bar dataKey="value" fill="#b91c1c" radius={[5, 5, 0, 0]} barSize={24} /></BarChart></ResponsiveContainer></div><div className="panel distribution"><div className="panel-head"><div><h2>Berdasarkan Kategori</h2><p>Distribusi pengaduan</p></div><MoreHorizontal size={18} /></div><div className="donut-wrap"><ResponsiveContainer width="100%" height={170}><PieChart><Pie data={distribution} innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">{distribution.map(item => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="donut-center"><strong>{total.toLocaleString('id-ID')}</strong><span>Total</span></div></div><div className="category-legend">{distribution.map(item => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><b>{total ? `${Math.round((item.value / total) * 100)}%` : '0%'}</b></div>)}</div>{!distribution.length && <p className="empty-chart">Belum ada kategori pada database.</p>}</div></section>
    <section className="panel table-panel"><div className="panel-head"><div><h2>Pengaduan Terbaru</h2><p>Pengaduan yang baru saja masuk ke sistem</p></div><button className="link-btn" onClick={() => navigate('/admin/complaints')}>Lihat semua <ChevronRight size={15} /></button></div>{loading ? <div className="empty-chart">Memuat data...</div> : <ComplaintTable rows={complaints.slice(0, 4)} />}</section>
    <section className="bottom-grid"><div className="panel ai-callout"><div className="ai-glow"><Sparkles size={22} /></div><div><Badge tone="purple">AI INSIGHT</Badge><h2>Analisis berbasis data</h2><p>Insight AI akan muncul setelah pengaduan tersedia dan dianalisis oleh sistem.</p></div><button className="dark-btn" onClick={() => navigate('/admin/ai/predictions')}>Tinjau sekarang <ChevronRight size={16} /></button></div><div className="panel activity"><div className="panel-head"><h2>Aktivitas Terkini</h2><button className="link-btn" onClick={() => navigate('/admin/system/activity-logs')}>Lihat log</button></div><div className="empty-chart">Aktivitas akan tampil dari database.</div></div></section>
  </>
}

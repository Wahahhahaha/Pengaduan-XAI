import { useEffect, useMemo, useState } from 'react'
import { FileBarChart2, Search } from 'lucide-react'
import ComplaintTable from '../../components/complaints/ComplaintTable'

export default function ComplaintsPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({ Semua: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/complaints').then(response => {
      if (!response.ok) throw new Error('Failed to load complaints')
      return response.json()
    }).then(data => { setItems(data.items || []); setCounts(data.counts || { Semua: 0 }) })
      .catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  const statuses = Object.keys(counts).filter(status => status !== 'Semua')
  const statusLabels = { 'Menunggu Verifikasi': 'Pending Verification', Diverifikasi: 'Verified', Ditugaskan: 'Assigned', 'Dalam Penanganan': 'In Progress', 'Menunggu Konfirmasi': 'Waiting Confirmation', Selesai: 'Completed', Ditolak: 'Rejected' }
  const priorityLabels = { Rendah: 'Low', Sedang: 'Medium', Tinggi: 'High', Mendesak: 'Urgent' }
  const priorities = ['All', 'Low', 'Medium', 'High', 'Urgent']
  const filtered = useMemo(() => items.filter(item =>
    (filter === 'All' || item.status === filter) &&
    (priorityFilter === 'All' || priorityLabels[item.priority] === priorityFilter) &&
    `${item.id} ${item.title} ${item.citizen_name}`.toLowerCase().includes(query.trim().toLowerCase())
  ).map(item => ({ ...item, citizen: item.citizen_name, status: statusLabels[item.status] || item.status, priority: priorityLabels[item.priority] || item.priority })), [items, query, filter, priorityFilter])
  const matchingStatusCount = filter === 'All' ? items.length : counts[filter] || 0

  return <div className="page-stack">
    {error && <div className="dashboard-notice error">{error}</div>}
    <div className="page-toolbar complaints-toolbar">
      <div className="search-box"><Search size={17} /><input aria-label="Search complaints" placeholder="Search ID, title, or reporter..." value={query} onChange={event => setQuery(event.target.value)} /></div>
      <select aria-label="Filter complaint status" value={filter} onChange={event => setFilter(event.target.value)}><option value="All">All statuses ({counts.Semua || 0})</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status] || status} ({counts[status] || 0})</option>)}</select>
      <select aria-label="Filter complaint priority" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}>{priorities.map(priority => <option key={priority}>{priority === 'All' ? 'All priorities' : priority}</option>)}</select>
    </div>
    <div className="panel table-panel full-table">
      <div className="panel-head"><div><h2>Complaints</h2><p>Manage and monitor all public complaints.</p></div><button className="outline-btn"><FileBarChart2 size={16} /> Export</button></div>
      {loading ? <div className="empty-chart">Loading complaints…</div> : <ComplaintTable rows={filtered} />}
      {!loading && <div className="pagination"><span>Showing <b>{filtered.length}</b> of <b>{matchingStatusCount}</b> complaints</span></div>}
    </div>
  </div>
}

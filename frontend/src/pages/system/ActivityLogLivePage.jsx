import { useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'

const actionKind = action => String(action || '').trim().split(/\s+/)[0] || 'Other'

export default function ActivityLogLivePage() {
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [actor, setActor] = useState('all')
  const [action, setAction] = useState('all')
  const [location, setLocation] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')

  const load = () => fetch('/api/activity-logs').then(response => {
    if (!response.ok) throw new Error('Unable to load activity log')
    return response.json()
  }).then(data => { setItems(data.items || []); setError('') }).catch(err => setError(err.message))
  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer) }, [])

  const actors = [...new Set(items.map(item => item.actor).filter(Boolean))].sort()
  const actions = [...new Set(items.map(item => actionKind(item.action)))].sort()
  const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity
  const toTime = dateTo ? new Date(`${dateTo}T00:00:00`).getTime() + 24 * 60 * 60 * 1000 : Infinity
  const filtered = items.filter(item => {
    const hasLocation = item.latitude != null && item.longitude != null
    const time = new Date(item.created_at).getTime()
    return (actor === 'all' || item.actor === actor) &&
      (action === 'all' || actionKind(item.action) === action) &&
      (location === 'all' || (location === 'available') === hasLocation) &&
      time >= fromTime && time < toTime &&
      `${item.actor} ${item.action} ${item.ip_address} ${item.latitude ?? ''} ${item.longitude ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  })
  const clearFilters = () => { setQuery(''); setActor('all'); setAction('all'); setLocation('all'); setDateFrom(''); setDateTo('') }

  return <div className="resource-page"><div className="panel table-panel"><div className="panel-head"><div><h2>Activity Log</h2><p>Website visits and data changes with IP address and available location.</p></div><button className="outline-btn" onClick={load}><RefreshCw size={16} /> Refresh</button></div><div className="activity-filter"><div className="search-box"><Search size={17} /><input aria-label="Search activity logs" placeholder="Search activities, users, or IP..." value={query} onChange={event => setQuery(event.target.value)} /></div><select aria-label="Filter by user" value={actor} onChange={event => setActor(event.target.value)}><option value="all">All users</option>{actors.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Filter by action" value={action} onChange={event => setAction(event.target.value)}><option value="all">All actions</option>{actions.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Filter by location" value={location} onChange={event => setLocation(event.target.value)}><option value="all">All locations</option><option value="available">With coordinates</option><option value="unavailable">Without coordinates</option></select><label>From<input aria-label="From date" type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} /></label><label>To<input aria-label="To date" type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} /></label><button className="outline-btn" onClick={clearFilters}>Clear</button></div><p className="filter-summary">Showing {filtered.length} of {items.length} activities</p>{error && <div className="dashboard-notice error">{error}</div>}<div className="table-wrap"><table><thead><tr><th>USER</th><th>ACTIVITY DETAILS</th><th>IP ADDRESS</th><th>LATITUDE</th><th>LONGITUDE</th><th>TIME</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td>{item.actor}</td><td className="activity-action">{item.action}</td><td>{item.ip_address}</td><td>{item.latitude ?? 'Unavailable'}</td><td>{item.longitude ?? 'Unavailable'}</td><td>{new Date(item.created_at).toLocaleString('en-US')}</td></tr>)}</tbody></table>{!filtered.length && !error && <div className="empty-chart">No activities match the current filters.</div>}</div></div></div>
}

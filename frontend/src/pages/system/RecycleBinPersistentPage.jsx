import { useEffect, useState } from 'react'
import { ArchiveRestore, RefreshCw, Search, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/ModalAnimated'
import { getAuth, hasPermission } from '../../app/permissions'
import { recordActivity } from '../../app/activity'
import { useToast } from '../../app/toast'

const typeLabel = { users: 'User', categories: 'Category' }

export default function RecycleBinPersistentPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const canRestore = hasPermission('recycle_bin.restore', getAuth())
  const canDelete = hasPermission('recycle_bin.delete', getAuth())
  const load = async () => {
    const response = await fetch('/api/recycle-bin')
    if (!response.ok) throw new Error('Unable to load Recycle Bin.')
    setItems((await response.json()).items)
  }
  useEffect(() => { load().catch(error => toast(error.message, 'error')) }, [toast])
  const restore = async item => {
    try {
      const response = await fetch(`/api/recycle-bin/${item.type}/${item.record_id}/restore`, { method: 'POST' })
      if (!response.ok) throw new Error('Unable to restore data.')
      recordActivity(`Restored ${item.type}: ${item.identity}`)
      await load()
      toast(`${typeLabel[item.type] || 'Data'} restored successfully.`)
    } catch (error) { toast(error.message || 'Unable to restore data.', 'error') }
  }
  const permanentlyDelete = async () => {
    try {
      const response = await fetch(`/api/recycle-bin/${selected.type}/${selected.record_id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to delete data permanently.')
      recordActivity(`Permanently deleted ${selected.type}: ${selected.identity}`)
      setSelected(null)
      await load()
      toast('Data permanently deleted.')
    } catch (error) { toast(error.message, 'error') }
  }
  const nameOf = item => item.data.email || item.data.name || 'Untitled data'
  const filtered = items.filter(item => (typeFilter === 'all' || item.type === typeFilter) && `${nameOf(item)} ${typeLabel[item.type] || item.type}`.toLowerCase().includes(query.toLowerCase()))

  return <div className="resource-page recycle-bin-page"><div className="panel table-panel"><div className="panel-head"><div><h2>Recycle Bin</h2><p>Restore deleted data or remove it permanently.</p></div><Badge tone={items.length ? 'amber' : 'green'}>{items.length} deleted</Badge></div><div className="recycle-filters"><div className="search-box"><Search size={17} /><input aria-label="Search deleted data" placeholder="Search deleted data..." value={query} onChange={event => setQuery(event.target.value)} /></div><select aria-label="Filter data type" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">All types</option><option value="users">Users</option><option value="categories">Categories</option></select></div>{!filtered.length ? <div className="empty-chart"><ArchiveRestore size={28} /><span>{items.length ? 'No matching data found.' : 'Recycle Bin is empty.'}</span></div> : <div className="table-wrap"><table><thead><tr><th>DATA</th><th>TYPE</th><th>DELETED AT</th><th>ACTIONS</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><b className="dark-text">{nameOf(item)}</b></td><td><Badge tone="neutral">{typeLabel[item.type] || item.type}</Badge></td><td className="muted">{new Date(item.deletedAt).toLocaleString('en-US')}</td><td><div className="recycle-actions">{canRestore && <button className="outline-btn" onClick={() => restore(item)}><RefreshCw size={14} /> Restore</button>}{canDelete && <button className="danger-btn recycle-delete-btn" onClick={() => setSelected(item)}><Trash2 size={14} /> Delete Permanently</button>}</div></td></tr>)}</tbody></table></div>}</div>{selected && <Modal title="Delete permanently?" onClose={() => setSelected(null)} footer={<><button className="outline-btn" onClick={() => setSelected(null)}>Cancel</button><button className="danger-btn" onClick={permanentlyDelete}>Delete Permanently</button></>}><p><b>{nameOf(selected)}</b> will be permanently removed and cannot be restored.</p></Modal>}</div>
}

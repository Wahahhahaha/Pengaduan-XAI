import { useEffect, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import IconButton from '../../components/ui/IconButton'
import Modal from '../../components/ui/ModalAnimated'
import { useToast } from '../../app/toast'
import { recordActivity } from '../../app/activity'

function ListingPage({ type }) {
  const toast = useToast()
  const isCategory = type === 'categories'
  const title = isCategory ? 'Category Management' : 'Institution Management'
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [draft, setDraft] = useState({ name: '', description: '' })
  const [busy, setBusy] = useState(false)
  const load = async () => {
    const response = await fetch(`/api/master-data/${type}`)
    if (!response.ok) throw new Error(`Unable to load ${type}.`)
    setItems((await response.json()).items)
  }
  useEffect(() => { load().catch(error => toast(error.message, 'error')) }, [type, toast])
  const save = async () => {
    if (!draft.name.trim()) return toast('Name is required.', 'error')
    setBusy(true)
    try {
      const target = modal.mode === 'add' ? `/api/master-data/${type}` : `/api/master-data/${type}/${modal.item.id}`
      const response = await fetch(target, { method: modal.mode === 'add' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, status: modal.item?.status || 'Active' }) })
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to save data.')
      await load()
      recordActivity(`${modal.mode === 'add' ? 'Created' : 'Updated'} ${isCategory ? 'category' : 'institution'} ${draft.name}`)
      setModal(null)
      toast('Data saved successfully.')
    } catch (error) { toast(error.message, 'error') }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/master-data/${type}/${modal.item.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to delete data.')
      await load()
      recordActivity(`Deleted ${isCategory ? 'category' : 'institution'} ${modal.item.name}; moved to Recycle Bin`)
      setModal(null)
      toast('Data moved to Recycle Bin.')
    } catch (error) { toast(error.message, 'error') }
    finally { setBusy(false) }
  }
  const visible = items.filter(item => `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()))

  return <div className="resource-page"><div className="page-toolbar"><div className="search-box"><Search size={17} /><input placeholder={`Search ${isCategory ? 'categories' : 'institutions'}...`} value={query} onChange={event => setQuery(event.target.value)} /></div><button className="primary-btn" onClick={() => { setDraft({ name: '', description: '' }); setModal({ mode: 'add' }) }}><Plus size={17} /> Add {isCategory ? 'Category' : 'Institution'}</button></div><div className="panel table-panel"><div className="panel-head"><div><h2>{title}</h2><p>Manage reference data used in the complaint workflow.</p></div><Badge tone="blue">{items.length} items</Badge></div><div className="table-wrap"><table><thead><tr><th>NAME</th><th>DESCRIPTION</th><th>{isCategory ? 'COMPLAINTS' : 'STATUS'}</th><th /></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td><b className="dark-text">{item.name}</b></td><td className="muted">{item.description}</td><td><Badge tone={isCategory ? 'neutral' : 'green'}>{isCategory ? `${item.complaint_count} complaints` : item.status}</Badge></td><td><IconButton label="Edit" onClick={() => { setDraft({ name: item.name, description: item.description }); setModal({ mode: 'edit', item }) }}><Pencil size={15} /></IconButton><IconButton label="Move to Recycle Bin" onClick={() => setModal({ mode: 'delete', item })}><Trash2 size={15} /></IconButton></td></tr>)}</tbody></table></div></div>{modal?.mode === 'delete' && <Modal title="Delete data?" onClose={() => setModal(null)} footer={<><button className="outline-btn" onClick={() => setModal(null)}>Cancel</button><button className="danger-btn" disabled={busy} onClick={remove}>Delete</button></>}><p>Are you sure you want to delete <b>{modal.item.name}</b>?</p></Modal>}{(modal?.mode === 'add' || modal?.mode === 'edit') && <Modal title={modal.mode === 'add' ? `Add ${isCategory ? 'Category' : 'Institution'}` : `Edit ${isCategory ? 'Category' : 'Institution'}`} onClose={() => setModal(null)} footer={<><button className="outline-btn" onClick={() => setModal(null)}>Cancel</button><button className="primary-btn" disabled={busy} onClick={save}>Save</button></>}><label className="modal-field">Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label className="modal-field">Description<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label></Modal>}</div>
}

export function CategoriesPage() { return <ListingPage type="categories" /> }
export function DepartmentsPage() { return <ListingPage type="departments" /> }

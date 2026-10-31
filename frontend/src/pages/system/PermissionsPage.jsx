import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { getRolePermissions, hasPermission, loadRolePermissions, saveRolePermissions } from '../../app/permissions'
import { recordActivity } from '../../app/activity'
import { useToast } from '../../app/toast'
import Modal from '../../components/ui/ModalAnimated'

export default function PermissionsPage() {
  const toast = useToast()
  const [roles, setRoles] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedKey, setSelectedKey] = useState('petugas')
  const [newRole, setNewRole] = useState('')
  const [drafts, setDrafts] = useState({})
  const [dialog, setDialog] = useState(null)
  const [roleName, setRoleName] = useState('')
  const [busy, setBusy] = useState(false)
  const activeRole = roles.find(role => role.key === selectedKey)
  const checks = drafts[activeRole?.key] || getRolePermissions(activeRole?.key)
  const canManagePermissions = hasPermission('permissions.manage')
  const canManageRoles = hasPermission('roles.manage')

  useEffect(() => {
    fetch('/api/roles').then(response => {
      if (!response.ok) throw new Error('Unable to load roles.')
      return response.json()
    }).then(data => setRoles(data.items)).catch(error => toast(error.message, 'error'))
    fetch('/api/permissions').then(response => {
      if (!response.ok) throw new Error('Unable to load permissions.')
      return response.json()
    }).then(data => {
      const grouped = new Map()
      data.items.forEach(item => {
        if (!grouped.has(item.group_name)) grouped.set(item.group_name, [])
        grouped.get(item.group_name).push(item.code)
      })
      setGroups([...grouped].map(([name, permissions]) => ({ name, permissions })))
    }).catch(error => toast(error.message, 'error'))
  }, [toast])

  const toggle = permission => setDrafts(previous => {
    const current = previous[activeRole.key] || getRolePermissions(activeRole.key)
    return { ...previous, [activeRole.key]: current.includes(permission) ? current.filter(item => item !== permission) : [...current, permission] }
  })
  const save = async () => {
    if (!activeRole) return
    setBusy(true)
    try {
      const before = getRolePermissions(activeRole.key)
      await saveRolePermissions(activeRole.key, checks)
      const granted = checks.filter(item => !before.includes(item))
      const revoked = before.filter(item => !checks.includes(item))
      setDrafts(previous => { const next = { ...previous }; delete next[activeRole.key]; return next })
      recordActivity(`Updated permissions for role ${activeRole.name}: granted ${granted.join(', ') || 'none'}; revoked ${revoked.join(', ') || 'none'}`)
      toast(`${activeRole.name} permissions saved successfully.`)
    } catch (error) { toast(error.message || 'Permissions could not be saved.', 'error') }
    finally { setBusy(false) }
  }
  const addRole = async () => {
    const name = newRole.trim()
    if (!name) return toast('Role name is required.', 'error')
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    if (!key) return toast('Use letters or numbers in the role name.', 'error')
    setBusy(true)
    try {
      const response = await fetch('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, key }) })
      if (!response.ok) throw new Error((await response.json()).detail || 'Role could not be saved.')
      const created = await response.json()
      await loadRolePermissions()
      setRoles(previous => [...previous, created])
      setNewRole('')
      setSelectedKey(created.key)
      recordActivity(`Created role ${created.name}`)
      toast(`${created.name} role created.`)
    } catch (error) { toast(error.message || 'Role could not be saved.', 'error') }
    finally { setBusy(false) }
  }
  const renameRole = async () => {
    const name = roleName.trim()
    if (!name) return toast('Role name is required.', 'error')
    setBusy(true)
    try {
      const response = await fetch(`/api/roles/${encodeURIComponent(dialog.role.key)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      if (!response.ok) throw new Error((await response.json()).detail || 'Role could not be updated.')
      const updated = await response.json()
      setRoles(previous => previous.map(role => role.key === updated.key ? updated : role))
      recordActivity(`Renamed role ${dialog.role.name} to ${updated.name}`)
      setDialog(null)
      toast('Role name updated.')
    } catch (error) { toast(error.message, 'error') }
    finally { setBusy(false) }
  }
  const deleteRole = async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/roles/${encodeURIComponent(dialog.role.key)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error((await response.json()).detail || 'Role could not be deleted.')
      await loadRolePermissions()
      setRoles(previous => previous.filter(role => role.key !== dialog.role.key))
      setDrafts(previous => { const next = { ...previous }; delete next[dialog.role.key]; return next })
      if (selectedKey === dialog.role.key) setSelectedKey('petugas')
      recordActivity(`Deleted role ${dialog.role.name}`)
      setDialog(null)
      toast('Role deleted.')
    } catch (error) { toast(error.message, 'error') }
    finally { setBusy(false) }
  }

  return <div className="permissions-page">
    <div className="permissions-head"><div><h2>Role & Hak Akses</h2><p>Atur kewenangan berbasis permission untuk setiap role.</p></div><div className="add-role"><input disabled={!canManageRoles || busy} value={newRole} onChange={event => setNewRole(event.target.value)} placeholder="New role name" /><button className="primary-btn" disabled={!canManageRoles || busy} onClick={addRole}><Plus size={16} /> Add Role</button></div></div>
    <div className="permissions-layout"><div className="panel roles-panel"><div className="panel-head"><h2>Roles</h2><ShieldCheck size={18} color="#b91c1c" /></div>{roles.map(role => <div key={role.key} className={`role-row ${selectedKey === role.key ? 'selected' : ''}`}><button className="role-row-select" onClick={() => setSelectedKey(role.key)} aria-pressed={selectedKey === role.key}>{role.name}</button>{canManageRoles && role.key !== 'superadmin' && <div className="role-row-actions"><button aria-label={`Edit role ${role.name}`} title="Edit role" onClick={() => { setRoleName(role.name); setDialog({ mode: 'edit', role }) }}><Pencil size={14} /></button>{!['admin', 'petugas', 'citizen'].includes(role.key) && <button aria-label={`Delete role ${role.name}`} title="Delete role" onClick={() => setDialog({ mode: 'delete', role })}><Trash2 size={14} /></button>}</div>}</div>)}</div>
      <div className="panel matrix-panel"><div className="panel-head"><div><h2>Permissions: {activeRole?.name || 'Select a role'}</h2></div></div>{activeRole && <div key={activeRole.key} className="role-permission-content">{activeRole.key === 'superadmin' ? <div className="immutable"><Check size={17} /> Superadmin has full access and its permissions are locked.</div> : !canManagePermissions && <div className="immutable">You have view-only access. Permission management access is required to make changes.</div>}<div className="permission-groups">{groups.map(group => <div className="permission-group" key={group.name}><h3>{group.name}</h3>{group.permissions.map(permission => <label key={permission} className="permission-row"><input type="checkbox" checked={activeRole.key === 'superadmin' || checks.includes(permission)} disabled={activeRole.key === 'superadmin' || !canManagePermissions} onChange={() => toggle(permission)} /><span className="fake-check"><Check size={12} /></span><span>{permission}</span></label>)}</div>)}</div><div className="matrix-footer"><span>{activeRole.key === 'superadmin' ? 'Superadmin permissions cannot be changed.' : 'Save changes to apply permissions to this role.'}</span><button className="primary-btn" disabled={activeRole.key === 'superadmin' || !canManagePermissions || busy} onClick={save}>{busy ? 'Saving…' : 'Save Changes'}</button></div></div>}</div>
    </div>
    {dialog?.mode === 'edit' && <Modal title="Edit role name" onClose={() => setDialog(null)} footer={<><button className="outline-btn" onClick={() => setDialog(null)}>Cancel</button><button className="primary-btn" disabled={busy} onClick={renameRole}>Save</button></>}><label className="modal-field">Role name<input value={roleName} onChange={event => setRoleName(event.target.value)} maxLength={120} autoFocus /></label></Modal>}
    {dialog?.mode === 'delete' && <Modal title="Delete role?" onClose={() => setDialog(null)} footer={<><button className="outline-btn" onClick={() => setDialog(null)}>Cancel</button><button className="danger-btn" disabled={busy} onClick={deleteRole}>Delete</button></>}><p>Are you sure you want to delete <b>{dialog.role.name}</b>? This role's permissions will also be removed.</p></Modal>}
  </div>
}

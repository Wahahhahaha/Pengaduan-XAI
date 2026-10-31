export const permissionByRoute = {
  '/admin/dashboard': 'dashboard.view',
  '/admin/complaints': 'complaints.view',
  '/admin/complaints/new': 'complaints.create',
  '/admin/complaints/verification': 'complaints.verify',
  '/admin/complaints/processing': 'complaints.update',
  '/admin/complaints/completed': 'complaints.view',
  '/admin/ai/predictions': 'ai_predictions.view',
  '/admin/ai/explanations': 'ai_explanations.view',
  '/admin/ai/evaluation': 'ai_models.manage',
  '/admin/reports': 'reports.view',
  '/admin/notifications': 'notifications.view',
  '/admin/users': 'users.view',
  '/admin/categories': 'categories.view',
  '/admin/system/settings': 'settings.view',
  '/admin/system/activity-logs': 'activity_logs.view',
  '/admin/system/roles': 'roles.view',
  '/admin/system/permissions': 'permissions.view',
  '/admin/system/backup': 'backup.view',
  '/admin/system/recycle-bin': 'recycle_bin.view',
}

let rolePermissions = {}
export const roleLabels = { superadmin: 'Superadmin', admin: 'Admin', petugas: 'Officer', citizen: 'Citizen' }

export function getRolePermissions(role) {
  return rolePermissions[role] || []
}

export async function loadRolePermissions() {
  try {
    const response = await fetch('/api/role-permissions', { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('Unable to load permissions.')
    const server = await response.json()
    rolePermissions = server
    window.dispatchEvent(new Event('laporkita-permissions-updated'))
  } catch { rolePermissions = {} }
}

export async function saveRolePermissions(role, permissions) {
  if (role === 'superadmin') throw new Error('Superadmin permissions cannot be changed.')
  const response = await fetch(`/api/role-permissions/${encodeURIComponent(role)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions }) })
  if (!response.ok) throw new Error('Permissions could not be saved to the server.')
  const savedRole = await response.json()
  rolePermissions = { ...rolePermissions, [role]: savedRole.permissions }
  window.dispatchEvent(new Event('laporkita-permissions-updated'))
}

export function getAuth() {
  try { return JSON.parse(localStorage.getItem('laporkita-auth') || 'null') } catch { return null }
}

export async function refreshAuthRole() {
  const auth = getAuth()
  if (!auth?.email) return
  try {
    const response = await fetch(`/api/users/by-email/${encodeURIComponent(auth.email)}`, { signal: AbortSignal.timeout(5000) })
    if (response.status === 404) { localStorage.removeItem('laporkita-auth'); return }
    if (!response.ok) return
    const user = await response.json()
    localStorage.setItem('laporkita-auth', JSON.stringify({ ...auth, name: user.name, role: user.role_key, role_id: user.role_id }))
  } catch { /* keep the current session when the API is temporarily unavailable */ }
}

export function hasPermission(permission, auth = getAuth()) {
  if (!auth?.role) return false
  const permissions = getRolePermissions(auth.role)
  return permissions.includes('*') || permissions.includes(permission)
}

export function canAccessRoute(pathname, auth = getAuth()) {
  if (pathname === '/admin/system/roles' || pathname === '/admin/system/permissions') {
    return hasPermission('roles.view', auth) && hasPermission('permissions.view', auth)
  }
  const permission = permissionByRoute[pathname]
  return !permission || hasPermission(permission, auth)
}

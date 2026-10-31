import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import './pages/complaints/ComplaintDetailPage.css'
import App from './app/App.jsx'
import { loadRolePermissions, refreshAuthRole } from './app/permissions.js'

Promise.all([loadRolePermissions(), refreshAuthRole()]).finally(() => createRoot(document.getElementById('root')).render(<App />))

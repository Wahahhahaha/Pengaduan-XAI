import { useEffect, useRef, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import AppSidebar from '../components/layout/AppSidebar'
import AppHeader from '../components/layout/AppHeader?notifications=v3'

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const outlet = useOutlet()
  const firstRender = useRef(true)
  const [displayedOutlet, setDisplayedOutlet] = useState(outlet)
  const [phase, setPhase] = useState('ready')
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return undefined }
    setPhase('exit')
    const timer = window.setTimeout(() => { setDisplayedOutlet(outlet); setPhase('enter') }, 160)
    return () => window.clearTimeout(timer)
  }, [location.key])
  return <div className="app-shell"><AppSidebar collapsed={collapsed} setCollapsed={setCollapsed} /><main className="main"><AppHeader onMenu={() => setCollapsed(false)} /><div className="content"><div className={`page-transition ${phase}`}>{displayedOutlet}</div></div></main></div>
}

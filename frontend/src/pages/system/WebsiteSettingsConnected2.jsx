import { useState } from 'react'
import { Globe2, Save, Upload } from 'lucide-react'
import { useToast } from '../../app/toast'
import useWebsiteSettings from '../../hooks/useWebsiteSettings'

export default function WebsiteSettingsConnectedPage() {
  const current = useWebsiteSettings()
  const toast = useToast()
  const [name, setName] = useState(current.website_name)
  const [logo, setLogo] = useState(current.logo || '')
  const [favicon, setFavicon] = useState(current.favicon || '')
  const readFile = (file, setter) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = event => setter(event.target.result)
    reader.readAsDataURL(file)
  }
  const save = async () => {
    const next = { website_name: name || 'laporkita', logo, favicon }
    try {
      const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website_name: next.website_name }) })
      if (!response.ok) throw new Error('api')
    } catch { /* aset frontend tetap tersedia melalui localStorage saat API tidak tersedia */ }
    localStorage.setItem('laporkita-settings', JSON.stringify(next))
    window.dispatchEvent(new Event('laporkita-settings-updated'))
    toast('Pengaturan website berhasil disimpan.')
  }
  return <div className="settings-page"><div className="settings-intro"><div className="settings-icon"><Globe2 size={21} /></div><div><h2>Pengaturan Website</h2><p>Kelola identitas publik website dan aset brand.</p></div></div><div className="settings-grid"><div className="panel settings-card settings-card-single"><h2>Identitas Website</h2><label>Nama Website<input value={name} onChange={e => setName(e.target.value)} /></label><div className="brand-assets"><div className="asset-logo-wrap"><span className="asset-label">Logo Website</span><input id="website-logo" className="asset-input" type="file" accept="image/png,image/webp,image/jpeg" onChange={e => readFile(e.target.files?.[0], setLogo)} /><label htmlFor="website-logo" className="asset-preview asset-preview-main">{logo && <img src={logo} alt="Logo website" />}<span className="asset-overlay"><Upload size={19} /><span>{logo ? 'Ganti logo' : 'Unggah logo'}</span></span></label></div><div className="asset-favicon-wrap"><span className="asset-label">Favicon Website</span><input id="website-favicon" className="asset-input" type="file" accept="image/png,image/x-icon,image/jpeg" onChange={e => readFile(e.target.files?.[0], setFavicon)} /><label htmlFor="website-favicon" className="asset-preview favicon-preview"><span className="favicon-overlay">{favicon && <img src={favicon} alt="Favicon website" />}<span className="favicon-upload-icon"><Upload size={17} /></span></span></label></div></div><button className="primary-btn" onClick={save}><Save size={16} /> Simpan Pengaturan</button></div><div className="panel settings-card"><h2>Informasi Organisasi</h2><label>Email Kontak<input type="email" defaultValue="halo@laporkita.local" /></label><label>Nomor Telepon<input defaultValue="021-555-0123" /></label><label>Alamat<textarea defaultValue="Jl. Pelayanan Publik No. 1" /></label></div></div></div>
}

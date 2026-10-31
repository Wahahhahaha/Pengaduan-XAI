import { useEffect, useState } from 'react'
import { Globe2, Save, Upload } from 'lucide-react'
import { useToast } from '../../app/toast'
import useWebsiteSettings, { setWebsiteSettings } from '../../hooks/useWebsiteSettings'
import { recordActivity } from '../../app/activity'
import ImageCropModal from '../../components/ui/ImageCropModal'

export default function SystemSettingsSplitPage() {
  const current = useWebsiteSettings()
  const toast = useToast()
  const [form, setForm] = useState({ website_name: '', logo: '', favicon: '', contact_email: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false); const [cropFile, setCropFile] = useState(null)
  useEffect(() => { setForm(previous => ({ ...previous, ...current })) }, [current])
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  const chooseImage = (event, key) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) setCropFile({ file, key }) }
  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!response.ok) throw new Error('Unable to save system settings.')
      setWebsiteSettings(await response.json())
      recordActivity(`Updated system settings for website ${form.website_name}`)
      toast('System settings saved.')
    } catch (error) { toast(error.message, 'error') }
    finally { setSaving(false) }
  }
  return <><div className="settings-page"><div className="settings-intro"><div className="settings-icon"><Globe2 size={21} /></div><div><h2>System Settings</h2><p>Manage website identity, branding assets, and contact details.</p></div></div><div className="panel settings-card settings-card-combined"><h2>System Settings</h2><div className="settings-columns"><section><label>Website Name<input value={form.website_name} onChange={event => change('website_name', event.target.value)} /></label><div className="brand-assets"><div className="asset-logo-wrap"><span className="asset-label">Website Logo</span><input id="website-logo" className="asset-input" type="file" accept="image/png,image/webp,image/jpeg" onChange={event => chooseImage(event, 'logo')} /><label htmlFor="website-logo" className="asset-preview asset-preview-main">{form.logo && <img src={form.logo} alt="Website logo" />}<span className="asset-overlay"><Upload size={19} /><span>{form.logo ? 'Change logo' : 'Upload logo'}</span></span></label></div><div className="asset-favicon-wrap"><span className="asset-label">Website Favicon</span><input id="website-favicon" className="asset-input" type="file" accept="image/png,image/x-icon,image/jpeg" onChange={event => chooseImage(event, 'favicon')} /><label htmlFor="website-favicon" className="asset-preview favicon-preview"><span className="favicon-overlay">{form.favicon && <img src={form.favicon} alt="Website favicon" />}<span className="favicon-upload-icon"><Upload size={17} /></span></span></label></div></div></section><section><label>Contact Email<input type="email" value={form.contact_email} onChange={event => change('contact_email', event.target.value)} /></label><label>Phone Number<input value={form.phone} onChange={event => change('phone', event.target.value)} /></label><label>Address<textarea value={form.address} onChange={event => change('address', event.target.value)} /></label></section></div><div className="settings-actions"><button className="primary-btn" disabled={saving} onClick={save}><Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}</button></div></div></div>{cropFile && <ImageCropModal file={cropFile.file} onCancel={() => setCropFile(null)} onApply={result => { change(cropFile.key, result.data); setCropFile(null) }} />}</>
}

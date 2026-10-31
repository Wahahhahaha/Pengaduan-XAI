import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import './ImageCropModal.css'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export default function ImageCropModal({ file, onCancel, onApply }) {
  const [source, setSource] = useState(''); const [crop, setCrop] = useState({ x: 12, y: 12, width: 76, height: 76 }); const stageRef = useRef(null); const dragRef = useRef(null)
  useEffect(() => { if (!file) return undefined; const url = URL.createObjectURL(file); setSource(url); return () => URL.revokeObjectURL(url) }, [file])
  useEffect(() => {
    const move = event => { const drag = dragRef.current; const stage = stageRef.current; if (!drag || !stage) return; const rect = stage.getBoundingClientRect(); const dx = (event.clientX - drag.startX) / rect.width * 100; const dy = (event.clientY - drag.startY) / rect.height * 100; const start = drag.crop; let next = { ...start }
      if (drag.corner.includes('e')) next.width = clamp(start.width + dx, 8, 100 - start.x)
      if (drag.corner.includes('s')) next.height = clamp(start.height + dy, 8, 100 - start.y)
      if (drag.corner.includes('w')) { const right = start.x + start.width; next.x = clamp(start.x + dx, 0, right - 8); next.width = right - next.x }
      if (drag.corner.includes('n')) { const bottom = start.y + start.height; next.y = clamp(start.y + dy, 0, bottom - 8); next.height = bottom - next.y }
      setCrop(next)
    }
    const stop = () => { dragRef.current = null }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
  }, [])
  const startDrag = (corner, event) => { event.preventDefault(); dragRef.current = { corner, startX: event.clientX, startY: event.clientY, crop } }
  const apply = () => { const image = new Image(); image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * crop.width / 100)); canvas.height = Math.max(1, Math.round(image.naturalHeight * crop.height / 100)); canvas.getContext('2d').drawImage(image, image.naturalWidth * crop.x / 100, image.naturalHeight * crop.y / 100, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height); onApply({ name: file.name, data: canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg') }) }; image.src = source }
  if (!file || !source) return null
  return createPortal(<div className="image-crop-backdrop"><div className="image-crop-modal" role="dialog" aria-modal="true" aria-label="Crop image"><div className="image-crop-head"><div><h2>Crop image</h2><p>Drag the four corners to select the area.</p></div><button type="button" className="image-crop-close" onClick={onCancel} aria-label="Close"><X size={18} /></button></div><div className="image-crop-stage" ref={stageRef}><img src={source} alt="Crop preview" /><div className="image-crop-box" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}>{['nw', 'ne', 'sw', 'se'].map(corner => <button type="button" key={corner} className={`image-crop-handle ${corner}`} onPointerDown={event => startDrag(corner, event)} aria-label={`Drag ${corner} crop corner`} />)}</div></div><div className="image-crop-footer"><button type="button" className="outline-btn" onClick={onCancel}>Cancel</button><button type="button" className="primary-btn" onClick={apply}><Check size={15} /> Apply crop</button></div></div></div>, document.body)
}

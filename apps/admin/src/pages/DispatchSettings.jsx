import { useState, useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, Loader, Save, Plus, Pencil, Trash2, X, Radio } from 'lucide-react'
import api from '../../../../shared/api'
import toast from 'react-hot-toast'

const ACCRA = [5.6037, -0.1870]
const ZONE_COLORS = ['#F89A38', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#f59e0b']
const BOUNDARY_OPTIONS = [10, 20, 30, 50, 75, 100, 150, 200]
const RADIUS_OPTIONS = [1, 2, 3, 5, 7, 10, 15, 20]

const EMPTY_DRAFT = { name: '', centerLat: null, centerLng: null, zoneBoundaryKm: 50, dispatchRadiusKm: 5 }

function makePinIcon(label, color) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;font-size:11px;font-weight:700;padding:3px 7px;border-radius:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:2px solid #fff">${label}</div>`,
    iconAnchor: [0, 0],
  })
}

const DRAFT_PIN_ICON = L.divIcon({
  className: '',
  html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path fill="#666" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

export default function DispatchSettings() {
  // Global config state
  const [config, setConfig] = useState({ radiusKm: 5, fallbackSecs: 90, locationFreshMins: 10 })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Global preview map state (used when no zones defined)
  const [previewCenter, setPreviewCenter] = useState(ACCRA)
  const [previewQuery, setPreviewQuery] = useState('')
  const [previewResults, setPreviewResults] = useState([])

  // Zones state
  const [zones, setZones] = useState([])
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [zoneDraft, setZoneDraft] = useState(EMPTY_DRAFT)
  const [zoneSaving, setZoneSaving] = useState(false)
  const [zoneQuery, setZoneQuery] = useState('')
  const [zoneResults, setZoneResults] = useState([])

  // Leaflet refs
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const previewCircleRef = useRef(null)
  const previewPinRef = useRef(null)
  const zoneLayersRef = useRef({})
  const draftCircleRef = useRef(null)
  const draftPinRef = useRef(null)
  const previewDebounce = useRef(null)
  const zoneDebounce = useRef(null)

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      api.get('/admin/dispatch'),
      api.get('/admin/dispatch/zones'),
    ]).then(([cfgRes, zonesRes]) => {
      setConfig(cfgRes.data)
      setZones(zonesRes.data)
    }).catch(() => toast.error('Failed to load dispatch settings'))
      .finally(() => setLoading(false))
  }, [])

  async function refreshZones() {
    const { data } = await api.get('/admin/dispatch/zones')
    setZones(data)
  }

  // ── Map init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (loading || !mapRef.current || mapInst.current) return
    const map = L.map(mapRef.current).setView(ACCRA, 7)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Global preview circle (only visible when no zones defined)
    previewPinRef.current = L.marker(ACCRA, { icon: DRAFT_PIN_ICON }).addTo(map)
    previewCircleRef.current = L.circle(ACCRA, {
      radius: config.radiusKm * 1000,
      color: '#888', fillColor: '#888', fillOpacity: 0.06, weight: 2, dashArray: '6 4',
    }).addTo(map)

    mapInst.current = map
    return () => {
      map.remove()
      mapInst.current = null
      previewPinRef.current = null
      previewCircleRef.current = null
      zoneLayersRef.current = {}
      draftCircleRef.current = null
      draftPinRef.current = null
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zone layers ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapInst.current) return

    // Clear existing zone layers
    Object.values(zoneLayersRef.current).forEach(({ circle, pin }) => {
      circle.remove(); pin.remove()
    })
    zoneLayersRef.current = {}

    const hasZones = zones.length > 0

    // Show/hide the global preview based on whether zones exist
    if (previewCircleRef.current) {
      if (hasZones) {
        previewCircleRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
        previewPinRef.current?.setOpacity(0)
      } else {
        previewCircleRef.current.setStyle({ opacity: 1, fillOpacity: 0.06 })
        previewPinRef.current?.setOpacity(1)
      }
    }

    // Draw each zone
    zones.forEach((zone, i) => {
      const color = ZONE_COLORS[i % ZONE_COLORS.length]
      const circle = L.circle([zone.centerLat, zone.centerLng], {
        radius: zone.zoneBoundaryKm * 1000,
        color, fillColor: color, fillOpacity: 0.07, weight: 2,
      }).addTo(mapInst.current)
      const pin = L.marker([zone.centerLat, zone.centerLng], {
        icon: makePinIcon(zone.name, color),
      }).addTo(mapInst.current)
      zoneLayersRef.current[zone.id] = { circle, pin }
    })

    // Fit all zones in view if any exist
    if (hasZones) {
      const allCircles = Object.values(zoneLayersRef.current).map(l => l.circle)
      if (allCircles.length === 1) {
        mapInst.current.fitBounds(allCircles[0].getBounds(), { padding: [40, 40] })
      } else {
        const group = L.featureGroup(allCircles)
        mapInst.current.fitBounds(group.getBounds(), { padding: [40, 40] })
      }
    }
  }, [zones]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draft zone preview ────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapInst.current) return
    if (!showZoneForm || zoneDraft.centerLat == null) {
      draftCircleRef.current?.remove(); draftCircleRef.current = null
      draftPinRef.current?.remove(); draftPinRef.current = null
      return
    }
    const latlng = [zoneDraft.centerLat, zoneDraft.centerLng]
    const radiusM = zoneDraft.zoneBoundaryKm * 1000

    if (draftCircleRef.current) {
      draftCircleRef.current.setLatLng(latlng).setRadius(radiusM)
      draftPinRef.current?.setLatLng(latlng)
    } else {
      draftCircleRef.current = L.circle(latlng, {
        radius: radiusM, color: '#888', fillColor: '#888', fillOpacity: 0.1, weight: 2, dashArray: '5 4',
      }).addTo(mapInst.current)
      draftPinRef.current = L.marker(latlng, { icon: DRAFT_PIN_ICON }).addTo(mapInst.current)
    }
    mapInst.current.fitBounds(draftCircleRef.current.getBounds(), { padding: [40, 40] })
  }, [showZoneForm, zoneDraft.centerLat, zoneDraft.centerLng, zoneDraft.zoneBoundaryKm])

  // ── Map click-to-place (when zone form is open) ───────────────────────────

  const handleMapClick = useCallback(e => {
    setZoneDraft(d => ({ ...d, centerLat: e.latlng.lat, centerLng: e.latlng.lng }))
  }, [])

  useEffect(() => {
    if (!mapInst.current) return
    if (showZoneForm) {
      mapInst.current.on('click', handleMapClick)
      mapInst.current.getContainer().style.cursor = 'crosshair'
    } else {
      mapInst.current.off('click', handleMapClick)
      mapInst.current.getContainer().style.cursor = ''
    }
    return () => {
      mapInst.current?.off('click', handleMapClick)
    }
  }, [showZoneForm, handleMapClick])

  // ── Global preview: sync radius circle ───────────────────────────────────

  useEffect(() => {
    if (!previewCircleRef.current || zones.length > 0) return
    previewCircleRef.current.setRadius(config.radiusKm * 1000)
    mapInst.current?.fitBounds(previewCircleRef.current.getBounds(), { padding: [40, 40] })
  }, [config.radiusKm, zones.length])

  // ── Global preview: sync location ────────────────────────────────────────

  useEffect(() => {
    if (!previewCircleRef.current || !previewPinRef.current || zones.length > 0) return
    const latlng = L.latLng(previewCenter[0], previewCenter[1])
    previewPinRef.current.setLatLng(latlng)
    previewCircleRef.current.setLatLng(latlng)
    mapInst.current?.setView(latlng, 11)
    setTimeout(() => {
      if (mapInst.current && previewCircleRef.current)
        mapInst.current.fitBounds(previewCircleRef.current.getBounds(), { padding: [40, 40] })
    }, 150)
  }, [previewCenter, zones.length])

  // ── Nominatim search: global preview ─────────────────────────────────────

  useEffect(() => {
    clearTimeout(previewDebounce.current)
    if (!previewQuery.trim()) { setPreviewResults([]); return }
    previewDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(previewQuery)}&format=json&limit=5`, { headers: { 'Accept-Language': 'en' } })
        setPreviewResults(await res.json())
      } catch { setPreviewResults([]) }
    }, 400)
    return () => clearTimeout(previewDebounce.current)
  }, [previewQuery])

  // ── Nominatim search: zone form ───────────────────────────────────────────

  useEffect(() => {
    clearTimeout(zoneDebounce.current)
    if (!zoneQuery.trim()) { setZoneResults([]); return }
    zoneDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zoneQuery)}&format=json&limit=5`, { headers: { 'Accept-Language': 'en' } })
        setZoneResults(await res.json())
      } catch { setZoneResults([]) }
    }, 400)
    return () => clearTimeout(zoneDebounce.current)
  }, [zoneQuery])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveGlobal(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/admin/dispatch', config)
      toast.success('Global settings saved')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings')
    } finally { setSaving(false) }
  }

  function openAddZone() {
    setEditingId(null)
    setZoneDraft(EMPTY_DRAFT)
    setZoneQuery('')
    setZoneResults([])
    setShowZoneForm(true)
  }

  function openEditZone(zone) {
    setEditingId(zone.id)
    setZoneDraft({ name: zone.name, centerLat: zone.centerLat, centerLng: zone.centerLng, zoneBoundaryKm: zone.zoneBoundaryKm, dispatchRadiusKm: zone.dispatchRadiusKm })
    setZoneQuery(zone.name)
    setZoneResults([])
    setShowZoneForm(true)
    // Fly to that zone on map
    if (mapInst.current && zoneLayersRef.current[zone.id]) {
      mapInst.current.fitBounds(zoneLayersRef.current[zone.id].circle.getBounds(), { padding: [40, 40] })
    }
  }

  function cancelZoneForm() {
    setShowZoneForm(false)
    setEditingId(null)
    setZoneDraft(EMPTY_DRAFT)
    setZoneQuery('')
    draftCircleRef.current?.remove(); draftCircleRef.current = null
    draftPinRef.current?.remove(); draftPinRef.current = null
  }

  async function handleSaveZone(e) {
    e.preventDefault()
    if (zoneDraft.centerLat == null) return toast.error('Click on the map or search to set the zone center')
    setZoneSaving(true)
    try {
      const payload = {
        name: zoneDraft.name,
        centerLat: zoneDraft.centerLat,
        centerLng: zoneDraft.centerLng,
        zoneBoundaryKm: zoneDraft.zoneBoundaryKm,
        dispatchRadiusKm: zoneDraft.dispatchRadiusKm,
      }
      if (editingId) {
        await api.put(`/admin/dispatch/zones/${editingId}`, payload)
        toast.success(`Zone "${zoneDraft.name}" updated`)
      } else {
        await api.post('/admin/dispatch/zones', payload)
        toast.success(`Zone "${zoneDraft.name}" created`)
      }
      await refreshZones()
      cancelZoneForm()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save zone')
    } finally { setZoneSaving(false) }
  }

  async function handleDeleteZone(zone) {
    if (!window.confirm(`Delete zone "${zone.name}"?`)) return
    try {
      await api.delete(`/admin/dispatch/zones/${zone.id}`)
      toast.success(`Zone "${zone.name}" deleted`)
      await refreshZones()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete zone')
    }
  }

  if (loading) return <div style={{ padding: '3rem' }}>Loading dispatch settings...</div>

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header" style={{ padding: '1.25rem 1.5rem 0.75rem', flexShrink: 0 }}>
        <h1 style={{ margin: 0 }}>Dispatch Zone</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
          Define zone-specific dispatch radii, or use a single global radius for all orders.
        </p>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '1.25rem', padding: '0 1.5rem 1.5rem', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left panel ── */}
        <div style={{ width: 340, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Section 1: Global defaults */}
          <div className="card" style={{ padding: '1.1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: 14, color: 'var(--text)' }}>
              Global Defaults
            </div>
            {zones.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Applied only when an order falls outside all defined zones below.
              </p>
            )}

            {/* Preview location search (shown only when no zones) */}
            {zones.length === 0 && (
              <div style={{ position: 'relative', marginBottom: '0.9rem' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)', fontSize: 12 }}>
                  Preview location
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input className="input-field" style={{ paddingLeft: '2rem', fontSize: 13 }} placeholder="Search any city…" value={previewQuery} onChange={e => setPreviewQuery(e.target.value)} />
                </div>
                {previewResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: 'var(--brand-card, #2b1515)', border: '1px solid rgba(248,154,56,0.2)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 6px 16px rgba(0,0,0,0.4)', marginTop: 2 }}>
                    {previewResults.map((r, i) => (
                      <button key={i} type="button" onClick={() => { setPreviewCenter([parseFloat(r.lat), parseFloat(r.lon)]); setPreviewQuery(r.display_name.split(',').slice(0, 2).join(', ')); setPreviewResults([]) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 11px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 12, lineHeight: 1.4, borderBottom: i < previewResults.length - 1 ? '1px solid var(--border)' : 'none' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,154,56,0.12)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                        {r.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSaveGlobal} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)', fontSize: 12 }}>Default dispatch radius</label>
                <select className="input-field" style={{ fontSize: 13 }} value={RADIUS_OPTIONS.includes(config.radiusKm) ? config.radiusKm : ''} onChange={e => setConfig({ ...config, radiusKm: +e.target.value })}>
                  {RADIUS_OPTIONS.map(km => <option key={km} value={km}>{km} km</option>)}
                  {!RADIUS_OPTIONS.includes(config.radiusKm) && <option value={config.radiusKm}>{config.radiusKm} km (custom)</option>}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)', fontSize: 12 }}>Fallback timeout (seconds)</label>
                <input className="input-field" style={{ fontSize: 13 }} type="number" step="5" min="30" max="600" value={config.fallbackSecs} onChange={e => setConfig({ ...config, fallbackSecs: +e.target.value })} />
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Admin notified if no rider accepts within this window.</small>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)', fontSize: 12 }}>Location freshness (minutes)</label>
                <input className="input-field" style={{ fontSize: 13 }} type="number" step="1" min="1" max="60" value={config.locationFreshMins} onChange={e => setConfig({ ...config, locationFreshMins: +e.target.value })} />
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Only riders who sent GPS within this window are eligible.</small>
              </div>
              <button className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={saving}>
                {saving ? <Loader size={14} className="loading" /> : <><Save size={14} style={{ marginRight: 5 }} />Save Defaults</>}
              </button>
            </form>
          </div>

          {/* Section 2: Zones */}
          <div className="card" style={{ padding: '1.1rem', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Dispatch Zones</span>
              {!showZoneForm && (
                <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 12, gap: 4 }} onClick={openAddZone}>
                  <Plus size={13} />Add Zone
                </button>
              )}
            </div>

            {/* Zone form */}
            {showZoneForm && (
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '0.85rem', marginBottom: '0.85rem', border: '1px solid rgba(248,154,56,0.15)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: '0.65rem', color: 'var(--brand-accent)' }}>
                  {editingId ? 'Edit Zone' : 'New Zone'}
                </div>
                <form onSubmit={handleSaveZone} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)', fontSize: 12 }}>Zone name</label>
                    <input className="input-field" style={{ fontSize: 13 }} placeholder="e.g. Greater Accra" required value={zoneDraft.name} onChange={e => setZoneDraft(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)', fontSize: 12 }}>Zone center</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      <input className="input-field" style={{ paddingLeft: '1.9rem', fontSize: 13 }} placeholder="Search or click on map" value={zoneQuery} onChange={e => setZoneQuery(e.target.value)} />
                    </div>
                    {zoneDraft.centerLat != null && (
                      <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {zoneDraft.centerLat.toFixed(4)}, {zoneDraft.centerLng.toFixed(4)}
                      </small>
                    )}
                    {zoneResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: 'var(--brand-card, #2b1515)', border: '1px solid rgba(248,154,56,0.2)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 6px 16px rgba(0,0,0,0.4)', marginTop: 2 }}>
                        {zoneResults.map((r, i) => (
                          <button key={i} type="button" onClick={() => { setZoneDraft(d => ({ ...d, centerLat: parseFloat(r.lat), centerLng: parseFloat(r.lon) })); setZoneQuery(r.display_name.split(',').slice(0, 2).join(', ')); setZoneResults([]) }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 12, lineHeight: 1.4, borderBottom: i < zoneResults.length - 1 ? '1px solid var(--border)' : 'none' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,154,56,0.12)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                            {r.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)', fontSize: 12 }}>Zone coverage</label>
                    <select className="input-field" style={{ fontSize: 13 }} value={BOUNDARY_OPTIONS.includes(zoneDraft.zoneBoundaryKm) ? zoneDraft.zoneBoundaryKm : ''} onChange={e => setZoneDraft(d => ({ ...d, zoneBoundaryKm: +e.target.value }))}>
                      {BOUNDARY_OPTIONS.map(km => <option key={km} value={km}>{km} km from center</option>)}
                      {!BOUNDARY_OPTIONS.includes(zoneDraft.zoneBoundaryKm) && <option value={zoneDraft.zoneBoundaryKm}>{zoneDraft.zoneBoundaryKm} km (custom)</option>}
                    </select>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Orders within this distance of the zone center use this zone's radius.</small>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)', fontSize: 12 }}>Dispatch radius</label>
                    <select className="input-field" style={{ fontSize: 13 }} value={RADIUS_OPTIONS.includes(zoneDraft.dispatchRadiusKm) ? zoneDraft.dispatchRadiusKm : ''} onChange={e => setZoneDraft(d => ({ ...d, dispatchRadiusKm: +e.target.value }))}>
                      {RADIUS_OPTIONS.map(km => <option key={km} value={km}>{km} km</option>)}
                      {!RADIUS_OPTIONS.includes(zoneDraft.dispatchRadiusKm) && <option value={zoneDraft.dispatchRadiusKm}>{zoneDraft.dispatchRadiusKm} km (custom)</option>}
                    </select>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Riders within this distance of the pickup receive the offer.</small>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} disabled={zoneSaving}>
                      {zoneSaving ? <Loader size={13} className="loading" /> : <><Radio size={13} style={{ marginRight: 4 }} />{editingId ? 'Update Zone' : 'Save Zone'}</>}
                    </button>
                    <button type="button" className="btn" style={{ padding: '0 12px' }} onClick={cancelZoneForm}>
                      <X size={14} />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Zone list */}
            {zones.length === 0 && !showZoneForm && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>
                No zones defined — global defaults apply everywhere.
              </p>
            )}
            {zones.map((zone, i) => {
              const color = ZONE_COLORS[i % ZONE_COLORS.length]
              return (
                <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < zones.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{zone.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {zone.zoneBoundaryKm} km area · {zone.dispatchRadiusKm} km dispatch radius
                    </div>
                  </div>
                  <button type="button" title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} onClick={() => openEditZone(zone)}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} onClick={() => handleDeleteZone(zone)}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger, #ef4444)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right panel: map ── */}
        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', minWidth: 0 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>

      </div>
    </div>
  )
}

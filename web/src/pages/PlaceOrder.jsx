import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import api from '../../../shared/api'
import { formatMoney } from '../../../shared/currency'
import toast from 'react-hot-toast'
import { MapPin, Package, Loader, Navigation, DollarSign, User, Phone, Image, X } from 'lucide-react'
import './PlaceOrder.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const LAGOS = { lat: 6.5244, lng: 3.3792 }
const SIZES = [
  { id: 'small',  label: 'Small',  desc: 'Envelope, documents' },
  { id: 'medium', label: 'Medium', desc: 'Shoebox, small bag' },
  { id: 'large',  label: 'Large',  desc: 'Large box, multiple items' },
]

async function reverseGeocode(lng, lat) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const res = await fetch(
    `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${token}`
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.features?.[0]?.properties?.full_address
      ?? data.features?.[0]?.properties?.place_formatted
      ?? null
}

async function forwardGeocode(query) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const res = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&proximity=ip&limit=8&access_token=${token}`
  )
  if (!res.ok) return []
  return (await res.json()).features ?? []
}

export default function PlaceOrder() {
  const navigate = useNavigate()
  const mapRef     = useRef(null)
  const mapInst    = useRef(null)
  const pickMark   = useRef(null)
  const dropMark   = useRef(null)
  const pickupWrapRef  = useRef(null)
  const dropoffWrapRef = useRef(null)
  const pickupDebounce  = useRef(null)
  const dropoffDebounce = useRef(null)
  const searchSeq = useRef(0)
  const routeDrawn = useRef(false)

  const [form, setForm] = useState({
    pickupAddress: '', pickupLat: '', pickupLng: '',
    pickupContactName: '', pickupPhone: '', pickupNotes: '',
    dropoffAddress: '', dropoffLat: '', dropoffLng: '',
    recipientName: '', recipientPhone: '', dropoffNotes: '',
    packageDescription: '', packageSize: 'medium',
  })
  const [estimate,  setEstimate] = useState(null)
  const [step,      setStep]     = useState('pickup')
  const [loading,   setLoading]  = useState(false)
  const [estimating, setEst]     = useState(false)
  const [geolocating, setGeolocating] = useState(false)
  const [packagePhoto, setPackagePhoto] = useState(null)

  const [pickupSuggestions,  setPickupSuggestions]  = useState([])
  const [dropoffSuggestions, setDropoffSuggestions] = useState([])
  const [pickupSearching,  setPickupSearching]  = useState(false)
  const [dropoffSearching, setDropoffSearching] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // ── Marker helper ────────────────────────────────────────────────────────────
  function placeMarker(which, lng, lat) {
    if (which === 'pickup') {
      if (!pickMark.current)
        pickMark.current = new mapboxgl.Marker({ color: '#7C3AED' }).setLngLat([lng, lat]).addTo(mapInst.current)
      else pickMark.current.setLngLat([lng, lat])
    } else {
      if (!dropMark.current)
        dropMark.current = new mapboxgl.Marker({ color: '#F59E0B' }).setLngLat([lng, lat]).addTo(mapInst.current)
      else dropMark.current.setLngLat([lng, lat])
    }
  }

  // ── Map init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInst.current) return
    mapInst.current = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [LAGOS.lng, LAGOS.lat],
      zoom: 12,
    })
    mapInst.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    return () => { mapInst.current?.remove(); mapInst.current = null }
  }, [])

  // ── Map click handler (re-registers when step changes) ──────────────────────
  useEffect(() => {
    if (!mapInst.current) return
    const onClick = async (e) => {
      const { lng, lat } = e.lngLat
      if (step === 'pickup') {
        setForm((f) => ({ ...f, pickupLat: lat, pickupLng: lng, pickupAddress: 'Locating…' }))
        placeMarker('pickup', lng, lat)
        const addr = await reverseGeocode(lng, lat)
        setForm((f) => ({
          ...f,
          pickupAddress: f.pickupAddress === 'Locating…'
            ? (addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
            : f.pickupAddress,
        }))
        setStep('dropoff')
      } else {
        setForm((f) => ({ ...f, dropoffLat: lat, dropoffLng: lng, dropoffAddress: 'Locating…' }))
        placeMarker('dropoff', lng, lat)
        const addr = await reverseGeocode(lng, lat)
        setForm((f) => ({
          ...f,
          dropoffAddress: f.dropoffAddress === 'Locating…'
            ? (addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
            : f.dropoffAddress,
        }))
      }
    }
    mapInst.current.off('click', onClick)
    mapInst.current.on('click', onClick)
    return () => mapInst.current?.off('click', onClick)
  }, [step])

  // ── Price estimate ────────────────────────────────────────────────────────────
  useEffect(() => {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = form
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) return
    setEst(true)
    api.post('/orders/estimate', { pickupLat, pickupLng, dropoffLat, dropoffLng })
      .then((r) => setEstimate(r.data))
      .catch(() => {})
      .finally(() => setEst(false))
  }, [form.pickupLat, form.pickupLng, form.dropoffLat, form.dropoffLng])

  // ── Route line between pickup and dropoff ─────────────────────────────────────
  useEffect(() => {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = form
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) return
    const map = mapInst.current
    if (!map) return

    async function drawRoute() {
      try {
        const token = import.meta.env.VITE_MAPBOX_TOKEN
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?geometries=geojson&overview=full&steps=false&access_token=${token}`
        const res = await fetch(url)
        const data = await res.json()
        const coords = data.routes?.[0]?.geometry?.coordinates
        if (!coords) return

        const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }

        if (map.getSource('po-route')) {
          map.getSource('po-route').setData(geojson)
        } else {
          map.addSource('po-route', { type: 'geojson', data: geojson })
          map.addLayer({ id: 'po-route-outline', type: 'line', source: 'po-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#0f172a', 'line-width': 10, 'line-opacity': 0.6 }
          })
          map.addLayer({ id: 'po-route-line', type: 'line', source: 'po-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#8A053B', 'line-width': 5, 'line-opacity': 0.95 }
          }, 'po-route-outline')
          routeDrawn.current = true
        }

        // Fit map to show both markers with the route
        const bounds = new mapboxgl.LngLatBounds()
        coords.forEach(([lng, lat]) => bounds.extend([lng, lat]))
        map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 900 })
      } catch (_) {}
    }

    // Wait for map style to be loaded before adding layers
    if (map.isStyleLoaded()) {
      drawRoute()
    } else {
      map.once('load', drawRoute)
    }
  }, [form.pickupLat, form.pickupLng, form.dropoffLat, form.dropoffLng])

  // ── Close dropdowns on outside click ─────────────────────────────────────────
  useEffect(() => {
    function onDocClick(e) {
      if (pickupWrapRef.current && !pickupWrapRef.current.contains(e.target))
        setPickupSuggestions([])
      if (dropoffWrapRef.current && !dropoffWrapRef.current.contains(e.target))
        setDropoffSuggestions([])
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // ── Address search handlers ───────────────────────────────────────────────────
  function handlePickupInput(e) {
    const q = e.target.value
    setForm((f) => ({ ...f, pickupAddress: q }))
    clearTimeout(pickupDebounce.current)
    if (q.length < 3) { setPickupSuggestions([]); return }
    const id = ++searchSeq.current
    setPickupSearching(true)
    pickupDebounce.current = setTimeout(async () => {
      const results = await forwardGeocode(q)
      if (id !== searchSeq.current) return
      setPickupSuggestions(results)
      setPickupSearching(false)
    }, 300)
  }

  function handleDropoffInput(e) {
    const q = e.target.value
    setForm((f) => ({ ...f, dropoffAddress: q }))
    clearTimeout(dropoffDebounce.current)
    if (q.length < 3) { setDropoffSuggestions([]); return }
    const id = ++searchSeq.current
    setDropoffSearching(true)
    dropoffDebounce.current = setTimeout(async () => {
      const results = await forwardGeocode(q)
      if (id !== searchSeq.current) return
      setDropoffSuggestions(results)
      setDropoffSearching(false)
    }, 300)
  }

  function selectPickupSuggestion(feature) {
    const [lng, lat] = feature.geometry.coordinates
    const addr = feature.properties.full_address || feature.properties.place_formatted || ''
    setForm((f) => ({ ...f, pickupAddress: addr, pickupLat: lat, pickupLng: lng }))
    setPickupSuggestions([])
    mapInst.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 800 })
    placeMarker('pickup', lng, lat)
  }

  function selectDropoffSuggestion(feature) {
    const [lng, lat] = feature.geometry.coordinates
    const addr = feature.properties.full_address || feature.properties.place_formatted || ''
    setForm((f) => ({ ...f, dropoffAddress: addr, dropoffLat: lat, dropoffLng: lng }))
    setDropoffSuggestions([])
    mapInst.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 800 })
    placeMarker('dropoff', lng, lat)
  }

  // ── Use my location ───────────────────────────────────────────────────────────
  async function useMyLocation() {
    if (!navigator.geolocation) return toast.error('Geolocation not supported by your browser')
    setGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        setForm((f) => ({ ...f, pickupLat: lat, pickupLng: lng, pickupAddress: 'Locating…' }))
        placeMarker('pickup', lng, lat)
        mapInst.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 800 })
        const addr = await reverseGeocode(lng, lat)
        setForm((f) => ({ ...f, pickupAddress: addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))
        setGeolocating(false)
      },
      (err) => {
        toast.error(err.code === 1 ? 'Location permission denied' : 'Could not get your location')
        setGeolocating(false)
      },
      { timeout: 8000, maximumAge: 60000 }
    )
  }

  // ── Package photo ─────────────────────────────────────────────────────────────
  function handlePackagePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setPackagePhoto(reader.result)
    reader.readAsDataURL(file)
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.pickupLat || !form.dropoffLat) return toast.error('Set pickup and drop-off on the map')
    if (!form.pickupContactName || !form.pickupPhone) return toast.error('Pickup contact required')
    if (!form.recipientName || !form.recipientPhone) return toast.error('Recipient details required')
    setLoading(true)
    try {
      const { data } = await api.post('/orders', { ...form, packagePhotoUrl: packagePhoto || undefined })
      toast.success('Order placed!')
      navigate(`/order/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    form.pickupLat && form.dropoffLat &&
    form.pickupContactName && form.pickupPhone &&
    form.recipientName && form.recipientPhone

  return (
    <div className="place-order page">
      <div className="container">
        <div className="page-header fade-in">
          <h1>Place a Delivery</h1>
          <p>Set locations on the map and fill in pickup, recipient, and package details.</p>
        </div>

        <div className="po-layout">
          <div className="po-form fade-in">
            {/* Step toggle */}
            <div className="po-step-toggle">
              <button
                type="button"
                className={`${step === 'pickup' ? 'active' : ''} ${form.pickupLat ? 'done' : ''}`}
                onClick={() => setStep('pickup')}
              >
                <Navigation size={14} /> Pickup
                {form.pickupLat && <span className="tab-check">✓</span>}
              </button>
              <button
                type="button"
                className={`${step === 'dropoff' ? 'active' : ''} ${form.dropoffLat ? 'done' : ''}`}
                onClick={() => setStep('dropoff')}
              >
                <MapPin size={14} /> Drop-off
                {form.dropoffLat && <span className="tab-check">✓</span>}
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* ── PICKUP ── */}
              <p className="po-section-label">Pickup</p>

              <div className="input-group">
                <label>Pickup address</label>
                <div className="address-search-group" ref={pickupWrapRef}>
                  <div className="address-input-row">
                    <input
                      className="input-field"
                      placeholder="Search address or click map"
                      value={form.pickupAddress}
                      onChange={handlePickupInput}
                      autoComplete="off"
                    />
                    {pickupSearching && <Loader size={13} className="loading address-spinner" />}
                    <button
                      type="button"
                      className="gps-btn"
                      onClick={useMyLocation}
                      disabled={geolocating}
                      title="Use my current location"
                    >
                      {geolocating ? <Loader size={14} className="loading" /> : <Navigation size={14} />}
                    </button>
                  </div>
                  {pickupSuggestions.length > 0 && (
                    <ul className="address-suggestions">
                      {pickupSuggestions.map((f) => (
                        <li key={f.id} onMouseDown={() => selectPickupSuggestion(f)}>
                          <MapPin size={12} />
                          <span>
                            <span className="suggestion-main">{f.properties.name}</span>
                            <span className="suggestion-sub">{f.properties.place_formatted}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {form.pickupLat && form.pickupAddress && form.pickupAddress !== 'Locating…' && (
                  <div className="location-confirmed">
                    <MapPin size={12} className="confirmed-icon confirmed-icon--pickup" />
                    <div>
                      <span className="confirmed-label">Pickup set</span>
                      <span className="confirmed-address">{form.pickupAddress}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="input-row">
                <div className="input-group">
                  <label><User size={12} /> Contact name</label>
                  <input className="input-field" placeholder="John at the shop"
                    value={form.pickupContactName} onChange={set('pickupContactName')} required />
                </div>
                <div className="input-group">
                  <label><Phone size={12} /> Phone</label>
                  <input className="input-field" type="tel" placeholder="+234..."
                    value={form.pickupPhone} onChange={set('pickupPhone')} required />
                </div>
              </div>
              <div className="input-group">
                <label>Pickup notes (optional)</label>
                <input className="input-field" placeholder="Ring bell 3 times"
                  value={form.pickupNotes} onChange={set('pickupNotes')} />
              </div>

              {/* ── RECIPIENT ── */}
              <p className="po-section-label">Recipient</p>

              <div className="input-group">
                <label>Drop-off address</label>
                <div className="address-search-group" ref={dropoffWrapRef}>
                  <div className="address-input-row">
                    <input
                      className="input-field"
                      placeholder="Search address or click map"
                      value={form.dropoffAddress}
                      onChange={handleDropoffInput}
                      autoComplete="off"
                    />
                    {dropoffSearching && <Loader size={13} className="loading address-spinner" />}
                  </div>
                  {dropoffSuggestions.length > 0 && (
                    <ul className="address-suggestions">
                      {dropoffSuggestions.map((f) => (
                        <li key={f.id} onMouseDown={() => selectDropoffSuggestion(f)}>
                          <MapPin size={12} />
                          <span>
                            <span className="suggestion-main">{f.properties.name}</span>
                            <span className="suggestion-sub">{f.properties.place_formatted}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {form.dropoffLat && form.dropoffAddress && form.dropoffAddress !== 'Locating…' && (
                  <div className="location-confirmed dropoff-confirmed">
                    <MapPin size={12} className="confirmed-icon confirmed-icon--dropoff" />
                    <div>
                      <span className="confirmed-label">Drop-off set</span>
                      <span className="confirmed-address">{form.dropoffAddress}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="input-row">
                <div className="input-group">
                  <label>Recipient name</label>
                  <input className="input-field" value={form.recipientName} onChange={set('recipientName')} required />
                </div>
                <div className="input-group">
                  <label>Recipient phone</label>
                  <input className="input-field" type="tel" value={form.recipientPhone} onChange={set('recipientPhone')} required />
                </div>
              </div>
              <div className="input-group">
                <label>Drop-off notes (optional)</label>
                <input className="input-field" placeholder="Leave at front door"
                  value={form.dropoffNotes} onChange={set('dropoffNotes')} />
              </div>

              {/* ── PACKAGE ── */}
              <p className="po-section-label">Package</p>
              <div className="input-group">
                <label><Package size={12} /> Description</label>
                <input className="input-field" placeholder="Documents, food, fragile..."
                  value={form.packageDescription} onChange={set('packageDescription')} />
              </div>

              {/* Package photo upload */}
              <div className="input-group">
                <label><Image size={12} /> Package photo <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                {packagePhoto ? (
                  <div className="pkg-photo-preview">
                    <img src={packagePhoto} alt="Package preview" />
                    <button type="button" className="pkg-photo-remove" onClick={() => setPackagePhoto(null)} title="Remove photo">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="pkg-photo-upload" htmlFor="pkg-photo-input">
                    <Image size={20} style={{ opacity: 0.4 }} />
                    <span>Tap to add photo</span>
                    <input id="pkg-photo-input" type="file" accept="image/*" onChange={handlePackagePhoto} style={{ display: 'none' }} />
                  </label>
                )}
              </div>

              <div className="package-sizes">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`size-card ${form.packageSize === s.id ? 'selected' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, packageSize: s.id }))}
                  >
                    <b>{s.label}</b>
                    <span>{s.desc}</span>
                  </button>
                ))}
              </div>

              {estimating && (
                <div className="estimate-box pulsing"><Loader size={14} className="loading" /> Calculating...</div>
              )}
              {estimate && !estimating && (
                <div className="estimate-box">
                  <div className="estimate-row"><span>Distance</span><b>{estimate.distanceKm} km</b></div>
                  <div className="estimate-row">
                    <DollarSign size={14} /><span>Estimated</span>
                    <b className="price">{formatMoney(estimate.estimatedPrice)}</b>
                  </div>
                  {estimate.businessSaving > 0 && (
                    <div className="estimate-row saving-row" style={{ color: 'var(--success)', borderTop: '1px dashed rgba(16,185,129,0.2)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      <span>Business Savings</span>
                      <b>-{formatMoney(estimate.businessSaving)}</b>
                    </div>
                  )}
                </div>
              )}

              <button className="btn btn-primary w-full" type="submit" disabled={loading || !canSubmit}>
                {loading ? <Loader size={16} className="loading" /> : <><Package size={16} /> Place Order</>}
              </button>
            </form>
          </div>

          {/* ── MAP ── */}
          <div className="po-map-wrap">
            <div className="map-step-hint">
              <span className="hint-step-num">{step === 'pickup' ? '1' : '2'}</span>
              <span className={`hint-dot hint-dot--${step}`} />
              {step === 'pickup' ? 'Set pickup location' : 'Set drop-off location'}
            </div>
            <div ref={mapRef} className="map-container po-map" />
          </div>
        </div>
      </div>
    </div>
  )
}

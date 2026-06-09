import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import api from '../../../shared/api'
import { formatMoney } from '../../../shared/currency'
import { connectSocket } from '../../../shared/socket'
import {
  MapPin, Package, Phone, Loader, Navigation, CheckCircle, Star, User, Bike,
} from 'lucide-react'
import toast from 'react-hot-toast'
import './TrackOrder.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const STATUS_STEPS = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED']
const STATUS_LABELS = {
  PENDING: 'Finding a rider…',
  ACCEPTED: 'Rider accepted',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  ARRIVED: 'Rider arrived',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function TrackOrder() {
  const { id } = useParams()
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const mapInitialized = useRef(false)
  const riderMark = useRef(null)
  const pickMark = useRef(null)
  const dropMark = useRef(null)
  const riderPos = useRef(null)
  const lastRiderRoute = useRef({ lat: null, lng: null })

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [distanceKm, setDistanceKm] = useState(null)
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [ratingSent, setRatingSent] = useState(false)

  // Keep a ref to latest order so moveRider stays stable (no stale closure)
  const orderRef = useRef(null)
  useEffect(() => { orderRef.current = order }, [order])

  const moveRider = useCallback((lat, lng) => {
    riderPos.current = { lat, lng }
    if (!mapInst.current) return
    if (!riderMark.current) {
      const el = document.createElement('div')
      el.className = 'rider-marker'
      el.innerHTML = '🏍️'
      riderMark.current = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(mapInst.current)
    } else {
      riderMark.current.setLngLat([lng, lat])
    }
    const o = orderRef.current
    if (o?.status !== 'DELIVERED') {
      const goingToDropoff =
        ['PICKED_UP', 'IN_TRANSIT'].includes(o?.status) ||
        (o?.status === 'ARRIVED' && o?.pickedUpAt)
      const dest = goingToDropoff
        ? { lat: o?.dropoffLat, lng: o?.dropoffLng }
        : { lat: o?.pickupLat, lng: o?.pickupLng }
      if (dest.lat != null) {
        setDistanceKm(haversineKm(lat, lng, dest.lat, dest.lng).toFixed(1))
        // Refetch road route only when rider moves 300m+ from last fetch
        const last = lastRiderRoute.current
        const movedFar = !last.lat || haversineKm(lat, lng, last.lat, last.lng) > 0.3
        if (movedFar) {
          lastRiderRoute.current = { lat, lng }
          const token = import.meta.env.VITE_MAPBOX_TOKEN
          fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${lng},${lat};${dest.lng},${dest.lat}?geometries=geojson&overview=full&steps=false&access_token=${token}`)
            .then((r) => r.json())
            .then((data) => {
              const coords = data.routes?.[0]?.geometry?.coordinates
              if (!coords) return
              mapInst.current?.getSource('rider-line')?.setData({
                type: 'Feature', geometry: { type: 'LineString', coordinates: coords },
              })
            })
            .catch(() => {})
        }
      }
    }
  }, []) // stable — reads latest order from orderRef

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then((r) => {
        setOrder(r.data)
        setRatingSent(!!r.data.customerRating)
        setRating(r.data.customerRating || 0)
      })
      .finally(() => setLoading(false))
  }, [id])

  // Map initializes exactly ONCE when order first loads.
  // No cleanup here — a separate unmount effect handles map removal.
  // Without this split, every status change would destroy + recreate the map.
  useEffect(() => {
    if (!order || mapInitialized.current) return
    mapInitialized.current = true
    mapInst.current = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [order.pickupLng, order.pickupLat],
      zoom: 13,
    })
    mapInst.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapInst.current.on('load', () => {
      pickMark.current = new mapboxgl.Marker({ color: '#7C3AED' })
        .setLngLat([order.pickupLng, order.pickupLat])
        .addTo(mapInst.current)

      dropMark.current = new mapboxgl.Marker({ color: '#F59E0B' })
        .setLngLat([order.dropoffLng, order.dropoffLat])
        .addTo(mapInst.current)

      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend([order.pickupLng, order.pickupLat])
      bounds.extend([order.dropoffLng, order.dropoffLat])
      mapInst.current.fitBounds(bounds, { padding: 60, maxZoom: 15 })

      ;(async function drawDirections() {
        try {
          const token = import.meta.env.VITE_MAPBOX_TOKEN
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${order.pickupLng},${order.pickupLat};${order.dropoffLng},${order.dropoffLat}?geometries=geojson&overview=full&steps=false&access_token=${token}`
          const res = await fetch(url)
          const data = await res.json()
          const route = data.routes && data.routes[0]
          if (!route) return
          const coords = route.geometry.coordinates
          if (mapInst.current.getSource('route')) {
            mapInst.current.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } })
          } else {
            mapInst.current.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } })
            mapInst.current.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#60A5FA', 'line-width': 6, 'line-opacity': 0.95 }
            })
            mapInst.current.addLayer({
              id: 'route-line-outline',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#0f172a', 'line-width': 10, 'line-opacity': 0.6 }
            }, 'route-line')
            try {
              const midIdx = Math.floor(coords.length / 2)
              const mid = coords[midIdx]
              const next = coords[Math.min(midIdx + 1, coords.length - 1)]
              const angle = Math.atan2(next[1] - mid[1], next[0] - mid[0]) * (180 / Math.PI)
              const arrow = document.createElement('div')
              arrow.className = 'route-arrow'
              arrow.innerHTML = '➤'
              arrow.style.transform = `rotate(${angle}deg)`
              const arrowMarker = new mapboxgl.Marker({ element: arrow })
                .setLngLat([mid[0], mid[1]])
                .addTo(mapInst.current)
              dropMark.current.arrowMarker = arrowMarker
            } catch (_) {}
          }
        } catch (err) {
          console.warn('Could not draw directions', err.message)
        }
      })()

      if (!mapInst.current.getSource('rider-line')) {
        mapInst.current.addSource('rider-line', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } })
        mapInst.current.addLayer({
          id: 'rider-line-layer',
          type: 'line',
          source: 'rider-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#F59E0B', 'line-width': 4, 'line-dasharray': [2, 2], 'line-opacity': 0.9 }
        })
      }

      // Use most recent position: live update if already received, else last known from DB
      const initLat = riderPos.current?.lat ?? order.rider?.lastLat
      const initLng = riderPos.current?.lng ?? order.rider?.lastLng
      if (initLat != null) moveRider(initLat, initLng)
    })
  }, [order, moveRider]) // moveRider is now stable so this only triggers when order loads

  // Remove map only when this component unmounts, not on every order status change
  useEffect(() => {
    return () => {
      mapInitialized.current = false
      mapInst.current?.remove()
      mapInst.current = null
    }
  }, [])

  useEffect(() => {
    if (!order) return
    const socket = connectSocket()
    socket.emit('order:watch', { orderId: id })
    const onLocation = ({ lat, lng }) => moveRider(lat, lng)
    const onStatusChanged = ({ status }) => setOrder((o) => (o ? { ...o, status } : o))
    const onAssigned = ({ rider }) => {
      setOrder((o) => (o ? { ...o, rider: { ...o?.rider, ...rider, fullName: rider.name } } : o))
      toast.success(`${rider.name} is your rider`)
    }
    const onArrived = ({ message }) => toast(message)
    socket.on('rider:location', onLocation)
    socket.on('order:status_changed', onStatusChanged)
    socket.on('order:assigned', onAssigned)
    socket.on('rider:arrived', onArrived)
    return () => {
      socket.off('rider:location', onLocation)
      socket.off('order:status_changed', onStatusChanged)
      socket.off('order:assigned', onAssigned)
      socket.off('rider:arrived', onArrived)
    }
  }, [id, order, moveRider])

  async function submitRating() {
    if (!rating) return toast.error('Select a star rating')
    try {
      await api.post(`/orders/${id}/rate`, { rating, review })
      setRatingSent(true)
      toast.success('Thanks for your feedback!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not submit rating')
    }
  }

  function downloadReceipt() {
    const text = [
      'Starvia Express — Receipt',
      `Order: ${order.id}`,
      `Status: ${order.status}`,
      `Pickup: ${order.pickupAddress}`,
      `Drop-off: ${order.dropoffAddress}`,
      `Recipient: ${order.recipientName}`,
      `Price: ${formatMoney(order.finalPrice ?? order.estimatedPrice)}`,
      `Delivered: ${order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'}`,
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `starvia-receipt-${order.id.slice(-8)}.txt`
    a.click()
  }

  if (loading) {
    return (
      <div className="track-loading">
        <Loader size={28} className="loading" />
        <p>Loading order…</p>
      </div>
    )
  }
  if (!order) {
    return (
      <div className="track-loading">
        <p>Order not found.</p>
      </div>
    )
  }

  const stepIdx = STATUS_STEPS.indexOf(order.status)
  const delivered = order.status === 'DELIVERED'
  const cancelled = order.status === 'CANCELLED'
  const hasRider = !!order.riderId && order.rider
  const rider = order.rider

  const timeline = [
    { label: 'Placed', at: order.createdAt },
    { label: 'Accepted', at: order.acceptedAt },
    { label: 'Picked up', at: order.pickedUpAt },
    { label: 'Delivered', at: order.deliveredAt },
  ].filter((t) => t.at)

  return (
    <div className="track-order page">
      <div className="container">
        <div className="page-header fade-in">
          <h1>Track Delivery</h1>
          <p>
            Order <code>#{order.id.slice(-8).toUpperCase()}</code>
            <span className={`status-pill status-${order.status.toLowerCase()}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </p>
        </div>

        <div className="track-layout">
          <div className="track-sidebar fade-in">
            {!hasRider && !delivered && !cancelled && (
              <div className="card mb-1 finding-rider">
                <Loader size={20} className="loading" />
                <div>
                  <b>Finding a rider…</b>
                  <p>We&apos;ll notify you when someone accepts your delivery.</p>
                </div>
              </div>
            )}

            <div className="card mb-1">
              <h3>Order summary</h3>
              <div className="detail-row">
                <Navigation size={14} />
                <span>Pickup</span>
                <b>{order.pickupAddress}</b>
              </div>
              <div className="detail-row sub">
                <User size={12} />
                {order.pickupContactName} · <a href={`tel:${order.pickupPhone}`}>{order.pickupPhone}</a>
              </div>
              <div className="detail-row">
                <MapPin size={14} />
                <span>Drop-off</span>
                <b>{order.dropoffAddress}</b>
              </div>
              <div className="detail-row sub">
                <User size={12} />
                {order.recipientName} · <a href={`tel:${order.recipientPhone}`}>{order.recipientPhone}</a>
              </div>
              {(order.packageDescription || order.packageSize || order.packagePhotoUrl) && (
                <>
                  <div className="detail-row">
                    <Package size={14} />
                    <span>Package</span>
                    <b>
                      {order.packageDescription}
                      {order.packageSize ? ` · ${order.packageSize}` : ''}
                    </b>
                  </div>
                  {order.packagePhotoUrl && (
                    <div className="pkg-photo-track">
                      <a href={order.packagePhotoUrl} target="_blank" rel="noopener noreferrer">
                        <img src={order.packagePhotoUrl} alt="Package photo" />
                      </a>
                    </div>
                  )}
                </>
              )}
              <div className="detail-row price-row">
                <span>Estimated</span>
                <b>{formatMoney(order.estimatedPrice)}</b>
              </div>
            </div>

            {hasRider && (
              <div className="card rider-card mb-1">
                <h3>Your rider</h3>
                <div className="rider-info">
                  <div className="rider-avatar">
                    {rider.profilePhoto ? (
                      <img src={rider.profilePhoto} alt="" />
                    ) : (
                      '🏍️'
                    )}
                  </div>
                  <div>
                    <b>{rider.fullName}</b>
                    <span>
                      <Bike size={12} /> {rider.motorColor} {rider.motorMake} {rider.motorModel}
                    </span>
                    <span className="plate">{rider.motorPlate}</span>
                  </div>
                </div>
                {rider.phone && (
                  <a href={`tel:${rider.phone}`} className="btn btn-outline btn-sm call-btn">
                    <Phone size={14} /> Call rider
                  </a>
                )}
                {distanceKm != null && order.status !== 'DELIVERED' && (
                  <p className="distance-remaining">~{distanceKm} km away</p>
                )}
              </div>
            )}

            <div className="card mb-1">
              <h3>Timeline</h3>
              {cancelled ? (
                <p className="cancelled-badge">Order cancelled</p>
              ) : (
                <div className="status-steps-vertical">
                  {STATUS_STEPS.map((s, i) => (
                    <div
                      key={s}
                      className={`vstep ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`}
                    >
                      <div className="vstep-dot">
                        {i < stepIdx ? <CheckCircle size={14} /> : i + 1}
                      </div>
                      <div>
                        <div className="vstep-label">{STATUS_LABELS[s]}</div>
                        {timeline.find((t) => t.label === STATUS_LABELS[s] || (s === 'PENDING' && t.label === 'Placed'))?.at && (
                          <div className="vstep-time">
                            {new Date(
                              s === 'PENDING'
                                ? order.createdAt
                                : s === 'ACCEPTED'
                                  ? order.acceptedAt
                                  : s === 'PICKED_UP'
                                    ? order.pickedUpAt
                                    : order.deliveredAt
                            ).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {delivered && (
              <div className="card">
                <h3>Delivery complete</h3>
                {order.deliveredAt && (
                  <p className="delivered-at">
                    {new Date(order.deliveredAt).toLocaleString()}
                  </p>
                )}
                {!ratingSent ? (
                  <>
                    <p>Rate your delivery</p>
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" onClick={() => setRating(n)}>
                          <Star size={24} fill={n <= rating ? '#F59E0B' : 'none'} stroke="#F59E0B" />
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Optional review"
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                    />
                    <button type="button" className="btn btn-primary btn-sm w-full" onClick={submitRating}>
                      Submit rating
                    </button>
                  </>
                ) : (
                  <p>Thanks for rating this delivery!</p>
                )}
                <button type="button" className="btn btn-outline btn-sm w-full mt-1" onClick={downloadReceipt}>
                  Download receipt
                </button>
              </div>
            )}
          </div>

          <div className="track-map-wrap fade-in">
            {delivered && (
              <div className="delivered-overlay">
                <CheckCircle size={36} />
                <span>Delivered!</span>
              </div>
            )}
            <div ref={mapRef} className="map-container track-map" />
          </div>
        </div>
      </div>
    </div>
  )
}

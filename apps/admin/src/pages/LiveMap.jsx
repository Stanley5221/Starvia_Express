import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../../../../shared/api'
import { connectSocket } from '../../../../shared/socket'

export default function LiveMap() {
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const markers = useRef({})
  const [riders, setRiders] = useState([])
  const [stats, setStats] = useState({ activeRiders: 0, pendingOrders: 0 })
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data))
    api.get('/admin/riders/live').then((r) => setRiders(r.data))
    api.get('/admin/orders?limit=50').then((r) => {
      const active = r.data.orders.filter((o) =>
        ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'].includes(o.status)
      )
      setStats((s) => ({ ...s, activeOrders: active.length }))
    })
  }, [])

  useEffect(() => {
    if (mapInst.current) return
    mapInst.current = L.map(mapRef.current, { zoomControl: true }).setView([6.5244, 3.3792], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInst.current)

    const socket = connectSocket()
    socket.emit('admin:join')
    socket.on('rider:location', ({ riderId, lat, lng, orderId }) => {
      if (!mapInst.current) return
      if (!markers.current[riderId]) {
        const el = L.divIcon({ html: '🏍️', className: 'admin-rider-pin', iconSize: [28, 28] })
        markers.current[riderId] = L.marker([lat, lng], { icon: el }).addTo(mapInst.current)
      } else {
        markers.current[riderId].setLatLng([lat, lng])
      }
    })

    // Mark map as ready so other effects can add initial markers
    setMapReady(true)

    return () => {
      socket.off('rider:location')
      mapInst.current?.remove()
      mapInst.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapInst.current || !mapReady || !riders.length) return
    riders.forEach((r) => {
      if (r.lastLat == null) return
      if (!markers.current[r.id]) {
        const el = L.divIcon({ html: '🏍️', className: 'admin-rider-pin', iconSize: [28, 28] })
        markers.current[r.id] = L.marker([r.lastLat, r.lastLng], { icon: el }).addTo(mapInst.current)
        if (r.fullName) markers.current[r.id].bindPopup(`<b>${r.fullName}</b><br/>${r.user?.email || ''}`)
      }
    })
  }, [riders, mapReady])

  return (
    <div className="live-map-page">
      <div className="live-map-bar">
        <span>
          <b>{riders.length}</b> riders on map
        </span>
        <span>
          <b>{stats.pendingOrders ?? 0}</b> active orders
        </span>
      </div>
      <div ref={mapRef} className="live-map-canvas" style={{height: '600px'}} />
    </div>
  )
}

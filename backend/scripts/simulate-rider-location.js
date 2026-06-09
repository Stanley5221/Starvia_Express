const io = require('socket.io-client')

// Adjust these values to match an existing order in your DB
const SERVER = process.env.SERVER_URL || 'http://localhost:4000'
const ORDER_ID = process.env.ORDER_ID || '123'
const RIDER_ID = process.env.RIDER_ID || 'sim-rider'

const path = [
  { lat: 6.69807, lng: -1.62469 },
  { lat: 6.6945, lng: -1.6220 },
  { lat: 6.6900, lng: -1.6190 },
  { lat: 6.6840, lng: -1.6150 },
  { lat: 6.6780, lng: -1.6100 },
  { lat: 6.67331, lng: -1.60236 },
]

const socket = io(SERVER, { transports: ['websocket'] })

socket.on('connect', () => {
  console.log('connected to', SERVER)
  // Tell server we want updates for this order (mimic a client watcher)
  socket.emit('order:watch', { orderId: ORDER_ID })
  console.log('watching order', ORDER_ID)

  let i = 0
  setInterval(() => {
    const p = path[i % path.length]
    const payload = { riderId: RIDER_ID, orderId: ORDER_ID, lat: p.lat, lng: p.lng }
    socket.emit('rider:location', payload)
    console.log('emitted rider:location', payload)
    i++
  }, 2500)
})

socket.on('connect_error', (err) => console.error('connect_error', err.message))

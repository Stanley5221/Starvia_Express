import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MapPin, Shield, Clock, Star, Package } from 'lucide-react'
import './Home.css'

const features = [
  { icon: <Package size={24}/>, title: 'Fast Delivery',    desc: 'Express deliveries across the city with guaranteed speed.' },
  { icon: <MapPin size={24}/>,  title: 'Live GPS Tracking', desc: 'Track your rider in real-time on our interactive map.' },
  { icon: <Shield size={24}/>,  title: 'Fully Insured',     desc: 'Every delivery is covered with complete protection.' },
  { icon: <Clock size={24}/>,   title: '24/7 Service',     desc: 'Round-the-clock delivery support whenever you need it.' },
]

const steps = [
  { n: '01', title: 'Place Order',    desc: 'Enter your pickup and delivery locations with package details.' },
  { n: '02', title: 'Rider Assigned', desc: 'A verified professional rider is dispatched immediately.' },
  { n: '03', title: 'Live Tracking',  desc: 'Follow your delivery live on the map until it arrives safely.' },
]

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="home">
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="container hero-content fade-in">
          <div className="hero-badge"><Star size={14}/> Starvia Express Delivery</div>
          <h1 className="hero-title">
            Fast & Reliable<br />
            <span className="gradient-text">Delivery Service</span>
          </h1>
          <p className="hero-sub">
            Experience premium delivery with Starvia Express. Real-time tracking, professional riders, 
            and guaranteed safety. Your packages deserve the best.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link to="/order/new" className="btn btn-primary">
                <Package size={18}/> Send a Delivery
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary">Get Started Now</Link>
                <Link to="/login"    className="btn btn-outline">Sign In</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section container">
        <h2 className="section-title">Why Choose Starvia Express?</h2>
        <div className="grid-4 fade-in">
          {features.map(f => (
            <div key={f.title} className="feature-card card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section container">
        <h2 className="section-title">How It Works</h2>
        <div className="steps fade-in">
          {steps.map((s, i) => (
            <div key={i} className="step-card">
              <div className="step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section container cta-section fade-in">
        <div className="cta-card card">
          <h2>Ready to experience express delivery?</h2>
          <p>Join thousands of satisfied customers who trust Starvia Express for their deliveries.</p>
          <Link to={user ? '/order/new' : '/register'} className="btn btn-accent">
            {user ? 'Send a Delivery' : 'Start for Free'}
          </Link>
        </div>
      </section>
    </div>
  )
}

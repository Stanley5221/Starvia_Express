import { useState, useEffect } from 'react'
import api from '../../../../shared/api'
import { DollarSign, Save, Loader, ShieldAlert, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Pricing() {
  const [activeTab, setActiveTab] = useState('standard') // 'standard' | 'business'

  const [standardConfig, setStandardConfig] = useState({ basePrice: 0, pricePerKm: 0, minPrice: 0, currency: 'GHS', discountPercent: 0 })
  const [businessConfig, setBusinessConfig] = useState({ basePrice: 0, pricePerKm: 0, minPrice: 0, discountPercent: 0, label: 'Business Rate' })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function fetchConfigs() {
    setLoading(true)
    try {
      const [stdRes, bizRes] = await Promise.all([
        api.get('/admin/pricing'),
        api.get('/admin/businesses/pricing'),
      ])
      setStandardConfig(stdRes.data)
      setBusinessConfig(bizRes.data)
    } catch (err) {
      toast.error('Failed to load configurations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfigs() }, [])

  async function handleSaveStandard(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/admin/pricing', standardConfig)
      toast.success('Standard pricing updated successfully')
      fetchConfigs()
    } catch (err) {
      toast.error('Failed to update standard pricing')
    } finally { setSaving(false) }
  }

  async function handleSaveBusiness(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/admin/businesses/pricing', businessConfig)
      toast.success('Business pricing updated successfully')
      fetchConfigs()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update business pricing')
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: '3rem' }}>Loading configurations...</div>

  return (
    <div className="pricing-page fade-in">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>Pricing Configurations</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Configure fare rates and business account discounts.</p>
      </div>

      {/* Tab toggle */}
      <div className="role-toggle" style={{ maxWidth: '480px', display: 'flex', gap: '0.25rem', marginBottom: '2rem' }}>
        <button type="button" className={activeTab === 'standard' ? 'active' : ''} onClick={() => setActiveTab('standard')}>
          <DollarSign size={14} /> Individual Standard Rate
        </button>
        <button type="button" className={activeTab === 'business' ? 'active' : ''} onClick={() => setActiveTab('business')}>
          <Sparkles size={14} /> Business Partner Default
        </button>
      </div>

      {activeTab === 'standard' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-accent)', marginBottom: '1.5rem', fontWeight: 'bold' }}>
            <ShieldAlert size={16} />
            <span>Standard Rates (Individual Customer Web App)</span>
          </div>
          <form onSubmit={handleSaveStandard}>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 'bold' }}>Base Price ({standardConfig.currency})</label>
              <input className="input-field" type="number" step="0.01" value={standardConfig.basePrice}
                onChange={e => setStandardConfig({ ...standardConfig, basePrice: +e.target.value })} required />
              <small style={{ color: 'var(--text-muted)' }}>The starting flag-fall fee charged for every delivery.</small>
            </div>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 'bold' }}>Price Per KM</label>
              <input className="input-field" type="number" step="0.01" value={standardConfig.pricePerKm}
                onChange={e => setStandardConfig({ ...standardConfig, pricePerKm: +e.target.value })} required />
              <small style={{ color: 'var(--text-muted)' }}>Distance-based rate added for every kilometer traveled.</small>
            </div>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 'bold' }}>Minimum Price</label>
              <input className="input-field" type="number" step="0.01" value={standardConfig.minPrice}
                onChange={e => setStandardConfig({ ...standardConfig, minPrice: +e.target.value })} required />
              <small style={{ color: 'var(--text-muted)' }}>The absolute lowest price for placing a delivery order.</small>
            </div>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                Global Individual Discount (%) <span style={{ color: 'var(--brand-accent)', fontWeight: 700 }}>— applies to ALL individual customers</span>
              </label>
              <input className="input-field" type="number" step="1" min="0" max="100"
                placeholder="0" value={standardConfig.discountPercent ?? 0}
                onChange={e => setStandardConfig({ ...standardConfig, discountPercent: +e.target.value })} />
              <small style={{ color: 'var(--text-muted)' }}>
                A % discount off the standard rate for every individual customer. 0 = no discount.
                Override per-customer from the Customers page.
              </small>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
              {saving ? <Loader size={16} className="loading" /> : <><Save size={16} /> Save Changes</>}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'business' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', marginBottom: '1.5rem', fontWeight: 'bold' }}>
            <Sparkles size={16} />
            <span>Business Partnership Rates (Corporate Default)</span>
          </div>
          <form onSubmit={handleSaveBusiness}>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 'bold' }}>Base Price (GH₵)</label>
              <input className="input-field" type="number" step="0.01" value={businessConfig.basePrice}
                onChange={e => setBusinessConfig({ ...businessConfig, basePrice: +e.target.value })} required />
              <small style={{ color: 'var(--text-muted)' }}>Starting price for business accounts. Default: GH₵ 5.00</small>
            </div>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 'bold' }}>Price Per KM (GH₵)</label>
              <input className="input-field" type="number" step="0.01" value={businessConfig.pricePerKm}
                onChange={e => setBusinessConfig({ ...businessConfig, pricePerKm: +e.target.value })} required />
              <small style={{ color: 'var(--text-muted)' }}>Kilometer charge for business accounts. Default: GH₵ 3.00</small>
            </div>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 'bold' }}>Minimum Price (GH₵)</label>
              <input className="input-field" type="number" step="0.01" value={businessConfig.minPrice}
                onChange={e => setBusinessConfig({ ...businessConfig, minPrice: +e.target.value })} required />
              <small style={{ color: 'var(--text-muted)' }}>Minimum charge for business deliveries. Default: GH₵ 8.00</small>
            </div>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                Global Discount (%) <span style={{ color: 'var(--brand-accent)', fontWeight: 700 }}>— applies to ALL businesses</span>
              </label>
              <input className="input-field" type="number" step="1" min="0" max="100"
                placeholder="0" value={businessConfig.discountPercent ?? 0}
                onChange={e => setBusinessConfig({ ...businessConfig, discountPercent: +e.target.value })} />
              <small style={{ color: 'var(--text-muted)' }}>
                An extra % off the business price applied to every business account.
                Set per-business overrides from each business's detail page.
              </small>
            </div>
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 'bold' }}>Price Label</label>
              <input className="input-field" type="text" placeholder="e.g. Business Default Rate" value={businessConfig.label || ''}
                onChange={e => setBusinessConfig({ ...businessConfig, label: e.target.value })} required />
              <small style={{ color: 'var(--text-muted)' }}>Description displayed to partners in their portal.</small>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving}>
              {saving ? <Loader size={16} className="loading" /> : <><Save size={16} /> Save Changes</>}
            </button>
          </form>
        </div>
      )}

    </div>
  )
}

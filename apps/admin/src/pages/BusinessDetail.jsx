import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../../../shared/api'
import { formatMoney } from '../../../../shared/currency'
import {
  Building, User, Mail, Phone, MapPin, ArrowLeft,
  ShieldCheck, FileText, Check, X, AlertCircle, Save, Loader,
  Percent, RotateCcw
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function BusinessDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [reviewingDocId, setReviewingDocId] = useState(null)

  // Status decision form
  const [status, setStatus] = useState('')
  const [reason, setReason] = useState('')

  // Individual document review notes
  const [docNotes, setDocNotes] = useState({})

  // Per-business pricing
  const [pricingData, setPricingData] = useState({ perBusiness: null, global: null })
  const [pricingForm, setPricingForm] = useState({ discountPercent: 0, basePrice: '', pricePerKm: '', minPrice: '', label: '' })
  const [savingPricing, setSavingPricing] = useState(false)
  const [resettingPricing, setResettingPricing] = useState(false)

  async function fetchDetail() {
    try {
      const res = await api.get(`/admin/businesses/${id}`)
      setBusiness(res.data)
      setStatus(res.data.verificationStatus)
      setReason(res.data.rejectionReason || '')
    } catch (err) {
      toast.error('Failed to load business details')
      navigate('/businesses')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPricing() {
    try {
      const res = await api.get(`/admin/businesses/${id}/pricing`)
      setPricingData(res.data)
      const src = res.data.perBusiness || res.data.global || {}
      setPricingForm({
        discountPercent: res.data.perBusiness?.discountPercent ?? 0,
        basePrice:       src.basePrice   ?? '',
        pricePerKm:      src.pricePerKm  ?? '',
        minPrice:        src.minPrice    ?? '',
        label:           res.data.perBusiness?.label ?? '',
      })
    } catch (_) {}
  }

  useEffect(() => {
    fetchDetail()
    fetchPricing()
  }, [id])

  async function handleSavePricing(e) {
    e.preventDefault()
    setSavingPricing(true)
    try {
      await api.put(`/admin/businesses/${id}/pricing`, {
        discountPercent: +pricingForm.discountPercent,
        basePrice:       pricingForm.basePrice !== '' ? +pricingForm.basePrice : undefined,
        pricePerKm:      pricingForm.pricePerKm !== '' ? +pricingForm.pricePerKm : undefined,
        minPrice:        pricingForm.minPrice !== '' ? +pricingForm.minPrice : undefined,
        label:           pricingForm.label || undefined,
      })
      toast.success('Custom pricing saved')
      fetchPricing()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save pricing')
    } finally {
      setSavingPricing(false)
    }
  }

  async function handleResetPricing() {
    if (!window.confirm('Remove custom pricing and revert this business to the global default rate?')) return
    setResettingPricing(true)
    try {
      await api.delete(`/admin/businesses/${id}/pricing`)
      toast.success('Reverted to global default')
      fetchPricing()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset pricing')
    } finally {
      setResettingPricing(false)
    }
  }

  // Securely download and open document file in a new tab
  async function handleViewFile(docId, fileName, mimeType) {
    const toastId = toast.loading('Downloading file...')
    try {
      const res = await api.get(`/admin/businesses/${id}/documents/${docId}/file`, {
        responseType: 'blob'
      })
      const file = new Blob([res.data], { type: mimeType })
      const fileURL = URL.createObjectURL(file)
      window.open(fileURL, '_blank')
      toast.dismiss(toastId)
    } catch (err) {
      toast.error('Failed to open document file', { id: toastId })
    }
  }

  // Update a single document status (approve or reject)
  async function handleReviewDoc(docId, docStatus) {
    const note = docNotes[docId] || ''
    if (docStatus === 'REJECTED' && !note.trim()) {
      return toast.error('Please enter a review note describing the rejection reason')
    }

    setReviewingDocId(docId)
    try {
      await api.patch(`/admin/businesses/${id}/documents/${docId}/review`, {
        status: docStatus,
        note: note.trim() || null
      })
      toast.success('Document updated successfully')
      fetchDetail()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update document status')
    } finally {
      setReviewingDocId(null)
    }
  }

  // Save overall business verification status
  async function handleSaveStatus(e) {
    e.preventDefault()
    if (status === 'REJECTED' && !reason.trim()) {
      return toast.error('A rejection reason is required')
    }

    setSavingStatus(true)
    try {
      await api.patch(`/admin/businesses/${id}/verify`, {
        status,
        reason: status === 'REJECTED' ? reason.trim() : null
      })
      toast.success('Verification status updated!')
      fetchDetail()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update verification status')
    } finally {
      setSavingStatus(false)
    }
  }

  if (loading) return <div style={{ padding: '3rem' }}>Loading business profile details...</div>

  // Enforce ALLOWED_TRANSITIONS mapping for warning notices
  const ALLOWED_TRANSITIONS = {
    PENDING:      ['UNDER_REVIEW', 'REJECTED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED:     ['SUSPENDED'],
    REJECTED:     ['UNDER_REVIEW'],
    SUSPENDED:    ['APPROVED', 'REJECTED'],
  }

  const allowedNextStates = ALLOWED_TRANSITIONS[business?.verificationStatus] || []

  return (
    <div className="business-detail-page fade-in">
      <div className="back-nav" style={{ marginBottom: '1.5rem' }}>
        <Link to="/businesses" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-accent)', fontWeight: 'bold' }}>
          <ArrowLeft size={16} /> Back to Partners List
        </Link>
      </div>

      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>Review Partner Account</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Review verification documents and toggle pricing configurations.</p>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Side: Profile & Documents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Business Details Card */}
          <div className="card">
            <h2>Partner Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
              <div>
                <span className="readonly-label">Business Name</span>
                <div className="readonly-value"><Building size={16} /> {business.businessName}</div>
              </div>
              <div>
                <span className="readonly-label">Business Type</span>
                <div className="readonly-value" style={{ textTransform: 'capitalize' }}>
                  <Building size={16} /> {business.businessType.toLowerCase().replace('_', ' ')}
                </div>
              </div>
              <div>
                <span className="readonly-label">Owner Full Name</span>
                <div className="readonly-value"><User size={16} /> {business.ownerFullName}</div>
              </div>
              <div>
                <span className="readonly-label">Email Address</span>
                <div className="readonly-value"><Mail size={16} /> {business.email}</div>
              </div>
              <div>
                <span className="readonly-label">Phone Number</span>
                <div className="readonly-value"><Phone size={16} /> {business.phone}</div>
              </div>
              <div>
                <span className="readonly-label">Ghana Post GPS</span>
                <div className="readonly-value"><MapPin size={16} /> {business.gpsAddress || 'N/A'}</div>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <span className="readonly-label">Business Location Address</span>
              <div className="readonly-value"><MapPin size={16} /> {business.businessAddress}</div>
            </div>
          </div>

          {/* KYC Documents Section */}
          <div className="card">
            <h2>KYC / Verification Documents</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
              {business.documents.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileText size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                  <p>No documents uploaded yet by this business partner.</p>
                </div>
              ) : (
                business.documents.map(doc => (
                  <div key={doc.id} className={`card doc-slot-card ${doc.status.toLowerCase()}`} style={{ background: 'rgba(255,255,255,0.01)', padding: '1.2rem !important' }}>
                    <div style={{ flex: '1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <FileText size={20} style={{ color: 'var(--brand-accent)' }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>{doc.type.replace(/_/g, ' ')}</h3>
                        <span className={`badge badge-${doc.status.toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                          {doc.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'flex', gap: '0.8rem' }}>
                        <span>File: <b>{doc.fileName}</b></span>
                        <span>Size: <b>{(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</b></span>
                      </div>
                      
                      {/* Document Review note display */}
                      {doc.status === 'REJECTED' && doc.reviewNote && (
                        <div className="doc-rejection-note" style={{ marginLeft: '0', marginTop: '0.8rem' }}>
                          <AlertCircle size={14} />
                          <span>Rejection Reason: {doc.reviewNote}</span>
                        </div>
                      )}

                      {/* Doc review forms if not approved */}
                      {doc.status !== 'APPROVED' && (
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', maxWidth: '400px' }}>
                          <input 
                            className="input-field" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginBottom: '0' }}
                            placeholder="Rejection note (required for rejection)" 
                            value={docNotes[doc.id] || ''}
                            onChange={(e) => setDocNotes({...docNotes, [doc.id]: e.target.value})}
                          />
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', marginLeft: '1rem' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleViewFile(doc.id, doc.fileName, doc.mimeType)}>
                        View Document
                      </button>
                      
                      {doc.status !== 'APPROVED' && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            className="btn btn-success btn-sm" 
                            style={{ padding: '0.4rem 0.8rem' }}
                            disabled={reviewingDocId === doc.id}
                            onClick={() => handleReviewDoc(doc.id, 'APPROVED')}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button 
                            className="btn btn-danger btn-sm" 
                            style={{ padding: '0.4rem 0.8rem' }}
                            disabled={reviewingDocId === doc.id}
                            onClick={() => handleReviewDoc(doc.id, 'REJECTED')}
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Decision & Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Decision Card */}
          <div className="card">
            <h2>Verification Status</h2>
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="readonly-label" style={{ marginBottom: '0' }}>Current Status:</span>
                <span className={`badge badge-${business.verificationStatus.toLowerCase()}`}>
                  {business.verificationStatus}
                </span>
              </div>
              
              <form onSubmit={handleSaveStatus} style={{ marginTop: '1.5rem' }}>
                <div className="input-group">
                  <label>Transition To</label>
                  <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value={business.verificationStatus}>{business.verificationStatus} (Current)</option>
                    {allowedNextStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {status === 'REJECTED' && (
                  <div className="input-group">
                    <label>Rejection Reason</label>
                    <textarea 
                      className="input-field" 
                      rows="3" 
                      placeholder="Explain to the merchant what files or fields are incorrect..."
                      value={reason} 
                      onChange={e => setReason(e.target.value)}
                      required
                    />
                  </div>
                )}

                <button className="btn btn-primary w-full" type="submit" disabled={savingStatus || status === business.verificationStatus}>
                  {savingStatus ? <Loader size={16} className="loading"/> : <><Save size={16}/> Save Decision</>}
                </button>

                {status !== business.verificationStatus && (
                  <div style={{ display: 'flex', gap: '0.4rem', color: 'var(--warning)', marginTop: '0.8rem', fontSize: '0.82rem', lineHeight: '1.3' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>Saving this decision will trigger automated email/push notifications to the business owner.</span>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Business Stats Card */}
          <div className="card">
            <h2>Partner Stats</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Deliveries</span>
                <b style={{ color: '#fff' }}>{business.totalDeliveries}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Deliveries This Month</span>
                <b style={{ color: '#fff' }}>{business.monthlyDeliveries}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Spend</span>
                <b style={{ color: 'var(--brand-accent)' }}>{formatMoney(business.totalSpend)}</b>
              </div>
            </div>
          </div>

          {/* Pricing & Discount Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Percent size={18} style={{ color: 'var(--brand-accent)' }} />
              <h2 style={{ margin: 0 }}>Pricing & Discount</h2>
            </div>

            {pricingData.perBusiness ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(var(--success-rgb, 52,199,89),0.12)', color: 'var(--success)', borderRadius: 6, padding: '0.2rem 0.6rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
                <ShieldCheck size={13} /> Custom rate active
              </div>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', borderRadius: 6, padding: '0.2rem 0.6rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Using global default
              </div>
            )}

            {pricingData.global && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text-secondary)' }}>Global defaults:</b>{' '}
                GH₵{pricingData.global.basePrice} base · GH₵{pricingData.global.pricePerKm}/km · GH₵{pricingData.global.minPrice} min
                {pricingData.global.discountPercent > 0 && ` · ${pricingData.global.discountPercent}% global discount`}
              </div>
            )}

            <form onSubmit={handleSavePricing}>
              {/* Discount — most prominent */}
              <div className="input-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Discount (%) <span style={{ color: 'var(--brand-accent)', fontWeight: 400, fontSize: '0.82rem' }}>— this business only</span>
                </label>
                <input
                  className="input-field"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={pricingForm.discountPercent}
                  onChange={e => setPricingForm({ ...pricingForm, discountPercent: e.target.value })}
                />
                <small style={{ color: 'var(--text-muted)' }}>Override the global discount for this specific partner.</small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: 16 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Base Price (GH₵)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.01"
                    placeholder={pricingData.global?.basePrice ?? '5.00'}
                    value={pricingForm.basePrice}
                    onChange={e => setPricingForm({ ...pricingForm, basePrice: e.target.value })}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Per KM (GH₵)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.01"
                    placeholder={pricingData.global?.pricePerKm ?? '3.00'}
                    value={pricingForm.pricePerKm}
                    onChange={e => setPricingForm({ ...pricingForm, pricePerKm: e.target.value })}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Minimum Price (GH₵)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.01"
                    placeholder={pricingData.global?.minPrice ?? '8.00'}
                    value={pricingForm.minPrice}
                    onChange={e => setPricingForm({ ...pricingForm, minPrice: e.target.value })}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Rate Label</label>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="e.g. Partner Rate"
                    value={pricingForm.label}
                    onChange={e => setPricingForm({ ...pricingForm, label: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button className="btn btn-primary" type="submit" disabled={savingPricing} style={{ flex: 1, justifyContent: 'center' }}>
                  {savingPricing ? <Loader size={15} className="loading" /> : <><Save size={15} /> Save Custom Rate</>}
                </button>
                {pricingData.perBusiness && (
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={handleResetPricing}
                    disabled={resettingPricing}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {resettingPricing ? <Loader size={15} className="loading" /> : <><RotateCcw size={15} /> Reset to Global</>}
                  </button>
                )}
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  )
}

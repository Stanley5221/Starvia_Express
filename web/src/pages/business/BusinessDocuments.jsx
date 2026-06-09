import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../../../shared/api'
import { 
  FileText, Upload, CheckCircle2, AlertCircle, Clock, 
  Loader, ArrowLeft, Trash2, Info
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import './Business.css'

const DOCUMENT_TYPES = [
  { id: 'GHANA_CARD_FRONT', label: 'Ghana Card - Front', required: true, description: 'National ID card front face showing photo and name.' },
  { id: 'GHANA_CARD_BACK', label: 'Ghana Card - Back', required: true, description: 'National ID card back face showing signature and barcode.' },
  { id: 'BUSINESS_REGISTRATION', label: 'Business Registration Certificate', required: true, description: 'Official registration certificate issued by the Registrar General\'s Dept.' },
  { id: 'TIN', label: 'TIN Certificate', required: false, description: 'Taxpayer Identification Number certificate (optional).' },
  { id: 'BUSINESS_PERMIT', label: 'Business Operating Permit', required: false, description: 'Local Assembly operating permit (optional).' }
]

export default function BusinessDocuments() {
  const { checkMe } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingDocType, setUploadingDocType] = useState(null)

  async function fetchDocuments() {
    try {
      const res = await api.get('/business/documents')
      setDocuments(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // Handle file upload
  async function handleFileUpload(e, docType) {
    const file = e.target.files[0]
    if (!file) return

    // 1. File validations
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedMimeTypes.includes(file.type)) {
      return toast.error('Only JPG, PNG, and PDF files are allowed')
    }

    const maxSize = 5 * 1024 * 1024 // 5 MB
    if (file.size > maxSize) {
      return toast.error('File size exceeds the 5 MB limit')
    }

    // 2. Upload file
    const formData = new FormData()
    formData.append('type', docType)
    formData.append('file', file)

    setUploadingDocType(docType)
    const toastId = toast.loading(`Uploading ${file.name}...`)

    try {
      await api.post('/business/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(`${file.name} uploaded successfully!`, { id: toastId })
      
      // Refresh documents list and re-run checkMe to update status in AuthContext
      await Promise.all([fetchDocuments(), checkMe()])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed', { id: toastId })
    } finally {
      setUploadingDocType(null)
    }
  }

  // Get matching document object from API state
  const getDoc = (type) => documents.find(d => d.type === type)

  // Render status badge or action
  const renderDocStatus = (docType) => {
    const doc = getDoc(docType.id)

    if (uploadingDocType === docType.id) {
      return (
        <div className="doc-status-loading">
          <Loader size={18} className="loading" />
          <span>Uploading...</span>
        </div>
      )
    }

    if (!doc) {
      return (
        <div className="doc-status-upload-btn">
          <label className="btn btn-outline btn-sm upload-label">
            <Upload size={14} /> Upload File
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} 
              onChange={(e) => handleFileUpload(e, docType.id)} />
          </label>
        </div>
      )
    }

    switch (doc.status) {
      case 'APPROVED':
        return (
          <div className="doc-status approved">
            <CheckCircle2 size={18} />
            <span>Approved</span>
          </div>
        )
      case 'PENDING':
        return (
          <div className="doc-status pending">
            <Clock size={18} />
            <span>Pending Review</span>
          </div>
        )
      case 'REJECTED':
        return (
          <div className="doc-status-reupload-wrap">
            <div className="doc-status rejected">
              <AlertCircle size={18} />
              <span>Rejected</span>
            </div>
            <label className="btn btn-outline btn-sm upload-label reupload-btn">
              <Upload size={14} /> Re-upload
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} 
                onChange={(e) => handleFileUpload(e, doc.type)} />
            </label>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="page fade-in">
      <div className="container">
        
        {/* Back Link */}
        <div className="back-nav">
          <Link to="/business/dashboard" className="back-link">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>

        {/* Page Header */}
        <div className="page-header">
          <h1>KYC / Verification Documents</h1>
          <p>Please upload all required business credentials. Approved documents activate discounted partnership pricing.</p>
        </div>

        <div className="documents-layout">
          {/* Instructions Box */}
          <div className="card info-box">
            <div className="info-box-title">
              <Info size={18} className="info-icon" />
              <h3>Verification Guidelines</h3>
            </div>
            <ul className="info-list">
              <li>Upload clean, readable scans or photos. Blurry documents will be rejected.</li>
              <li>Only <b>JPG, PNG, or PDF</b> formats are accepted.</li>
              <li>Maximum file size per document is <b>5 MB</b>.</li>
              <li>Your Ghana Card name must align with your Starvia profile owner name.</li>
              <li>Required files (Ghana Card Front, Ghana Card Back, and Business Cert) must be <b>APPROVED</b> by admin to activate your partnership discount.</li>
            </ul>
          </div>

          {/* Document Slots List */}
          <div className="document-slots">
            {DOCUMENT_TYPES.map((type) => {
              const doc = getDoc(type.id)
              return (
                <div key={type.id} className={`card doc-slot-card ${doc ? doc.status.toLowerCase() : 'empty'}`}>
                  <div className="doc-slot-info">
                    <div className="doc-slot-title-wrap">
                      <FileText className="doc-icon" size={24} />
                      <div>
                        <h3>
                          {type.label} 
                          {type.required && <span className="req-label" style={{ color: 'var(--brand-secondary)', marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 'bold' }}>(Required)</span>}
                        </h3>
                        <p className="doc-desc">{type.description}</p>
                      </div>
                    </div>
                    {doc && (
                      <div className="doc-file-details">
                        <span className="file-name" title={doc.fileName}>{doc.fileName}</span>
                        <span className="file-divider">•</span>
                        <span className="file-size">{(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    )}
                    {doc?.status === 'REJECTED' && doc.reviewNote && (
                      <div className="doc-rejection-note">
                        <AlertCircle size={14} />
                        <span><b>Reviewer Note:</b> {doc.reviewNote}</span>
                      </div>
                    )}
                  </div>

                  <div className="doc-slot-action">
                    {renderDocStatus(type)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_BASE = path.join(__dirname, '..', '..', 'uploads', 'business');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const businessId = req.user && req.user.businessId;
    if (!businessId) return cb(new Error('businessId missing from token'), null);

    const dir = path.join(UPLOAD_BASE, businessId.toString());
    try {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err, null);
    }
  },

  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const stem = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, '-')
      .slice(0, 40);
    cb(null, `${stem}-${Date.now()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPG, PNG and PDF files are accepted'), false);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

module.exports = { upload, UPLOAD_BASE };

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = {
  stl: path.join(__dirname, '../uploads/stl'),
  images: path.join(__dirname, '../uploads/images'),
  attachments: path.join(__dirname, '../uploads/attachments')
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration for STL files
const stlStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.stl);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'stl-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Storage configuration for images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.images);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Storage configuration for general attachments
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.attachments);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for 3D model files (STL, OBJ, 3MF)
const stlFileFilter = (req, file, cb) => {
  const allowedExtensions = ['.stl', '.obj', '.3mf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only STL, OBJ, and 3MF files are allowed'), false);
  }
};

// File filter for images
const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

// File filter for general attachments
const attachmentFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

// Multer configurations
const uploadSTL = multer({
  storage: stlStorage,
  fileFilter: stlFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB
  }
}).single('stlFile');

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
}).single('image');

const uploadMultipleImages = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB per file
  }
}).array('images', 5); // Max 5 images

const uploadAttachment = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  }
}).single('attachment');

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File size too large',
        details: err.message
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        details: err.message
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      details: err.message
    });
  }

  if (err) {
    return res.status(400).json({
      error: err.message || 'File upload failed'
    });
  }

  next();
};

// Helper function to delete file
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

module.exports = {
  uploadSTL,
  uploadImage,
  uploadMultipleImages,
  uploadAttachment,
  handleUploadError,
  deleteFile,
  uploadDirs
};

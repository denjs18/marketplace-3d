const multer = require('multer');
const path = require('path');
const { put } = require('@vercel/blob');

// NOTE: Using Vercel Blob for file storage
// Vercel serverless functions have a read-only filesystem.
// All files are stored in Vercel Blob storage instead of local directories.

// Use memory storage to handle files in memory before uploading to Vercel Blob
const memoryStorage = multer.memoryStorage();

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

// Helper function to upload file to Vercel Blob
const uploadToVercelBlob = async (file, folder) => {
  try {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `${folder}/${file.fieldname}-${uniqueSuffix}${ext}`;

    const blob = await put(filename, file.buffer, {
      access: 'public',
      contentType: file.mimetype
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      size: file.size,
      mimetype: file.mimetype,
      originalname: file.originalname
    };
  } catch (error) {
    console.error('Error uploading to Vercel Blob:', error);
    throw new Error('Failed to upload file to storage');
  }
};

// Middleware to handle STL file upload
const uploadSTL = multer({
  storage: memoryStorage,
  fileFilter: stlFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB (Vercel Blob max recommended size)
  }
}).single('stlFile');

// Middleware to handle single image upload
const uploadImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
}).single('image');

// Middleware to handle profile image upload
const uploadProfileImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
}).single('profileImage');

// Middleware to handle multiple images upload
const uploadMultipleImages = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB per file
  }
}).array('images', 5); // Max 5 images

// Middleware to handle attachment upload
const uploadAttachment = multer({
  storage: memoryStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  }
}).single('attachment');

// Wrapper middleware for STL upload with Vercel Blob
const uploadSTLToBlob = (req, res, next) => {
  uploadSTL(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    if (req.file) {
      try {
        const blobData = await uploadToVercelBlob(req.file, 'uploads/stl');
        req.file.url = blobData.url;
        req.file.pathname = blobData.pathname;
        req.file.path = blobData.url; // For backward compatibility
      } catch (error) {
        return next(error);
      }
    }

    next();
  });
};

// Wrapper middleware for image upload with Vercel Blob
const uploadImageToBlob = (req, res, next) => {
  uploadImage(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    if (req.file) {
      try {
        const blobData = await uploadToVercelBlob(req.file, 'uploads/images');
        req.file.url = blobData.url;
        req.file.pathname = blobData.pathname;
        req.file.path = blobData.url; // For backward compatibility
      } catch (error) {
        return next(error);
      }
    }

    next();
  });
};

// Wrapper middleware for profile image upload with Vercel Blob
const uploadProfileImageToBlob = (req, res, next) => {
  uploadProfileImage(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    if (req.file) {
      try {
        const blobData = await uploadToVercelBlob(req.file, 'uploads/profile-images');
        req.file.url = blobData.url;
        req.file.pathname = blobData.pathname;
        req.file.path = blobData.url; // For backward compatibility
      } catch (error) {
        return next(error);
      }
    }

    next();
  });
};

// Wrapper middleware for multiple images upload with Vercel Blob
const uploadMultipleImagesToBlob = (req, res, next) => {
  uploadMultipleImages(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map(file => uploadToVercelBlob(file, 'uploads/images'));
        const blobDataArray = await Promise.all(uploadPromises);

        req.files.forEach((file, index) => {
          file.url = blobDataArray[index].url;
          file.pathname = blobDataArray[index].pathname;
          file.path = blobDataArray[index].url; // For backward compatibility
        });
      } catch (error) {
        return next(error);
      }
    }

    next();
  });
};

// Wrapper middleware for attachment upload with Vercel Blob
const uploadAttachmentToBlob = (req, res, next) => {
  uploadAttachment(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    if (req.file) {
      try {
        const blobData = await uploadToVercelBlob(req.file, 'uploads/attachments');
        req.file.url = blobData.url;
        req.file.pathname = blobData.pathname;
        req.file.path = blobData.url; // For backward compatibility
      } catch (error) {
        return next(error);
      }
    }

    next();
  });
};

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

// Helper function to delete file from Vercel Blob
const deleteFile = async (fileUrl) => {
  try {
    // Vercel Blob delete functionality
    // Note: You need to use the del function from @vercel/blob
    const { del } = require('@vercel/blob');
    await del(fileUrl);
    return true;
  } catch (error) {
    console.error('Error deleting file from Vercel Blob:', error);
    return false;
  }
};

module.exports = {
  uploadSTL: uploadSTLToBlob,
  uploadImage: uploadImageToBlob,
  uploadProfileImage: uploadProfileImageToBlob,
  uploadMultipleImages: uploadMultipleImagesToBlob,
  uploadAttachment: uploadAttachmentToBlob,
  handleUploadError,
  deleteFile,
  uploadToVercelBlob // Export helper for custom usage
};

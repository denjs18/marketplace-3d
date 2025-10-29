const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate, isClient } = require('../middleware/auth');
const { uploadSTL, handleUploadError } = require('../middleware/upload');
const { validateProject, validateObjectId } = require('../middleware/validation');

/**
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Private (Client only)
 */
router.post(
  '/',
  authenticate,
  isClient,
  // Middleware conditionnel : si JSON, pas d'upload, sinon upload STL
  (req, res, next) => {
    const contentType = req.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      // JSON request, skip file upload
      return projectController.createProjectJSON(req, res);
    } else {
      // FormData request, use file upload
      uploadSTL(req, res, (err) => {
        if (err) return handleUploadError(err, req, res, next);
        validateProject(req, res, (err) => {
          if (err) return next(err);
          projectController.createProject(req, res);
        });
      });
    }
  }
);

/**
 * @route   GET /api/projects
 * @desc    Get all projects (filtered by role)
 * @access  Private
 */
router.get('/', authenticate, projectController.getProjects);

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  Private
 */
router.get('/:id', authenticate, validateObjectId('id'), projectController.getProjectById);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Private (Client owner only)
 */
router.put('/:id', authenticate, isClient, validateObjectId('id'), projectController.updateProject);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Private (Client owner only)
 */
router.delete('/:id', authenticate, isClient, validateObjectId('id'), projectController.deleteProject);

/**
 * @route   POST /api/projects/:id/complete
 * @desc    Mark project as completed
 * @access  Private (Assigned printer only)
 */
router.post('/:id/complete', authenticate, validateObjectId('id'), projectController.completeProject);

/**
 * @route   POST /api/projects/:id/cancel
 * @desc    Cancel project
 * @access  Private (Client owner only)
 */
router.post('/:id/cancel', authenticate, isClient, validateObjectId('id'), projectController.cancelProject);

module.exports = router;

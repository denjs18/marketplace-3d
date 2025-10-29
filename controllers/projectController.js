const Project = require('../models/Project');
const Quote = require('../models/Quote');
const { deleteFile } = require('../middleware/upload');

/**
 * Create new project (FormData with file upload)
 */
exports.createProject = async (req, res) => {
  try {
    const { title, description, specifications, deadline, budget, tags } = req.body;

    if (!req.file) {
      return res.status(400).json({
        error: 'STL file is required'
      });
    }

    const projectData = {
      client: req.userId,
      title,
      description,
      specifications: typeof specifications === 'string' ? JSON.parse(specifications) : specifications,
      stlFile: {
        filename: req.file.originalname,
        path: req.file.url,
        url: req.file.url,
        size: req.file.size,
        originalName: req.file.originalname
      }
    };

    if (deadline) projectData.deadline = deadline;
    if (budget) projectData.budget = typeof budget === 'string' ? JSON.parse(budget) : budget;
    if (tags) projectData.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;

    const project = new Project(projectData);
    await project.save();

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);

    // Delete uploaded file if project creation fails
    if (req.file) {
      deleteFile(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to create project',
      details: error.message
    });
  }
};

/**
 * Create new project (JSON with pre-uploaded STL URL)
 */
exports.createProjectJSON = async (req, res) => {
  try {
    const {
      title,
      description,
      stlFile,
      material,
      color,
      quantity,
      infill,
      finish,
      layerHeight,
      estimatedBudget,
      deadline,
      projectStatus
    } = req.body;

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        error: 'Title and description are required'
      });
    }

    if (!stlFile) {
      return res.status(400).json({
        error: 'STL file URL is required'
      });
    }

    if (!material) {
      return res.status(400).json({
        error: 'Material is required'
      });
    }

    // Extraire le nom du fichier depuis l'URL
    const filename = stlFile.split('/').pop();

    const projectData = {
      client: req.userId,
      title,
      description,
      stlFile: {
        filename: filename,
        path: stlFile,
        size: 0, // On ne connaît pas la taille, mettre 0 par défaut
        originalName: filename
      },
      specifications: {
        material,
        color: color || 'Natural',
        quantity: quantity || 1,
        infill: infill || 20,
        layerHeight: layerHeight || 0.2,
        postProcessing: finish || 'None'
      },
      projectStatus: projectStatus || 'draft'
    };

    if (estimatedBudget) {
      projectData.budget = {
        max: estimatedBudget
      };
    }

    if (deadline) {
      projectData.deadline = new Date(deadline);
    }

    const project = new Project(projectData);
    await project.save();

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project JSON error:', error);
    res.status(500).json({
      error: 'Failed to create project',
      details: error.message
    });
  }
};

/**
 * Get all projects (with filters)
 */
exports.getProjects = async (req, res) => {
  try {
    const {
      status,
      material,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (material) query['specifications.material'] = material;

    // If user is a client, show only their projects
    if (req.userRole === 'client') {
      query.client = req.userId;
    }

    // If user is a printer, show published projects or assigned projects
    if (req.userRole === 'printer') {
      query.$or = [
        { projectStatus: 'published' },
        { projectStatus: 'in_negotiation' },
        { projectStatus: 'quote_received' },
        { assignedPrinter: req.userId }
      ];
    }

    const skip = (page - 1) * limit;

    const projects = await Project.find(query)
      .populate('client', 'firstName lastName profileImage rating')
      .populate('assignedPrinter', 'firstName lastName profileImage rating')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Project.countDocuments(query);

    res.json({
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      error: 'Failed to get projects',
      details: error.message
    });
  }
};

/**
 * Get single project by ID
 */
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client', 'firstName lastName email phone profileImage rating')
      .populate('assignedPrinter', 'firstName lastName email phone profileImage rating companyName')
      .populate({
        path: 'quotes',
        populate: {
          path: 'printer',
          select: 'firstName lastName profileImage rating companyName'
        }
      });

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Check permissions
    const isOwner = project.client._id.toString() === req.userId.toString();
    const isAssigned = project.assignedPrinter && project.assignedPrinter._id.toString() === req.userId.toString();
    const hasQuoted = project.quotes && project.quotes.some(q => q.printer._id.toString() === req.userId.toString());

    // Allow access if:
    // 1. User is the project owner (client)
    // 2. User is the assigned printer
    // 3. User has submitted a quote
    // 4. User is a printer AND project is published/available
    if (!isOwner && !isAssigned && !hasQuoted) {
      if (req.userRole === 'printer') {
        // Printers can view published and available projects
        const allowedStatuses = ['published', 'in_negotiation', 'quote_received'];
        if (!allowedStatuses.includes(project.projectStatus)) {
          return res.status(403).json({
            error: 'Access denied'
          });
        }
      } else {
        // Non-printers (like clients viewing other projects) are denied
        return res.status(403).json({
          error: 'Access denied'
        });
      }
    }

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      error: 'Failed to get project',
      details: error.message
    });
  }
};

/**
 * Update project
 */
exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Only client owner can update
    if (project.client.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Cannot update if project is in progress or completed
    if (['in_progress', 'completed'].includes(project.status)) {
      return res.status(400).json({
        error: 'Cannot update project in current status'
      });
    }

    const {
      title,
      description,
      specifications,
      deadline,
      budget,
      tags,
      projectStatus,
      // Champs individuels des spécifications
      material,
      color,
      quantity,
      infill,
      finish,
      layerHeight,
      estimatedBudget,
      stlFile
    } = req.body;

    // Mettre à jour les champs simples
    if (title) project.title = title;
    if (description) project.description = description;
    if (deadline) project.deadline = new Date(deadline);
    if (tags) project.tags = tags;
    if (projectStatus) project.projectStatus = projectStatus;

    // Mettre à jour specifications (ancien format)
    if (specifications) {
      project.specifications = specifications;
    }

    // Mettre à jour specifications (nouveau format individuel)
    if (material) project.specifications.material = material;
    if (color) project.specifications.color = color;
    if (quantity) project.specifications.quantity = quantity;
    if (infill !== undefined) project.specifications.infill = infill;
    if (layerHeight !== undefined) project.specifications.layerHeight = layerHeight;
    if (finish) project.specifications.postProcessing = finish;

    // Mettre à jour le budget
    if (budget) {
      project.budget = budget;
    } else if (estimatedBudget) {
      project.budget = { max: estimatedBudget };
    }

    // Mettre à jour le fichier STL si fourni
    if (stlFile) {
      const filename = stlFile.split('/').pop();
      project.stlFile = {
        filename: filename,
        path: stlFile,
        size: project.stlFile?.size || 0,
        originalName: filename
      };
    }

    await project.save();

    res.json({
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      error: 'Failed to update project',
      details: error.message
    });
  }
};

/**
 * Delete project
 */
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Only client owner can delete
    if (project.client.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Cannot delete if project is in progress or completed
    if (['in_progress', 'completed'].includes(project.status)) {
      return res.status(400).json({
        error: 'Cannot delete project in current status'
      });
    }

    // Delete STL file
    deleteFile(project.stlFile.path);

    // Delete associated quotes
    await Quote.deleteMany({ project: project._id });

    await project.deleteOne();

    res.json({
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      error: 'Failed to delete project',
      details: error.message
    });
  }
};

/**
 * Mark project as completed
 */
exports.completeProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Only assigned printer can mark as completed
    if (!project.assignedPrinter || project.assignedPrinter.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (project.status !== 'in_progress') {
      return res.status(400).json({
        error: 'Project must be in progress to complete'
      });
    }

    project.status = 'completed';
    project.completedAt = new Date();
    await project.save();

    // Send notification to client
    const User = require('../models/User');
    const { sendProjectCompletedEmail } = require('../utils/email');
    const client = await User.findById(project.client);
    const printer = await User.findById(project.assignedPrinter);

    if (client && printer) {
      sendProjectCompletedEmail(client, project, printer).catch(err =>
        console.error('Failed to send completion email:', err)
      );
    }

    res.json({
      message: 'Project marked as completed',
      project
    });
  } catch (error) {
    console.error('Complete project error:', error);
    res.status(500).json({
      error: 'Failed to complete project',
      details: error.message
    });
  }
};

/**
 * Cancel project
 */
exports.cancelProject = async (req, res) => {
  try {
    const { reason } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Only client can cancel
    if (project.client.toString() !== req.userId.toString()) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    project.status = 'cancelled';
    project.cancelledAt = new Date();
    if (reason) project.cancelReason = reason;
    await project.save();

    res.json({
      message: 'Project cancelled successfully',
      project
    });
  } catch (error) {
    console.error('Cancel project error:', error);
    res.status(500).json({
      error: 'Failed to cancel project',
      details: error.message
    });
  }
};

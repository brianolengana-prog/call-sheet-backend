/**
 * Contacts Routes
 * Handles job and contact management
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const prismaService = require('../services/prismaService');
const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/contacts
 * Get all contacts for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, jobId, search, role } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = {
      userId,
      ...(jobId && { jobId }),
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const [contacts, totalCount] = await Promise.all([
      prismaService.prisma.contact.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              fileName: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: offset
      }),
      prismaService.prisma.contact.count({ where })
    ]);

    // Transform to match frontend ContactRow interface
    const contactRows = contacts.map(contact => ({
      id: contact.id,
      job_id: contact.jobId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      role: contact.role,
      company: contact.company,
      created_at: contact.createdAt?.toISOString() || null,
      is_selected: contact.isSelected,
      job: contact.job
    }));

    res.json({
      success: true,
      data: contactRows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts'
    });
  }
});

/**
 * GET /api/contacts/stats
 * Get contact statistics for the authenticated user
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const [totalContacts, withEmail, withPhone, totalJobs] = await Promise.all([
      prismaService.prisma.contact.count({
        where: { userId }
      }),
      prismaService.prisma.contact.count({
        where: { 
          userId,
          email: { not: null }
        }
      }),
      prismaService.prisma.contact.count({
        where: { 
          userId,
          phone: { not: null }
        }
      }),
      prismaService.prisma.job.count({
        where: { userId }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalContacts,
        withEmail,
        withPhone,
        totalJobs
      }
    });

  } catch (error) {
    console.error('❌ Error fetching contact stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact statistics'
    });
  }
});

/**
 * GET /api/jobs
 * Get all jobs for the authenticated user
 */
router.get('/jobs', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, totalCount] = await Promise.all([
      prismaService.getUserJobs(userId, parseInt(limit), offset),
      prismaService.prisma.job.count({
        where: { userId }
      })
    ]);

    // Transform to match frontend Job interface
    const jobRows = jobs.map(job => ({
      id: job.id,
      title: job.title,
      file_name: job.fileName,
      status: job.status.toLowerCase(),
      created_at: job.createdAt?.toISOString() || null
    }));

    res.json({
      success: true,
      data: jobRows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch jobs'
    });
  }
});

/**
 * PATCH /api/jobs/:id
 * Update job title
 */
router.patch('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.user.id;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    // Verify job belongs to user
    const job = await prismaService.getJobById(id);
    if (!job || job.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    const updatedJob = await prismaService.updateJob(id, { title });

    res.json({
      success: true,
      data: {
        id: updatedJob.id,
        title: updatedJob.title,
        file_name: updatedJob.fileName,
        status: updatedJob.status.toLowerCase(),
        created_at: updatedJob.createdAt?.toISOString() || null
      }
    });

  } catch (error) {
    console.error('❌ Error updating job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job'
    });
  }
});

/**
 * POST /api/contacts
 * Create a new contact
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { jobId, name, email, phone, role, company } = req.body;

    if (!jobId || !name) {
      return res.status(400).json({
        success: false,
        error: 'Job ID and name are required'
      });
    }

    // Verify job belongs to user
    const job = await prismaService.getJobById(jobId);
    if (!job || job.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    const contact = await prismaService.createContact({
      jobId,
      userId,
      name,
      email,
      phone,
      role,
      company
    });

    res.json({
      success: true,
      data: {
        id: contact.id,
        job_id: contact.jobId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        role: contact.role,
        company: contact.company,
        created_at: contact.createdAt?.toISOString() || null,
        is_selected: contact.isSelected
      }
    });

  } catch (error) {
    console.error('❌ Error creating contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create contact'
    });
  }
});

/**
 * GET /api/contacts/export
 * Export contacts as CSV
 */
router.get('/export', async (req, res) => {
  try {
    const userId = req.user.id;
    const { ids } = req.query;

    let where = { userId };
    if (ids) {
      const contactIds = ids.split(',');
      where.id = { in: contactIds };
    }

    const contacts = await prismaService.prisma.contact.findMany({
      where,
      include: {
        job: {
          select: {
            title: true,
            fileName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Generate CSV
    const csvHeader = 'Name,Email,Phone,Role,Company,Job Title,Extracted Date\n';
    const csvRows = contacts.map(contact => 
      `"${contact.name}","${contact.email || ''}","${contact.phone || ''}","${contact.role || ''}","${contact.company || ''}","${contact.job?.title || ''}","${contact.createdAt?.toISOString().split('T')[0] || ''}"`
    ).join('\n');
    
    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csv);

  } catch (error) {
    console.error('❌ Error exporting contacts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export contacts'
    });
  }
});

module.exports = router;

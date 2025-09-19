const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/security');

// In-memory storage for demo (replace with database in production)
let supportTickets = [];
let supportMessages = [];
let supportAgents = [
  {
    id: 'agent_1',
    name: 'Sarah Johnson',
    email: 'sarah@callsheetconverter.com',
    status: 'online',
    specialties: ['technical', 'billing'],
    currentTickets: 0,
    maxTickets: 10
  },
  {
    id: 'agent_2',
    name: 'Mike Chen',
    email: 'mike@callsheetconverter.com',
    status: 'online',
    specialties: ['technical', 'account'],
    currentTickets: 0,
    maxTickets: 10
  }
];

let knowledgeBase = [
  {
    id: 'kb_1',
    title: 'How to upload a call sheet',
    content: 'To upload a call sheet, go to the Upload page and drag & drop your PDF, DOCX, or image file...',
    category: 'technical',
    tags: ['upload', 'call sheet', 'file'],
    views: 0
  },
  {
    id: 'kb_2',
    title: 'Understanding your billing',
    content: 'Your billing cycle starts when you upgrade to a paid plan...',
    category: 'billing',
    tags: ['billing', 'payment', 'subscription'],
    views: 0
  },
  {
    id: 'kb_3',
    title: 'Exporting contacts',
    content: 'You can export your contacts in multiple formats including CSV, vCard, Excel, and JSON...',
    category: 'technical',
    tags: ['export', 'contacts', 'csv'],
    views: 0
  }
];

// POST /api/support/tickets - Create support ticket
router.post('/tickets', authenticateToken, apiRateLimit, async (req, res) => {
  try {
    const { subject, description, priority, category, userId, userEmail } = req.body;

    if (!subject || !description) {
      return res.status(400).json({
        error: {
          message: 'Subject and description are required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    const ticket = {
      id: `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      subject,
      description,
      priority: priority || 'medium',
      status: 'open',
      category: category || 'technical',
      userId,
      userEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedTo: null,
      messages: []
    };

    supportTickets.push(ticket);

    // Auto-assign to available agent
    const availableAgent = supportAgents.find(agent => 
      agent.status === 'online' && 
      agent.currentTickets < agent.maxTickets &&
      agent.specialties.includes(category)
    );

    if (availableAgent) {
      ticket.assignedTo = availableAgent.id;
      availableAgent.currentTickets++;
    }

    res.status(201).json(ticket);

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create support ticket',
        type: 'server_error',
        status: 500
      }
    });
  }
});

// GET /api/support/tickets - Get user's support tickets
router.get('/tickets', authenticateToken, apiRateLimit, async (req, res) => {
  try {
    const { userId, status, category } = req.query;

    let filteredTickets = supportTickets;

    if (userId) {
      filteredTickets = filteredTickets.filter(ticket => ticket.userId === userId);
    }

    if (status) {
      filteredTickets = filteredTickets.filter(ticket => ticket.status === status);
    }

    if (category) {
      filteredTickets = filteredTickets.filter(ticket => ticket.category === category);
    }

    // Sort by creation date (newest first)
    filteredTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(filteredTickets);

  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch support tickets',
        type: 'server_error',
        status: 500
      }
    });
  }
});

// GET /api/support/tickets/:id - Get specific ticket
router.get('/tickets/:id', authenticateToken, apiRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = supportTickets.find(t => t.id === id);

    if (!ticket) {
      return res.status(404).json({
        error: {
          message: 'Support ticket not found',
          type: 'not_found',
          status: 404
        }
      });
    }

    res.json(ticket);

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch support ticket',
        type: 'server_error',
        status: 500
      }
    });
  }
});

// POST /api/support/tickets/:id/messages - Send message to ticket
router.post('/tickets/:id/messages', authenticateToken, apiRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: {
          message: 'Message content is required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    const ticket = supportTickets.find(t => t.id === id);
    if (!ticket) {
      return res.status(404).json({
        error: {
          message: 'Support ticket not found',
          type: 'not_found',
          status: 404
        }
      });
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ticketId: id,
      content,
      sender: 'user',
      senderName: 'User',
      timestamp: new Date(),
      attachments: []
    };

    supportMessages.push(message);
    ticket.messages.push(message);
    ticket.updatedAt = new Date();

    // Update ticket status if it was closed
    if (ticket.status === 'closed') {
      ticket.status = 'open';
    }

    res.status(201).json(message);

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to send message',
        type: 'server_error',
        status: 500
      }
    });
  }
});

// GET /api/support/kb/articles - Get knowledge base articles
router.get('/kb/articles', apiRateLimit, async (req, res) => {
  try {
    const { category, limit = 10 } = req.query;

    let filteredArticles = knowledgeBase;

    if (category) {
      filteredArticles = filteredArticles.filter(article => article.category === category);
    }

    filteredArticles = filteredArticles.slice(0, parseInt(limit));

    res.json(filteredArticles);

  } catch (error) {
    console.error('Get KB articles error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch knowledge base articles',
        type: 'server_error',
        status: 500
      }
    });
  }
});

// GET /api/support/kb/search - Search knowledge base
router.get('/kb/search', apiRateLimit, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        error: {
          message: 'Search query is required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    const query = q.toLowerCase();
    const results = knowledgeBase.filter(article => 
      article.title.toLowerCase().includes(query) ||
      article.content.toLowerCase().includes(query) ||
      article.tags.some(tag => tag.toLowerCase().includes(query))
    );

    // Sort by relevance (simple scoring)
    results.sort((a, b) => {
      const aScore = (a.title.toLowerCase().includes(query) ? 2 : 0) +
                    (a.content.toLowerCase().includes(query) ? 1 : 0) +
                    (a.tags.some(tag => tag.toLowerCase().includes(query)) ? 1 : 0);
      
      const bScore = (b.title.toLowerCase().includes(query) ? 2 : 0) +
                    (b.content.toLowerCase().includes(query) ? 1 : 0) +
                    (b.tags.some(tag => tag.toLowerCase().includes(query)) ? 1 : 0);

      return bScore - aScore;
    });

    res.json(results);

  } catch (error) {
    console.error('Search KB error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to search knowledge base',
        type: 'server_error',
        status: 500
      }
    });
  }
});

// GET /api/support/agents - Get support agents status
router.get('/agents', async (req, res) => {
  try {
    res.json(supportAgents);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch support agents',
        type: 'server_error',
        status: 500
      }
    });
  }
});

// GET /api/support/status - Get support status (public)
router.get('/status', apiRateLimit, async (req, res) => {
  try {
    const onlineAgents = supportAgents.filter(a => a.status === 'online').length;
    const status = onlineAgents > 0 ? 'online' : 'offline';
    
    res.json({ 
      status,
      onlineAgents,
      message: onlineAgents > 0 
        ? 'Support is available' 
        : 'Support is currently offline'
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get support status',
        type: 'server_error',
        status: 500
      }
    });
  }
});

// GET /api/support/stats - Get support statistics
router.get('/stats', authenticateToken, apiRateLimit, async (req, res) => {
  try {
    const stats = {
      totalTickets: supportTickets.length,
      openTickets: supportTickets.filter(t => t.status === 'open').length,
      inProgressTickets: supportTickets.filter(t => t.status === 'in_progress').length,
      resolvedTickets: supportTickets.filter(t => t.status === 'resolved').length,
      onlineAgents: supportAgents.filter(a => a.status === 'online').length,
      averageResponseTime: '2.5 hours', // This would be calculated from actual data
      customerSatisfaction: '4.8/5' // This would be calculated from ratings
    };

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch support statistics',
        type: 'server_error',
        status: 500
      }
    });
  }
});

module.exports = router;

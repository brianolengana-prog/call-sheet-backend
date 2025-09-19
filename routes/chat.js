const express = require('express');
const router = express.Router();

// Simple AI response generation (you can replace this with OpenAI, Claude, etc.)
const generateAIResponse = async (message, context) => {
  // This is a placeholder - replace with actual AI service
  // For now, we'll use a more sophisticated rule-based system
  
  const input = message.toLowerCase();
  
  // Context-aware responses
  if (context.userPlan) {
    if (input.includes('upgrade') || input.includes('plan')) {
      return {
        response: `I see you're currently on the ${context.userPlan} plan. Would you like to upgrade to get more uploads and features?`,
        type: 'quick_reply',
        quickReplies: ['View Upgrade Options', 'Compare Plans', 'Contact Sales']
      };
    }
  }

  if (context.currentPage) {
    if (input.includes('upload') && context.currentPage === '/upload') {
      return {
        response: 'I can see you\'re on the upload page! Need help with the upload process?',
        type: 'text'
      };
    }
  }

  // Enhanced responses based on message content
  if (input.includes('hello') || input.includes('hi') || input.includes('hey')) {
    return {
      response: 'Hello! 👋 I\'m here to help you with CallSheet Converter. What can I assist you with today?',
      type: 'quick_reply',
      quickReplies: ['How to Upload', 'Pricing Info', 'Export Help', 'Account Support']
    };
  }

  if (input.includes('thank') || input.includes('thanks')) {
    return {
      response: 'You\'re very welcome! 😊 Is there anything else I can help you with?',
      type: 'text'
    };
  }

  if (input.includes('bye') || input.includes('goodbye')) {
    return {
      response: 'Goodbye! 👋 Feel free to reach out anytime if you need help. Have a great day!',
      type: 'text'
    };
  }

  // Default AI-like response
  return {
    response: 'I understand you\'re asking about that. Let me help you find the best solution. Could you provide a bit more detail about what you\'re trying to accomplish?',
    type: 'quick_reply',
    quickReplies: ['Upload Help', 'Pricing Questions', 'Technical Support', 'Account Issues']
  };
};

// POST /api/chat/message
router.post('/message', async (req, res) => {
  try {
    const { message, context, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: {
          message: 'Message is required',
          type: 'validation_error',
          status: 400
        }
      });
    }

    // Generate AI response
    const aiResponse = await generateAIResponse(message, context);

    // Log the conversation for analytics (optional)
    console.log(`Chat session ${sessionId}: ${message} -> ${aiResponse.response}`);

    res.json(aiResponse);

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to process chat message',
        type: 'server_error',
        status: 500
      }
    });
  }
});

// GET /api/chat/suggestions
router.get('/suggestions', (req, res) => {
  try {
    const suggestions = [
      'How do I upload a call sheet?',
      'What are your pricing plans?',
      'How do I export my contacts?',
      'What file formats do you support?',
      'How accurate is the AI extraction?',
      'Can I upgrade my plan?',
      'How do I contact support?',
      'What is the processing time?'
    ];

    res.json({ suggestions });
  } catch (error) {
    console.error('Chat suggestions error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get chat suggestions',
        type: 'server_error',
        status: 500
      }
    });
  }
});

module.exports = router;

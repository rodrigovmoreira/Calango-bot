import express from 'express';
const router = express.Router();
import BusinessConfig from '../models/BusinessConfig.js';
import Message from '../models/Message.js';
import { publicChatLimiter } from '../middleware/rateLimiters.js';

router.post('/send', publicChatLimiter, async (req, res) => {
  try {
    const { businessId, sessionId, message } = req.body;

    // Validate inputs
    if (!businessId || !sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields: businessId, sessionId, message' });
    }

    // Verify BusinessConfig exists
    const businessConfig = await BusinessConfig.findById(businessId);
    if (!businessConfig) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Construct Normalized Message
    const normalizedMsg = {
      from: sessionId,
      name: 'Visitante', // Default name for now, could be passed in body
      body: message,
      type: 'text',
      channel: 'web',
      provider: 'web'
    };

    // Call Handler and Wait for Response
    const { handleIncomingMessage } = await import('../messageHandler.js');
    const response = await handleIncomingMessage(normalizedMsg, businessId);

    // Return the response AND emit to socket
    if (response && response.text) {
        // Emit to all tabs of this visitor
        if (req.io) {
            req.io.to(sessionId).emit('bot_message', { sender: 'bot', text: response.text });
        }
        return res.json({ response: response.text });
    } else if (response && response.error) {
        return res.status(500).json({ error: response.error });
    } else {
        // Fallback if no response text (should not happen with current logic)
        return res.json({ response: "" });
    }

  } catch (error) {
    console.error('Error in Public Chat API:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET History for Visitor
router.get('/history/:visitorId', async (req, res) => {
  try {
    const { visitorId } = req.params;

    // Search messages by sessionId (which equals visitorId)
    // We sort by timestamp ascending for the chat UI
    const messages = await Message.find({ sessionId: visitorId })
      .sort({ timestamp: 1 })
      .select('role content timestamp')
      .lean();

    // Map to frontend format
    const formattedMessages = messages.map(msg => ({
      sender: msg.role === 'user' ? 'user' : 'bot',
      text: msg.content,
      timestamp: msg.timestamp
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET Public Business Info (for the chat header)
router.get('/config/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const businessConfig = await BusinessConfig.findById(businessId).select('businessName operatingHours');
    if (!businessConfig) {
      return res.status(404).json({ error: 'Business not found' });
    }
    res.json(businessConfig);
  } catch (error) {
    console.error('Error fetching business config:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

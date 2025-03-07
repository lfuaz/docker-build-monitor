// routes/logRoutes.js - Log-related routes
const express = require('express');
const { dbAll , dbRun }  = require('../config/database');
const router = express.Router();
const { addClient } = require('../services/sseService');

router.get('/stream', (req, res) => {
  console.log('SSE connection requested from:', req.ip, 'for project:', req.query.project || 'all');
  
  // Add client and send initial message
  addClient(req, res);
  
  // No need to end the response - it will stay open for SSE
});

// Get a specific log
router.get('/:id', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM deployment_logs WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error retrieving log:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
// routes/webhookRoutes.js - Webhook-related routes
const express = require('express');
const { dbAll , dbRun } = require('../config/database');
const { deployProject } = require('../services/dockerService');
const { sendEventToAll } = require('../services/sseService');
const router = express.Router();


// Generate a unique token for webhooks
const generateToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Create a webhook for a project
router.post('/create/:id', async (req, res) => {
  const { description } = req.body;
  
  try {
    const rows = await dbAll('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = rows[0];
    const token = generateToken();
    
    const result = await dbRun(
      'INSERT INTO webhooks (project_id, token, description) VALUES (?, ?, ?)',
      [project.id, token, description]
    );
    
    const webhookUrl = `/webhook/${token}`;
    
    res.json({ 
      id: result.lastID,
      url: webhookUrl,
      token,
      project_id: project.id,
      project_name: project.name
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all webhooks
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT w.*, p.name as project_name 
      FROM webhooks w 
      JOIN projects p ON w.project_id = p.id
      ORDER BY w.created_at DESC
    `);
    
    const webhooks = rows.map(webhook => ({
      ...webhook,
      url: `/webhook/${webhook.token}`
    }));
    
    res.json(webhooks);
  } catch (error) {
    console.error('Error retrieving webhooks:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a webhook
router.delete('/:id', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM webhooks WHERE id = ?', [req.params.id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Trigger deployment via webhook
router.post('/:token', async (req, res) => {
  try {
    // Find webhook by token
    const webhookRows = await dbAll('SELECT * FROM webhooks WHERE token = ?', [req.params.token]);
    
    if (webhookRows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const webhook = webhookRows[0];
    
    // Update last used date
    await dbRun('UPDATE webhooks SET last_used = CURRENT_TIMESTAMP WHERE id = ?', [webhook.id]);
    
    // Get project information
    const projectRows = await dbAll('SELECT * FROM projects WHERE id = ?', [webhook.project_id]);
    
    if (projectRows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projectRows[0];
    
    // Inform client that deployment has started
    res.json({ status: 'deploy_started', project: project.name });
    
    // Record deployment start in logs
    const logResult = await dbRun(
      'INSERT INTO deployment_logs (project_id, action, status, triggered_by) VALUES (?, ?, ?, ?)',
      [project.id, 'deploy', 'started', `webhook:${webhook.id}`]
    );
    const logId = logResult.lastID;
    
    // Execute deployment
    const deployResult = await deployProject(project, logId, `webhook:${webhook.id}`);
    
    // Update log entry with result
    await dbRun(
      'UPDATE deployment_logs SET status = ?, log_content = ? WHERE id = ?',
      [deployResult.status, deployResult.logContent, logId]
    );
    
  } catch (error) {
    console.error('Error during webhook deployment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
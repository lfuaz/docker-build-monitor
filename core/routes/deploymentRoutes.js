// routes/deploymentRoutes.js - Build and deployment routes
const express = require('express');
const pool = require('../config/database');
const { buildProject, deployProject } = require('../services/dockerService');
const { sendEventToAll } = require('../services/sseService');
const router = express.Router();

// Build a project
router.post('/build/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = rows[0];
    
    // Inform client that build has started
    res.json({ status: 'build_started', project: project.name });
    
    // Record build start in logs
    const [logResult] = await pool.query(
      'INSERT INTO deployment_logs (project_id, action, status, triggered_by) VALUES (?, ?, ?, ?)',
      [project.id, 'build', 'started', 'user']
    );
    const logId = logResult.insertId;
    
    // Start the build process
    sendEventToAll('build_log', { 
      project: project.name, 
      output: `🔄 Starting build for ${project.name}...\n`,
      timestamp: Date.now()
    });
    
    // For debugging: Send test log after 1 second
    setTimeout(() => {
      sendEventToAll('build_log', { 
        project: project.name, 
        output: `🔍 Test log: Checking SSE transmission at ${new Date().toISOString()}\n`,
        timestamp: Date.now()
      });
    }, 1000);
    
    // Execute the build
    const buildResult = await buildProject(project, logId);
    
    // Update log entry with result
    await pool.query(
      'UPDATE deployment_logs SET status = ?, log_content = ? WHERE id = ?',
      [buildResult.status, buildResult.logContent, logId]
    );
    
  } catch (error) {
    console.error('Error during build:', error);
    // Client has already received the "build_started" response
    sendEventToAll('build_error', { 
      project: project?.name || 'unknown', 
      message: error.message,
      timestamp: Date.now()
    });
  }
});

// Deploy a project
router.post('/deploy/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = rows[0];
    
    // Inform client that deployment has started
    res.json({ status: 'deploy_started', project: project.name });
    
    // Record deployment start in logs
    const [logResult] = await pool.query(
      'INSERT INTO deployment_logs (project_id, action, status, triggered_by) VALUES (?, ?, ?, ?)',
      [project.id, 'deploy', 'started', 'user']
    );
    const logId = logResult.insertId;
    
    // Execute deployment
    const deployResult = await deployProject(project, logId);
    
    // Update log entry with result
    await pool.query(
      'UPDATE deployment_logs SET status = ?, log_content = ? WHERE id = ?',
      [deployResult.status, deployResult.logContent, logId]
    );
    
  } catch (error) {
    console.error('Error during deployment:', error);
    // Client has already received the "deploy_started" response
    sendEventToAll('deploy_error', { 
      project: project?.name || 'unknown', 
      message: error.message,
      timestamp: Date.now()
    });
  }
});

module.exports = router;
// routes/projectRoutes.js - Project-related routes
const express = require('express');
const { dbAll , dbRun }  = require('../config/database');
const { getProjectContainers } = require('../services/dockerService');
const router = express.Router();



// List all projects
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM projects ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Error retrieving projects:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Detect Docker projects on host
router.get('/detect', async (req, res) => {
  try {
    // Get projects from containers
    const detectedProjects = await getProjectContainers();
    
    // Check which projects already exist in database
    const existingProjects = await dbAll('SELECT name, path FROM projects');
    const existingProjectsMap = {};
    
    for (const project of existingProjects) {
      existingProjectsMap[project.name] = project.path;
    }
    
    // Mark projects as existing or new
    for (const project of detectedProjects) {
      project.exists = existingProjectsMap[project.name] === project.path;
    }
    
    res.json({ projects: detectedProjects });
  } catch (error) {
    console.error('Error detecting Docker projects:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Import projects to database
router.post('/import', async (req, res) => {
  const { projects } = req.body;
  
  if (!projects || !Array.isArray(projects)) {
    return res.status(400).json({ error: 'Project list required' });
  }
  
  try {
    // Get all containers for fresh data
    const containers = await getProjectContainers();
    const projectsMap = {};
    
    for (const project of containers) {
      projectsMap[project.name] = {
        name: project.name,
        path: project.path
      };
    }
    
    // Import only specified projects
    const importResults = [];
    const existingProjects = [];
    
    for (const projectName of projects) {
      const { name } = projectName;
      
      if (projectsMap[name]) {
        const project = projectsMap[name];
        
        // Check if project already exists
        const existingCheck = await dbAll(
          'SELECT id FROM projects WHERE name = ? OR path = ?',
          [project.name, project.path]
        );
        
        if (existingCheck.length > 0) {
          existingProjects.push(project.name);
          continue;
        }
        
        // Insert new project
        const result = await dbRun(
          'INSERT INTO projects (name, path, description) VALUES (?, ?, ?)',
          [project.name, project.path, `Project automatically imported from Docker`]
        );
        
        importResults.push({
          id: result.lastID,
          name: project.name,
          path: project.path,
          imported: true
        });
      }
    }
    
    res.json({
      imported: importResults,
      alreadyExists: existingProjects,
      total: importResults.length
    });
  } catch (error) {
    console.error('Error importing projects:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a specific project
router.get('/:id', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error retrieving project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a project
router.post('/', async (req, res) => {
  const { name, path, description, repository_url } = req.body;
  
  if (!name || !path) {
    return res.status(400).json({ error: 'Project name and path required' });
  }
  
  try {
    const result = await dbRun(
      'INSERT INTO projects (name, path, description, repository_url) VALUES (?, ?, ?, ?)',
      [name, path, description, repository_url]
    );
    
    res.status(201).json({
      id: result.lastID,
      name,
      path,
      description,
      repository_url
    });
  } catch (error) {
    console.error('Error creating project:', error);
    
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'A project with this name already exists' });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a project
router.put('/:id', async (req, res) => {
  const { name, path, description, repository_url } = req.body;
  const { id } = req.params;
  
  if (!name || !path) {
    return res.status(400).json({ error: 'Project name and path required' });
  }
  
  try {
    const result = await dbRun(
      'UPDATE projects SET name = ?, path = ?, description = ?, repository_url = ? WHERE id = ?',
      [name, path, description, repository_url, id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({
      id,
      name,
      path,
      description,
      repository_url
    });
  } catch (error) {
    console.error('Error updating project:', error);
    
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'A project with this name already exists' });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a project
router.delete('/:id', async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM projects WHERE id = ?', [req.params.id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get project logs
router.get('/:id/logs', async (req, res) => {
  try {
    const rows = await dbAll(
      'SELECT * FROM deployment_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error retrieving logs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get project webhooks
router.get('/:id/webhooks', async (req, res) => {
  try {
    const rows = await dbAll(
      'SELECT * FROM webhooks WHERE project_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    
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

module.exports = router;
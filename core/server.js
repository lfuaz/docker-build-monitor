// api/app.js
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const Docker = require('dockerode');
const SSE = require('express-sse');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'docker_monitor',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Création du pool de connexions MySQL
const pool = mysql.createPool(dbConfig);

// Initialisation de l'instance SSE pour les logs
const buildLogs = new SSE(['Initial connection established']); // Initialize with a welcome message

// Connexion à l'API Docker
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Génération d'un token unique pour les webhooks
const generateToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Ensure CORS is properly configured with specific options for SSE support
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());


app.use(express.static('dist'));

// Create a simpler SSE implementation that doesn't rely on the express-sse library
// and doesn't debounce messages
const clients = new Map();
let clientIdCounter = 0;

function addClient(req, res) {
  const clientId = clientIdCounter++;
  const projectName = req.query.project || null;
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Send initial connection message
  sendEventToClient(res, 'connection', { message: 'SSE connection established' });
  
  // Store client with its project subscription
  clients.set(clientId, { res, projectName });
  console.log(`Client ${clientId} connected${projectName ? ` for project ${projectName}` : ' (all projects)'}. Total clients: ${clients.size}`);
  
  // Set up keep-alive interval
  const keepAliveInterval = setInterval(() => {
    sendEventToClient(res, 'ping', { timestamp: Date.now() });
  }, 15000);
  
  // Handle client disconnection
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected. Total clients: ${clients.size}`);
  });
  
  return clientId;
}

function sendEventToClient(client, eventType, data) {
  client.write(`event: ${eventType}\n`);
  client.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendEventToAll(eventType, data) {
  const projectName = data.project;
  
  // Removed debounce logic - all messages will be sent now
  
  // Count how many clients will receive this message
  let sentCount = 0;
  
  clients.forEach((client, clientId) => {
    // Send to clients subscribed to all projects or to this specific project
    if (!client.projectName || client.projectName === projectName) {
      sendEventToClient(client.res, eventType, data);
      sentCount++;
    }
  });
  
  console.log(`Event ${eventType} sent to ${sentCount}/${clients.size} clients for project ${projectName || 'unknown'}`);
}

// Replace SSE initialization - define this route before all others
app.get('/logs/stream', (req, res) => {
  console.log('SSE connection requested from:', req.ip, 'for project:', req.query.project || 'all');
  
  // Add client and send initial message
  addClient(req, res);
  
  // No need to end the response - it will stay open for SSE
});

// Route pour lister les projets depuis la BDD
app.get('/projects', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM projects ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des projets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// Route pour détecter les projets Docker sur l'hôte
app.get('/projects/detect', async (req, res) => {
    try {
      // Récupérer tous les containers
      const containers = await docker.listContainers({ all: true });
      
      // Extraire les informations de projet des containers
      const projectsMap = {};
      
      for (const container of containers) {
        const labels = container.Labels || {};
        const projectPath = labels['com.docker.compose.project.working_dir'];
        const projectName = labels['com.docker.compose.project'];
        
        // Si le container a les labels nécessaires
        if (projectPath && projectName) {
          if (!projectsMap[projectName]) {
            projectsMap[projectName] = {
              name: projectName,
              path: projectPath,
              containers: []
            };
          }
          
          // Ajouter le container au projet
          projectsMap[projectName].containers.push({
            id: container.Id,
            name: container.Names[0].replace(/^\//, ''),
            image: container.Image,
            state: container.State,
            status: container.Status
          });
        }
      }
      
      // Convertir la map en tableau de projets
      const detectedProjects = Object.values(projectsMap);
      
      // Vérifier quels projets sont déjà dans la base de données
      const [existingProjects] = await pool.query('SELECT name, path FROM projects');
      const existingProjectsMap = {};
      
      for (const project of existingProjects) {
        existingProjectsMap[project.name] = project.path;
      }
      
      // Marquer les projets comme existants ou nouveaux
      for (const project of detectedProjects) {
        project.exists = existingProjectsMap[project.name] === project.path;
      }
      
      res.json({ projects: detectedProjects });
    } catch (error) {
      console.error('Erreur lors de la détection des projets Docker:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  
  // Route pour importer des projets détectés dans la base de données
app.post('/projects/import', async (req, res) => {
    const { projects } = req.body;
    
    
    if (!projects || !Array.isArray(projects)) {
      return res.status(400).json({ error: 'Liste des projets requise' });
    }
    
    try {
      // Récupérer à nouveau les containers pour extraire les informations à jour
      const containers = await docker.listContainers({ all: true });
      const projectsMap = {};
      
      for (const container of containers) {
        const labels = container.Labels || {};
        const projectPath = labels['com.docker.compose.project.working_dir'];
        const projectName = labels['com.docker.compose.project'];
        
        if (projectPath && projectName) {
          projectsMap[projectName] = {
            name: projectName,
            path: projectPath
          };
        }
      }
      
      // Importer uniquement les projets spécifiés
      const importResults = [];
      const existingProjects = [];
      
      for (const projectName of projects) {

        const { name } = projectName;
        
        if (projectsMap[name]) {
          const project = projectsMap[name];
          
          // Vérifier si le projet existe déjà
          const [existingCheck] = await pool.query(
            'SELECT id FROM projects WHERE name = ? OR path = ?',
            [project.name, project.path]
          );
          
          if (existingCheck.length > 0) {
            existingProjects.push(project.name);
            continue;
          }
          
          // Insérer le nouveau projet
          const [result] = await pool.query(
            'INSERT INTO projects (name, path, description) VALUES (?, ?, ?)',
            [project.name, project.path, `Projet importé automatiquement depuis Docker`]
          );
          
          importResults.push({
            id: result.insertId,
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
      console.error('Erreur lors de l\'importation des projets:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
});


// Route pour obtenir un projet spécifique
app.get('/projects/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération du projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour créer un projet
app.post('/projects', async (req, res) => {
  const { name, path, description, repository_url } = req.body;
  
  if (!name || !path) {
    return res.status(400).json({ error: 'Nom et chemin du projet requis' });
  }
  
  try {
    const [result] = await pool.query(
      'INSERT INTO projects (name, path, description, repository_url) VALUES (?, ?, ?, ?)',
      [name, path, description, repository_url]
    );
    
    res.status(201).json({
      id: result.insertId,
      name,
      path,
      description,
      repository_url
    });
  } catch (error) {
    console.error('Erreur lors de la création du projet:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Un projet avec ce nom existe déjà' });
    }
    
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour mettre à jour un projet
app.put('/projects/:id', async (req, res) => {
  const { name, path, description, repository_url } = req.body;
  const { id } = req.params;
  
  if (!name || !path) {
    return res.status(400).json({ error: 'Nom et chemin du projet requis' });
  }
  
  try {
    const [result] = await pool.query(
      'UPDATE projects SET name = ?, path = ?, description = ?, repository_url = ? WHERE id = ?',
      [name, path, description, repository_url, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    res.json({
      id,
      name,
      path,
      description,
      repository_url
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du projet:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Un projet avec ce nom existe déjà' });
    }
    
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour supprimer un projet
app.delete('/projects/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    res.json({ message: 'Projet supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour déclencher un build
app.post('/build/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    const project = rows[0];
    
    // On informe le client que le build a commencé
    res.json({ status: 'build_started', project: project.name });
    
    // Enregistrer le début du build dans les logs
    const [logResult] = await pool.query(
      'INSERT INTO deployment_logs (project_id, action, status, triggered_by) VALUES (?, ?, ?, ?)',
      [project.id, 'build', 'started', 'user']
    );
    const logId = logResult.insertId;
    
    // On transmet l'information via SSE - use new function
    sendEventToAll('build_log', { 
      project: project.name, 
      output: `🔄 Démarrage du build pour ${project.name}...\n`,
      timestamp: Date.now() // Add timestamp to help client identify order
    });
    
    // Debugging: Send a test log after 1 second to verify SSE works
    setTimeout(() => {
      sendEventToAll('build_log', { 
        project: project.name, 
        output: `🔍 Test log: Vérification de la transmission SSE à ${new Date().toISOString()}\n`,
        timestamp: Date.now()
      });
    }, 1000);
    
    // On exécute la commande de build
    const buildProcess = exec(`cd ${project.path} && docker compose build --no-cache`, 
      { maxBuffer: 10 * 1024 * 1024 }, // Increased buffer size to 10MB
      async (error, stdout, stderr) => {
        let status = 'success';
        let logContent = stdout;
        
        if (error) {
          status = 'error';
          logContent += '\n' + stderr + '\n' + error.message;
          sendEventToAll('build_error', { 
            project: project.name, 
            message: error.message,
            timestamp: Date.now()
          });
        } else {
          sendEventToAll('build_completed', { 
            project: project.name, 
            status: 'completed',
            timestamp: Date.now()
          });
        }
        
        // Mettre à jour l'entrée de log avec le contenu complet
        await pool.query(
          'UPDATE deployment_logs SET status = ?, log_content = ? WHERE id = ?',
          [status, logContent, logId]
        );
      }
    );
    
    // Ensure we're capturing stdout in smaller chunks to avoid buffer issues
    buildProcess.stdout.setEncoding('utf8');
    buildProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Build stdout for ${project.name}: ${output.substring(0, 100)}...`);
      
      // Send output in chunks to avoid overwhelming the SSE connection
      const chunks = output.match(/.{1,500}/gs) || [output];
      chunks.forEach(chunk => {
        sendEventToAll('build_log', { 
          project: project.name, 
          output: chunk,
          timestamp: Date.now()
        });
      });
    });
    
    buildProcess.stderr.setEncoding('utf8');
    buildProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log(`Build stderr: ${output.substring(0, 100)}...`); // Log first 100 chars for debugging
      
      // Send output in chunks to avoid overwhelming the SSE connection
      const chunks = output.match(/.{1,500}/gs) || [output];
      chunks.forEach(chunk => {
        sendEventToAll('build_log', { 
          project: project.name, 
          output: chunk,
          timestamp: Date.now()
        });
      });
    });
  } catch (error) {
    console.error('Erreur lors du build:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour déployer un projet
app.post('/deploy/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    const project = rows[0];
    
    // On informe le client que le déploiement a commencé
    res.json({ status: 'deploy_started', project: project.name });
    
    // Enregistrer le début du déploiement dans les logs
    const [logResult] = await pool.query(
      'INSERT INTO deployment_logs (project_id, action, status, triggered_by) VALUES (?, ?, ?, ?)',
      [project.id, 'deploy', 'started', 'user']
    );
    const logId = logResult.insertId;
    
    // On transmet l'information via SSE - use new function
    sendEventToAll('deploy_log', { 
      project: project.name, 
      output: `🔄 Démarrage du déploiement pour ${project.name}...\n`,
      timestamp: Date.now()
    });
    
    // On exécute la commande de déploiement
    const deployProcess = exec(`cd ${project.path} && docker compose up -d --build`, 
      { maxBuffer: 5 * 1024 * 1024 }, // Increase buffer size to 5MB
      async (error, stdout, stderr) => {
        let status = 'success';
        let logContent = stdout;
        
        if (error) {
          status = 'error';
          logContent += '\n' + stderr + '\n' + error.message;
          sendEventToAll('deploy_error', { 
            project: project.name, 
            message: error.message,
            timestamp: Date.now()
          });
        } else {
          sendEventToAll('deploy_completed', { 
            project: project.name, 
            status: 'completed',
            timestamp: Date.now()
          });
        }
        
        // Mettre à jour l'entrée de log avec le contenu complet
        await pool.query(
          'UPDATE deployment_logs SET status = ?, log_content = ? WHERE id = ?',
          [status, logContent, logId]
        );
      }
    );
    
    // On capture et transmet les logs en temps réel
    deployProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Deploy stdout for ${project.name}: ${output.substring(0, 100)}...`);
      
      // Use the new sendEventToAll function
      sendEventToAll('deploy_log', { 
        project: project.name, 
        output,
        timestamp: Date.now()
      });
    });
    
    deployProcess.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Use the new sendEventToAll function
      sendEventToAll('deploy_log', { 
        project: project.name, 
        output,
        timestamp: Date.now()
      });
    });
    
  } catch (error) {
    console.error('Erreur lors du déploiement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour obtenir les logs d'un déploiement spécifique
app.get('/logs/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM deployment_logs WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Log non trouvé' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération des logs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour lister les logs d'un projet
app.get('/projects/:id/logs', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM deployment_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des logs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Création d'un webhook pour un projet
app.post('/webhook/create/:id', async (req, res) => {
  const { description } = req.body;
  
  try {
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    const project = rows[0];
    const token = generateToken();
    
    const [result] = await pool.query(
      'INSERT INTO webhooks (project_id, token, description) VALUES (?, ?, ?)',
      [project.id, token, description]
    );
    
    const webhookUrl = `${process.env.BACKEND_URL}/webhook/${token}`;
    
    res.json({ 
      id: result.insertId,
      url: webhookUrl,
      token,
      project_id: project.id,
      project_name: project.name
    });
  } catch (error) {
    console.error('Erreur lors de la création du webhook:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des webhooks
app.get('/webhooks', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT w.*, p.name as project_name 
      FROM webhooks w 
      JOIN projects p ON w.project_id = p.id
      ORDER BY w.created_at DESC
    `);
    
    const webhooks = rows.map(webhook => ({
      ...webhook,
      url: `${process.env.BACKEND_URL}/webhook/${webhook.token}`
    }));
    
    res.json(webhooks);
  } catch (error) {
    console.error('Erreur lors de la récupération des webhooks:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des webhooks d'un projet
app.get('/projects/:id/webhooks', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM webhooks WHERE project_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    
    const webhooks = rows.map(webhook => ({
      ...webhook,
      url: `${process.env.BACKEND_URL}/webhook/${webhook.token}`
    }));
    
    res.json(webhooks);
  } catch (error) {
    console.error('Erreur lors de la récupération des webhooks:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Suppression d'un webhook
app.delete('/webhook/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM webhooks WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Webhook non trouvé' });
    }
    
    res.json({ message: 'Webhook supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du webhook:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint webhook pour le déploiement
app.post('/webhook/:token', async (req, res) => {
  try {
    // Rechercher le webhook par son token
    const [webhookRows] = await pool.query('SELECT * FROM webhooks WHERE token = ?', [req.params.token]);
    
    if (webhookRows.length === 0) {
      return res.status(404).json({ error: 'Webhook non trouvé' });
    }
    
    const webhook = webhookRows[0];
    
    // Mettre à jour la date de dernière utilisation
    await pool.query('UPDATE webhooks SET last_used = CURRENT_TIMESTAMP WHERE id = ?', [webhook.id]);
    
    // Récupérer les informations du projet
    const [projectRows] = await pool.query('SELECT * FROM projects WHERE id = ?', [webhook.project_id]);
    
    if (projectRows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    const project = projectRows[0];
    
    // On informe le client que le déploiement a commencé
    res.json({ status: 'deploy_started', project: project.name });
    
    // Enregistrer le début du déploiement dans les logs
    const [logResult] = await pool.query(
      'INSERT INTO deployment_logs (project_id, action, status, triggered_by) VALUES (?, ?, ?, ?)',
      [project.id, 'deploy', 'started', `webhook:${webhook.id}`]
    );
    const logId = logResult.insertId;
    
    // Use sendEventToAll
    sendEventToAll('deploy_log', { 
      project: project.name, 
      output: `🔄 Déploiement via webhook déclenché à ${new Date().toISOString()}\n`,
      timestamp: Date.now()
    });
    
    // On exécute la commande de déploiement
    const deployProcess = exec(`cd ${project.path} && docker compose up -d`, 
      async (error, stdout, stderr) => {
        let status = 'success';
        let logContent = stdout;
        
        if (error) {
          status = 'error';
          logContent += '\n' + stderr + '\n' + error.message;
          sendEventToAll('deploy_error', { 
            project: project.name, 
            message: error.message,
            timestamp: Date.now()
          });
        } else {
          sendEventToAll('deploy_completed', { 
            project: project.name, 
            status: 'completed',
            timestamp: Date.now()
          });
        }
        
        // Mettre à jour l'entrée de log avec le contenu complet
        await pool.query(
          'UPDATE deployment_logs SET status = ?, log_content = ? WHERE id = ?',
          [status, logContent, logId]
        );
      }
    );
    
    // On capture et transmet les logs en temps réel
    deployProcess.stdout.on('data', (data) => {
      sendEventToAll('deploy_log', { 
        project: project.name, 
        output: data.toString(),
        timestamp: Date.now()
      });
    });
    
    deployProcess.stderr.on('data', (data) => {
      sendEventToAll('deploy_log', { 
        project: project.name, 
        output: data.toString(),
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Erreur lors du déploiement via webhook:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Add a simple health check endpoint for testing connectivity
app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: clients.size, message: 'Server is running' });
});

// Add this at the end of the file to handle 404s
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).send('Not Found');
});




app.listen(port, () => {
  console.log(`API Docker Build Monitor en écoute sur le port ${port}`);
});

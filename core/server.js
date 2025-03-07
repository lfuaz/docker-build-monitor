// app.js - Main application entry point
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { clients } = require('./services/sseService');
const { initialize: initDb, db } = require('./config/database');

// Import routes
const projectRoutes = require('./routes/projectRoutes');
const deploymentRoutes = require('./routes/deploymentRoutes');
const logRoutes = require('./routes/logRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS with specific options for SSE support
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.static('dist'));

// Routes
app.use('/projects', projectRoutes);
app.use('/logs', logRoutes);
app.use('/webhook', webhookRoutes);
app.use('/', deploymentRoutes); // For build/:id and deploy/:id routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: clients.size, message: 'Server is running' });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).send('Not Found');
});


// Initialize database and start the server
async function startServer() {
  try {
    // Initialize the database
    await initDb();
    console.log('Database initialized successfully');
    
    // Start the server
    app.listen(port, "0.0.0.0", () => {
      console.log(`Docker Build Monitor API listening on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
// services/sseService.js - Server-Sent Events handling
const clients = new Map();
let clientIdCounter = 0;

/**
 * Add a new SSE client
 */
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

/**
 * Send an event to a specific client
 */
function sendEventToClient(client, eventType, data) {
  client.write(`event: ${eventType}\n`);
  client.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Send an event to all subscribed clients
 */
function sendEventToAll(eventType, data) {
  const projectName = data.project;
  
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

module.exports = {
  clients,
  addClient,
  sendEventToClient,
  sendEventToAll
};
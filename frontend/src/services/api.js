const API_BASE_URL = 'http://127.0.0.1:8048';

// Simple fetch with error handling
const fetchWithErrorHandling = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    throw error;
  }
};

// API endpoints (no caching/deduping here - that will be handled by React Query)
export const fetchProjects = () => {
  return fetchWithErrorHandling(`${API_BASE_URL}/projects`);
};

export const fetchProject = (id) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/projects/${id}`);
};

export const createProject = (projectData) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  });
};

export const updateProject = (id, projectData) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  });
};

export const deleteProject = (id) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
  });
};

export const buildProject = async (projectId) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/build/${projectId}`, {
    method: 'POST',
  });
};

export const deployProject = async (projectId) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/deploy/${projectId}`, {
    method: 'POST',
  });
};

export const fetchProjectLogs = async (projectId) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/projects/${projectId}/logs`);
};

export const createWebhook = async (projectId, description = '') => {
  return fetchWithErrorHandling(`${API_BASE_URL}/webhook/create/${projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
};

export const fetchWebhooks = () => {
  return fetchWithErrorHandling(`${API_BASE_URL}/webhooks`);
};

export const fetchProjectWebhooks = async (projectId) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/projects/${projectId}/webhooks`);
};

export const deleteWebhook = async (id) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/webhook/${id}`, {
    method: 'DELETE',
  });
};

// New endpoints for detected projects
export const detectProjects = () => {
  return fetchWithErrorHandling(`${API_BASE_URL}/projects/detect`);
};

export const importDetectedProject = (projects) => {
  return fetchWithErrorHandling(`${API_BASE_URL}/projects/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects }),
  });
};

// Maintain the EventSource connection management
export const subscribeToLogs = (sseUrl, onMessage, onError) => {
  // Keep track of the EventSource instance globally to avoid duplicates
  if (!window._eventSourceInstances) {
    window._eventSourceInstances = {};
  }
  
  const instanceId = sseUrl;
  
  // Close any existing connection with the same URL
  if (window._eventSourceInstances[instanceId]) {
    window._eventSourceInstances[instanceId].close();
    delete window._eventSourceInstances[instanceId];
  }
  
  try {
    if (!window.EventSource) {
      const error = new Error('EventSource is not supported in this browser');
      if (onError) onError(error);
      return { close: () => {} };
    }
    
    const eventSource = new EventSource(sseUrl);
    window._eventSourceInstances[instanceId] = eventSource;
    
    eventSource.onopen = () => {
      if (onMessage) {
        onMessage({
          message: 'Connection established successfully'
        }, 'connection_success');
      }
    };
    
    const processedMessageIds = new Set();
    
    const handleEvent = (event, eventType) => {
      try {
        if (!event || !event.data) return;
        
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (parseError) {
          console.warn("Error parsing SSE event data:", parseError);
          data = { output: event.data };
        }
        
        // Create a unique ID for the message to prevent duplicates
        const messageId = `${eventType}:${data.timestamp || Date.now()}:${(data.output?.substring(0, 20) || '')}`;
        
        if (processedMessageIds.has(messageId)) return;
        
        processedMessageIds.add(messageId);
        setTimeout(() => processedMessageIds.delete(messageId), 5000);
        
        if (eventType === 'build_log' || eventType === 'deploy_log') {
          if (data.output && typeof data.output === 'string' && !data.output.endsWith('\n')) {
            data.output = data.output + '\n';
          }
        }
        
        if (onMessage) onMessage(data, eventType);
      } catch (error) {
        console.error("Error handling SSE event:", error, event);
        if (onMessage) onMessage({ 
          output: `Error handling event data: ${event.data}`,
          error: error.message
        }, eventType);
      }
    };
    
    eventSource.addEventListener('build_log', event => handleEvent(event, 'build_log'));
    eventSource.addEventListener('deploy_log', event => handleEvent(event, 'deploy_log'));
    eventSource.addEventListener('build_completed', event => handleEvent(event, 'build_completed'));
    eventSource.addEventListener('build_error', event => handleEvent(event, 'build_error'));
    eventSource.addEventListener('deploy_completed', event => handleEvent(event, 'deploy_completed'));
    eventSource.addEventListener('deploy_error', event => handleEvent(event, 'deploy_error'));
    eventSource.addEventListener('connection', event => handleEvent(event, 'connection'));
    eventSource.addEventListener('ping', () => {});
    
    eventSource.onmessage = (event) => handleEvent(event, 'message');
    
    eventSource.onerror = (error) => {
      if (eventSource.readyState === EventSource.CONNECTING) {
        if (onError) onError(new Error('Connection lost, reconnecting...'));
      } else if (eventSource.readyState === EventSource.CLOSED) {
        if (onError) onError(new Error('Connection closed'));
        
        if (window._eventSourceInstances && window._eventSourceInstances[instanceId]) {
          delete window._eventSourceInstances[instanceId];
        }
      }
    };
    
    return {
      close: () => {
        eventSource.close();
        if (window._eventSourceInstances && window._eventSourceInstances[instanceId]) {
          delete window._eventSourceInstances[instanceId];
        }
      }
    };
  } catch (error) {
    if (onError) onError(error);
    return { close: () => {} };
  }
};

export const testServerConnectivity = async () => {
  return fetchWithErrorHandling(`${API_BASE_URL}/health`);
};
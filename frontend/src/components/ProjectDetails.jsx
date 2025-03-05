import React, { useState, useEffect, useRef } from 'react';
import { 
  buildProject, 
  deployProject, 
  createWebhook, 
  deleteWebhook, 
  deleteProject,
  fetchProjectLogs,
  fetchProjectWebhooks,
  subscribeToLogs
} from '../services/api';
import WebhookList from './WebhookList';
import LogsList from './LogsList';
import LogLine from './LogLine';

const ProjectDetails = ({ project, onEdit, onWebhookCreated, onProjectUpdated }) => {
  const [isBuilding, setIsBuilding] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [logs, setLogs] = useState({});
  const [currentLogs, setCurrentLogs] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [deploymentLogs, setDeploymentLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('control');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectData, setProjectData] = useState(project);
  const logsEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Better way to update when project changes
  useEffect(() => {
    if (project) {
      setProjectData(project);
      // When project data changes, also reload related data
      loadProjectWebhooks();
      loadProjectLogs();
    }
  }, [project]);

  // Load project webhooks
  const loadProjectWebhooks = () => {
    fetchProjectWebhooks(projectData.id)
      .then(data => {
        setWebhooks(data);
      })
      .catch(error => {
        console.error('Erreur lors du chargement des webhooks:', error);
      });
  };
  
  // Load project logs
  const loadProjectLogs = () => {
    fetchProjectLogs(projectData.id)
      .then(data => {
        setDeploymentLogs(data);
      })
      .catch(error => {
        console.error('Erreur lors du chargement des logs:', error);
      });
  };

  // Configurer la connexion SSE pour les logs avec meilleure gestion d'erreurs et déduplication
  useEffect(() => {
    if (projectData) {
      // Nettoyer l'éventuelle connexion précédente
      if (eventSourceRef.current) {
        console.log('Closing previous SSE connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      
      // For message deduplication
      const processedMessages = new Set();
      const messageLifetime = 10000; // ms - how long to remember a message
      
      // Verify server connectivity before establishing SSE connection
      const API_BASE_URL = import.meta.env.VITE_SERVER_ENDPOINT || 'http://localhost:3000';
      
      // First, test basic connectivity with a simple fetch
      fetch(`${API_BASE_URL}/health`)
        .then(response => response.json())
        .then(data => {
          setupSSEConnection();
        })
        .catch(error => {
          console.error('Server is unreachable:', error);
          setCurrentLogs(prevLogs => [
            ...prevLogs, 
            `⚠️ Le serveur n'est pas accessible. Vérifiez que le serveur est en cours d'exécution sur ${API_BASE_URL}\n`
          ]);
        });
      
      function setupSSEConnection() {
        try {
          // Clear any existing reconnection timers
          if (window.sseReconnectTimer) {
            clearTimeout(window.sseReconnectTimer);
          }
          
          let reconnectAttempts = 0;
          const MAX_RECONNECT_ATTEMPTS = 5;
          
          // Create the SSE connection - specify project name to filter events
          const sseUrl = `${API_BASE_URL}/logs/stream?project=${encodeURIComponent(projectData.name)}`;
          
          // Helper function to check if a message is a duplicate
          const isDuplicate = (eventType, data) => {
            const timestamp = data.timestamp || Date.now();
            const messageId = `${eventType}:${JSON.stringify(data)}`;
            
            if (processedMessages.has(messageId)) {
              console.log('Skipping duplicate message:', eventType, data);
              return true;
            }
            
            // Add to processed messages
            processedMessages.add(messageId);
            
            // Clean up old messages to prevent memory leaks
            setTimeout(() => {
              processedMessages.delete(messageId);
            }, messageLifetime);
            
            return false;
          };
          
          // Format log timestamp if available
          const formatTimestamp = (timestamp) => {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return `[${date.toLocaleTimeString()}] `;
          };
          
          // Format log output for display
          const formatLogOutput = (data) => {

            
            // Check if we have data.output
            if (!data) return '';
            
            if (typeof data === 'string') {
              return data;
            }
            
            if (typeof data.output === 'string') {
              return data.output;
            }
            
            // If all else fails, try to stringify the data
            try {
              return JSON.stringify(data);
            } catch (e) {
              return 'Unformattable log data';
            }
          };
          
          // Create the SSE connection
          eventSourceRef.current = subscribeToLogs(
            sseUrl,
            (data, eventType) => {              
              // Skip duplicate messages
              if (isDuplicate(eventType, data)) return;
              
              // On successful message, reset reconnect attempts
              if (eventType !== 'error') {
                reconnectAttempts = 0;
              }
              
              // Ne traiter que les événements qui concernent notre projet
              if (!data.project || data.project === projectData.name) {
                if (eventType === 'build_log' || eventType === 'deploy_log') {
                  // Extract the actual log output
                  const logOutput = formatLogOutput(data);
                  
                  if (logOutput) {
                    // Add formatted log to the current logs
                    setCurrentLogs(prevLogs => [...prevLogs, logOutput]);
                  }
                } else if (eventType === 'build_completed') {
                  setIsBuilding(false);
                  setCurrentLogs(prevLogs => [...prevLogs, '✅ Build terminé avec succès\n']);
                  // Refresh logs after build completes
                  loadProjectLogs();
                  // Notify parent component that project data may have changed
                  if (onProjectUpdated) onProjectUpdated(projectData.id);
                } else if (eventType === 'build_error') {
                  setIsBuilding(false);
                  setCurrentLogs(prevLogs => [...prevLogs, `❌ Erreur: ${data.message || 'Erreur inconnue'}\n`]);
                } else if (eventType === 'deploy_completed') {
                  setIsDeploying(false);
                  setCurrentLogs(prevLogs => [...prevLogs, '✅ Déploiement terminé avec succès\n']);
                  // Refresh logs after deployment completes
                  loadProjectLogs();
                  // Notify parent component that project data may have changed
                  if (onProjectUpdated) onProjectUpdated(projectData.id);
                } else if (eventType === 'deploy_error') {
                  setIsDeploying(false);
                  setCurrentLogs(prevLogs => [...prevLogs, `❌ Erreur: ${data.message || 'Erreur inconnue'}\n`]);
                } else if (eventType === 'connection' || eventType === 'connection_success') {
                  // Only add the connection message once
                  if (!processedMessages.has('connection')) {
                    processedMessages.add('connection');
                    setCurrentLogs(prevLogs => [...prevLogs, '🔌 Connexion SSE établie...\n']);
                    
                    // Clean up after a while
                    setTimeout(() => {
                      processedMessages.delete('connection');
                    }, 60000); // 1 minute
                  }
                } else if (eventType === 'reconnecting') {
                  setCurrentLogs(prevLogs => [...prevLogs, '🔄 Tentative de reconnexion...\n']);
                }
              }
            },
            (error) => {
              console.error('Erreur SSE:', error);
              
              // Avoid duplicate error messages
              if (!processedMessages.has('connection-error')) {
                processedMessages.add('connection-error');
                
                // Inform the user
                setCurrentLogs(prevLogs => [
                  ...prevLogs, 
                  `⚠️ Erreur de connexion SSE: ${error.message || 'Erreur inconnue'}\n`
                ]);
                
                // Clean up after a while
                setTimeout(() => {
                  processedMessages.delete('connection-error');
                }, 30000); // 30 seconds
              }
              
              // Attempt to reconnect with backoff
              reconnectAttempts++;
              if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                
                setCurrentLogs(prevLogs => [
                  ...prevLogs, 
                  `🔄 Tentative de reconnexion ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} dans ${delay/1000} secondes...\n`
                ]);
                
                window.sseReconnectTimer = setTimeout(() => {
                  if (eventSourceRef.current) {
                    eventSourceRef.current.close();
                    eventSourceRef.current = null;
                  }
                  
                  // Re-establish the connection
                  setupSSEConnection();
                }, delay);
              } else {
                setCurrentLogs(prevLogs => [
                  ...prevLogs, 
                  `❌ Échec des tentatives de reconnexion. Veuillez rafraîchir la page.\n`
                ]);
              }
            }
          );
        } catch (error) {
          console.error('Failed to establish SSE connection:', error);
          setCurrentLogs(prevLogs => [
            ...prevLogs, 
            `⚠️ Échec de la connexion SSE: ${error.message || 'Erreur inconnue'}\n`
          ]);
        }
      }
      
      // Nettoyage à la déconnexion
      return () => {
        // Clear any reconnection timers
        if (window.sseReconnectTimer) {
          clearTimeout(window.sseReconnectTimer);
        }
        
        // Close the SSE connection
        if (eventSourceRef.current) {
          console.log('Closing SSE connection on cleanup');
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      };
    }
  }, [projectData]);

  // Scroll automatique vers le bas des logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentLogs]);

  const handleBuild = async () => {
    setActiveTab('logs'); // Switch to logs tab immediately
    setCurrentLogs(['🔄 Préparation du build... Veuillez patienter...\n']); // Clear previous logs with initial message
    setIsBuilding(true);
    
    try {
      // First confirm server connectivity
      const API_BASE_URL = import.meta.env.VITE_SERVER_ENDPOINT || 'http://localhost:3000';
      
      try {
        // Perform a quick health check before attempting to build
        await fetch(`${API_BASE_URL}/health`, { timeout: 2000 });
      } catch (healthError) {
        throw new Error(`Le serveur n'est pas accessible sur ${API_BASE_URL}. Vérifiez la connexion.`);
      }
      
      // If health check passed, proceed with build
      const response = await buildProject(project.id);
      
      // Add a message confirming the build has started
      setCurrentLogs(prevLogs => [...prevLogs, '🚀 Build lancé sur le serveur. Les logs vont apparaître ci-dessous...\n']);
    } catch (error) {
      console.error('Error starting build:', error);
      setIsBuilding(false);
      setCurrentLogs(prevLogs => [
        ...prevLogs, 
        `❌ Erreur de démarrage du build: ${error.message || 'Erreur inconnue'}\n`
      ]);
    }
  };

  const handleDeploy = async () => {
    setActiveTab('logs'); // Switch to logs tab immediately
    setCurrentLogs([]); // Clear previous logs
    setIsDeploying(true);
    try {
      await deployProject(project.id); // Use project directly from props instead of projectData
      // The deployment has started, but we'll receive updates through SSE
      setCurrentLogs(['🔄 Démarrage du déploiement...\n']);
    } catch (error) {
      setIsDeploying(false);
      setCurrentLogs([`❌ Erreur de démarrage: ${error.message}\n`]);
    }
  };

  const handleCreateWebhook = async () => {
    try {
      const webhookData = await createWebhook(projectData.id);
      if (onWebhookCreated) {
        onWebhookCreated(webhookData);
      }
      
      // Refresh webhooks list
      loadProjectWebhooks();
    } catch (error) {
      console.error('Erreur lors de la création du webhook:', error);
    }
  };

  const handleDeleteWebhook = async (id) => {
    try {
      await deleteWebhook(id);
      setWebhooks(webhooks.filter(webhook => webhook.id !== id));
      // Notify parent that project data may have changed
      if (onProjectUpdated) onProjectUpdated(projectData.id);
    } catch (error) {
      console.error('Erreur lors de la suppression du webhook:', error);
    }
  };

  const handleDeleteProject = async () => {
    if (showDeleteConfirm) {
      setIsDeleting(true);
      try {
        await deleteProject(projectData.id);
        setIsDeleting(false);
        // Call onProjectUpdated with null to indicate project deletion
        if (onProjectUpdated) onProjectUpdated(null, true);
      } catch (error) {
        console.error('Erreur lors de la suppression du projet:', error);
        setIsDeleting(false);
      }
    } else {
      setShowDeleteConfirm(true);
    }
  };

  if (!projectData) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="project-details">
      <div className="project-header">
        <h2>{projectData.name}</h2>
        <div className="project-actions">
          <button onClick={onEdit} className="edit-button">
            Modifier
          </button>
          <button 
            onClick={handleDeleteProject} 
            className={`delete-button ${showDeleteConfirm ? 'confirm' : ''}`}
            disabled={isDeleting}
          >
            {isDeleting 
              ? 'Suppression...' 
              : showDeleteConfirm 
                ? 'Confirmer la suppression' 
                : 'Supprimer'}
          </button>
          {showDeleteConfirm && (
            <button 
              onClick={() => setShowDeleteConfirm(false)} 
              className="cancel-delete-button"
            >
              Annuler
            </button>
          )}
        </div>
      </div>
      
      <div className="project-info">
        <div className="info-row">
          <span className="label">Chemin:</span>
          <span className="value">{projectData.path}</span>
        </div>
        {projectData.description && (
          <div className="info-row">
            <span className="label">Description:</span>
            <span className="value">{projectData.description}</span>
          </div>
        )}
        {projectData.repository_url && (
          <div className="info-row">
            <span className="label">Dépôt:</span>
            <a href={projectData.repository_url} target="_blank" rel="noopener noreferrer" className="value link">
              {projectData.repository_url}
            </a>
          </div>
        )}
      </div>
      
      <div className="tabs">
        <button 
          className={`tab-button ${activeTab === 'control' ? 'active' : ''}`}
          onClick={() => setActiveTab('control')}
        >
          Contrôle
        </button>
        <button 
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Logs en direct
        </button>
        <button 
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Historique
        </button>
        <button 
          className={`tab-button ${activeTab === 'webhooks' ? 'active' : ''}`}
          onClick={() => setActiveTab('webhooks')}
        >
          Webhooks
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'control' && (
          <div className="control-panel">
            <h3>Actions</h3>
            <div className="button-row">
              <button 
                onClick={handleBuild} 
                disabled={isBuilding || isDeploying}
                className="action-button build"
              >
                {isBuilding ? 'Build en cours...' : 'Build'}
              </button>
              <button 
                onClick={handleDeploy} 
                disabled={isBuilding || isDeploying}
                className="action-button deploy"
              >
                {isDeploying ? 'Déploiement en cours...' : 'Déployer'}
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'logs' && (
          <div className="logs-container">
            <h3>Logs en direct</h3>
            <div className="live-logs">
              {currentLogs.length === 0 ? (
                <p className="no-logs-message">Aucun log disponible. Lancez un build ou un déploiement pour voir les logs.</p>
              ) : (
                <pre className="logs-output">
                  {currentLogs.map((log, index) => (
                    <LogLine key={index} content={log} />
                  ))}
                  <div ref={logsEndRef} />
                </pre>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'history' && (
          <div className="history-container">
            <h3>Historique des déploiements</h3>
            <LogsList logs={deploymentLogs} />
          </div>
        )}
        
        {activeTab === 'webhooks' && (
          <div className="webhooks-container">
            <div className="webhooks-header">
              <h3>Webhooks</h3>
              <button onClick={handleCreateWebhook} className="create-webhook-button">
                + Nouveau webhook
              </button>
            </div>
            <WebhookList 
              webhooks={webhooks}
              onDelete={handleDeleteWebhook}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;
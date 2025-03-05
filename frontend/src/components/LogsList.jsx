// frontend/src/components/LogsList.js
import React, { useState } from 'react';

const LogsList = ({ logs }) => {
  const [expandedLog, setExpandedLog] = useState(null);

  if (logs.length === 0) {
    return <p className="no-logs">Aucun log disponible.</p>;
  }

  const toggleExpand = (id) => {
    setExpandedLog(expandedLog === id ? null : id);
  };

  return (
    <div className="logs-list">
      <table className="logs-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Statut</th>
            <th>Déclencheur</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <React.Fragment key={log.id}>
              <tr className={`log-row ${log.status}`}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>
                  {log.action === 'build' ? 'Build' : 'Déploiement'}
                </td>
                <td>
                  <span className={`status-badge ${log.status}`}>
                    {log.status === 'started' ? 'Démarré' : 
                     log.status === 'success' ? 'Succès' : 'Erreur'}
                  </span>
                </td>
                <td>
                  {log.triggered_by && log.triggered_by.startsWith('webhook:') 
                    ? `Webhook #${log.triggered_by.split(':')[1]}` 
                    : 'Manuel'}
                </td>
                <td>
                  <button 
                    onClick={() => toggleExpand(log.id)}
                    className="small-button view"
                  >
                    {expandedLog === log.id ? 'Masquer' : 'Voir les logs'}
                  </button>
                </td>
              </tr>
              {expandedLog === log.id && (
                <tr className="log-content-row">
                  <td colSpan="5">
                    <div className="log-content">
                      <pre>{log.log_content || 'Aucun contenu de log disponible.'}</pre>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LogsList;
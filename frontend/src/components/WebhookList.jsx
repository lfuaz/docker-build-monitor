// frontend/src/components/WebhookList.js
import React from 'react';

const WebhookList = ({ webhooks, onDelete }) => {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert("URL du webhook copiée dans le presse-papier !");
      })
      .catch(err => {
        console.error('Erreur lors de la copie :', err);
      });
  };

  if (webhooks.length === 0) {
    return <p className="no-webhooks">Aucun webhook configuré pour ce projet.</p>;
  }

  return (
    <table className="webhooks-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>URL</th>
          <th>Créé le</th>
          <th>Dernière utilisation</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {webhooks.map(webhook => (
          <tr key={webhook.id}>
            <td>{webhook.id}</td>
            <td>
              <code className="webhook-url">{webhook.url}</code>
            </td>
            <td>{new Date(webhook.created_at).toLocaleString()}</td>
            <td>
              {webhook.last_used 
                ? new Date(webhook.last_used).toLocaleString()
                : 'Jamais utilisé'}
            </td>
            <td className="webhook-actions">
              <button 
                onClick={() => copyToClipboard(webhook.url)}
                className="small-button"
                title="Copier l'URL"
              >
                Copier
              </button>
              <button 
                onClick={() => onDelete(webhook.id)}
                className="small-button delete"
                title="Supprimer ce webhook"
              >
                Supprimer
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default WebhookList;




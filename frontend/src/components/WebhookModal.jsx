// frontend/src/components/WebhookModal.js
import React from 'react';

const WebhookModal = ({ webhookData, onClose }) => {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert("URL du webhook copiée dans le presse-papier !");
      })
      .catch(err => {
        console.error('Erreur lors de la copie :', err);
      });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Webhook Créé</h3>
        <p>Votre webhook a été créé avec succès pour le projet <strong>{webhookData.project_name}</strong>.</p>
        
        <div className="webhook-display">
          <code>{webhookData.url}</code>
          <button 
            onClick={() => copyToClipboard(webhookData.url)}
            className="copy-button"
          >
            Copier
          </button>
        </div>
        
        <p className="webhook-info">
          Utilisez une requête HTTP POST vers cette URL pour déclencher le déploiement.
          <br />
          Exemple avec curl : <code>curl -X POST {webhookData.url}</code>
        </p>
        
        <p className="webhook-instructions">
          <strong>Comment utiliser ce webhook :</strong>
        </p>
        
        <div className="webhook-examples">
          <div className="example">
            <h4>Dans GitHub Actions</h4>
            <pre>
{`name: Deploy via webhook
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger deployment webhook
        run: |
          curl -X POST ${webhookData.url}`}
            </pre>
          </div>
          
          <div className="example">
            <h4>Dans GitLab CI/CD</h4>
            <pre>
{`deploy:
  stage: deploy
  script:
    - curl -X POST ${webhookData.url}
  only:
    - main`}
            </pre>
          </div>
        </div>
        
        <div className="modal-actions">
          <button onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default WebhookModal;
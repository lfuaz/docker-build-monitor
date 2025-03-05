import React, { useState, useEffect } from 'react';
import { createProject, updateProject } from '../services/api';
import { useToast } from '../context/ToastContext';

const ProjectForm = ({ project, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    description: '',
    repository_url: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  
  useEffect(() => {
    // If project data is provided, this is an edit operation
    if (project) {
      setFormData({
        name: project.name || '',
        path: project.path || '',
        description: project.description || '',
        repository_url: project.repository_url || '',
      });
    }
  }, [project]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      let responseData;
      
      if (project) {
        // Update existing project
        responseData = await updateProject(project.id, formData);
        toast.success('Project updated successfully');
      } else {
        // Create new project
        responseData = await createProject(formData);
        toast.success('Project created successfully');
      }
      
      // Pass the updated/created project data back to parent
      onSubmit(responseData);
    } catch (error) {
      toast.error(`Error saving project: ${error.message}`);
      setError(error.message);
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="project-form">
      <h2>{project ? 'Modifier le projet' : 'Nouveau projet'}</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Nom</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="path">Chemin</label>
          <input
            type="text"
            id="path"
            name="path"
            value={formData.path}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="repository_url">URL du dépôt</label>
          <input
            type="url"
            id="repository_url"
            name="repository_url"
            value={formData.repository_url}
            onChange={handleChange}
            placeholder="https://github.com/user/repo"
          />
        </div>
        
        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="cancel-button"
            disabled={isSubmitting}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Enregistrement...'
              : project
                ? 'Mettre à jour'
                : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectForm;
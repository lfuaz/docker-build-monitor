import React, { useState, useCallback } from 'react';
import './App.scss';
import ProjectList from './components/ProjectList';
import ProjectDetails from './components/ProjectDetails';
import ProjectForm from './components/ProjectForm';
import WebhookModal from './components/WebhookModal';
import { useProjects } from './hooks/useProjects';
import { useDetectedProjects, importProject } from './hooks/useDetectedProjects';
import { useQueryClient } from 'react-query';
import { useToast } from './context/ToastContext';

function App() {
  const queryClient = useQueryClient();
  const toast = useToast();
  
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [webhookData, setWebhookData] = useState(null);
  
  // Use the React Query hooks
  const { 
    data: projects = [], 
    isLoading: isLoadingProjects, 
    refetch: refetchProjects 
  } = useProjects();

  const {
    data: detectedProjects = [],
    isLoading: isLoadingDetectedProjects
  } = useDetectedProjects();

  const handleSelectProject = useCallback((project) => {
    setSelectedProject(project);
    setIsEditMode(false);
  }, []);

  const handleAddProject = useCallback(() => {
    setSelectedProject(null);
    setIsEditMode(false);
    setShowProjectForm(true);
  }, []);

  const handleEditProject = useCallback(() => {
    setIsEditMode(true);
    setShowProjectForm(true);
  }, []);

  const handleProjectFormSubmit = useCallback((updatedProject) => {
    setShowProjectForm(false);
    refetchProjects();
    
    if (isEditMode && updatedProject) {
      setSelectedProject(updatedProject);
    }
  }, [isEditMode, refetchProjects]);

  const handleProjectFormCancel = useCallback(() => {
    setShowProjectForm(false);
  }, []);

  const handleWebhookCreated = useCallback((webhookData) => {
    setWebhookData(webhookData);
  }, []);

  const handleCloseWebhookModal = useCallback(() => {
    setWebhookData(null);
  }, []);

  const handleProjectUpdated = useCallback((projectId, isDeleted = false) => {
    if (isDeleted) {
      setSelectedProject(null);
      refetchProjects();
    }
  }, [refetchProjects]);

  const handleImportProject = useCallback(async (project) => {
    try {
      await importProject(project);
      await refetchProjects();
      // Also invalidate the detected projects query to refresh the list
      queryClient.invalidateQueries('detectedProjects');
      toast.success(`Project ${project.name} was successfully imported`);
    } catch (error) {
      toast.error(`Failed to import project: ${error.message}`);
    }
  }, [refetchProjects, queryClient, toast]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Docker Build Monitor</h1>
      </header>
      
      <div className="container">
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>Projets</h2>
            <button className="add-button" onClick={handleAddProject}>
              + Nouveau
            </button>
          </div>
          
          <ProjectList
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={handleSelectProject}
            isLoading={isLoadingProjects || isLoadingDetectedProjects}
            detectedProjects={detectedProjects}
            onImportProject={handleImportProject}
          />
        </div>
        
        <div className="content">
          {showProjectForm ? (
            <ProjectForm
              project={isEditMode ? selectedProject : null}
              onSubmit={handleProjectFormSubmit}
              onCancel={handleProjectFormCancel}
            />
          ) : selectedProject ? (
            <ProjectDetails
              project={selectedProject}
              onEdit={handleEditProject}
              onWebhookCreated={handleWebhookCreated}
              onProjectUpdated={handleProjectUpdated}
              key={`project-details-${selectedProject.id}`}
            />
          ) : (
            <div className="no-selection">
              <p>Sélectionnez un projet pour voir les détails ou créez-en un nouveau</p>
            </div>
          )}
        </div>
      </div>
      
      {webhookData && (
        <WebhookModal
          webhookData={webhookData}
          onClose={handleCloseWebhookModal}
        />
      )}
    </div>
  );
}

export default App;
import React from 'react';
import './ProjectList.scss';
import ProjectItem from './ProjectItem';

const ProjectList = ({ 
  projects, 
  selectedProject, 
  onSelectProject, 
  isLoading, 
  detectedProjects = [],
  onImportProject
}) => {
  if (isLoading) {
    return <div className="loading">Loading projects...</div>;
  }

  // Maps for checking if projects exist to avoid duplicates
  const managedProjectsMap = new Map(
    projects.map(project => [project.path, project])
  );

  // Filter out detected projects that are already managed
  const filteredDetectedProjects = detectedProjects.filter(
    project => !managedProjectsMap.has(project.path)
  );

  return (
    <div className="project-list">
      {projects.length === 0 && filteredDetectedProjects.length === 0 ? (
        <div className="empty-list">No projects found</div>
      ) : (
        <>
          {projects.length > 0 && (
            <div className="project-section">
              <h3 className="section-title">Managed Projects</h3>
              {projects.map(project => (
                <ProjectItem 
                  key={project.id} 
                  project={project}
                  isSelected={selectedProject && selectedProject.id === project.id}
                  onClick={onSelectProject}
                  isDetected={false}
                />
              ))}
            </div>
          )}

          {filteredDetectedProjects.length > 0 && (
            <div className="project-section">
              <h3 className="section-title">Detected Projects</h3>
              {filteredDetectedProjects.map(project => (
                <ProjectItem 
                  key={project.path} 
                  project={project}
                  isSelected={false}
                  onClick={() => {}}
                  isDetected={true}
                  onImport={onImportProject}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectList;
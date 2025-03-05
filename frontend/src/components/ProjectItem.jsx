import React from 'react';
import './ProjectItem.scss';

const ProjectItem = ({ project, isSelected, onClick, isDetected, onImport }) => {
  const handleImport = (e) => {
    e.stopPropagation();
    if (onImport) {
      onImport(project);
    }
  };

  return (
    <div
      className={`project-item ${isSelected ? 'selected' : ''} ${isDetected ? 'detected' : ''}`}
      onClick={() => onClick(project)}
    >
      <div className="project-item-name">{project.name}</div>
      
      {isDetected && (
        <div className="project-item-actions">
          <button onClick={handleImport} className="import-button">
            Import
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectItem;

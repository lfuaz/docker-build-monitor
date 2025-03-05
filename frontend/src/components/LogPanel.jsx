import React, { useEffect, useRef } from 'react';
import LogLine from './LogLine';
import useEventSource from '../hooks/useEventSource';

const LogPanel = ({ projectName = null }) => {
  const logContainerRef = useRef(null);
  
  // Connect to SSE stream
  const url = projectName 
    ? `/logs/stream?project=${encodeURIComponent(projectName)}` 
    : '/logs/stream';
  
  const { data: logs, status } = useEventSource(url);
  
  // Auto-scroll to the bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      const element = logContainerRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="log-panel">
      <div className="log-header">
        <h3>Build & Deploy Logs {projectName && `- ${projectName}`}</h3>
        <span className="connection-status">
          Status: {status === 'connected' ? '🟢 Connected' : '🔴 Connecting...'}
        </span>
      </div>
      
      <div className="log-container" ref={logContainerRef}>
        {logs.length === 0 && (
          <div className="empty-logs">No logs yet. Start a build or deployment to see logs here.</div>
        )}
        
        {logs.map((log, index) => (
          <LogLine key={index} content={log} />
        ))}
      </div>
    </div>
  );
};

export default LogPanel;

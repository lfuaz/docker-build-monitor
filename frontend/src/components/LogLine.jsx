import React from 'react';

export default function LogLine({ content }) {
    // Handle null or undefined content
    if (!content) {
        return null;
    }

    // If content is not a string, stringify it
    if (typeof content !== 'string') {
        try {
            content = JSON.stringify(content);
        } catch (e) {
            content = String(content);
        }
    }

    // Special handling for status messages with emojis
    if (content.includes('🔄') || content.includes('🚀') || 
        content.includes('✅') || content.includes('🔌')) {
        return (
            <div className="log-line status-message">
                {content}
            </div>
        );
    }
    
    // Handle pre-formatted project logs (format: [project] message)
    const projectLogMatch = content.match(/^\[([^\]]+)\]\s+(.+)$/);
    if (projectLogMatch) {
        const projectName = projectLogMatch[1];
        const message = projectLogMatch[2];
        
        // Check if it's an error message - must specifically be marked with [ERROR]
        if (message.includes('[ERROR]')) {
            const errorMessage = message.replace('[ERROR]', '').trim();
            return (
                <div className="log-line build-log error">
                    <span className="project-name">[{projectName}]</span>
                    <span className="build-output error-text"> {errorMessage}</span>
                </div>
            );
        }
        
        // Check for success indicators
        const successPatterns = ['Built', 'Running', 'Created', 'Started', 'Pulled', 'Done', 'DONE'];
        let isSuccess = false;
        
        for (const pattern of successPatterns) {
            if (message.includes(pattern)) {
                isSuccess = true;
                break;
            }
        }
        
        // Apply success class if applicable
        if (isSuccess) {
            return (
                <div className="log-line build-log success">
                    <span className="project-name">[{projectName}]</span>
                    <span className="build-output success-text"> {message}</span>
                </div>
            );
        }
        
        // Default project log
        return (
            <div className="log-line build-log">
                <span className="project-name">[{projectName}]</span>
                <span className="build-output"> {message}</span>
            </div>
        );
    }
    
    // Default case: just display the content as is
    return (
        <div className="log-line">
            {content}
        </div>
    );
}
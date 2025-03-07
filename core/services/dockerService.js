// services/dockerService.js - Docker-related operations
const { exec } = require('child_process');
const { sendEventToAll } = require('./sseService');

/**
 * Get project containers from Docker using exec instead of Dockerode
 */
async function getProjectContainers() {
  return new Promise((resolve, reject) => {
    // Use docker ps with format option to get all containers in JSON format
    exec('docker ps -a --format "{{json .}}"', (error, stdout, stderr) => {
      if (error) {
        console.error('Error detecting Docker projects:', error);
        reject(error);
        return;
      }

      try {
        // Split by newline and parse each line as a JSON object
        const containersList = stdout.trim().split('\n')
          .filter(line => line.trim() !== '')
          .map(line => JSON.parse(line));

        // Extract project information from containers
        const projectsMap = {};
        
        for (const container of containersList) {
          // Get labels as string and parse it
          const labelsStr = container.Labels || '';
          const labels = {};
          
          // Parse comma-separated labels into an object
          labelsStr.split(',').forEach(labelPair => {
            const [key, value] = labelPair.split('=');
            if (key && value) {
              labels[key] = value;
            }
          });
          
          const projectName = labels['com.docker.compose.project'];
          const configfiles = labels['com.docker.compose.project.config_files'];
          
          // If container has the necessary labels
          if (configfiles) {
            if (!projectsMap[projectName]) {
              projectsMap[projectName] = {
                name: projectName,
                path: configfiles,
                containers: []
              };
            }
            
            // Add container to project
            projectsMap[projectName].containers.push({
              id: container.ID,
              name: container.Names.replace(/^\//, ''),
              image: container.Image,
              state: container.State,
              status: container.Status
            });
          }
        }
        
        // Convert map to array of projects
        resolve(Object.values(projectsMap));
      } catch (error) {
        console.error('Error parsing Docker projects:', error);
        reject(error);
      }
    });
  });
}

/**
 * Build and deploy a project
 */
async function buildProject(project, logId) {
  return new Promise((resolve, reject) => {
    let logContent = '';
    
    // Send initial notification
    sendEventToAll('build_log', { 
      project: project.name, 
      output: `🔄 Starting build for ${project.name}...\n`,
      timestamp: Date.now()
    });
    
    // First: pull images
    const pullProcess = exec(
      `docker compose -f ${project.path} pull`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );
    
    const handleLog = (output) => {
      logContent += output;
      sendEventToAll('build_log', { 
        project: project.name, 
        output: output,
        timestamp: Date.now()
      });
    };

    pullProcess.stdout.on('data', handleLog);
    pullProcess.stderr.on('data', handleLog);
    
    pullProcess.on('close', (pullCode) => {
      if (pullCode !== 0) {
        handleLog(`⚠️ Warning during image pull (exit code ${pullCode}) - continuing with build\n`);
      } else {
        handleLog(`✅ Images pulled successfully\n`);
      }
      
      // Second: build services
      handleLog(`🏗️ Building services from Dockerfile...\n`);
      
      const buildProcess = exec(
        `docker compose -f ${project.path} build --no-cache --pull`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );
      
      buildProcess.stdout.on('data', handleLog);
      buildProcess.stderr.on('data', handleLog);
      
      buildProcess.on('close', (buildCode) => {
        if (buildCode !== 0) {
          const errorMsg = `❌ Error during build (exit code ${buildCode})\n`;
          handleLog(errorMsg);
          
          sendEventToAll('build_error', { 
            project: project.name, 
            message: `Build failed with exit code ${buildCode}`,
            timestamp: Date.now()
          });
          
          resolve({ status: 'error', logContent });
          return;
        }
        
        handleLog(`✅ Build completed successfully\n`);
        
        // Third: create but don't start containers (this prepares everything for deployment)
        handleLog(`📦 Creating containers...\n`);
        
        const createProcess = exec(
          `docker compose -f ${project.path} create --force-recreate`,
          { maxBuffer: 5 * 1024 * 1024 }
        );
        
        createProcess.stdout.on('data', handleLog);
        createProcess.stderr.on('data', handleLog);
        
        createProcess.on('close', (createCode) => {
          if (createCode !== 0) {
            const errorMsg = `❌ Error creating containers (exit code ${createCode})\n`;
            handleLog(errorMsg);
            
            sendEventToAll('build_error', { 
              project: project.name, 
              message: `Container creation failed with exit code ${createCode}`,
              timestamp: Date.now()
            });
            
            resolve({ status: 'error', logContent });
            return;
          }
          
          handleLog(`\n📦 Build process completed successfully.\n`);
          
          sendEventToAll('build_completed', { 
            project: project.name, 
            status: 'completed',
            timestamp: Date.now()
          });
          
          resolve({ status: 'success', logContent });
        });
        
        createProcess.on('error', (error) => {
          const errorMsg = `❌ Error creating containers: ${error.message}\n`;
          handleLog(errorMsg);
          
          sendEventToAll('build_error', { 
            project: project.name, 
            message: error.message,
            timestamp: Date.now()
          });
          
          resolve({ status: 'error', logContent });
        });
      });
      
      buildProcess.on('error', (error) => {
        const errorMsg = `❌ Error during build command: ${error.message}\n`;
        handleLog(errorMsg);
        
        sendEventToAll('build_error', { 
          project: project.name, 
          message: error.message,
          timestamp: Date.now()
        });
        
        resolve({ status: 'error', logContent });
      });
    });
    
    pullProcess.on('error', (error) => {
      const errorMsg = `❌ Error during pull command: ${error.message}\n`;
      handleLog(errorMsg);
      
      sendEventToAll('build_error', { 
        project: project.name, 
        message: error.message,
        timestamp: Date.now()
      });
      
      resolve({ status: 'error', logContent });
    });
  });
}

/**
 * Deploy a project using Docker Compose
 */
function deployProject(project, logId, triggerSource = 'user') {
  return new Promise((resolve, reject) => {
    let logContent = '';
    
    // Send initial notification
    sendEventToAll('deploy_log', { 
      project: project.name, 
      output: `🔄 Starting deployment for ${project.name} (triggered by ${triggerSource})...\n`,
      timestamp: Date.now()
    });
    
    // Execute deployment command
    const deployProcess = exec(
      `docker compose -f ${project.path} up -d --build`, 
      { maxBuffer: 5 * 1024 * 1024 } // Increase buffer size to 5MB
    );
    
    // Capture stdout
    deployProcess.stdout.on('data', (data) => {
      const output = data.toString();
      logContent += output;
      
      sendEventToAll('deploy_log', { 
        project: project.name, 
        output,
        timestamp: Date.now()
      });
    });
    
    // Capture stderr
    deployProcess.stderr.on('data', (data) => {
      const output = data.toString();
      logContent += output;
      
      sendEventToAll('deploy_log', { 
        project: project.name, 
        output,
        timestamp: Date.now()
      });
    });
    
    // Handle process completion
    deployProcess.on('close', (code) => {
      if (code === 0) {
        sendEventToAll('deploy_completed', { 
          project: project.name, 
          status: 'completed',
          timestamp: Date.now()
        });
        resolve({ status: 'success', logContent });
      } else {
        const errorMsg = `Process exited with code ${code}`;
        sendEventToAll('deploy_error', { 
          project: project.name, 
          message: errorMsg,
          timestamp: Date.now()
        });
        resolve({ status: 'error', logContent, error: errorMsg });
      }
    });
    
    // Handle process errors
    deployProcess.on('error', (error) => {
      const errorMsg = `Error executing deployment: ${error.message}`;
      logContent += `\n${errorMsg}\n`;
      
      sendEventToAll('deploy_error', { 
        project: project.name, 
        message: errorMsg,
        timestamp: Date.now()
      });
      
      resolve({ status: 'error', logContent, error: errorMsg });
    });
  });
}

module.exports = {
  getProjectContainers,
  buildProject,
  deployProject
};
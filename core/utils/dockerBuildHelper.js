// utils/dockerBuildHelper.js - Docker build helper functions
const path = require('path');
const tar = require('tar-fs');
const fs = require('fs');

/**
 * Build a service from Docker Compose configuration
 * 
 * @param {Object} docker - Docker instance
 * @param {Object} service - Service configuration from compose file
 * @param {string} imageName - Name for the built image
 * @param {string} workDir - Working directory (compose file location)
 * @returns {Stream} - Build stream
 */
async function buildServiceFromCompose(docker, service, imageName, workDir) {
  // Determine the context and dockerfile path
  let context = workDir;
  let dockerfile = 'Dockerfile';
  
  if (typeof service.build === 'string') {
    // If build is a string, it's the context
    context = path.resolve(workDir, service.build);
  } else if (typeof service.build === 'object') {
    // If build is an object, it may have context and dockerfile
    if (service.build.context) {
      context = path.resolve(workDir, service.build.context);
    }
    
    if (service.build.dockerfile) {
      dockerfile = service.build.dockerfile;
    }
  }
  
  // Create a tar stream from the build context
  const tarStream = tar.pack(context, {
    // Include only necessary files
    ignore: function(name) {
      return name.includes('node_modules') || name.includes('.git');
    }
  });
  
  // Build options
  const buildOptions = {
    t: imageName,
    dockerfile: dockerfile,
    forcerm: true,
    nocache: true
  };
  
  // Start the build
  return docker.buildImage(tarStream, buildOptions);
}

module.exports = {
  buildServiceFromCompose
};
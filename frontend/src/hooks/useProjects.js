import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  fetchProjects, 
  fetchProject, 
  createProject, 
  updateProject, 
  deleteProject,
  buildProject,
  deployProject,
  fetchProjectLogs,
  fetchProjectWebhooks
} from '../services/api';

// Query key prefixes for organization
const PROJECTS = 'projects';
const PROJECT = 'project';
const PROJECT_LOGS = 'project-logs';
const PROJECT_WEBHOOKS = 'project-webhooks';

// Hook for accessing all projects
export const useProjects = () => {
  return useQuery(PROJECTS, fetchProjects);
};

// Hook for accessing a single project
export const useProject = (id, options = {}) => {
  return useQuery(
    [PROJECT, id], 
    () => fetchProject(id), 
    { 
      ...options,
      enabled: !!id // Only fetch when we have an ID
    }
  );
};

// Hook for accessing project logs
export const useProjectLogs = (projectId, options = {}) => {
  return useQuery(
    [PROJECT_LOGS, projectId], 
    () => fetchProjectLogs(projectId), 
    { 
      ...options,
      enabled: !!projectId
    }
  );
};

// Hook for accessing project webhooks
export const useProjectWebhooks = (projectId, options = {}) => {
  return useQuery(
    [PROJECT_WEBHOOKS, projectId], 
    () => fetchProjectWebhooks(projectId), 
    { 
      ...options,
      enabled: !!projectId
    }
  );
};

// Hook for creating a project
export const useCreateProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation(createProject, {
    onSuccess: () => {
      // Invalidate projects list to trigger refetch
      queryClient.invalidateQueries(PROJECTS);
    }
  });
};

// Hook for updating a project
export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, data }) => updateProject(id, data), 
    {
      onSuccess: (data) => {
        // Update the cache with the new data
        queryClient.setQueryData([PROJECT, data.id], data);
        // Also invalidate the projects list
        queryClient.invalidateQueries(PROJECTS);
      }
    }
  );
};

// Hook for deleting a project
export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation(deleteProject, {
    onSuccess: (_, id) => {
      // Remove from cache and invalidate lists
      queryClient.removeQueries([PROJECT, id]);
      queryClient.invalidateQueries(PROJECTS);
    }
  });
};

// Hook for building a project
export const useBuildProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation(buildProject, {
    onSuccess: (_, projectId) => {
      // Invalidate the specific project to show updated status
      queryClient.invalidateQueries([PROJECT, projectId]);
    }
  });
};

// Hook for deploying a project
export const useDeployProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation(deployProject, {
    onSuccess: (_, projectId) => {
      // Invalidate the specific project to show updated status
      queryClient.invalidateQueries([PROJECT, projectId]);
    }
  });
};

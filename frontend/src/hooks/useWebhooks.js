import { useQuery, useMutation, useQueryClient } from 'react-query';
import { fetchWebhooks, createWebhook, deleteWebhook } from '../services/api';

// Query key prefixes
const WEBHOOKS = 'webhooks';
const PROJECT_WEBHOOKS = 'project-webhooks';

// Hook for accessing all webhooks
export const useWebhooks = () => {
  return useQuery(WEBHOOKS, fetchWebhooks);
};

// Hook for creating a webhook
export const useCreateWebhook = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ projectId, description }) => createWebhook(projectId, description),
    {
      onSuccess: (data, { projectId }) => {
        // Invalidate related queries
        queryClient.invalidateQueries(WEBHOOKS);
        queryClient.invalidateQueries([PROJECT_WEBHOOKS, projectId]);
      }
    }
  );
};

// Hook for deleting a webhook
export const useDeleteWebhook = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    deleteWebhook,
    {
      onSuccess: () => {
        // Invalidate the webhooks list
        queryClient.invalidateQueries(WEBHOOKS);
        // Since we don't know which project this webhook belonged to,
        // invalidate all project webhooks queries
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === PROJECT_WEBHOOKS
        });
      }
    }
  );
};

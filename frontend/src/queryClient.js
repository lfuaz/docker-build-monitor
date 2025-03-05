import { QueryClient } from 'react-query';

// Create a client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Disable refetching when window gets focus
      retry: 1, // Only retry failed queries once
      staleTime: 30000, // Consider data fresh for 30 seconds
      cacheTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      refetchInterval: false, // Disable polling by default
      onError: (err) => {
        console.error('Query error:', err);
      }
    },
    mutations: {
      onError: (err) => {
        console.error('Mutation error:', err);
      }
    }
  }
});

// Make sure to properly export the queryClient
export default queryClient;

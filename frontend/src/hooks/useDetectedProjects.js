import { useQuery } from 'react-query';
import { detectProjects, importDetectedProject } from '../services/api';

export const useDetectedProjects = () => {
  return useQuery(
    'detectedProjects',
    async () => {
      const data = await detectProjects();
      return data.projects || [];
    },
    {
      staleTime: 60000, // 1 minute
      refetchOnWindowFocus: false
    }
  );
};

export const importProject = async (project) => {
  try {
    return await importDetectedProject([project]);
  } catch (error) {
    console.error('Error importing project:', error);
    throw error;
  }
};

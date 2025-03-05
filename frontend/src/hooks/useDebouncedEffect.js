import { useEffect, useRef } from 'react';

/**
 * A custom hook that runs an effect with debouncing to prevent rapid re-execution
 * 
 * @param {Function} effect - The effect callback to run
 * @param {Array} dependencies - Array of dependencies for the effect
 * @param {number} delay - Debounce delay in milliseconds
 */
function useDebouncedEffect(effect, dependencies, delay = 300) {
  const timeoutRef = useRef(null);
  const effectRef = useRef(effect);
  const isFirstRun = useRef(true);
  
  // Keep the effect function reference up to date
  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);
  
  useEffect(() => {
    // Skip debouncing on the first render to ensure initialization happens promptly
    if (isFirstRun.current) {
      isFirstRun.current = false;
      effectRef.current();
      return;
    }
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a new timeout
    timeoutRef.current = setTimeout(() => {
      effectRef.current();
    }, delay);
    
    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
}

export default useDebouncedEffect;

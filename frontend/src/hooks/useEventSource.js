import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToLogs } from '../services/api';

/**
 * Custom hook to manage EventSource connections with proper cleanup and loop prevention
 * @param {string} url - The SSE URL to connect to
 * @param {Function} onMessage - Callback for SSE messages
 * @param {Function} onError - Callback for SSE errors
 */
const useEventSource = (url, onMessage, onError) => {
  const [status, setStatus] = useState('idle');
  const eventSourceRef = useRef(null);
  const urlRef = useRef(url);
  const connectionAttempts = useRef(0);
  const lastConnectionTime = useRef(0);
  
  // Stabilize callback references
  const stableOnMessage = useCallback((data, eventType) => {
    if (onMessage) onMessage(data, eventType);
  }, []);
  
  const stableOnError = useCallback((error) => {
    if (onError) onError(error);
  }, []);
  
  // Check if the URL has changed
  useEffect(() => {
    urlRef.current = url;
  }, [url]);
  
  // Connection management with loop prevention
  useEffect(() => {
    // Only create a new connection if URL is provided
    if (!url) {
      setStatus('idle');
      return;
    }
    
    // Prevent rapid connection attempts that could cause loops
    const now = Date.now();
    if (now - lastConnectionTime.current < 2000) {
      connectionAttempts.current += 1;
      
      // If we've tried to connect too many times in quick succession, wait longer
      if (connectionAttempts.current > 3) {
        console.warn('Too many EventSource connection attempts, delaying reconnect...');
        setTimeout(() => {
          // Reset connection attempts after a delay
          connectionAttempts.current = 0;
        }, 5000);
        return;
      }
    } else {
      // Reset connection attempts if enough time has passed
      connectionAttempts.current = 0;
    }
    
    lastConnectionTime.current = now;
    setStatus('connecting');
    
    // Create the EventSource connection
    const eventSourceInstance = subscribeToLogs(
      url,
      stableOnMessage,
      stableOnError
    );
    
    // Store the reference for cleanup
    eventSourceRef.current = eventSourceInstance;
    
    // Cleanup function to close the connection when component unmounts
    // or when url changes
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [url, stableOnMessage, stableOnError]);
  
  // Return the connection status and a method to manually close the connection
  return {
    status,
    close: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setStatus('closed');
      }
    }
  };
};

export default useEventSource;

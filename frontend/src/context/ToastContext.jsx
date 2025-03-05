import React, { createContext, useContext } from 'react';
import { toast } from 'react-toastify';

// Create the context
const ToastContext = createContext(null);

// Custom provider component
export const ToastProvider = ({ children }) => {
  // Toast functions with predefined configurations
  const showToast = {
    success: (message, options = {}) =>
      toast.success(message, { ...options }),
    
    error: (message, options = {}) =>
      toast.error(message, { ...options }),
    
    info: (message, options = {}) =>
      toast.info(message, { ...options }),
    
    warning: (message, options = {}) =>
      toast.warning(message, { ...options }),
    
    // Allow direct access to toast method as well
    custom: toast
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
    </ToastContext.Provider>
  );
};

// Custom hook to use toast
export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
};

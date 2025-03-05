import React from 'react';
import { ToastContainer as ReactToastifyContainer } from 'react-toastify';
// Note: We're importing the CSS in index.scss globally instead
// This prevents duplicate style imports

const ToastContainer = () => {
  return (
    <ReactToastifyContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
      limit={3}
    />
  );
};

export default ToastContainer;

import React from 'react';

const LoadingSpinner = () => {
  return (
    <div style={styles.loadingContainer}>
      <div style={styles.loadingSpinner}></div>
      <style>
        {`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};

const styles = {
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh', // Full viewport height to center the spinner
  },
  loadingSpinner: {
    border: '8px solid #f3f3f3', // Light gray background
    borderTop: '8px solid #3498db', // Blue color for the spinner
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite', // Apply spin animation
  },
};

export default LoadingSpinner;

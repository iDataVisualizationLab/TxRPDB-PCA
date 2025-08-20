import React, { useState } from 'react';

interface HelpButtonProps {
  helpContent: React.ReactNode;
}

const HelpButton: React.FC<HelpButtonProps> = ({ helpContent }) => {
  const [showHelp, setShowHelp] = useState(false);

  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  return (
    <div className="help-button-container">
      <button 
        className="help-button"
        onClick={toggleHelp}
        aria-label="Help"
        title="Help"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </button>
      
      {showHelp && (
        <div className="help-popup">
          <div className="help-popup-content">
            <button className="close-button" onClick={toggleHelp}>×</button>
            <div>{helpContent}</div>
          </div>
        </div>
      )}

      <style jsx>{`
        .help-button-container {
          position: relative;
        }
        
        .help-button {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #2563eb;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          z-index: 1000;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
          transition: background-color 0.2s;
        }
        
        .help-button:hover {
          background-color: #1d4ed8;
        }
        
        .help-popup {
          position: fixed;
          bottom: 70px;
          right: 20px;
          width: 300px;
          max-height: 400px;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          overflow: auto;
        }
        
        .help-popup-content {
          padding: 16px;
          position: relative;
        }
        
        .close-button {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default HelpButton;

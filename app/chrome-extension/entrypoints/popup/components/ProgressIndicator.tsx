import React from 'react';

interface Props {
  visible?: boolean;
  text: string;
  showSpinner?: boolean;
}

export const ProgressIndicator: React.FC<Props> = ({
  visible = true,
  text,
  showSpinner = true,
}) => {
  if (!visible) return null;

  return (
    <div className="progress-section">
      <div className="progress-indicator">
        {showSpinner && <div className="spinner" />}
        <span className="progress-text">{text}</span>
      </div>
    </div>
  );
};

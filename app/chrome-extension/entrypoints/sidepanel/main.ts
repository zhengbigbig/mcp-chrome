import React from 'react';
import { createRoot } from 'react-dom/client';
import NewApp from './components/NewApp';
import './new-style.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

const root = createRoot(container);
root.render(React.createElement(NewApp));

import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { App } from './components/App';

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(App));
}

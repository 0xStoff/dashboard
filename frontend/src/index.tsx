import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import "@interchain-ui/react/styles";
import App from "./App";
import EthTokens from "./EthTokens";

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
          <App />
      <EthTokens />
  </React.StrictMode>
);


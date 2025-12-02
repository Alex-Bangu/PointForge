import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initLocalStorageObserver } from './utils/localStorageObserver.js'

// Initialize localStorage observer early to detect same-tab changes
initLocalStorageObserver();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

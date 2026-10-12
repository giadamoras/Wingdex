import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { JournalProvider } from './collection/JournalContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JournalProvider>
      <App />
    </JournalProvider>
  </StrictMode>,
)

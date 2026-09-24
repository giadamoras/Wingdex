import { useEffect, useState } from 'react'

// Backend base URL; override with VITE_API_URL in a .env file.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function App() {
  const [status, setStatus] = useState('checking...')

  // Smoke test: prove the frontend can reach the backend (CORS + plumbing).
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data: { status: string }) => setStatus(data.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <main>
      <h1>Airspace Explorer</h1>
      <p>Backend status: {status}</p>
    </main>
  )
}

export default App

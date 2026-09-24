import { FlightMap } from './FlightMap'
import { useFlights } from './useFlights'

function App() {
  const { flights, error } = useFlights()

  return (
    <main>
      <h1>Airspace Explorer</h1>
      {flights === null ? (
        <p>{error ? 'Could not load flights.' : 'Loading flights...'}</p>
      ) : (
        <>
          {error && <p>Connection lost, retrying...</p>}
          <FlightMap flights={flights} />
        </>
      )}
    </main>
  )
}

export default App

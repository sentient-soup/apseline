import { useEffect } from 'react';
import { useServicesStore } from './stores/servicesStore';
import { SolarSystem } from './components/SolarSystem';
import { OrbitalBackground } from './components/OrbitalBackground';

function App() {
  const { fetchConfig, fetchServices, fetchDiscoveryStatus, connectSocket, activeInfra } = useServicesStore();

  useEffect(() => {
    fetchConfig();
    fetchServices();
    fetchDiscoveryStatus();
    const disconnect = connectSocket();
    return disconnect;
  }, [fetchConfig, fetchServices, fetchDiscoveryStatus, connectSocket]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <OrbitalBackground infrastructure={activeInfra} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <SolarSystem />
      </div>
    </div>
  );
}

export default App;

import { useEffect } from 'react';
import { useServicesStore } from './stores/servicesStore';
import { Tacnav } from './components/Tacnav';

function App() {
  const {
    fetchConfig, fetchServices, fetchDiscoveryStatus,
    fetchMetrics, fetchHealth, connectSocket,
  } = useServicesStore();

  useEffect(() => {
    fetchConfig();
    fetchServices();
    fetchDiscoveryStatus();
    fetchMetrics();
    fetchHealth();
    const disconnect = connectSocket();
    return disconnect;
  }, [fetchConfig, fetchServices, fetchDiscoveryStatus, fetchMetrics, fetchHealth, connectSocket]);

  return <Tacnav />;
}

export default App;

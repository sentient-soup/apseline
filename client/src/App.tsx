import { useEffect } from 'react';
import { useServicesStore } from './stores/servicesStore';
import { Pulse } from './components/Pulse';

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

  return <Pulse />;
}

export default App;

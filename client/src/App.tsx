import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServicesStore } from './stores/servicesStore';
import { ServiceGrid } from './components/ServiceGrid';
import { Header } from './components/Header';
import { OrbitalBackground } from './components/OrbitalBackground';

function App() {
  const {
    activeInfra, setActiveInfra,
    services, loading, error,
    discoveryStatus,
    fetchConfig, fetchServices, fetchDiscoveryStatus, refreshServices, connectSocket,
  } = useServicesStore();

  useEffect(() => {
    fetchConfig();
    fetchServices();
    fetchDiscoveryStatus();
    const disconnect = connectSocket();
    return disconnect;
  }, [fetchConfig, fetchServices, fetchDiscoveryStatus, connectSocket]);

  const isPerihelion = activeInfra === 'perihelion';
  const filteredServices = services.filter(s => s.infrastructure === activeInfra);

  return (
    <div className="min-h-screen bg-space-background">
      {/* Subtle Background */}
      <OrbitalBackground infrastructure={activeInfra} />

      {/* Content Layer */}
      <div className="relative z-10">
        <Header
          activeInfra={activeInfra}
          onInfraChange={setActiveInfra}
          serviceCount={filteredServices.length}
          discoveryStatus={discoveryStatus}
          onRefresh={refreshServices}
        />

        <main className="container mx-auto px-6 py-8">
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-32"
              >
                <motion.div
                  className={`w-16 h-16 rounded-full border-2 ${
                    isPerihelion ? 'border-perihelion-primary' : 'border-aphelion-primary'
                  } border-t-transparent`}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <motion.p
                  className="mt-6 text-sm text-space-text-muted"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Discovering services...
                </motion.p>
              </motion.div>
            )}

            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-32"
              >
                <div className="bg-space-card p-8 rounded-lg border border-red-500/20 max-w-md text-center">
                  <h3 className="text-xl font-semibold text-red-400 mb-3">Error Loading Services</h3>
                  <p className="text-sm text-space-text-secondary mb-6">{error}</p>
                  <button
                    onClick={() => fetchServices()}
                    className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm font-medium text-red-400 border border-red-500/30 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </motion.div>
            )}

            {!loading && !error && (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ServiceGrid services={services} infrastructure={activeInfra} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;

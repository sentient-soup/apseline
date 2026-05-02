import { motion } from 'framer-motion';

interface DiscoveryStatus {
  kubernetes: { connected: boolean };
  docker: { connected: boolean };
  lastDiscovery: number | null;
  cachedServiceCount: number;
}

interface HeaderProps {
  activeInfra: 'perihelion' | 'aphelion';
  onInfraChange: (infra: 'perihelion' | 'aphelion') => void;
  serviceCount: number;
  discoveryStatus: DiscoveryStatus | null;
  onRefresh: () => void;
}

export function Header({ activeInfra, onInfraChange, serviceCount, discoveryStatus, onRefresh }: HeaderProps) {
  const isPerihelion = activeInfra === 'perihelion';
  const k8sConnected = discoveryStatus?.kubernetes.connected ?? false;
  const dockerConnected = discoveryStatus?.docker.connected ?? false;
  const hasIntegrations = k8sConnected || dockerConnected;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="border-b border-space-border backdrop-blur-xl bg-space-surface/50 sticky top-0 z-50"
    >
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo and Infrastructure Info */}
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className={`relative w-8 h-8 rounded-lg border ${
                isPerihelion ? 'border-perihelion-primary/50' : 'border-aphelion-primary/50'
              } flex items-center justify-center`}>
                <div className={`w-3 h-3 rounded-full ${
                  isPerihelion
                    ? 'bg-gradient-to-br from-perihelion-primary to-perihelion-secondary'
                    : 'bg-gradient-to-br from-aphelion-primary to-aphelion-secondary'
                }`} />
              </div>
              <h1 className="text-lg font-semibold text-white">Apseline</h1>
            </div>

            {/* Infrastructure Info */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isPerihelion ? 'bg-perihelion-primary' : 'bg-aphelion-primary'
                } animate-pulse`} />
                <span className="text-space-text-secondary">
                  {isPerihelion ? 'Perihelion' : 'Aphelion'}
                </span>
              </div>
              <div className="w-px h-4 bg-space-border" />
              <span className="text-space-text-muted">
                {serviceCount} {serviceCount === 1 ? 'Service' : 'Services'}
              </span>

              {/* Integration Status Indicators */}
              {hasIntegrations && (
                <>
                  <div className="w-px h-4 bg-space-border" />
                  <div className="flex items-center gap-3">
                    {k8sConnected && (
                      <span className="flex items-center gap-1.5 text-xs text-space-text-muted" title="Kubernetes connected">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        K8s
                      </span>
                    )}
                    {dockerConnected && (
                      <span className="flex items-center gap-1.5 text-xs text-space-text-muted" title="Docker connected">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Docker
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Refresh + Infrastructure Toggle */}
          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg text-space-text-muted hover:text-white hover:bg-space-card/50 border border-transparent hover:border-space-border transition-all duration-200"
              title="Refresh services"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Infrastructure Toggle */}
            <div className="relative flex gap-1 p-1 rounded-lg bg-space-card/50 border border-space-border">
              {/* Animated Background Slider */}
              <motion.div
                className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-md ${
                  isPerihelion
                    ? 'bg-gradient-to-r from-perihelion-primary/20 to-perihelion-secondary/20 border border-perihelion-primary/30'
                    : 'bg-gradient-to-r from-aphelion-primary/20 to-aphelion-secondary/20 border border-aphelion-primary/30'
                }`}
                initial={false}
                animate={{
                  x: isPerihelion ? 4 : 'calc(100% + 4px)',
                }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                }}
              />

              {/* Perihelion Button */}
              <button
                onClick={() => onInfraChange('perihelion')}
                className={`relative z-10 px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                  isPerihelion
                    ? 'text-white'
                    : 'text-space-text-muted hover:text-space-text-secondary'
                }`}
              >
                Perihelion
              </button>

              {/* Aphelion Button */}
              <button
                onClick={() => onInfraChange('aphelion')}
                className={`relative z-10 px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                  !isPerihelion
                    ? 'text-white'
                    : 'text-space-text-muted hover:text-space-text-secondary'
                }`}
              >
                Aphelion
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

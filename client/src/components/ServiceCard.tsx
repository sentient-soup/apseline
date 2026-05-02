import { motion } from 'framer-motion';
import type { Service, ServiceStatus, ServiceSource } from '@apseline/shared';

interface ServiceCardProps {
  service: Service;
  index: number;
}

const statusConfig: Record<ServiceStatus, { color: string; label: string; pulse: boolean }> = {
  running: { color: 'bg-emerald-400', label: 'Running', pulse: true },
  stopped: { color: 'bg-red-400', label: 'Stopped', pulse: false },
  unreachable: { color: 'bg-amber-400', label: 'Unreachable', pulse: false },
  unknown: { color: 'bg-space-text-muted', label: 'Unknown', pulse: false },
};

const sourceIcons: Record<ServiceSource, string> = {
  manual: '⚙',
  kubernetes: '☸',
  docker: '🐳',
};

export function ServiceCard({ service, index }: ServiceCardProps) {
  const isPerihelion = service.infrastructure === 'perihelion';
  const status = service.status || 'unknown';
  const source = service.source || 'manual';
  const { color, label, pulse } = statusConfig[status];

  return (
    <motion.a
      href={service.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.4,
      }}
      whileHover={{
        y: -4,
        transition: { duration: 0.2 },
      }}
      className="group relative block"
    >
      <div className={`
        relative p-5 rounded-lg bg-space-card border border-space-border
        hover:border-${isPerihelion ? 'perihelion' : 'aphelion'}-primary/30
        transition-all duration-300
      `}>
        {/* Top Row: Category + Status + Source */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Category Badge */}
            {service.category && (
              <span className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                ${isPerihelion
                  ? 'bg-perihelion-primary/10 text-perihelion-secondary border border-perihelion-primary/20'
                  : 'bg-aphelion-primary/10 text-aphelion-secondary border border-aphelion-primary/20'
                }
              `}>
                <span className={`w-1 h-1 rounded-full ${
                  isPerihelion ? 'bg-perihelion-primary' : 'bg-aphelion-primary'
                }`} />
                {service.category}
              </span>
            )}

            {/* Source Badge (only for auto-discovered) */}
            {source !== 'manual' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-space-surface text-space-text-muted border border-space-border">
                <span className="text-[10px]">{sourceIcons[source]}</span>
                {source === 'kubernetes' ? 'K8s' : 'Docker'}
              </span>
            )}
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-1.5" title={label}>
            <span className="relative flex h-2.5 w-2.5">
              {pulse && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-50`} />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
            </span>
          </div>
        </div>

        {/* Service Name */}
        <h3 className={`text-lg font-semibold mb-2 ${
          isPerihelion ? 'text-perihelion-secondary' : 'text-aphelion-secondary'
        } group-hover:text-white transition-colors`}>
          {service.name}
        </h3>

        {/* URL + Namespace */}
        <div className="flex items-center gap-2 text-xs text-space-text-muted">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="truncate font-mono group-hover:text-space-text-secondary transition-colors">
            {service.url}
          </span>
        </div>

        {/* Namespace tag for K8s services */}
        {service.namespace && (
          <div className="mt-2 text-[10px] text-space-text-muted font-mono opacity-60">
            ns/{service.namespace}
          </div>
        )}

        {/* Container ID tag for Docker services */}
        {service.containerId && (
          <div className="mt-2 text-[10px] text-space-text-muted font-mono opacity-60">
            {service.containerId}
          </div>
        )}

        {/* Hover Accent */}
        <div className={`
          absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg
          ${isPerihelion
            ? 'bg-gradient-to-r from-perihelion-primary to-perihelion-secondary'
            : 'bg-gradient-to-r from-aphelion-primary to-aphelion-secondary'
          }
          opacity-0 group-hover:opacity-100 transition-opacity duration-300
        `} />
      </div>
    </motion.a>
  );
}

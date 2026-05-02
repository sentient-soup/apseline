import { ServiceCard } from './ServiceCard';
import type { Service } from '@apseline/shared';

interface ServiceGridProps {
  services: Service[];
  infrastructure: 'perihelion' | 'aphelion';
}

export function ServiceGrid({ services, infrastructure }: ServiceGridProps) {
  const filteredServices = services.filter(s => s.infrastructure === infrastructure);

  if (filteredServices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-space-text-secondary">
          No services configured for {infrastructure === 'perihelion' ? 'Perihelion (Homelab)' : 'Aphelion (Cloud)'}
        </p>
        <p className="text-space-text-muted text-sm mt-2">
          Edit config.yaml to add services
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredServices.map((service, index) => (
        <ServiceCard key={`${service.name}-${service.url}`} service={service} index={index} />
      ))}
    </div>
  );
}

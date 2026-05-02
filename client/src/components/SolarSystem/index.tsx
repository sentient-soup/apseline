import { useState, useEffect } from 'react';
import { useViewStore, type View } from '../../stores/viewStore';
import { useServicesStore } from '../../stores/servicesStore';
import { Camera } from './Camera';
import { Star } from './Star';
import { Orbit } from './Orbit';
import { Planet } from './Planet';
import { OuterPlanet } from './Planet/OuterPlanet';
import { Satellites, distributeSatellites } from './Planet/Satellites';
import { Brackets } from './Chrome/Brackets';
import { Header } from './Chrome/Header';
import { Telemetry } from './Chrome/Telemetry';
import { UtilityDock, type UtilityItemId } from './Chrome/UtilityDock';
import { ServiceModal } from './ServiceModal';
import { SatelliteHighlight } from './ServiceModal/SatelliteHighlight';
import { SettingsPanel } from './Settings/SettingsPanel';
import { NODES, VIEWBOX_W, VIEWBOX_H, findNode } from './layout';
import { ZOOM_IN_DURATION_MS, SWOOP_DURATION_MS, SATELLITE_FADE_MS } from '../../lib/transitions';

function useSatelliteFade(view: View, transitionId: number) {
  const [op, setOp] = useState(view.kind === 'planet' || view.kind === 'service' ? 1 : 0);
  useEffect(() => {
    if (view.kind === 'system') { setOp(0); return; }
    const total = view.kind === 'planet' ? ZOOM_IN_DURATION_MS : SWOOP_DURATION_MS;
    const fadeStart = total - SATELLITE_FADE_MS;
    setOp(0);
    let raf = 0;
    const t1 = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / SATELLITE_FADE_MS);
        setOp(t);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, fadeStart);
    return () => { clearTimeout(t1); cancelAnimationFrame(raf); };
  }, [transitionId, view.kind]);
  return op;
}

export function SolarSystem() {
  const { view, transitionId, navigate, openService } = useViewStore();
  const services = useServicesStore((s) => s.services);
  const satOpacity = useSatelliteFade(view, transitionId);
  const [openPanel, setOpenPanel] = useState<UtilityItemId | null>(null);

  const activeNodeId = view.kind === 'planet' || view.kind === 'service' ? view.nodeId : null;
  const activeNode = activeNodeId ? findNode(activeNodeId) : null;

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--color-bg)' }}>
      <svg viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <Camera view={view} transitionId={transitionId}>
          <Orbit which="inner" />
          <Orbit which="middle" />
          <Orbit which="outer" />
          <Star />
          {NODES.filter(n => n.kind === 'primary').map(n => (
            <Planet key={n.id}
              x={n.position.x} y={n.position.y}
              colorVar={n.colorVar}
              radius={n.id === 'aphelion' ? 20 : 16}
              hintSatellites={view.kind === 'system'}
              onClick={() => navigate({ kind: 'planet', nodeId: n.id })}
            />
          ))}
          {NODES.filter(n => n.kind === 'outer').map(n => (
            <OuterPlanet key={n.id}
              x={n.position.x} y={n.position.y}
              colorVar={n.colorVar} label={n.label}
              onClick={() => navigate({ kind: 'planet', nodeId: n.id })}
            />
          ))}
          {activeNode && (
            <g transform={`translate(${activeNode.position.x} ${activeNode.position.y})`}>
              <Satellites
                services={services.filter(s => s.infrastructure === activeNode.id)}
                colorVar={activeNode.colorVar}
                opacity={satOpacity}
                onSelect={openService}
              />
            </g>
          )}
        </Camera>

        <Brackets />
        <Header view={view} />
        <Telemetry serviceCount={services.length} />
        <UtilityDock alertCount={0} onItem={(id) => setOpenPanel(id)} />

        {view.kind === 'service' && activeNode && (() => {
          const list = services.filter(s => s.infrastructure === view.nodeId);
          const slot = distributeSatellites(list).find(s => s.service.name === view.serviceId);
          return (
            <>
              <rect x={0} y={0} width={VIEWBOX_W} height={VIEWBOX_H} fill="rgba(10,10,20,0.55)" pointerEvents="none" />
              {slot && (
                <g transform={`translate(${activeNode.position.x} ${activeNode.position.y})`}>
                  <SatelliteHighlight x={slot.x} y={slot.y} colorVar={activeNode.colorVar} />
                </g>
              )}
            </>
          );
        })()}
      </svg>

      {view.kind === 'service' && (
        <ServiceModal nodeId={view.nodeId} serviceId={view.serviceId} services={services} />
      )}
      <SettingsPanel open={openPanel === 'settings'} onClose={() => setOpenPanel(null)} />
    </div>
  );
}

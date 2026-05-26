import { useState, useEffect, useRef } from 'react';
import { useViewStore, type View } from '../../stores/viewStore';
import { useServicesStore } from '../../stores/servicesStore';
import { Camera } from './Camera';
import { Star } from './Star';
import { Orbit } from './Orbit';
import { Planet } from './Planet';
import { OuterPlanet } from './Planet/OuterPlanet';
import { PlanetDot } from './Planet/PlanetDot';
import { Satellites, distributeSatellites } from './Planet/Satellites';
import { Brackets } from './Chrome/Brackets';
import { Header } from './Chrome/Header';
import { Telemetry } from './Chrome/Telemetry';
import { UtilityDock, type UtilityItemId } from './Chrome/UtilityDock';
import { ServiceModal } from './ServiceModal';
import { SatelliteHighlight } from './ServiceModal/SatelliteHighlight';
import { SettingsPanel } from './Settings/SettingsPanel';
import { AlertsPanel } from './Chrome/AlertsPanel';
import { LogsPanel } from './Chrome/LogsPanel';
import { DiscoveryPanel } from './Chrome/DiscoveryPanel';
import { NODES, VIEWBOX_W, VIEWBOX_H, findNode } from './layout';
import { ZOOM_IN_DURATION_MS, SWOOP_DURATION_MS, SATELLITE_FADE_MS } from '../../lib/transitions';

// True only after the camera animation to the focused planet has finished.
// Prevents rendering the thin-stroked wireframe during the zoom (which the
// browser bitmap-caches and blurs during transform animation).
function useFocusArrived(view: View) {
  const focusNodeId = view.kind === 'system' ? null : view.nodeId;
  const [arrived, setArrived] = useState(focusNodeId !== null);
  const lastFocusRef = useRef<string | null>(focusNodeId);
  useEffect(() => {
    if (lastFocusRef.current === focusNodeId) return;
    const prev = lastFocusRef.current;
    lastFocusRef.current = focusNodeId;
    if (focusNodeId === null) { setArrived(false); return; }
    const total = prev === null ? ZOOM_IN_DURATION_MS : SWOOP_DURATION_MS;
    setArrived(false);
    const t = setTimeout(() => setArrived(true), total);
    return () => clearTimeout(t);
  }, [focusNodeId]);
  return arrived;
}

function useSatelliteFade(view: View) {
  const focusNodeId = view.kind === 'system' ? null : view.nodeId;
  const [op, setOp] = useState(focusNodeId ? 1 : 0);
  const lastFocusRef = useRef<string | null>(focusNodeId);
  useEffect(() => {
    if (lastFocusRef.current === focusNodeId) return;
    const prevFocus = lastFocusRef.current;
    lastFocusRef.current = focusNodeId;
    if (focusNodeId === null) { setOp(0); return; }
    const total = prevFocus === null ? ZOOM_IN_DURATION_MS : SWOOP_DURATION_MS;
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
  }, [focusNodeId]);
  return op;
}

export function SolarSystem() {
  const { view, transitionId, navigate, openService } = useViewStore();
  const services = useServicesStore((s) => s.services);
  const health = useServicesStore((s) => s.health);
  const satOpacity = useSatelliteFade(view);
  const focusArrived = useFocusArrived(view);
  const [openPanel, setOpenPanel] = useState<UtilityItemId | null>(null);

  // Alert count = anything not "up" or "unknown" in the health map.
  const alertCount = Object.values(health).filter(
    (h) => h.state === 'down' || h.state === 'degraded',
  ).length;

  const activeNodeId = view.kind === 'planet' || view.kind === 'service' ? view.nodeId : null;
  const activeNode = activeNodeId ? findNode(activeNodeId) : null;

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--color-bg)' }}>
      <svg viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shapeRendering="geometricPrecision">
        <Camera view={view} transitionId={transitionId}>
          <Orbit which="inner" />
          <Orbit which="middle" />
          <Orbit which="outer" />
          <Orbit which="outer2" />
          <Star />
          {NODES.map(n => {
            const isFocus = n.id === activeNodeId;
            if (isFocus && focusArrived) {
              return n.kind === 'primary' ? (
                <Planet key={n.id}
                  x={n.position.x} y={n.position.y}
                  colorVar={n.colorVar}
                  radius={n.id === 'aphelion' ? 1.33 : 1.07}
                  onClick={() => navigate({ kind: 'planet', nodeId: n.id })}
                />
              ) : (
                <OuterPlanet key={n.id}
                  x={n.position.x} y={n.position.y}
                  colorVar={n.colorVar} label={n.label}
                  onClick={() => navigate({ kind: 'planet', nodeId: n.id })}
                />
              );
            }
            if (isFocus) {
              // In flight: render a simple filled disc at the wireframe radius.
              // No thin strokes → no rasterization blur during the zoom.
              const r = n.kind === 'primary' ? (n.id === 'aphelion' ? 1.33 : 1.07) : 0.67;
              return (
                <circle key={n.id}
                  cx={n.position.x} cy={n.position.y} r={r}
                  fill={`var(--${n.colorVar})`}
                />
              );
            }
            return (
              <PlanetDot key={n.id}
                x={n.position.x} y={n.position.y}
                colorVar={n.colorVar} label={n.label} sublabel={n.sublabel}
                size={n.kind === 'primary' ? 'primary' : 'outer'}
                onClick={() => navigate({ kind: 'planet', nodeId: n.id })}
              />
            );
          })}
          {activeNode && (
            <g transform={`translate(${activeNode.position.x} ${activeNode.position.y})`}>
              <Satellites
                services={services.filter(s => s.infrastructure === activeNode.id)}
                colorVar={activeNode.colorVar}
                opacity={satOpacity}
                onSelect={openService}
              />
              {view.kind === 'service' && (() => {
                const list = services.filter(s => s.infrastructure === view.nodeId);
                const slot = distributeSatellites(list).find(s => s.service.name === view.serviceId);
                return slot ? (
                  <SatelliteHighlight x={slot.x} y={slot.y} colorVar={activeNode.colorVar} />
                ) : null;
              })()}
            </g>
          )}
        </Camera>

        <Brackets />
        <Header view={view} />
        <Telemetry />
        <UtilityDock alertCount={alertCount} onItem={(id) => setOpenPanel(id)} />

      </svg>

      {view.kind === 'service' && (
        <ServiceModal nodeId={view.nodeId} serviceId={view.serviceId} services={services} />
      )}
      <SettingsPanel open={openPanel === 'settings'} onClose={() => setOpenPanel(null)} />
      <AlertsPanel open={openPanel === 'alerts'} onClose={() => setOpenPanel(null)} />
      <LogsPanel open={openPanel === 'logs'} onClose={() => setOpenPanel(null)} />
      <DiscoveryPanel open={openPanel === 'discovery'} onClose={() => setOpenPanel(null)} />
    </div>
  );
}

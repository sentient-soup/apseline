import { readFileSync, watch, type FSWatcher } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';
import type { DashboardConfig } from '@apseline/shared';

let cachedConfig: DashboardConfig | null = null;
let watcher: FSWatcher | null = null;
let changeListeners: Array<(config: DashboardConfig) => void> = [];

const configPath = process.env.CONFIG_PATH || join(process.cwd(), '../config.yaml');

export function loadConfig(): DashboardConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const fileContent = readFileSync(configPath, 'utf8');
    const config = parse(fileContent);

    const dashboardConfig: DashboardConfig = {
      title: config.dashboard?.title || 'Apseline',
      refreshInterval: config.dashboard?.refreshInterval || 30,
      integrations: config.integrations || {},
      nodes: config.nodes || undefined,
      perihelion: (config.perihelion || []).map((service: any) => ({
        ...service,
        infrastructure: 'perihelion' as const,
      })),
      aphelion: (config.aphelion || []).map((service: any) => ({
        ...service,
        infrastructure: 'aphelion' as const,
      })),
    };

    cachedConfig = dashboardConfig;
    return dashboardConfig;
  } catch (error) {
    console.error('Failed to load config.yaml:', error);
    return {
      title: 'Apseline',
      refreshInterval: 30,
      perihelion: [],
      aphelion: [],
    };
  }
}

export function clearConfigCache() {
  cachedConfig = null;
}

export function onConfigChange(listener: (config: DashboardConfig) => void) {
  changeListeners.push(listener);
  return () => {
    changeListeners = changeListeners.filter(l => l !== listener);
  };
}

export function watchConfig() {
  if (watcher) return;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    watcher = watch(configPath, (event) => {
      if (event !== 'change') return;

      // Debounce — editors often fire multiple events per save
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[Config] config.yaml changed, reloading...');
        cachedConfig = null;
        const newConfig = loadConfig();
        for (const listener of changeListeners) {
          listener(newConfig);
        }
      }, 200);
    });

    console.log(`[Config] Watching ${configPath} for changes`);
  } catch (error) {
    console.warn('[Config] Could not watch config.yaml:', (error as Error).message);
  }
}

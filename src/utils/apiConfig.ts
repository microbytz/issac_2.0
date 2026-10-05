import { Capacitor } from '@capacitor/core';

// The default deployed backend URL for the AI Studio build
export const DEFAULT_REMOTE_BACKEND_URL = 'https://ais-dev-6rlgdc7uzc7t3irpj5ndi4-163850775682.asia-east1.run.app';

/**
 * Checks if the app is currently running in a native mobile container (Capacitor Android/iOS)
 * or a local WebView that does not have the local Node.js Express server running.
 */
export function isMobileOrNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  // 1. Capacitor native check
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch (_) {}

  // 2. Protocol check for Capacitor or Cordova
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:' || window.location.protocol === 'content:') {
    return true;
  }

  // 3. Android WebView file or localhost with no port (Capacitor androidScheme: 'https' maps to https://localhost)
  if (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '5173') {
    return true;
  }

  return false;
}

/**
 * Retrieves the custom server URL configured by the user in Settings.
 */
export function getCustomServerUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('isaac_server_url') || '';
}

/**
 * Saves or clears the custom server URL in localStorage.
 */
export function setCustomServerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/$/, '');
  if (!clean) {
    localStorage.removeItem('isaac_server_url');
  } else {
    localStorage.setItem('isaac_server_url', clean);
  }
}

/**
 * Returns the effective base URL for all /api endpoints.
 * In desktop browser preview, returns '' so relative requests are used.
 * In native mobile app or standalone WebView, returns the cloud server URL or custom server URL.
 */
export function getBackendBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. User manual override from Settings
  const custom = getCustomServerUrl();
  if (custom) return custom;

  // 2. Vite environment variable if injected
  const envUrl = (import.meta as any).env?.VITE_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
    return envUrl.replace(/\/$/, '');
  }

  // 3. Native mobile app detection
  if (isMobileOrNativeApp()) {
    return DEFAULT_REMOTE_BACKEND_URL;
  }

  // 4. Default for web browser on the same host
  return '';
}

/**
 * Resolves an endpoint like '/api/search' to its full URL on mobile or relative path on web.
 */
export function apiUrl(endpoint: string): string {
  const base = getBackendBaseUrl();
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${clean}`;
}

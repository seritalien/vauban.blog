'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker for PWA functionality.
 * This component should be included in the root layout.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Only register in production
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PWA] Service worker disabled in development');
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('[PWA] Service worker registered:', registration.scope);

        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available, notify user
                console.log('[PWA] New content available, refresh to update');
                // Could show a toast notification here
              }
            });
          }
        });
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
      }
    };

    // Register after the page loads
    window.addEventListener('load', registerServiceWorker);

    return () => {
      window.removeEventListener('load', registerServiceWorker);
    };
  }, []);

  return null;
}

export default ServiceWorkerRegistration;

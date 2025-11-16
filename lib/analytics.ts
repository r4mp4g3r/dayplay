// Analytics stub - PostHog removed for web compatibility
// Replace with web-compatible analytics later if needed

export function initAnalytics() {
  console.log('[Analytics] Initialized (console logging only)');
}

export function capture(event: string, properties?: Record<string, unknown>) {
  console.log('[Analytics]', event, properties);
}



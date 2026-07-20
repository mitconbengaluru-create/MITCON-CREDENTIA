import env from './env.js';

export const cacheConfig = {
  enabled: env.REDIS_ENABLED,
  // Cache TTLs in seconds
  ttls: {
    dashboardMetrics: 300, // 5 minutes
    userPermissions: 3600, // 1 hour
    systemSettings: 86400, // 24 hours
    reportSummaries: 600, // 10 minutes
    frequentlyAccessedMetadata: 1800, // 30 minutes
  },
  // Redis prefix keys namespaces
  prefixes: {
    dashboard: 'cache:dashboard:',
    permissions: 'cache:permissions:',
    settings: 'cache:settings:',
    reports: 'cache:reports:',
    metadata: 'cache:metadata:',
  },
};

export default cacheConfig;

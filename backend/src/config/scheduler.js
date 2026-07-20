import env from './env.js';
import bullmqConfig from './bullmq.js';

export const schedulerConfig = {
  queueName: bullmqConfig.queueConfigs.scheduler.name,
  defaultJobOptions: bullmqConfig.defaultJobOptions,
  // Define execution windows or fallback timezones
  defaultTimezone: 'UTC',
  // Max retries for automated reports
  retryCount: 3,
  retryDelayMs: 60000, // 1 minute retry delay
};

export default schedulerConfig;

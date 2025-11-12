import { defineFunction } from '@aws-amplify/backend'

export const streamHealthMonitor = defineFunction({
  name: 'stream-health-monitor',
  entry: './handler.ts',
  timeoutSeconds: 60,
  environment: {
    EC2_INSTANCE_ID: '',
    SNS_ALERT_TOPIC: '',
    HEALTH_LOG_TABLE: ''
  }
})

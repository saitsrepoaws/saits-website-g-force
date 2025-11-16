import { defineFunction } from '@aws-amplify/backend'

export const securityLogAnalyzer = defineFunction({
  name: 'security-log-analyzer',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes
  memoryMB: 1024
})

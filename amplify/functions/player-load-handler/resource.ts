import { defineFunction } from '@aws-amplify/backend'

export const playerLoadHandler = defineFunction({
  name: 'player-load-handler',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20,
  bundling: {
    externalModules: [], // Bundle ALL modules including AWS SDK
    nodeModules: [
      '@aws-sdk/signature-v4',
      '@aws-sdk/protocol-http',
      '@aws-sdk/credential-provider-node',
      '@aws-crypto/sha256-js'
    ]
  }
})

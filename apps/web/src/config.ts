export const FEATURE_FLAGS = {
  pubsub: (import.meta as any).env?.VITE_ENABLE_PUBSUB === 'true',
} as const

export const DEFAULTS = {
  topic: 'iot/demo/topic',
} as const

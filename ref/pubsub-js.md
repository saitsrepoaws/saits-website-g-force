# Amplify JS v6 PubSub

- Getting Started (JS): https://docs.amplify.aws/lib/pubsub/getting-started/q/platform/js/

## Notes
- Ensure `aws-amplify` and `@aws-amplify/pubsub` versions match.
- MQTT over WebSocket via AWS IoT is supported.
- Typically, endpoint and credentials are derived from Amplify outputs (avoid hardcoding keys in client).

## Basic API
```ts
import { PubSub } from 'aws-amplify'

// Subscribe
const sub = PubSub.subscribe({ topics: ["my/topic"] }).subscribe({
  next: (data) => console.log('msg', data),
  error: (err) => console.error(err),
  complete: () => console.log('done'),
})

// Publish
await PubSub.publish({ topics: ["my/topic"], message: { hello: 'world' } })
```

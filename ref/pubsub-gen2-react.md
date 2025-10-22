# PubSub (Gen 2) in React

- Gen 2 PubSub (React): https://docs.amplify.aws/react/build-a-backend/add-aws-services/pubsub/set-up-pubsub/
- Vue variant (similar steps): https://docs.amplify.aws/vue/build-a-backend/add-aws-services/pubsub/set-up-pubsub/

## Key Steps
1. Provision Cognito Identity Pool (unauth or auth) via Gen 2 backend.
2. Create AWS IoT policy to allow connect/subscribe/publish/receive for your MQTT topics.
3. Attach the policy to the Cognito Identity role used by your client.
4. Determine your IoT endpoint (Settings in AWS IoT Core console).
5. Configure client with Amplify outputs; then use `PubSub` to subscribe/publish.

## Client patterns
- Subscribe: `PubSub.subscribe({ topics: ["topic/name"] }).subscribe({ next, error })`
- Publish: `PubSub.publish({ topics: ["topic/name"], message })`

## Tips
- Use a feature toggle to avoid runtime errors before outputs are available.
- Keep topic names consistent; narrow permissions to least privilege.

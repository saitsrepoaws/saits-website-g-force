# AWS IoT Core MQTT Policy Examples

- Policy docs: https://docs.aws.amazon.com/iot/latest/developerguide/pub-sub-policy.html

## Example (WebSocket with Cognito)
Replace `<region>`, `<account-id>`, `<identity-id>`, and topic as needed.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:Connect"
      ],
      "Resource": [
        "arn:aws:iot:<region>:<account-id>:client/${cognito-identity.amazonaws.com:sub}"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Subscribe"
      ],
      "Resource": [
        "arn:aws:iot:<region>:<account-id>:topicfilter/iot/demo/topic"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Publish",
        "iot:Receive"
      ],
      "Resource": [
        "arn:aws:iot:<region>:<account-id>:topic/iot/demo/topic"
      ]
    }
  ]
}
```

## Tips
- Lock down to specific topics or prefixes (e.g., `topicprefix/user/${identity}`).
- Ensure the policy is attached to the Cognito Identity role assumed by your app users.

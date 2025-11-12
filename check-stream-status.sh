#!/bin/bash
# Complete Stream Status Check

echo "🎵 G-Forge Radio Stream Status Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Check SQS Queue
echo "📬 1. SQS Queue Status:"
QUEUE_URL=$(aws sqs list-queues --region eu-west-1 --query "QueueUrls[?contains(@, 'radio-track-stream-queue')]" --output text)
if [ -n "$QUEUE_URL" ]; then
  echo "   ✅ Queue found: $QUEUE_URL"
  echo ""
  echo "   Messages in queue:"
  aws sqs get-queue-attributes \
    --region eu-west-1 \
    --queue-url "$QUEUE_URL" \
    --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
    --query "Attributes.{Available:ApproximateNumberOfMessages,InFlight:ApproximateNumberOfMessagesNotVisible}" \
    --output table
else
  echo "   ❌ Queue not found"
fi

echo ""

# 2. Check EC2 Instance
echo "📟 2. EC2 Stream Server:"
INSTANCE_ID=$(aws ec2 describe-instances --region eu-west-1 \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[?Tags[?Key=='Name' && contains(Value, 'StreamServer')]].[InstanceId]" \
  --output text)

if [ -n "$INSTANCE_ID" ]; then
  echo "   ✅ Instance ID: $INSTANCE_ID"
  echo ""
  aws ec2 describe-instances --region eu-west-1 --instance-ids $INSTANCE_ID \
    --query "Reservations[0].Instances[0].{IP:PublicIpAddress,State:State.Name,LaunchTime:LaunchTime,Type:InstanceType}" \
    --output table
else
  echo "   ❌ No running instance found"
fi

echo ""

# 3. Check Lambda Function
echo "⚡ 3. Lambda Stream Playlist Updater:"
LAMBDA_NAME=$(aws lambda list-functions --region eu-west-1 \
  --query "Functions[?contains(FunctionName, 'streamplaylistupdater')].FunctionName" \
  --output text)

if [ -n "$LAMBDA_NAME" ]; then
  echo "   ✅ Function: $LAMBDA_NAME"
  echo ""
  echo "   Recent logs (last 10 minutes):"
  aws logs tail "/aws/lambda/$LAMBDA_NAME" --region eu-west-1 --since 10m --format short 2>/dev/null | tail -20
else
  echo "   ❌ Lambda not found"
fi

echo ""

# 4. Test Stream Endpoints
echo "🌐 4. Stream Endpoints:"
echo "   Port 80 (nginx): $(curl -s -o /dev/null -w '%{http_code}' http://46.137.184.91/)"
echo "   Port 8000 (icecast): $(curl -s -o /dev/null -w '%{http_code}' http://46.137.184.91:8000/ 2>/dev/null || echo 'unreachable')"
echo "   Stream: $(curl -s -o /dev/null -w '%{http_code}' http://46.137.184.91/stream.mp3)"

echo ""

# 5. SSM Connection Info
if [ -n "$INSTANCE_ID" ]; then
  echo "🔗 5. Connect to EC2 via SSM:"
  echo "   aws ssm start-session --region eu-west-1 --target $INSTANCE_ID"
  echo ""
  echo "   Once connected, check services:"
  echo "   sudo systemctl status icecast2"
  echo "   sudo systemctl status liquidsoap-radio"
  echo "   sudo tail -f /var/log/cloud-init-output.log"
fi

echo ""
echo "✅ Status check complete!"

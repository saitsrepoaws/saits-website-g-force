#!/bin/bash

echo "🚀 DEPLOYING SQS LIQUIDSOAP CONFIG TO EC2"
echo ""

# Step 1: Upload config
echo "📤 Step 1: Uploading config..."
scp liquidsoap-sqs-hybrid-PRODUCTION.liq radio-ec2:/tmp/radio-sqs.liq
if [ $? -ne 0 ]; then
  echo "❌ Upload failed!"
  exit 1
fi
echo "✅ Config uploaded"
echo ""

# Step 2: Move to correct location
echo "📁 Step 2: Moving to /opt/radio..."
ssh radio-ec2 "sudo mv /tmp/radio-sqs.liq /opt/radio/radio-sqs.liq && sudo chmod +x /opt/radio/radio-sqs.liq"
echo "✅ Config moved"
echo ""

# Step 3: Stop old Liquidsoap
echo "🛑 Step 3: Stopping old Liquidsoap..."
ssh radio-ec2 "sudo pkill -f liquidsoap"
sleep 2
echo "✅ Old process stopped"
echo ""

# Step 4: Start new Liquidsoap
echo "🚀 Step 4: Starting SQS Liquidsoap..."
ssh radio-ec2 "nohup sudo liquidsoap /opt/radio/radio-sqs.liq > /var/log/liquidsoap.log 2>&1 &"
sleep 4
echo "✅ New process started"
echo ""

# Step 5: Verify
echo "🔍 Step 5: Verifying..."
ssh radio-ec2 "ps aux | grep liquidsoap | grep -v grep"
echo ""

# Step 6: Check logs
echo "📋 Step 6: Checking logs (first 30 lines)..."
ssh radio-ec2 "tail -30 /var/log/liquidsoap.log"
echo ""

echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "🎧 Stream URLs:"
echo "   Raw: http://46.137.184.91:8000/stream-raw.mp3"
echo "   Main: http://46.137.184.91:8000/stream.mp3"
echo "   Processed: http://46.137.184.91:8000/stream-processed.mp3"
echo ""
echo "🎚️ Stereo Tools: http://46.137.184.91:9001"

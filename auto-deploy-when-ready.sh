#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║     🤖 AUTO-DEPLOY MONITOR                                          ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Monitoring stack deletion..."
echo "Will auto-deploy to 'gerard' when ready!"
echo ""

STACK_NAME="amplify-gforgeiot-gerard-sandbox-28f2e0c620"
MAX_ATTEMPTS=60  # 60 attempts * 10 seconds = 10 minutes max
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  
  echo -n "[$ATTEMPT/$MAX_ATTEMPTS] Checking... "
  
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region eu-west-1 \
    --query 'Stacks[0].StackStatus' \
    --output text 2>&1)
  
  if echo "$STATUS" | grep -q "does not exist"; then
    echo "STACK DELETED!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 STARTING DEPLOYMENT TO 'GERARD' STACK!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Time: $(date +"%H:%M:%S")"
    echo "Log: /tmp/amplify-gerard-FINAL-deployment.log"
    echo ""
    
    # Start deployment
    cd /Users/gerard/Desktop/T7/g-forge-iot
    pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --identifier gerard > /tmp/amplify-gerard-FINAL-deployment.log 2>&1 &
    
    DEPLOY_PID=$!
    echo "✅ Deployment started! PID: $DEPLOY_PID"
    echo ""
    echo "Monitoring first 30 seconds..."
    sleep 30
    
    if ps -p $DEPLOY_PID > /dev/null 2>&1; then
      echo ""
      echo "✅ Process running! Showing progress:"
      echo ""
      tail -40 /tmp/amplify-gerard-FINAL-deployment.log
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "✅ DEPLOYMENT IN PROGRESS!"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
      echo "Monitor with:"
      echo "  tail -f /tmp/amplify-gerard-FINAL-deployment.log"
      echo ""
      exit 0
    else
      echo ""
      echo "❌ Process died immediately!"
      echo ""
      cat /tmp/amplify-gerard-FINAL-deployment.log
      exit 1
    fi
  fi
  
  echo "Still deleting ($(echo "$STATUS" | xargs))"
  sleep 10
done

echo ""
echo "⚠️  Timeout after $MAX_ATTEMPTS attempts"
echo "Stack still not deleted. Check manually:"
echo "  aws cloudformation describe-stacks --stack-name $STACK_NAME --region eu-west-1"
echo ""
exit 1

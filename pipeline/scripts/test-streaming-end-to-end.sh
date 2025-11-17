#!/bin/bash
##############################################
# G-FORGE RADIO - END-TO-END STREAMING TEST
# 
# Complete streaming pipeline test:
# SQS → Lambda → S3 → EC2 → Liquidsoap → Icecast → Nginx → CloudFront → User
##############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
INSTANCE_ID="${1:-i-054754fbca0bda346}"
REGION="eu-west-1"
SQS_QUEUE_URL="https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎵 END-TO-END STREAMING TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

test_pass() { echo -e "${GREEN}✅ $1${NC}"; ((TESTS_PASSED++)); }
test_fail() { echo -e "${RED}❌ $1${NC}"; ((TESTS_FAILED++)); }

# =============================================================================
# TEST 1: SQS QUEUE
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📬 TEST 1: SQS QUEUE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Checking queue status..."
QUEUE_MESSAGES=$(aws sqs get-queue-attributes \
  --queue-url $SQS_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages \
  --region $REGION \
  --query 'Attributes.ApproximateNumberOfMessages' \
  --output text 2>/dev/null || echo "ERROR")

if [ "$QUEUE_MESSAGES" == "ERROR" ]; then
    test_fail "Cannot access SQS queue"
else
    echo "Messages in queue: $QUEUE_MESSAGES"
    if [ "$QUEUE_MESSAGES" -gt 0 ]; then
        test_pass "Queue has messages ($QUEUE_MESSAGES)"
    else
        test_fail "Queue is empty - no tracks to stream"
    fi
fi

echo ""

# =============================================================================
# TEST 2: LIQUIDSOAP
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎧 TEST 2: LIQUIDSOAP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Liquidsoap process
SSM_CMD=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --comment "Check Liquidsoap" \
  --parameters 'commands=["pgrep -f liquidsoap > /dev/null && echo RUNNING || echo STOPPED","ps aux | grep liquidsoap | grep -v grep | head -1 | awk {print $3,$4}"]' \
  --region $REGION \
  --output text \
  --query 'Command.CommandId' 2>/dev/null)

sleep 5

RESULT=$(aws ssm get-command-invocation \
  --command-id $SSM_CMD \
  --instance-id $INSTANCE_ID \
  --region $REGION \
  --query 'StandardOutputContent' \
  --output text 2>/dev/null)

if echo "$RESULT" | grep -q "RUNNING"; then
    CPU_MEM=$(echo "$RESULT" | tail -1)
    test_pass "Liquidsoap running (CPU/MEM: $CPU_MEM%)"
else
    test_fail "Liquidsoap not running"
fi

echo ""

# =============================================================================
# TEST 3: ICECAST
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 TEST 3: ICECAST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Icecast status
SSM_CMD=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --comment "Check Icecast" \
  --parameters 'commands=["curl -s http://localhost:8000/status-json.xsl | python3 -c \"import sys,json; data=json.load(sys.stdin); source=data.get('icestats',{}).get('source',{}); print(source.get('server_name',''),source.get('bitrate',''),source.get('listeners',''),source.get('title',''))\""]' \
  --region $REGION \
  --output text \
  --query 'Command.CommandId' 2>/dev/null)

sleep 5

RESULT=$(aws ssm get-command-invocation \
  --command-id $SSM_CMD \
  --instance-id $INSTANCE_ID \
  --region $REGION \
  --query 'StandardOutputContent' \
  --output text 2>/dev/null)

if [ -n "$RESULT" ] && [ "$RESULT" != " " ]; then
    test_pass "Icecast streaming: $RESULT"
else
    test_fail "Icecast not streaming"
fi

echo ""

# =============================================================================
# TEST 4: NGINX PROXY
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 TEST 4: NGINX PROXY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get EC2 public IP
PUBLIC_IP=$(aws ssm get-parameter \
  --name "/gforge-radio/ec2/public-ip" \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text 2>/dev/null || echo "")

if [ -z "$PUBLIC_IP" ]; then
    test_fail "Cannot get public IP from Parameter Store"
else
    echo "Public IP: $PUBLIC_IP"
    
    # Test /stream.mp3 endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$PUBLIC_IP/stream.mp3 2>/dev/null || echo "000")
    
    case "$HTTP_CODE" in
        200) test_pass "Nginx proxy working (HTTP 200)" ;;
        404) test_fail "Endpoint not found (HTTP 404)" ;;
        400) test_fail "Bad request (HTTP 400) - Check Nginx config" ;;
        502) test_fail "Bad gateway (HTTP 502) - Icecast down?" ;;
        *) test_fail "Unexpected status: HTTP $HTTP_CODE" ;;
    esac
fi

echo ""

# =============================================================================
# TEST 5: DNS
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 TEST 5: DNS RESOLUTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DNS_IP=$(dig +short stream.g-force.cloud 2>/dev/null | head -1)

if [ -n "$DNS_IP" ]; then
    if [ "$DNS_IP" == "$PUBLIC_IP" ]; then
        test_pass "DNS resolves correctly to $DNS_IP"
    else
        test_fail "DNS mismatch: $DNS_IP != $PUBLIC_IP"
    fi
else
    test_fail "DNS does not resolve"
fi

echo ""

# =============================================================================
# TEST 6: CLOUDFRONT
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "☁️  TEST 6: CLOUDFRONT DELIVERY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CF_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://splashfm.nl/splashfm.mp3 2>/dev/null || echo "000")

case "$CF_CODE" in
    200) test_pass "CloudFront delivering stream (HTTP 200)" ;;
    504) test_fail "Gateway timeout (HTTP 504) - Origin issue" ;;
    502) test_fail "Bad gateway (HTTP 502)" ;;
    403) test_fail "Forbidden (HTTP 403)" ;;
    *) test_fail "Unexpected status: HTTP $CF_CODE" ;;
esac

echo ""

# =============================================================================
# TEST 7: STREAM QUALITY
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎼 TEST 7: STREAM QUALITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Download first 1MB of stream and check
echo "Testing stream download..."
timeout 5 curl -s http://$PUBLIC_IP:8000/stream.mp3 2>/dev/null | head -c 1000000 > /tmp/stream-test.mp3 || true

if [ -f /tmp/stream-test.mp3 ] && [ -s /tmp/stream-test.mp3 ]; then
    SIZE=$(wc -c < /tmp/stream-test.mp3)
    if [ $SIZE -gt 100000 ]; then
        test_pass "Stream downloading ($SIZE bytes received)"
    else
        test_fail "Stream too small ($SIZE bytes)"
    fi
    rm -f /tmp/stream-test.mp3
else
    test_fail "Cannot download stream"
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=$((TESTS_PASSED + TESTS_FAILED))
PASS_RATE=$((TESTS_PASSED * 100 / TOTAL))

echo -e "${GREEN}✅ Passed: $TESTS_PASSED/$TOTAL${NC}"
echo -e "${RED}❌ Failed: $TESTS_FAILED/$TOTAL${NC}"
echo "Pass Rate: $PASS_RATE%"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL STREAMING TESTS PASSED!${NC}"
    echo ""
    echo "🎉 Stream is fully functional end-to-end!"
    EXIT_CODE=0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "🔧 Issues detected in the streaming pipeline."
    echo "   Review failed tests above for details."
    EXIT_CODE=1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $EXIT_CODE

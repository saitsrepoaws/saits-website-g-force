#!/bin/bash
##############################################
# G-FORGE RADIO - AUTOMATED SYSTEM AUDIT
# 
# Complete system health check for deployment testing
# Can be run post-deployment to verify all components
##############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTANCE_ID="${1:-i-054754fbca0bda346}"
REGION="${2:-eu-west-1}"
LOG_GROUP="/gforge-radio/all-logs"
PARAM_PREFIX="/gforge-radio/ec2"

# Output file
REPORT_FILE="pipeline/docs/SYSTEM_AUDIT_REPORT_$(date +%Y%m%d-%H%M).md"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 G-FORGE RADIO - AUTOMATED SYSTEM AUDIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Instance:  $INSTANCE_ID"
echo "Region:    $REGION"
echo "Report:    $REPORT_FILE"
echo ""

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Helper function
test_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

test_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((TESTS_WARNING++))
}

# =============================================================================
# TEST 1: AWS SERVICES
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST 1: AWS SERVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# GuardDuty
echo -n "GuardDuty: "
DETECTOR=$(aws guardduty list-detectors --region $REGION --query 'DetectorIds[0]' --output text 2>/dev/null)
if [ -n "$DETECTOR" ] && [ "$DETECTOR" != "None" ]; then
    test_pass "Active ($DETECTOR)"
else
    test_fail "Not enabled"
fi

# Security Hub
echo -n "Security Hub: "
aws securityhub describe-hub --region $REGION &>/dev/null
if [ $? -eq 0 ]; then
    test_pass "Enabled"
else
    test_warn "Not enabled or no access"
fi

# CloudWatch Log Group
echo -n "CloudWatch Log Group: "
LOG_GROUP_EXISTS=$(aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region $REGION --query 'logGroups[0].logGroupName' --output text 2>/dev/null)
if [ "$LOG_GROUP_EXISTS" == "$LOG_GROUP" ]; then
    test_pass "Created"
else
    test_fail "Not found"
fi

# SNS Topic
echo -n "SNS Topic: "
SNS_TOPIC=$(aws sns list-topics --region $REGION --query 'Topics[?contains(TopicArn, `gforge-radio-security-alerts`)].TopicArn' --output text 2>/dev/null)
if [ -n "$SNS_TOPIC" ]; then
    test_pass "Created"
else
    test_fail "Not found"
fi

# Parameter Store
echo -n "Parameter Store: "
PARAM_COUNT=$(aws ssm get-parameters-by-path --path "$PARAM_PREFIX" --region $REGION --query 'length(Parameters)' --output text 2>/dev/null)
if [ "$PARAM_COUNT" -ge 9 ]; then
    test_pass "$PARAM_COUNT parameters configured"
elif [ "$PARAM_COUNT" -gt 0 ]; then
    test_warn "$PARAM_COUNT parameters (expected 9)"
else
    test_fail "No parameters found"
fi

echo ""

# =============================================================================
# TEST 2: EC2 SYSTEM CHECK
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🖥️  TEST 2: EC2 SYSTEM CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run system check via SSM
SSM_CMD=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --comment "Automated System Audit" \
  --parameters 'commands=["echo STATUS_CHECK","systemctl is-active liquidsoap 2>/dev/null || pgrep -f liquidsoap > /dev/null && echo liquidsoap=RUNNING || echo liquidsoap=STOPPED","systemctl is-active icecast2 > /dev/null && echo icecast2=RUNNING || echo icecast2=STOPPED","systemctl is-active nginx > /dev/null && echo nginx=RUNNING || echo nginx=STOPPED","df -h /mnt/ramdisk 2>/dev/null | tail -1 | awk {print \"ramdisk=MOUNTED\"} || echo ramdisk=NOT_MOUNTED","sysctl vm.swappiness | awk {print \"swappiness=\" $3}","which rkhunter > /dev/null && echo rkhunter=INSTALLED || echo rkhunter=NOT_INSTALLED","which chkrootkit > /dev/null && echo chkrootkit=INSTALLED || echo chkrootkit=NOT_INSTALLED","curl -s http://localhost:8000/status-json.xsl 2>/dev/null | grep -q stream.mp3 && echo icecast_stream=ACTIVE || echo icecast_stream=INACTIVE"]' \
  --region $REGION \
  --output text \
  --query 'Command.CommandId' 2>/dev/null)

if [ -n "$SSM_CMD" ]; then
    echo "SSM Command: $SSM_CMD"
    echo "Waiting for results..."
    sleep 10
    
    # Get results
    RESULTS=$(aws ssm get-command-invocation \
      --command-id $SSM_CMD \
      --instance-id $INSTANCE_ID \
      --region $REGION \
      --query 'StandardOutputContent' \
      --output text 2>/dev/null)
    
    # Parse results
    echo "$RESULTS" | while read line; do
        case "$line" in
            liquidsoap=RUNNING)     test_pass "Liquidsoap running" ;;
            liquidsoap=STOPPED)     test_fail "Liquidsoap stopped" ;;
            icecast2=RUNNING)       test_pass "Icecast2 running" ;;
            icecast2=STOPPED)       test_fail "Icecast2 stopped" ;;
            nginx=RUNNING)          test_pass "Nginx running" ;;
            nginx=STOPPED)          test_fail "Nginx stopped" ;;
            ramdisk=MOUNTED)        test_pass "RAM disk mounted" ;;
            ramdisk=NOT_MOUNTED)    test_warn "RAM disk not mounted" ;;
            swappiness=10)          test_pass "Swappiness optimized" ;;
            swappiness=*)           test_warn "Swappiness not optimal: $line" ;;
            rkhunter=INSTALLED)     test_pass "rkhunter installed" ;;
            rkhunter=NOT_INSTALLED) test_warn "rkhunter not installed" ;;
            chkrootkit=INSTALLED)   test_pass "chkrootkit installed" ;;
            chkrootkit=NOT_INSTALLED) test_warn "chkrootkit not installed" ;;
            icecast_stream=ACTIVE)  test_pass "Icecast stream active" ;;
            icecast_stream=INACTIVE) test_fail "Icecast stream inactive" ;;
        esac
    done
else
    test_fail "SSM command failed"
fi

echo ""

# =============================================================================
# TEST 3: NETWORK & DNS
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 TEST 3: NETWORK & DNS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# DNS Resolution
echo -n "DNS stream.g-force.cloud: "
DNS_IP=$(dig +short stream.g-force.cloud 2>/dev/null | head -1)
if [ -n "$DNS_IP" ]; then
    test_pass "Resolves to $DNS_IP"
else
    test_fail "Cannot resolve"
fi

# HTTP Connectivity
echo -n "HTTP connectivity: "
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DNS_IP/ 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" == "200" ] || [ "$HTTP_STATUS" == "404" ] || [ "$HTTP_STATUS" == "400" ]; then
    test_pass "Server responding (HTTP $HTTP_STATUS)"
elif [ "$HTTP_STATUS" == "000" ]; then
    test_fail "Cannot connect"
else
    test_warn "Unexpected status: $HTTP_STATUS"
fi

echo ""

# =============================================================================
# TEST 4: STREAMING ACCESS
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎵 TEST 4: STREAMING ACCESS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stream access test
echo -n "Stream /stream.mp3: "
STREAM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DNS_IP/stream.mp3 2>/dev/null || echo "000")
if [ "$STREAM_STATUS" == "200" ]; then
    test_pass "Accessible (HTTP 200)"
elif [ "$STREAM_STATUS" == "404" ]; then
    test_fail "Not found (HTTP 404)"
elif [ "$STREAM_STATUS" == "400" ]; then
    test_fail "Bad request (HTTP 400)"
else
    test_fail "Error (HTTP $STREAM_STATUS)"
fi

# CloudFront test
echo -n "CloudFront: "
CF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://splashfm.nl/splashfm.mp3 2>/dev/null || echo "000")
if [ "$CF_STATUS" == "200" ]; then
    test_pass "Accessible (HTTP 200)"
elif [ "$CF_STATUS" == "504" ]; then
    test_fail "Gateway timeout (HTTP 504)"
else
    test_warn "Status: HTTP $CF_STATUS"
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + TESTS_WARNING))
PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo -e "${GREEN}✅ Passed:  $TESTS_PASSED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $TESTS_WARNING${NC}"
echo -e "${RED}❌ Failed:  $TESTS_FAILED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total:     $TOTAL_TESTS tests"
echo "Pass Rate: $PASS_RATE%"
echo ""

# Final status
if [ $TESTS_FAILED -eq 0 ]; then
    if [ $TESTS_WARNING -eq 0 ]; then
        echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
        EXIT_CODE=0
    else
        echo -e "${YELLOW}⚠️  PASSED WITH WARNINGS${NC}"
        EXIT_CODE=0
    fi
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    EXIT_CODE=1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $EXIT_CODE

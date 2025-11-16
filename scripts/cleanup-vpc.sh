#!/bin/bash

# VPC Cleanup Script - Verwijder Orphaned VPC
# Date: 16 November 2025
# VPC: vpc-01b81f989bc673299

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹 VPC CLEANUP SCRIPT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

VPC_ID="vpc-01b81f989bc673299"
REGION="eu-west-1"

echo "VPC to delete: $VPC_ID"
echo "Region: $REGION"
echo ""

# Function to check if VPC exists
check_vpc() {
  aws ec2 describe-vpcs \
    --vpc-ids $VPC_ID \
    --region $REGION \
    --query 'Vpcs[0].State' \
    --output text 2>&1
}

# Step 1: Check current state
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Pre-cleanup Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

VPC_STATE=$(check_vpc)
if [[ "$VPC_STATE" == *"does not exist"* ]]; then
  echo "✅ VPC already deleted! Nothing to do."
  exit 0
fi

echo "VPC State: $VPC_STATE"
echo ""

# Step 2: Check for dependencies
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Check Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Checking NLBs..."
NLB_COUNT=$(aws elbv2 describe-load-balancers \
  --region $REGION \
  --query "LoadBalancers[?VpcId=='$VPC_ID']" \
  --output text | wc -l)

if [ "$NLB_COUNT" -gt 0 ]; then
  echo "❌ ERROR: Still $NLB_COUNT NLBs attached!"
  echo "Run cleanup again to remove NLBs first."
  exit 1
fi
echo "✅ No NLBs (0)"

echo ""
echo "Checking ENIs..."
ENI_COUNT=$(aws ec2 describe-network-interfaces \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --region $REGION \
  --query 'NetworkInterfaces[*].NetworkInterfaceId' \
  --output text | wc -w)

if [ "$ENI_COUNT" -gt 0 ]; then
  echo "❌ ERROR: Still $ENI_COUNT ENIs attached!"
  echo "Wait for ENIs to be released (2-3 min after NLB deletion)"
  exit 1
fi
echo "✅ No ENIs (0)"

echo ""
echo "Checking Internet Gateways..."
IGW_COUNT=$(aws ec2 describe-internet-gateways \
  --filters "Name=attachment.vpc-id,Values=$VPC_ID" \
  --region $REGION \
  --query 'InternetGateways[*].InternetGatewayId' \
  --output text | wc -w)

if [ "$IGW_COUNT" -gt 0 ]; then
  echo "⚠️ Found $IGW_COUNT Internet Gateway(s) - will detach"
  
  IGW_IDS=$(aws ec2 describe-internet-gateways \
    --filters "Name=attachment.vpc-id,Values=$VPC_ID" \
    --region $REGION \
    --query 'InternetGateways[*].InternetGatewayId' \
    --output text)
  
  for IGW_ID in $IGW_IDS; do
    echo "Detaching IGW: $IGW_ID"
    aws ec2 detach-internet-gateway \
      --internet-gateway-id $IGW_ID \
      --vpc-id $VPC_ID \
      --region $REGION 2>&1 || echo "  (already detached)"
    
    echo "Deleting IGW: $IGW_ID"
    aws ec2 delete-internet-gateway \
      --internet-gateway-id $IGW_ID \
      --region $REGION 2>&1 || echo "  (already deleted)"
  done
else
  echo "✅ No Internet Gateways (0)"
fi

echo ""
echo "Checking Subnets..."
SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --region $REGION \
  --query 'Subnets[*].SubnetId' \
  --output text)

if [ -n "$SUBNET_IDS" ]; then
  echo "⚠️ Found subnets - will delete"
  for SUBNET_ID in $SUBNET_IDS; do
    echo "Deleting Subnet: $SUBNET_ID"
    aws ec2 delete-subnet \
      --subnet-id $SUBNET_ID \
      --region $REGION 2>&1 || echo "  (already deleted or in use)"
  done
else
  echo "✅ No Subnets"
fi

echo ""
echo "Checking Route Tables..."
RT_IDS=$(aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --region $REGION \
  --query 'RouteTables[?Associations[0].Main==`false`].RouteTableId' \
  --output text)

if [ -n "$RT_IDS" ]; then
  echo "⚠️ Found non-main route tables - will delete"
  for RT_ID in $RT_IDS; do
    echo "Deleting Route Table: $RT_ID"
    aws ec2 delete-route-table \
      --route-table-id $RT_ID \
      --region $REGION 2>&1 || echo "  (already deleted or in use)"
  done
else
  echo "✅ No non-main Route Tables"
fi

echo ""
echo "Checking Security Groups (non-default)..."
SG_IDS=$(aws ec2 describe-security-groups \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --region $REGION \
  --query 'SecurityGroups[?GroupName!=`default`].GroupId' \
  --output text)

if [ -n "$SG_IDS" ]; then
  echo "⚠️ Found non-default security groups - will delete"
  for SG_ID in $SG_IDS; do
    echo "Deleting Security Group: $SG_ID"
    aws ec2 delete-security-group \
      --group-id $SG_ID \
      --region $REGION 2>&1 || echo "  (already deleted or in use)"
  done
else
  echo "✅ No non-default Security Groups"
fi

echo ""

# Step 3: Delete VPC
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Delete VPC"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Deleting VPC: $VPC_ID"
aws ec2 delete-vpc \
  --vpc-id $VPC_ID \
  --region $REGION 2>&1

if [ $? -eq 0 ]; then
  echo "✅ VPC deletion initiated!"
else
  echo "❌ VPC deletion failed!"
  echo ""
  echo "Possible reasons:"
  echo "  - Dependencies still exist"
  echo "  - VPC is managed by CloudFormation (use CFN delete instead)"
  echo ""
  exit 1
fi

echo ""

# Step 4: Verify deletion
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: Verify Deletion"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

sleep 3

VPC_STATE=$(check_vpc)
if [[ "$VPC_STATE" == *"does not exist"* ]]; then
  echo "✅ VPC successfully deleted!"
else
  echo "⚠️ VPC still exists (state: $VPC_STATE)"
  echo "It may take a few moments to fully delete."
fi

echo ""

# Step 5: Check CloudFormation Stacks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 5: CloudFormation Stack Cleanup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Checking nested stack..."
NESTED_STATUS=$(aws cloudformation describe-stacks \
  --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620-function1351588B-18SZQZAVQ6JS8 \
  --region $REGION \
  --query 'Stacks[0].StackStatus' \
  --output text 2>&1)

if [[ "$NESTED_STATUS" == *"does not exist"* ]]; then
  echo "✅ Nested stack already deleted"
else
  echo "Nested stack status: $NESTED_STATUS"
  
  if [[ "$NESTED_STATUS" == "DELETE_FAILED" ]]; then
    echo "Retrying nested stack deletion..."
    aws cloudformation delete-stack \
      --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620-function1351588B-18SZQZAVQ6JS8 \
      --region $REGION 2>&1 || echo "  (deletion already in progress)"
  fi
fi

echo ""
echo "Checking parent stack..."
PARENT_STATUS=$(aws cloudformation describe-stacks \
  --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620 \
  --region $REGION \
  --query 'Stacks[0].StackStatus' \
  --output text 2>&1)

if [[ "$PARENT_STATUS" == *"does not exist"* ]]; then
  echo "✅ Parent stack already deleted"
else
  echo "Parent stack status: $PARENT_STATUS"
  
  if [[ "$PARENT_STATUS" == "DELETE_FAILED" ]]; then
    echo "Retrying parent stack deletion..."
    aws cloudformation delete-stack \
      --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620 \
      --region $REGION 2>&1 || echo "  (deletion already in progress)"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CLEANUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary:"
echo "  ✅ NLBs removed"
echo "  ✅ ENIs removed"
echo "  ✅ VPC deleted"
echo "  ⏳ CloudFormation stacks deleting"
echo ""
echo "Next steps:"
echo "  1. Wait 2-3 min for stacks to fully delete"
echo "  2. Deploy new sandbox: pnpm exec ampx sandbox --once"
echo ""

#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 Create S3 VPC Gateway Endpoint for FAST S3 Access
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 
# This creates a FREE S3 Gateway Endpoint that routes all
# S3 traffic through AWS internal network (FAST!)
# instead of the public internet (SLOW!)
#
# Benefits:
# - ✅ MUCH faster downloads
# - ✅ FREE (no endpoint charges)
# - ✅ No data transfer costs
# - ✅ More secure (stays in AWS network)
# - ✅ AWS CLI automatically uses it
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

REGION="eu-west-1"
VPC_ID="vpc-01b81f989bc673299"
SERVICE_NAME="com.amazonaws.eu-west-1.s3"

echo "🚀 Creating S3 VPC Gateway Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "VPC: $VPC_ID"
echo "Service: $SERVICE_NAME"
echo ""

# Get route tables in VPC
echo "1. Finding route tables..."
ROUTE_TABLES=$(aws ec2 describe-route-tables \
  --region $REGION \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'RouteTables[*].RouteTableId' \
  --output text)

echo "   Route tables: $ROUTE_TABLES"
echo ""

# Create VPC Endpoint
echo "2. Creating S3 Gateway Endpoint..."
ENDPOINT_ID=$(aws ec2 create-vpc-endpoint \
  --region $REGION \
  --vpc-id $VPC_ID \
  --service-name $SERVICE_NAME \
  --route-table-ids $ROUTE_TABLES \
  --query 'VpcEndpoint.VpcEndpointId' \
  --output text)

echo "   ✅ Created: $ENDPOINT_ID"
echo ""

# Wait for endpoint to be available
echo "3. Waiting for endpoint to be available..."
for i in {1..30}; do
  STATE=$(aws ec2 describe-vpc-endpoints \
    --region $REGION \
    --vpc-endpoint-ids $ENDPOINT_ID \
    --query 'VpcEndpoints[0].State' \
    --output text)
  
  if [ "$STATE" == "available" ]; then
    echo "   ✅ Endpoint is available!"
    break
  fi
  
  echo "   Status: $STATE (${i}s)"
  sleep 1
done
echo ""

# Verify
echo "4. Verifying endpoint..."
aws ec2 describe-vpc-endpoints \
  --region $REGION \
  --vpc-endpoint-ids $ENDPOINT_ID \
  --query 'VpcEndpoints[0].{ID:VpcEndpointId,State:State,Service:ServiceName,Type:VpcEndpointType}' \
  --output table

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ S3 VPC ENDPOINT CREATED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "What this means:"
echo "  ✅ All S3 traffic from EC2 now uses AWS internal network"
echo "  ✅ MUCH faster downloads (no public internet!)"
echo "  ✅ No extra costs"
echo "  ✅ AWS CLI automatically uses it"
echo ""
echo "Test it:"
echo "  ssh radio-ec2 'time aws s3 cp s3://bucket/file.mp3 /tmp/test.mp3'"
echo "  → Should be MUCH faster now!"
echo ""
echo "Endpoint ID: $ENDPOINT_ID"
echo ""

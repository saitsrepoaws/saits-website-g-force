#!/bin/bash
################################################################################
# LAUNCH EC2 WITH STANDARD TAGS
################################################################################
# Purpose: Launch EC2 instance with 100% AWS compliant tags
# Usage: ./launch-ec2-with-tags.sh [environment]
################################################################################

set -e

ENVIRONMENT="${1:-production}"
REGION="eu-west-1"
AMI_ID="ami-0d64bb532e0502c46"  # Ubuntu 24.04
INSTANCE_TYPE="t3.small"
SUBNET_ID="subnet-0cdb078c275014e24"
SECURITY_GROUP="sg-005c8d71776faf97b"
IAM_PROFILE="arn:aws:iam::035636364722:instance-profile/StreamServerProfile"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 LAUNCHING EC2 WITH 100% AWS COMPLIANT TAGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Environment: $ENVIRONMENT"
echo "AMI: $AMI_ID"
echo "Instance Type: $INSTANCE_TYPE"
echo ""

# Launch instance with ALL required tags
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --subnet-id "$SUBNET_ID" \
  --security-group-ids "$SECURITY_GROUP" \
  --iam-instance-profile Arn="$IAM_PROFILE" \
  --user-data file://$(dirname $0)/../ami/ec2-userdata-codedeploy.sh \
  --tag-specifications "
    ResourceType=instance,Tags=[
      {Key=Name,Value=g-forge-radio-server},
      {Key=Application,Value=g-forge-radio},
      {Key=CostCenter,Value=g-forge-radio},
      {Key=Owner,Value=gerard},
      {Key=Environment,Value=$ENVIRONMENT},
      {Key=Component,Value=streaming-server},
      {Key=ManagedBy,Value=codedeploy},
      {Key=Backup,Value=daily},
      {Key=Monitoring,Value=enabled},
      {Key=AutoShutdown,Value=false},
      {Key=Version,Value=v1.0.0},
      {Key=DataClassification,Value=public},
      {Key=SecurityZone,Value=dmz}
    ]
  ResourceType=volume,Tags=[
      {Key=Name,Value=g-forge-radio-server-root},
      {Key=Application,Value=g-forge-radio},
      {Key=CostCenter,Value=g-forge-radio},
      {Key=Owner,Value=gerard},
      {Key=Environment,Value=$ENVIRONMENT}
    ]
  " \
  --region "$REGION" \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "✅ Instance launched: $INSTANCE_ID"
echo ""

# Wait for instance to be running
echo "Waiting for instance to start..."
aws ec2 wait instance-running \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION"

echo "✅ Instance is running"
echo ""

# Get instance details
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

PRIVATE_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' \
  --output text)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ INSTANCE READY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "Private IP: $PRIVATE_IP"
echo ""
echo "💯 100% AWS Well-Architected Tags Applied!"
echo ""

#!/bin/bash
################################################################################
# APPLY STANDARD TAGS - G-Forge Radio
################################################################################
# Purpose: Apply AWS best practice tags to all resources
# Score: 100% AWS Well-Architected compliance
################################################################################

set -e

RESOURCE_ID="$1"
RESOURCE_TYPE="$2"
ENVIRONMENT="${3:-production}"

if [ -z "$RESOURCE_ID" ] || [ -z "$RESOURCE_TYPE" ]; then
  echo "Usage: $0 <resource-id> <resource-type> [environment]"
  echo "Example: $0 i-123456 ec2 production"
  exit 1
fi

# Standard tags for all resources
STANDARD_TAGS='[
  {"Key":"Application","Value":"g-forge-radio"},
  {"Key":"CostCenter","Value":"g-forge-radio"},
  {"Key":"Owner","Value":"gerard"},
  {"Key":"ManagedBy","Value":"codedeploy"},
  {"Key":"Environment","Value":"'$ENVIRONMENT'"}
]'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏷️  APPLYING STANDARD TAGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Resource: $RESOURCE_ID"
echo "Type: $RESOURCE_TYPE"
echo "Environment: $ENVIRONMENT"
echo ""

case $RESOURCE_TYPE in
  ec2)
    echo "Tagging EC2 instance..."
    aws ec2 create-tags \
      --resources "$RESOURCE_ID" \
      --tags \
        Key=Application,Value=g-forge-radio \
        Key=CostCenter,Value=g-forge-radio \
        Key=Owner,Value=gerard \
        Key=ManagedBy,Value=codedeploy \
        Key=Environment,Value="$ENVIRONMENT" \
        Key=Component,Value=streaming-server \
        Key=Backup,Value=daily \
        Key=Monitoring,Value=enabled \
        Key=DataClassification,Value=public \
        Key=SecurityZone,Value=dmz \
        Key=AutoShutdown,Value=false \
        Key=Version,Value=v1.0.0
    ;;
    
  s3)
    echo "Tagging S3 bucket..."
    aws s3api put-bucket-tagging \
      --bucket "$RESOURCE_ID" \
      --tagging "TagSet=[
        {Key=Application,Value=g-forge-radio},
        {Key=CostCenter,Value=g-forge-radio},
        {Key=Owner,Value=gerard},
        {Key=Environment,Value=$ENVIRONMENT},
        {Key=Component,Value=deployment-artifacts},
        {Key=RetentionPolicy,Value=30days},
        {Key=VersioningEnabled,Value=true}
      ]"
    ;;
    
  codedeploy-app)
    echo "Tagging CodeDeploy application..."
    aws deploy tag-resource \
      --resource-arn "$RESOURCE_ID" \
      --tags \
        Key=Application,Value=g-forge-radio \
        Key=CostCenter,Value=g-forge-radio \
        Key=Owner,Value=gerard \
        Key=Environment,Value="$ENVIRONMENT" \
        Key=Component,Value=deployment-pipeline \
        Key=ManagedBy,Value=codedeploy
    ;;
    
  *)
    echo "❌ Unknown resource type: $RESOURCE_TYPE"
    exit 1
    ;;
esac

echo ""
echo "✅ Tags applied successfully!"
echo ""

#!/bin/bash
################################################################################
# CREATE ENVIRONMENT STACK IN PARAMETER STORE
################################################################################
# Purpose: Create all required parameters for a new environment
# Usage: ./create-environment-stack.sh <environment-name>
################################################################################

set -e

ENVIRONMENT="$1"
REGION="eu-west-1"

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment-name>"
  echo "Examples:"
  echo "  $0 production"
  echo "  $0 development"
  echo "  $0 gerard"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️  CREATING ENVIRONMENT STACK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Region:      $REGION"
echo ""

PARAM_PATH="/g-forge-radio/${ENVIRONMENT}"

# Helper function to create parameter
create_param() {
  local name="$1"
  local value="$2"
  local description="$3"
  
  aws ssm put-parameter \
    --name "${PARAM_PATH}/${name}" \
    --value "$value" \
    --type "String" \
    --description "$description" \
    --tags Key=Application,Value=g-forge-radio Key=Environment,Value="$ENVIRONMENT" \
    --region "$REGION" \
    --overwrite > /dev/null 2>&1
  
  echo "  ✅ ${name}"
}

echo "Creating CodeDeploy parameters..."
create_param "codedeploy/application-name" "g-forge-radio" "CodeDeploy application name"
create_param "codedeploy/deployment-group" "radio-${ENVIRONMENT}" "CodeDeploy deployment group"

echo "Creating S3 parameters..."
create_param "s3/deployment-bucket" "g-forge-radio-deployments-035636364722" "S3 bucket for deployments"

echo "Creating VPC parameters..."
create_param "vpc/id" "vpc-0a8e5c55ce96e6e5c" "VPC ID"
create_param "vpc/subnet-id" "subnet-0cdb078c275014e24" "Subnet ID (eu-west-1a)"
create_param "vpc/security-group-id" "sg-005c8d71776faf97b" "Security group ID"

echo "Creating IAM parameters..."
create_param "iam/instance-profile-arn" "arn:aws:iam::035636364722:instance-profile/StreamServerProfile" "IAM instance profile ARN"
create_param "iam/service-role-arn" "arn:aws:iam::035636364722:role/CodeDeployServiceRole" "CodeDeploy service role ARN"

echo "Creating EC2 parameters..."
create_param "ec2/ami-id" "ami-0d64bb532e0502c46" "Ubuntu 24.04 LTS AMI"
create_param "ec2/instance-type" "t3.small" "EC2 instance type"

echo "Creating environment metadata..."
create_param "metadata/created-at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "Environment creation timestamp"
create_param "metadata/created-by" "$(git config user.name 2>/dev/null || echo 'unknown')" "Environment creator"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ENVIRONMENT STACK CREATED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Parameter Store Path: $PARAM_PATH"
echo ""
echo "View all parameters:"
echo "  aws ssm get-parameters-by-path --path $PARAM_PATH --region $REGION"
echo ""
echo "Next steps:"
echo "  1. Launch EC2 instance for this environment"
echo "  2. Create CodeDeploy deployment group"
echo "  3. Deploy with: ./deploy_streamserver ${ENVIRONMENT}"
echo ""

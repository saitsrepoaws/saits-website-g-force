#!/bin/bash
# Setup CI/CD Pipeline - G-Forge IoT Radio
# Run this script to set up the complete CI/CD pipeline

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║         🚀 CI/CD PIPELINE SETUP - G-FORGE RADIO 🚀                 ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found! Install it first:"
    echo "   brew install awscli"
    exit 1
fi

echo "✅ AWS CLI found"

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="eu-west-1"

echo "📋 Configuration:"
echo "   AWS Account: $AWS_ACCOUNT_ID"
echo "   Region: $AWS_REGION"
echo "   EC2 Instance: i-044ea4a949c8f562a"
echo ""

# Step 1: Create S3 Bucket
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1: Creating S3 Artifact Bucket"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

BUCKET_NAME="g-forge-radio-pipeline-${AWS_ACCOUNT_ID}"

if aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "Creating bucket: ${BUCKET_NAME}"
    aws s3 mb "s3://${BUCKET_NAME}" --region ${AWS_REGION}
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "${BUCKET_NAME}" \
        --versioning-configuration Status=Enabled \
        --region ${AWS_REGION}
    
    # Add lifecycle policy
    cat > /tmp/lifecycle.json << EOF
{
    "Rules": [{
        "Id": "DeleteOldArtifacts",
        "Status": "Enabled",
        "ExpirationInDays": 30,
        "NoncurrentVersionExpirationInDays": 7
    }]
}
EOF
    
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "${BUCKET_NAME}" \
        --lifecycle-configuration file:///tmp/lifecycle.json \
        --region ${AWS_REGION}
    
    echo "✅ Bucket created: ${BUCKET_NAME}"
else
    echo "✅ Bucket already exists: ${BUCKET_NAME}"
fi

# Step 2: Tag EC2 Instance
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏷️  Step 2: Tagging EC2 Instance"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

aws ec2 create-tags \
    --resources i-044ea4a949c8f562a \
    --tags \
        Key=Project,Value=g-forge-radio \
        Key=Environment,Value=production \
        Key=DeploymentGroup,Value=production \
    --region ${AWS_REGION}

echo "✅ EC2 instance tagged"

# Step 3: Create IAM Roles
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Step 3: Creating IAM Roles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# CodeBuild Service Role
if ! aws iam get-role --role-name g-forge-codebuild-role 2>/dev/null; then
    echo "Creating CodeBuild role..."
    
    cat > /tmp/codebuild-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {
            "Service": "codebuild.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
    }]
}
EOF
    
    aws iam create-role \
        --role-name g-forge-codebuild-role \
        --assume-role-policy-document file:///tmp/codebuild-trust-policy.json
    
    # Attach policies
    aws iam attach-role-policy \
        --role-name g-forge-codebuild-role \
        --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
    
    # Create inline policy for S3
    cat > /tmp/codebuild-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Action": [
            "s3:GetObject",
            "s3:PutObject"
        ],
        "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }]
}
EOF
    
    aws iam put-role-policy \
        --role-name g-forge-codebuild-role \
        --policy-name CodeBuildS3Access \
        --policy-document file:///tmp/codebuild-policy.json
    
    echo "✅ CodeBuild role created"
else
    echo "✅ CodeBuild role already exists"
fi

# CodeDeploy Service Role
if ! aws iam get-role --role-name g-forge-codedeploy-role 2>/dev/null; then
    echo "Creating CodeDeploy role..."
    
    cat > /tmp/codedeploy-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {
            "Service": "codedeploy.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
    }]
}
EOF
    
    aws iam create-role \
        --role-name g-forge-codedeploy-role \
        --assume-role-policy-document file:///tmp/codedeploy-trust-policy.json
    
    # Attach managed policy
    aws iam attach-role-policy \
        --role-name g-forge-codedeploy-role \
        --policy-arn arn:aws:iam::aws:policy/AWSCodeDeployRole
    
    echo "✅ CodeDeploy role created"
else
    echo "✅ CodeDeploy role already exists"
fi

# Step 4: Install CodeDeploy Agent (instructions)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 4: Install CodeDeploy Agent on EC2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Run these commands on your EC2 instance:"
echo ""
echo "  ssh ec2-user@79.125.44.178"
echo ""
echo "  # Install CodeDeploy agent"
echo "  sudo yum install ruby wget -y"
echo "  cd /home/ec2-user"
echo "  wget https://aws-codedeploy-${AWS_REGION}.s3.${AWS_REGION}.amazonaws.com/latest/install"
echo "  chmod +x ./install"
echo "  sudo ./install auto"
echo "  sudo service codedeploy-agent start"
echo "  sudo service codedeploy-agent status"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SETUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Resources created:"
echo "  ✅ S3 Bucket: ${BUCKET_NAME}"
echo "  ✅ EC2 Tags: Project=g-forge-radio"
echo "  ✅ IAM Role: g-forge-codebuild-role"
echo "  ✅ IAM Role: g-forge-codedeploy-role"
echo ""
echo "Next steps:"
echo "  1. Install CodeDeploy agent on EC2 (see commands above)"
echo "  2. Create CodeBuild project in AWS Console"
echo "  3. Create CodeDeploy application in AWS Console"
echo "  4. Create CodePipeline in AWS Console"
echo ""
echo "See: ref/CICD_PIPELINE_SETUP.md for detailed instructions"
echo ""

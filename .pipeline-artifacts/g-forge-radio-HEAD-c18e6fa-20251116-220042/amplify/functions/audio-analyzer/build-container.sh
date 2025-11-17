#!/bin/bash
set -e

echo "🐳 Building Docker container for audio-analyzer Lambda..."

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-eu-west-1}
REPOSITORY_NAME="audio-analyzer-lambda"
IMAGE_TAG="latest"

echo "📦 AWS Account: $AWS_ACCOUNT_ID"
echo "🌍 Region: $AWS_REGION"
echo "🏷️  Repository: $REPOSITORY_NAME"

# Create ECR repository if it doesn't exist
echo "🔍 Checking if ECR repository exists..."
if ! aws ecr describe-repositories --repository-names $REPOSITORY_NAME --region $AWS_REGION 2>/dev/null; then
    echo "📦 Creating ECR repository..."
    aws ecr create-repository \
        --repository-name $REPOSITORY_NAME \
        --region $AWS_REGION \
        --image-scanning-configuration scanOnPush=true
    echo "✅ ECR repository created"
else
    echo "✅ ECR repository already exists"
fi

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build the Docker image
echo "🔨 Building Docker image..."
docker build --platform linux/amd64 -t $REPOSITORY_NAME:$IMAGE_TAG .

# Tag the image for ECR
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPOSITORY_NAME:$IMAGE_TAG"
echo "🏷️  Tagging image: $ECR_URI"
docker tag $REPOSITORY_NAME:$IMAGE_TAG $ECR_URI

# Push to ECR
echo "⬆️  Pushing to ECR..."
docker push $ECR_URI

echo ""
echo "✅ Container built and pushed successfully!"
echo "📍 Image URI: $ECR_URI"
echo ""
echo "Next steps:"
echo "1. Update backend.ts to use this container image"
echo "2. Deploy with: npx ampx sandbox"

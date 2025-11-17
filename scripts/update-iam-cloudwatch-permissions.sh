#!/bin/bash
################################################################################
# G-FORGE RADIO - IAM CloudWatch Permissions Update
################################################################################
# Adds CloudWatch Logs and Metrics permissions to EC2 IAM role
################################################################################

set -e

REGION="eu-west-1"
ROLE_NAME="amplify-gforgeiot-gerard-s-StreamServerRole6A0ED596-PDlQLOv2V4ju"
POLICY_NAME="StreamServerCloudWatchAccess"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 UPDATING IAM PERMISSIONS FOR CLOUDWATCH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Role: $ROLE_NAME"
echo "Policy: $POLICY_NAME"
echo ""

# ============================================================================
# CREATE CLOUDWATCH PERMISSIONS POLICY
# ============================================================================
echo "=== CREATING CLOUDWATCH POLICY ==="

cat > /tmp/cloudwatch-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:eu-west-1:*:log-group:/g-forge-radio/*",
        "arn:aws:logs:eu-west-1:*:log-group:/g-forge-radio/*:*"
      ]
    },
    {
      "Sid": "CloudWatchMetricsAccess",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "cloudwatch:namespace": "GForgeRadio/StreamServer"
        }
      }
    },
    {
      "Sid": "EC2MetadataAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeVolumes",
        "ec2:DescribeTags",
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Apply policy to role
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document file:///tmp/cloudwatch-policy.json

rm /tmp/cloudwatch-policy.json

echo "✅ CloudWatch permissions added to EC2 role!"
echo ""

# ============================================================================
# VERIFICATION
# ============================================================================
echo "=== VERIFICATION ==="

echo "Current role policies:"
aws iam list-role-policies \
  --role-name "$ROLE_NAME" \
  --query 'PolicyNames' \
  --output table

echo ""
echo "✅ IAM PERMISSIONS UPDATED!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 PERMISSIONS GRANTED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "EC2 can now:"
echo "  ✓ Create log groups and streams"
echo "  ✓ Write logs to CloudWatch"
echo "  ✓ Publish custom metrics"
echo "  ✓ Query EC2 metadata"
echo ""

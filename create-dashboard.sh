#!/bin/bash

# Create CloudWatch Dashboard for SplashFM Queue Monitoring

DASHBOARD_NAME="SplashFM-Queue-Dashboard"
REGION="eu-west-1"

echo "🎨 Creating CloudWatch Dashboard: $DASHBOARD_NAME"
echo ""

# Create dashboard JSON
cat > /tmp/dashboard-body.json << 'EOF'
{
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "SplashFM", "QueueDepth", { "label": "Messages Waiting", "color": "#1f77b4" } ],
                    [ ".", "QueueInFlight", { "label": "In-Flight", "color": "#ff7f0e" } ],
                    [ ".", "QueueTotal", { "label": "Total Queue", "color": "#2ca02c" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "eu-west-1",
                "title": "📊 Queue Depth Over Time",
                "period": 60,
                "stat": "Average",
                "yAxis": {
                    "left": {
                        "label": "Track Count",
                        "showUnits": false
                    }
                }
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "SplashFM", "QueueOldestMessageAge", { "stat": "Average" } ]
                ],
                "view": "singleValue",
                "region": "eu-west-1",
                "title": "⏱️ Queue Wait Time",
                "period": 60,
                "stat": "Average",
                "setPeriodToTimeRange": true
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "SplashFM", "QueueLowAlert", { "stat": "Maximum", "color": "#d62728" } ]
                ],
                "view": "singleValue",
                "region": "eu-west-1",
                "title": "⚠️ Low Queue Alert",
                "period": 60,
                "stat": "Maximum"
            }
        },
        {
            "type": "log",
            "properties": {
                "query": "SOURCE '/splash-fm/queue-stats'\n| fields @timestamp, @message\n| sort @timestamp desc\n| limit 10",
                "region": "eu-west-1",
                "stacked": false,
                "title": "📋 Recent Queue Stats",
                "view": "table"
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "SplashFM", "QueueDepth" ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "eu-west-1",
                "title": "📈 Queue Depth Trend (24h)",
                "period": 300,
                "stat": "Average"
            }
        }
    ]
}
EOF

echo "📄 Dashboard configuration created"
echo ""

# Create the dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "$DASHBOARD_NAME" \
  --dashboard-body file:///tmp/dashboard-body.json \
  --region "$REGION"

if [ $? -eq 0 ]; then
    echo "✅ Dashboard created successfully!"
    echo ""
    echo "🔗 View dashboard at:"
    echo "https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#dashboards:name=$DASHBOARD_NAME"
else
    echo "❌ Failed to create dashboard"
    exit 1
fi

echo ""
echo "📊 Dashboard includes:"
echo "  ✅ Queue Depth Over Time (line graph)"
echo "  ✅ Queue Wait Time (single value)"
echo "  ✅ Low Queue Alert (warning indicator)"
echo "  ✅ Recent Queue Stats (log table)"
echo "  ✅ 24h Trend (overview)"
echo ""
echo "🎉 Dashboard ready!"

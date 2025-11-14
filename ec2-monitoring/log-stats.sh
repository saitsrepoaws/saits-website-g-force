#!/bin/bash

# 📊 Log Statistics Reporter
# Reports log statistics to CloudWatch

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Count errors in Liquidsoap log (last hour)
if [ -f "/tmp/liquidsoap.log" ]; then
    ERROR_COUNT=$(grep -c "ERROR" /tmp/liquidsoap.log 2>/dev/null || echo 0)
    aws cloudwatch put-metric-data \
        --namespace "SplashFM" \
        --metric-name "LiquidsoapErrors" \
        --value $ERROR_COUNT \
        --dimensions Type=hourly 2>/dev/null || true
fi

# Count Nginx errors (last hour)
if [ -f "/var/log/nginx/error.log" ]; then
    NGINX_ERRORS=$(grep -c "error" /var/log/nginx/error.log 2>/dev/null || echo 0)
    aws cloudwatch put-metric-data \
        --namespace "SplashFM" \
        --metric-name "NginxErrors" \
        --value $NGINX_ERRORS \
        --dimensions Type=hourly 2>/dev/null || true
fi

# Check log file sizes
if [ -f "/tmp/liquidsoap.log" ]; then
    LOG_SIZE=$(stat -f%z "/tmp/liquidsoap.log" 2>/dev/null || stat -c%s "/tmp/liquidsoap.log" 2>/dev/null)
    LOG_SIZE_MB=$((LOG_SIZE / 1024 / 1024))
    aws cloudwatch put-metric-data \
        --namespace "SplashFM" \
        --metric-name "LiquidsoapLogSize" \
        --value $LOG_SIZE_MB \
        --unit Megabytes 2>/dev/null || true
fi

echo "[$TIMESTAMP] Log stats reported to CloudWatch"

/**
 * G-FORGE RADIO - ML-POWERED SECURITY STACK
 * 
 * Components:
 * - AWS GuardDuty (ML threat detection)
 * - AWS Security Hub (centralized findings)
 * - CloudWatch Anomaly Detection (ML on logs)
 * - Lambda for real-time log analysis
 * - SNS alerts for security events
 * - EventBridge rules for automation
 */

import { Stack, Duration, RemovalPolicy } from 'aws-cdk-lib'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'

export interface SecurityMLStackProps {
  /**
   * Email address for security alerts
   */
  alertEmail: string
  
  /**
   * EC2 instance ID to monitor
   */
  ec2InstanceId: string
  
  /**
   * Enable GuardDuty (ML threat detection)
   */
  enableGuardDuty?: boolean
  
  /**
   * Enable Security Hub (centralized security)
   */
  enableSecurityHub?: boolean
}

export class SecurityMLStack {
  public readonly logGroup: logs.LogGroup
  public readonly alertTopic: sns.Topic
  public readonly logAnalysisLambda: lambda.Function
  
  constructor(stack: Stack, props: SecurityMLStackProps) {
    
    // ==========================================================================
    // 1. CENTRALIZED LOG GROUP (ALL LOGS IN ONE PLACE)
    // ==========================================================================
    
    this.logGroup = new logs.LogGroup(stack, 'SecurityAllLogsGroup', {
      logGroupName: '/gforge-radio/all-logs',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN
    })
    
    // ==========================================================================
    // 2. SNS TOPIC FOR SECURITY ALERTS
    // ==========================================================================
    
    this.alertTopic = new sns.Topic(stack, 'SecurityAlertTopic', {
      topicName: 'gforge-radio-security-alerts',
      displayName: 'G-Force Radio Security Alerts'
    })
    
    // Subscribe email
    this.alertTopic.addSubscription(
      new subscriptions.EmailSubscription(props.alertEmail)
    )
    
    // ==========================================================================
    // 3. ML-POWERED LOG ANALYSIS LAMBDA
    // ==========================================================================
    
    this.logAnalysisLambda = new NodejsFunction(stack, 'LogAnalysisLambda', {
      functionName: 'gforge-radio-log-analysis-ml',
      entry: require.resolve('../../functions/security-log-analyzer/handler.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        LOG_GROUP_NAME: this.logGroup.logGroupName,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
        EC2_INSTANCE_ID: props.ec2InstanceId
      }
    })
    
    // Grant permissions
    this.logGroup.grantRead(this.logAnalysisLambda)
    this.alertTopic.grantPublish(this.logAnalysisLambda)
    
    // Add CloudWatch Logs Insights permissions
    this.logAnalysisLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:StartQuery',
          'logs:GetQueryResults',
          'logs:StopQuery',
          'logs:FilterLogEvents',
          'logs:DescribeLogStreams'
        ],
        resources: [this.logGroup.logGroupArn]
      })
    )
    
    // ==========================================================================
    // 4. CLOUDWATCH ANOMALY DETECTION (ML ON METRICS)
    // ==========================================================================
    
    // CPU Anomaly Detection
    const cpuMetric = new cloudwatch.Metric({
      namespace: 'GForgeRadio',
      metricName: 'CPU_USED',
      statistic: 'Average',
      period: Duration.minutes(5)
    })
    
    const cpuAnomaly = new cloudwatch.CfnAnomalyDetector(stack, 'CPUAnomalyDetector', {
      metricName: cpuMetric.metricName,
      namespace: cpuMetric.namespace,
      stat: 'Average'
    })
    
    // Memory Anomaly Detection
    const memMetric = new cloudwatch.Metric({
      namespace: 'GForgeRadio',
      metricName: 'MEM_USED',
      statistic: 'Average',
      period: Duration.minutes(5)
    })
    
    const memAnomaly = new cloudwatch.CfnAnomalyDetector(stack, 'MemAnomalyDetector', {
      metricName: memMetric.metricName,
      namespace: memMetric.namespace,
      stat: 'Average'
    })
    
    // ==========================================================================
    // 5. EVENTBRIDGE RULES FOR SECURITY EVENTS
    // ==========================================================================
    
    // Rule 1: GuardDuty Findings (if enabled)
    if (props.enableGuardDuty !== false) {
      const guardDutyRule = new events.Rule(stack, 'GuardDutyFindingsRule', {
        ruleName: 'gforge-radio-guardduty-findings',
        description: 'Capture GuardDuty findings and send to Lambda for ML analysis',
        eventPattern: {
          source: ['aws.guardduty'],
          detailType: ['GuardDuty Finding']
        }
      })
      
      guardDutyRule.addTarget(new targets.LambdaFunction(this.logAnalysisLambda))
      guardDutyRule.addTarget(new targets.SnsTopic(this.alertTopic))
    }
    
    // Rule 2: Security Hub Findings (if enabled)
    if (props.enableSecurityHub !== false) {
      const securityHubRule = new events.Rule(stack, 'SecurityHubFindingsRule', {
        ruleName: 'gforge-radio-securityhub-findings',
        description: 'Capture Security Hub findings',
        eventPattern: {
          source: ['aws.securityhub'],
          detailType: ['Security Hub Findings - Imported']
        }
      })
      
      securityHubRule.addTarget(new targets.LambdaFunction(this.logAnalysisLambda))
    }
    
    // Rule 3: EC2 Instance State Changes
    const ec2StateRule = new events.Rule(stack, 'EC2StateChangeRule', {
      ruleName: 'gforge-radio-ec2-state-change',
      description: 'Alert on EC2 instance state changes',
      eventPattern: {
        source: ['aws.ec2'],
        detailType: ['EC2 Instance State-change Notification'],
        detail: {
          'instance-id': [props.ec2InstanceId]
        }
      }
    })
    
    ec2StateRule.addTarget(new targets.SnsTopic(this.alertTopic))
    
    // Rule 4: Scheduled Log Analysis (every 15 minutes)
    const scheduledAnalysisRule = new events.Rule(stack, 'ScheduledLogAnalysisRule', {
      ruleName: 'gforge-radio-scheduled-log-analysis',
      description: 'Run ML log analysis every 15 minutes',
      schedule: events.Schedule.rate(Duration.minutes(15))
    })
    
    scheduledAnalysisRule.addTarget(new targets.LambdaFunction(this.logAnalysisLambda))
    
    // ==========================================================================
    // 6. CLOUDWATCH ALARMS FOR ANOMALIES
    // ==========================================================================
    
    // Alarm for CPU Anomalies
    const cpuAnomalyAlarm = new cloudwatch.Alarm(stack, 'CPUAnomalyAlarm', {
      alarmName: 'gforge-radio-cpu-anomaly',
      metric: cpuMetric,
      threshold: 80,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    })
    
    cpuAnomalyAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: this.alertTopic.topicArn })
    })
    
    // Alarm for Memory Anomalies
    const memAnomalyAlarm = new cloudwatch.Alarm(stack, 'MemAnomalyAlarm', {
      alarmName: 'gforge-radio-mem-anomaly',
      metric: memMetric,
      threshold: 85,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    })
    
    memAnomalyAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: this.alertTopic.topicArn })
    })
    
    // Alarm for Failed SSH Attempts (custom metric from logs)
    const failedSSHMetric = new logs.MetricFilter(stack, 'FailedSSHMetricFilter', {
      logGroup: this.logGroup,
      filterPattern: logs.FilterPattern.literal('[time, source, user, ...] Failed password'),
      metricNamespace: 'GForgeRadio/Security',
      metricName: 'FailedSSHAttempts',
      metricValue: '1',
      defaultValue: 0
    })
    
    const failedSSHAlarm = new cloudwatch.Alarm(stack, 'FailedSSHAlarm', {
      alarmName: 'gforge-radio-failed-ssh-attempts',
      metric: failedSSHMetric.metric(),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    })
    
    failedSSHAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: this.alertTopic.topicArn })
    })
    
    // ==========================================================================
    // 7. METRIC FILTERS FOR SECURITY EVENTS
    // ==========================================================================
    
    // Rootkit Detection
    new logs.MetricFilter(stack, 'RootkitDetectionMetricFilter', {
      logGroup: this.logGroup,
      filterPattern: logs.FilterPattern.anyTerm('rootkit', 'trojan', 'backdoor', 'suspicious'),
      metricNamespace: 'GForgeRadio/Security',
      metricName: 'RootkitDetections',
      metricValue: '1',
      defaultValue: 0
    })
    
    // Virus Detection
    new logs.MetricFilter(stack, 'VirusDetectionMetricFilter', {
      logGroup: this.logGroup,
      filterPattern: logs.FilterPattern.anyTerm('FOUND', 'Infected', 'virus'),
      metricNamespace: 'GForgeRadio/Security',
      metricName: 'VirusDetections',
      metricValue: '1',
      defaultValue: 0
    })
    
    // Docker Vulnerabilities
    new logs.MetricFilter(stack, 'DockerVulnMetricFilter', {
      logGroup: this.logGroup,
      filterPattern: logs.FilterPattern.anyTerm('HIGH', 'CRITICAL', 'vulnerability'),
      metricNamespace: 'GForgeRadio/Security',
      metricName: 'DockerVulnerabilities',
      metricValue: '1',
      defaultValue: 0
    })
    
    // Suspicious Network Activity
    new logs.MetricFilter(stack, 'SuspiciousNetworkMetricFilter', {
      logGroup: this.logGroup,
      filterPattern: logs.FilterPattern.anyTerm('SYN flood', 'port scan', 'DDoS', 'brute force'),
      metricNamespace: 'GForgeRadio/Security',
      metricName: 'SuspiciousNetworkActivity',
      metricValue: '1',
      defaultValue: 0
    })
    
    console.log('🤖 ML-Powered Security Stack configured')
    console.log('   📊 Log Group: /gforge-radio/all-logs')
    console.log('   🔔 Alert Topic: gforge-radio-security-alerts')
    console.log('   🧠 ML Analysis: Every 15 minutes')
  }
}

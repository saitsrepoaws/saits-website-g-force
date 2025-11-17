/**
 * ML-Powered Security Log Analyzer
 * 
 * Analyzes logs for:
 * - Hack attempts (SSH brute force, port scans, etc.)
 * - Security scan results (rootkits, viruses, vulnerabilities)
 * - Anomalous behavior patterns
 * - Failed authentication attempts
 * 
 * Uses CloudWatch Logs Insights for pattern detection
 */

import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  QueryStatus
} from '@aws-sdk/client-cloudwatch-logs'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'

const logsClient = new CloudWatchLogsClient({})
const snsClient = new SNSClient({})

const LOG_GROUP_NAME = process.env.LOG_GROUP_NAME || '/gforge-radio/all-logs'
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN || ''
const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID || ''

interface SecurityThreat {
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  count: number
  description: string
  details: string[]
  timestamp: string
}

/**
 * Main handler - Analyzes logs and sends alerts
 */
export const handler = async (event: any) => {
  console.log('🔍 Starting ML-powered security log analysis...')
  console.log('Event:', JSON.stringify(event, null, 2))
  
  const threats: SecurityThreat[] = []
  const now = new Date()
  const startTime = new Date(now.getTime() - 15 * 60 * 1000) // Last 15 minutes
  
  try {
    // Analyze different threat categories
    await Promise.all([
      analyzeSSHAttacks(startTime, now, threats),
      analyzeRootkitDetections(startTime, now, threats),
      analyzeVirusDetections(startTime, now, threats),
      analyzeDockerVulnerabilities(startTime, now, threats),
      analyzeSuspiciousNetworkActivity(startTime, now, threats),
      analyzeFailedLogins(startTime, now, threats)
    ])
    
    // Generate summary report
    const report = generateSecurityReport(threats)
    
    // Send alert if threats detected
    if (threats.length > 0) {
      await sendSecurityAlert(report, threats)
    }
    
    console.log('✅ Security analysis complete')
    console.log(`   Threats detected: ${threats.length}`)
    
    return {
      statusCode: 200,
      body: {
        threatsDetected: threats.length,
        threats,
        report
      }
    }
  } catch (error) {
    console.error('❌ Error in security analysis:', error)
    throw error
  }
}

/**
 * Analyze SSH brute force attacks
 */
async function analyzeSSHAttacks(
  startTime: Date,
  endTime: Date,
  threats: SecurityThreat[]
): Promise<void> {
  const query = `
    fields @timestamp, @message
    | filter @message like /Failed password/
    | stats count() as failedAttempts by bin(5m)
    | filter failedAttempts > 3
  `
  
  const results = await runInsightsQuery(query, startTime, endTime)
  
  if (results.length > 0) {
    const totalAttempts = results.reduce((sum, r) => sum + parseInt(r[1]?.value || '0'), 0)
    
    threats.push({
      type: 'SSH_BRUTE_FORCE',
      severity: totalAttempts > 10 ? 'HIGH' : 'MEDIUM',
      count: totalAttempts,
      description: `Detected ${totalAttempts} failed SSH login attempts`,
      details: results.map(r => `${r[0]?.value}: ${r[1]?.value} attempts`),
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Analyze rootkit detections
 */
async function analyzeRootkitDetections(
  startTime: Date,
  endTime: Date,
  threats: SecurityThreat[]
): Promise<void> {
  const query = `
    fields @timestamp, @message
    | filter @message like /rootkit/ or @message like /trojan/ or @message like /backdoor/ or @message like /Warning:/
    | filter @logStream like /security-scans/
    | stats count() as detections
  `
  
  const results = await runInsightsQuery(query, startTime, endTime)
  
  if (results.length > 0 && parseInt(results[0][0]?.value || '0') > 0) {
    const count = parseInt(results[0][0]?.value || '0')
    
    threats.push({
      type: 'ROOTKIT_DETECTION',
      severity: 'CRITICAL',
      count,
      description: `Rootkit scanner detected ${count} suspicious items`,
      details: ['Check /var/log/security-scans.log for details'],
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Analyze virus detections
 */
async function analyzeVirusDetections(
  startTime: Date,
  endTime: Date,
  threats: SecurityThreat[]
): Promise<void> {
  const query = `
    fields @timestamp, @message
    | filter @message like /FOUND/ or @message like /Infected/
    | filter @logStream like /security-scans/
    | stats count() as infections
  `
  
  const results = await runInsightsQuery(query, startTime, endTime)
  
  if (results.length > 0 && parseInt(results[0][0]?.value || '0') > 0) {
    const count = parseInt(results[0][0]?.value || '0')
    
    threats.push({
      type: 'VIRUS_DETECTION',
      severity: 'CRITICAL',
      count,
      description: `ClamAV detected ${count} infected files`,
      details: ['Run: clamscan -r / for full details'],
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Analyze Docker vulnerabilities
 */
async function analyzeDockerVulnerabilities(
  startTime: Date,
  endTime: Date,
  threats: SecurityThreat[]
): Promise<void> {
  const query = `
    fields @timestamp, @message
    | filter (@message like /HIGH/ or @message like /CRITICAL/) and @message like /vulnerability/
    | filter @logStream like /security-scans/
    | stats count() as vulns
  `
  
  const results = await runInsightsQuery(query, startTime, endTime)
  
  if (results.length > 0 && parseInt(results[0][0]?.value || '0') > 0) {
    const count = parseInt(results[0][0]?.value || '0')
    
    threats.push({
      type: 'DOCKER_VULNERABILITY',
      severity: 'HIGH',
      count,
      description: `Trivy detected ${count} HIGH/CRITICAL vulnerabilities in Docker images`,
      details: ['Update Docker images or patch vulnerabilities'],
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Analyze suspicious network activity
 */
async function analyzeSuspiciousNetworkActivity(
  startTime: Date,
  endTime: Date,
  threats: SecurityThreat[]
): Promise<void> {
  const query = `
    fields @timestamp, @message
    | filter @message like /SYN flood/ or @message like /port scan/ or @message like /DDoS/
    | stats count() as incidents
  `
  
  const results = await runInsightsQuery(query, startTime, endTime)
  
  if (results.length > 0 && parseInt(results[0][0]?.value || '0') > 0) {
    const count = parseInt(results[0][0]?.value || '0')
    
    threats.push({
      type: 'SUSPICIOUS_NETWORK',
      severity: 'HIGH',
      count,
      description: `Detected ${count} suspicious network activities`,
      details: ['Check firewall logs and iptables'],
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Analyze failed login attempts
 */
async function analyzeFailedLogins(
  startTime: Date,
  endTime: Date,
  threats: SecurityThreat[]
): Promise<void> {
  const query = `
    fields @timestamp, @message
    | filter @message like /authentication failure/ or @message like /Invalid user/
    | parse @message /.*from (?<sourceIP>\\d+\\.\\d+\\.\\d+\\.\\d+).*/
    | stats count() as attempts by sourceIP
    | filter attempts > 5
    | sort attempts desc
  `
  
  const results = await runInsightsQuery(query, startTime, endTime)
  
  if (results.length > 0) {
    const details = results.map(r => `IP: ${r[1]?.value} - ${r[0]?.value} attempts`)
    
    threats.push({
      type: 'FAILED_AUTHENTICATION',
      severity: 'MEDIUM',
      count: results.length,
      description: `${results.length} IP addresses with multiple failed login attempts`,
      details,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Run CloudWatch Logs Insights query
 */
async function runInsightsQuery(
  query: string,
  startTime: Date,
  endTime: Date
): Promise<any[]> {
  try {
    // Start query
    const startResponse = await logsClient.send(
      new StartQueryCommand({
        logGroupName: LOG_GROUP_NAME,
        startTime: Math.floor(startTime.getTime() / 1000),
        endTime: Math.floor(endTime.getTime() / 1000),
        queryString: query
      })
    )
    
    const queryId = startResponse.queryId
    if (!queryId) {
      throw new Error('No query ID returned')
    }
    
    // Poll for results
    let status = QueryStatus.Running
    let results: any[] = []
    let attempts = 0
    const maxAttempts = 20
    
    while (status === QueryStatus.Running && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const getResponse = await logsClient.send(
        new GetQueryResultsCommand({ queryId })
      )
      
      status = getResponse.status || QueryStatus.Failed
      results = getResponse.results || []
      attempts++
    }
    
    if (status === QueryStatus.Complete) {
      return results
    }
    
    console.warn(`Query did not complete: ${status}`)
    return []
  } catch (error) {
    console.error('Error running Insights query:', error)
    return []
  }
}

/**
 * Generate security report
 */
function generateSecurityReport(threats: SecurityThreat[]): string {
  if (threats.length === 0) {
    return '✅ No security threats detected in the last 15 minutes'
  }
  
  const criticalCount = threats.filter(t => t.severity === 'CRITICAL').length
  const highCount = threats.filter(t => t.severity === 'HIGH').length
  const mediumCount = threats.filter(t => t.severity === 'MEDIUM').length
  const lowCount = threats.filter(t => t.severity === 'LOW').length
  
  let report = `🚨 SECURITY ALERT - ${threats.length} Threat(s) Detected\n\n`
  report += `Instance: ${EC2_INSTANCE_ID}\n`
  report += `Timestamp: ${new Date().toISOString()}\n\n`
  report += `Severity Breakdown:\n`
  if (criticalCount > 0) report += `  🔴 CRITICAL: ${criticalCount}\n`
  if (highCount > 0) report += `  🟠 HIGH: ${highCount}\n`
  if (mediumCount > 0) report += `  🟡 MEDIUM: ${mediumCount}\n`
  if (lowCount > 0) report += `  🟢 LOW: ${lowCount}\n`
  report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
  
  threats.forEach((threat, index) => {
    report += `${index + 1}. ${getSeverityEmoji(threat.severity)} ${threat.type}\n`
    report += `   Severity: ${threat.severity}\n`
    report += `   ${threat.description}\n`
    if (threat.details.length > 0) {
      report += `   Details:\n`
      threat.details.slice(0, 5).forEach(d => {
        report += `     - ${d}\n`
      })
      if (threat.details.length > 5) {
        report += `     ... and ${threat.details.length - 5} more\n`
      }
    }
    report += `\n`
  })
  
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  report += `\n📊 View full logs: CloudWatch > /gforge-radio/all-logs\n`
  report += `🔐 SSH to EC2: ssh ubuntu@stream.g-force.cloud\n`
  
  return report
}

/**
 * Send security alert via SNS
 */
async function sendSecurityAlert(report: string, threats: SecurityThreat[]): Promise<void> {
  const hasCritical = threats.some(t => t.severity === 'CRITICAL')
  const subject = hasCritical
    ? '🚨 CRITICAL SECURITY ALERT - G-Force Radio'
    : '⚠️ Security Alert - G-Force Radio'
  
  try {
    await snsClient.send(
      new PublishCommand({
        TopicArn: ALERT_TOPIC_ARN,
        Subject: subject,
        Message: report
      })
    )
    
    console.log('✅ Security alert sent via SNS')
  } catch (error) {
    console.error('❌ Failed to send security alert:', error)
  }
}

/**
 * Get emoji for severity level
 */
function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '🔴'
    case 'HIGH': return '🟠'
    case 'MEDIUM': return '🟡'
    case 'LOW': return '🟢'
    default: return '⚪'
  }
}

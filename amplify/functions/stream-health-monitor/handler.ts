/**
 * Stream Health Monitor - BULLETPROOF!
 * 
 * Runs every 1 minute via EventBridge
 * 
 * CHECKS:
 * 1. Is Icecast responding?
 * 2. Is stream actually flowing (bitrate check)?
 * 3. Is Liquidsoap process running?
 * 4. Are there tracks on disk?
 * 
 * ACTIONS:
 * 1. Auto-restart Liquidsoap if crashed
 * 2. Switch to emergency playlist if main fails
 * 3. Send SNS alert if down > 2 minutes
 * 4. Log all events to DynamoDB
 */
import { SSMClient, SendCommandCommand, GetCommandInvocationCommand } from '@aws-sdk/client-ssm'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import * as http from 'http'

const ssm = new SSMClient({})
const sns = new SNSClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID || ''
const SNS_ALERT_TOPIC = process.env.SNS_ALERT_TOPIC || ''
const HEALTH_LOG_TABLE = process.env.HEALTH_LOG_TABLE || ''

interface HealthCheck {
  timestamp: string
  icecastUp: boolean
  streamFlowing: boolean
  liquidsoakRunning: boolean
  trackCount: number
  bitrate: number | null
  listenerCount: number
  currentTrack: string | null
  actionsTaken: string[]
}

/**
 * Check if Icecast is responding
 */
async function checkIcecast(): Promise<{ up: boolean, bitrate: number | null, listeners: number, track: string | null }> {
  return new Promise((resolve) => {
    const req = http.get('http://79.125.44.178:8000/status-json.xsl', (res) => {
      let data = ''
      
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const source = json.icestats?.source
          
          if (source) {
            resolve({
              up: true,
              bitrate: source.bitrate || null,
              listeners: source.listeners || 0,
              track: source.title || null
            })
          } else {
            resolve({ up: false, bitrate: null, listeners: 0, track: null })
          }
        } catch (err) {
          resolve({ up: false, bitrate: null, listeners: 0, track: null })
        }
      })
    })
    
    req.on('error', () => {
      resolve({ up: false, bitrate: null, listeners: 0, track: null })
    })
    
    req.setTimeout(5000, () => {
      req.destroy()
      resolve({ up: false, bitrate: null, listeners: 0, track: null })
    })
  })
}

/**
 * Check if Liquidsoap process is running on EC2
 */
async function checkLiquidsoap(): Promise<boolean> {
  try {
    const result = await ssm.send(new SendCommandCommand({
      InstanceIds: [EC2_INSTANCE_ID],
      DocumentName: 'AWS-RunShellScript',
      Parameters: {
        commands: ['pgrep -f "liquidsoap /opt/radio/radio.liq" > /dev/null && echo "running" || echo "stopped"']
      }
    }))
    
    const commandId = result.Command?.CommandId
    if (!commandId) return false
    
    // Wait for result
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const invocation = await ssm.send(new GetCommandInvocationCommand({
      CommandId: commandId,
      InstanceId: EC2_INSTANCE_ID
    }))
    
    const output = invocation.StandardOutputContent || ''
    return output.trim() === 'running'
  } catch (err) {
    console.error('Failed to check Liquidsoap:', err)
    return false
  }
}

/**
 * Check track count on EC2
 */
async function checkTrackCount(): Promise<number> {
  try {
    const result = await ssm.send(new SendCommandCommand({
      InstanceIds: [EC2_INSTANCE_ID],
      DocumentName: 'AWS-RunShellScript',
      Parameters: {
        commands: ['ls -1 /var/radio/tracks/*.mp3 /var/radio/tracks/*.wav 2>/dev/null | grep -v news-latest | wc -l']
      }
    }))
    
    const commandId = result.Command?.CommandId
    if (!commandId) return 0
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const invocation = await ssm.send(new GetCommandInvocationCommand({
      CommandId: commandId,
      InstanceId: EC2_INSTANCE_ID
    }))
    
    const output = invocation.StandardOutputContent || '0'
    return parseInt(output.trim()) || 0
  } catch (err) {
    console.error('Failed to check track count:', err)
    return 0
  }
}

/**
 * Restart Liquidsoap on EC2
 */
async function restartLiquidsoap(): Promise<boolean> {
  try {
    console.log('🔄 Restarting Liquidsoap...')
    
    await ssm.send(new SendCommandCommand({
      InstanceIds: [EC2_INSTANCE_ID],
      DocumentName: 'AWS-RunShellScript',
      Parameters: {
        commands: [
          'sudo pkill -9 -f liquidsoap',
          'sleep 3',
          'sudo rm -f /tmp/liquidsoap.log',
          'sudo -u root nohup /usr/bin/liquidsoap /opt/radio/radio.liq > /tmp/liquidsoap.log 2>&1 &',
          'sleep 5',
          'pgrep -f liquidsoap > /dev/null && echo "SUCCESS" || echo "FAILED"'
        ]
      }
    }))
    
    console.log('✅ Liquidsoap restart command sent')
    return true
  } catch (err) {
    console.error('❌ Failed to restart Liquidsoap:', err)
    return false
  }
}

/**
 * Switch to emergency playlist
 */
async function switchToEmergencyPlaylist(): Promise<boolean> {
  try {
    console.log('🚨 Switching to EMERGENCY playlist...')
    
    await ssm.send(new SendCommandCommand({
      InstanceIds: [EC2_INSTANCE_ID],
      DocumentName: 'AWS-RunShellScript',
      Parameters: {
        commands: [
          'cp /var/radio/playlists/emergency.m3u /var/radio/playlists/current.m3u',
          'echo "Switched to emergency playlist at $(date)" >> /tmp/emergency.log'
        ]
      }
    }))
    
    console.log('✅ Emergency playlist activated')
    return true
  } catch (err) {
    console.error('❌ Failed to switch to emergency playlist:', err)
    return false
  }
}

/**
 * Send SNS alert
 */
async function sendAlert(subject: string, message: string): Promise<void> {
  if (!SNS_ALERT_TOPIC) {
    console.log('⚠️ No SNS topic configured, skipping alert')
    return
  }
  
  try {
    await sns.send(new PublishCommand({
      TopicArn: SNS_ALERT_TOPIC,
      Subject: `🚨 Splash FM Alert: ${subject}`,
      Message: message
    }))
    
    console.log(`📧 Alert sent: ${subject}`)
  } catch (err) {
    console.error('Failed to send alert:', err)
  }
}

/**
 * Log health check to DynamoDB
 */
async function logHealthCheck(check: HealthCheck): Promise<void> {
  try {
    await dynamodb.send(new PutCommand({
      TableName: HEALTH_LOG_TABLE,
      Item: {
        ...check,
        ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
      }
    }))
  } catch (err) {
    console.error('Failed to log health check:', err)
  }
}

/**
 * Check if we need to send alert (stream down > 2 minutes)
 */
async function shouldSendAlert(): Promise<boolean> {
  try {
    // Query last 3 health checks
    const result = await dynamodb.send(new QueryCommand({
      TableName: HEALTH_LOG_TABLE,
      KeyConditionExpression: '#t > :time',
      ExpressionAttributeNames: { '#t': 'timestamp' },
      ExpressionAttributeValues: {
        ':time': new Date(Date.now() - 3 * 60 * 1000).toISOString()
      },
      Limit: 3,
      ScanIndexForward: false
    }))
    
    const checks = result.Items || []
    
    // If all last 3 checks failed, send alert
    if (checks.length >= 3) {
      return checks.every((c: any) => !c.icecastUp || !c.streamFlowing)
    }
    
    return false
  } catch (err) {
    console.error('Failed to check alert history:', err)
    return false
  }
}

/**
 * Main handler
 */
export const handler = async () => {
  console.log('🔍 Running health check...')
  
  const timestamp = new Date().toISOString()
  const actionsTaken: string[] = []
  
  // 1. Check Icecast
  const icecast = await checkIcecast()
  console.log(`Icecast: ${icecast.up ? '✅' : '❌'} (bitrate: ${icecast.bitrate}, listeners: ${icecast.listeners})`)
  
  // 2. Check Liquidsoap process
  const liquidsoakRunning = await checkLiquidsoap()
  console.log(`Liquidsoap: ${liquidsoakRunning ? '✅' : '❌'}`)
  
  // 3. Check track count
  const trackCount = await checkTrackCount()
  console.log(`Tracks on disk: ${trackCount}`)
  
  // 4. Determine if stream is flowing
  const streamFlowing = icecast.up && icecast.bitrate !== null && icecast.bitrate > 0
  
  // 5. Take actions if needed
  if (!liquidsoakRunning) {
    actionsTaken.push('restart_liquidsoap')
    await restartLiquidsoap()
    await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10s for restart
  }
  
  if (!streamFlowing && trackCount === 0) {
    actionsTaken.push('switch_to_emergency')
    await switchToEmergencyPlaylist()
    await restartLiquidsoap()
  }
  
  // 6. Check if we should send alert
  if (!icecast.up || !streamFlowing) {
    const shouldAlert = await shouldSendAlert()
    
    if (shouldAlert) {
      actionsTaken.push('send_alert')
      await sendAlert(
        'Stream Down for 2+ Minutes',
        `Stream Status:
        
Icecast: ${icecast.up ? 'UP' : 'DOWN'}
Stream Flowing: ${streamFlowing ? 'YES' : 'NO'}
Bitrate: ${icecast.bitrate || 'N/A'}
Listeners: ${icecast.listeners}
Liquidsoap: ${liquidsoakRunning ? 'RUNNING' : 'STOPPED'}
Tracks on Disk: ${trackCount}

Actions Taken: ${actionsTaken.join(', ') || 'none'}

Time: ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
        `
      )
    }
  }
  
  // 7. Log health check
  const check: HealthCheck = {
    timestamp,
    icecastUp: icecast.up,
    streamFlowing,
    liquidsoakRunning,
    trackCount,
    bitrate: icecast.bitrate,
    listenerCount: icecast.listeners,
    currentTrack: icecast.track,
    actionsTaken
  }
  
  await logHealthCheck(check)
  
  console.log('✅ Health check complete')
  
  return {
    statusCode: 200,
    body: JSON.stringify(check)
  }
}

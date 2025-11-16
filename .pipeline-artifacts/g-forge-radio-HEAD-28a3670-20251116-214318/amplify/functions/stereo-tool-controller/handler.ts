/**
 * 🎚️ Stereo Tool Controller Lambda
 * 
 * Advanced control interface for Stereo Tool on EC2
 * - Start/Stop processing
 * - Bypass toggle (on/off)
 * - Preset loading
 * - Status monitoring
 * 
 * Uses SSM Run Command to execute stereo-tool CLI commands on EC2
 */

import { SSMClient, SendCommandCommand, GetCommandInvocationCommand } from '@aws-sdk/client-ssm';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data';

const ssmClient = new SSMClient({ region: process.env.AWS_REGION });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const iotClient = new IoTDataPlaneClient({ region: process.env.AWS_REGION });

const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID || 'i-021451e919d39c898';
const STATE_TABLE = process.env.STATE_TABLE || 'StereoToolState';
const IOT_TOPIC = 'stereo-tool/status';

interface StereoToolCommand {
  action: 'start' | 'stop' | 'bypass' | 'unbypass' | 'restart' | 'status' | 'load-preset';
  preset?: string;
}

interface StereoToolStatus {
  isRunning: boolean;
  isBypassed: boolean;
  currentPreset: string;
  uptime?: number;
  lastUpdate: string;
}

export const handler = async (event: any) => {
  console.log('🎚️ Stereo Tool Controller');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const command: StereoToolCommand = body;
    
    console.log(`Command: ${command.action}`);
    
    // Execute command on EC2
    const result = await executeStereoToolCommand(command);
    
    // Get updated status
    const status = await getStereoToolStatus();
    
    // Save state to DynamoDB
    await saveState(status);
    
    // Publish to IoT for real-time UI updates
    await publishStatus(status);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        command: command.action,
        status,
        result
      })
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Execute Stereo Tool command via SSM
 */
async function executeStereoToolCommand(command: StereoToolCommand): Promise<any> {
  console.log(`Executing: ${command.action}`);
  
  let shellCommand: string;
  
  switch (command.action) {
    case 'start':
      shellCommand = `
        # Start Stereo Tool if not running
        if ! pgrep -f stereotool-cmd > /dev/null; then
          echo "Starting Stereo Tool..."
          nohup /usr/local/bin/stereotool-cmd \
            -s /opt/radio/preset.sts \
            -q 2 \
            http://localhost:8000/stream-raw.mp3 \
            http://localhost:8001/stream-processed.mp3 \
            > /tmp/stereotool.log 2>&1 &
          sleep 2
          echo "✅ Stereo Tool started"
        else
          echo "⚠️  Stereo Tool already running"
        fi
        pgrep -f stereotool-cmd && echo "PID: $(pgrep -f stereotool-cmd)"
      `;
      break;
      
    case 'stop':
      shellCommand = `
        # Stop Stereo Tool
        if pgrep -f stereotool-cmd > /dev/null; then
          echo "Stopping Stereo Tool..."
          pkill -f stereotool-cmd
          sleep 1
          echo "✅ Stereo Tool stopped"
        else
          echo "⚠️  Stereo Tool not running"
        fi
      `;
      break;
      
    case 'bypass':
      shellCommand = `
        # Enable bypass (pass-through mode)
        echo "Enabling bypass mode..."
        # Use Stereo Tool API or kill and restart with bypass flag
        # For now: Stop processing (bypass = direct stream)
        if pgrep -f stereotool-cmd > /dev/null; then
          pkill -f stereotool-cmd
          echo "✅ Bypass enabled (processing stopped)"
        else
          echo "⚠️  Already bypassed (not running)"
        fi
      `;
      break;
      
    case 'unbypass':
      shellCommand = `
        # Disable bypass (resume processing)
        echo "Disabling bypass mode..."
        if ! pgrep -f stereotool-cmd > /dev/null; then
          echo "Starting Stereo Tool..."
          nohup /usr/local/bin/stereotool-cmd \
            -s /opt/radio/preset.sts \
            -q 2 \
            http://localhost:8000/stream-raw.mp3 \
            http://localhost:8001/stream-processed.mp3 \
            > /tmp/stereotool.log 2>&1 &
          sleep 2
          echo "✅ Bypass disabled (processing active)"
        else
          echo "⚠️  Already processing"
        fi
      `;
      break;
      
    case 'restart':
      shellCommand = `
        # Restart Stereo Tool
        echo "Restarting Stereo Tool..."
        pkill -f stereotool-cmd 2>/dev/null
        sleep 2
        nohup /usr/local/bin/stereotool-cmd \
          -s /opt/radio/preset.sts \
          -q 2 \
          http://localhost:8000/stream-raw.mp3 \
          http://localhost:8001/stream-processed.mp3 \
          > /tmp/stereotool.log 2>&1 &
        sleep 2
        echo "✅ Stereo Tool restarted"
        pgrep -f stereotool-cmd && echo "PID: $(pgrep -f stereotool-cmd)"
      `;
      break;
      
    case 'status':
      shellCommand = `
        # Get Stereo Tool status
        if pgrep -f stereotool-cmd > /dev/null; then
          PID=$(pgrep -f stereotool-cmd)
          UPTIME=$(ps -o etime= -p $PID)
          echo "Status: RUNNING"
          echo "PID: $PID"
          echo "Uptime: $UPTIME"
          echo "Bypass: false"
        else
          echo "Status: STOPPED"
          echo "Bypass: true"
        fi
        
        # Check preset
        if [ -f /opt/radio/preset.sts ]; then
          PRESET_SIZE=$(stat -f%z /opt/radio/preset.sts 2>/dev/null || stat -c%s /opt/radio/preset.sts)
          echo "Preset: /opt/radio/preset.sts ($PRESET_SIZE bytes)"
        fi
        
        # Check log
        if [ -f /tmp/stereotool.log ]; then
          echo "Log (last 5 lines):"
          tail -5 /tmp/stereotool.log
        fi
      `;
      break;
      
    case 'load-preset':
      if (!command.preset) {
        throw new Error('Preset path required for load-preset command');
      }
      shellCommand = `
        # Load new preset
        PRESET_PATH="${command.preset}"
        
        if [ ! -f "$PRESET_PATH" ]; then
          echo "❌ Preset not found: $PRESET_PATH"
          exit 1
        fi
        
        echo "Loading preset: $PRESET_PATH"
        
        # Stop if running
        if pgrep -f stereotool-cmd > /dev/null; then
          echo "Stopping Stereo Tool..."
          pkill -f stereotool-cmd
          sleep 1
        fi
        
        # Start with new preset
        echo "Starting with preset: $PRESET_PATH"
        nohup /usr/local/bin/stereotool-cmd \
          -s "$PRESET_PATH" \
          -q 2 \
          http://localhost:8000/stream-raw.mp3 \
          http://localhost:8001/stream-processed.mp3 \
          > /tmp/stereotool.log 2>&1 &
        
        sleep 2
        echo "✅ Preset loaded and Stereo Tool started"
        pgrep -f stereotool-cmd && echo "PID: $(pgrep -f stereotool-cmd)"
      `;
      break;
      
    default:
      throw new Error(`Unknown command: ${command.action}`);
  }
  
  // Execute via SSM
  const ssmCommand = new SendCommandCommand({
    InstanceIds: [EC2_INSTANCE_ID],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: [shellCommand]
    },
    Comment: `Stereo Tool: ${command.action}`
  });
  
  const response = await ssmClient.send(ssmCommand);
  const commandId = response.Command?.CommandId;
  
  if (!commandId) {
    throw new Error('Failed to get command ID from SSM');
  }
  
  console.log(`SSM Command ID: ${commandId}`);
  
  // Wait for command to complete (max 10 seconds)
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Get command result
  const invocation = await ssmClient.send(new GetCommandInvocationCommand({
    CommandId: commandId,
    InstanceId: EC2_INSTANCE_ID
  }));
  
  console.log('Command output:', invocation.StandardOutputContent);
  if (invocation.StandardErrorContent) {
    console.error('Command error:', invocation.StandardErrorContent);
  }
  
  return {
    commandId,
    status: invocation.Status,
    output: invocation.StandardOutputContent,
    error: invocation.StandardErrorContent
  };
}

/**
 * Get current Stereo Tool status from EC2
 */
async function getStereoToolStatus(): Promise<StereoToolStatus> {
  const statusCommand = await executeStereoToolCommand({ action: 'status' });
  const output = statusCommand.output || '';
  
  const isRunning = output.includes('Status: RUNNING');
  const isBypassed = output.includes('Bypass: true') || !isRunning;
  
  // Parse uptime if available
  const uptimeMatch = output.match(/Uptime: (.+)/);
  const uptime = uptimeMatch ? uptimeMatch[1] : undefined;
  
  // Parse preset
  const presetMatch = output.match(/Preset: (.+\.sts)/);
  const currentPreset = presetMatch ? presetMatch[1] : '/opt/radio/preset.sts';
  
  return {
    isRunning,
    isBypassed,
    currentPreset,
    uptime: uptime ? parseUptime(uptime) : undefined,
    lastUpdate: new Date().toISOString()
  };
}

/**
 * Parse uptime string to seconds
 */
function parseUptime(uptime: string): number {
  // Format: "00:05:23" or "1-00:05:23"
  const parts = uptime.trim().split(/[-:]/);
  let seconds = 0;
  
  if (parts.length === 4) {
    // Days-HH:MM:SS
    seconds = parseInt(parts[0]) * 86400 + parseInt(parts[1]) * 3600 + parseInt(parts[2]) * 60 + parseInt(parts[3]);
  } else if (parts.length === 3) {
    // HH:MM:SS
    seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  
  return seconds;
}

/**
 * Save state to DynamoDB
 */
async function saveState(status: StereoToolStatus): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: STATE_TABLE,
    Item: {
      id: 'stereo-tool-status',
      ...status,
      ttl: Math.floor(Date.now() / 1000) + 86400 // 24h TTL
    }
  }));
  
  console.log('✅ State saved to DynamoDB');
}

/**
 * Publish status to IoT for real-time UI updates
 */
async function publishStatus(status: StereoToolStatus): Promise<void> {
  await iotClient.send(new PublishCommand({
    topic: IOT_TOPIC,
    payload: Buffer.from(JSON.stringify({
      type: 'status-update',
      status,
      timestamp: new Date().toISOString()
    })),
    qos: 0
  }));
  
  console.log('✅ Status published to IoT');
}

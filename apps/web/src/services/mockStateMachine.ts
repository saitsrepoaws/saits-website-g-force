/**
 * Mock State Machine - DEPRECATED ❌
 * 
 * This file is NO LONGER USED!
 * Real AWS State Machine is now active via IoT Rule + Lambda
 * 
 * Schedule data is in DynamoDB
 * Lambda reads from DynamoDB and determines tracks
 * 
 * This mock was only needed during development when schedule was in localStorage
 * Now everything runs on AWS infrastructure!
 */

/**
 * Start Mock State Machine - NO-OP
 * Real AWS Lambda handles all logic now
 */
export function startMockStateMachine() {
  console.log('⚠️ Mock State Machine is DISABLED - using real AWS Lambda + DynamoDB')
  console.log('📍 Schedule data is in DynamoDB')
  console.log('📍 IoT Rule triggers AWS Step Functions')
  console.log('📍 Lambda determines tracks from schedule')
}

/**
 * Stop Mock State Machine - NO-OP
 */
export function stopMockStateMachine() {
  // No-op - nothing to stop
}

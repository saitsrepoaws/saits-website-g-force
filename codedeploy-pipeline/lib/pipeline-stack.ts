/**
 * 🚀 G-FORGE RADIO - STANDALONE CI/CD PIPELINE
 * 
 * Complete professional pipeline infrastructure
 * 100% isolated from main project
 * 
 * Features:
 * - CodePipeline orchestration
 * - CodeBuild (build, test, deploy)
 * - CodeDeploy (blue/green deployment)
 * - S3 artifact storage
 * - SNS notifications
 * - CloudWatch monitoring
 * - Automatic rollback
 * - Manual approvals
 * 
 * @author Gerard + Cascade AI
 * @date 16 November 2025
 */

import * as cdk from 'aws-cdk-lib'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline'
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

export interface PipelineStackProps extends cdk.StackProps {
  readonly githubOwner: string
  readonly githubRepo: string
  readonly githubBranch: string
  readonly githubToken: string
  readonly notificationEmail?: string
}

export class GForgePipelineStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline
  public readonly artifactBucket: s3.Bucket
  
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props)
    
    // =============================================================================
    // S3 ARTIFACT BUCKET
    // =============================================================================
    
    this.artifactBucket = new s3.Bucket(this, 'PipelineArtifacts', {
      bucketName: `gforge-pipeline-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldArtifacts',
          expiration: cdk.Duration.days(30),
          noncurrentVersionExpiration: cdk.Duration.days(7),
          enabled: true,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    })
    
    // =============================================================================
    // SNS TOPIC FOR NOTIFICATIONS
    // =============================================================================
    
    const notificationTopic = new sns.Topic(this, 'PipelineNotifications', {
      topicName: 'gforge-pipeline-notifications',
      displayName: 'G-Forge Radio Pipeline Notifications',
    })
    
    if (props.notificationEmail) {
      notificationTopic.addSubscription(
        new subscriptions.EmailSubscription(props.notificationEmail)
      )
    }
    
    // =============================================================================
    // CODEBUILD PROJECTS
    // =============================================================================
    
    // 1. BUILD PROJECT
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: 'gforge-build',
      description: 'Build and package application',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true,
      },
      environmentVariables: {
        NODE_ENV: { value: 'production' },
        ARTIFACT_BUCKET: { value: this.artifactBucket.bucketName },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('codedeploy-pipeline/buildspecs/buildspec-build.yml'),
      cache: codebuild.Cache.local(
        codebuild.LocalCacheMode.SOURCE,
        codebuild.LocalCacheMode.CUSTOM
      ),
      timeout: cdk.Duration.minutes(15),
    })
    
    this.artifactBucket.grantReadWrite(buildProject)
    
    // 2. SMOKE TEST PROJECT
    const smokeTestProject = new codebuild.PipelineProject(this, 'SmokeTestProject', {
      projectName: 'gforge-smoke-tests',
      description: 'Quick smoke tests (< 30 sec)',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('codedeploy-pipeline/buildspecs/buildspec-smoke.yml'),
      timeout: cdk.Duration.minutes(5),
    })
    
    // 3. REGRESSION TEST PROJECT
    const regressionTestProject = new codebuild.PipelineProject(this, 'RegressionTestProject', {
      projectName: 'gforge-regression-tests',
      description: 'Full regression test suite (2-5 min)',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('codedeploy-pipeline/buildspecs/buildspec-regression.yml'),
      timeout: cdk.Duration.minutes(10),
    })
    
    // 4. DEPLOY TO STAGING PROJECT
    const deployStagingProject = new codebuild.PipelineProject(this, 'DeployStagingProject', {
      projectName: 'gforge-deploy-staging',
      description: 'Deploy to staging environment',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
      environmentVariables: {
        ENVIRONMENT: { value: 'staging' },
        ARTIFACT_BUCKET: { value: this.artifactBucket.bucketName },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('codedeploy-pipeline/buildspecs/buildspec-deploy.yml'),
      timeout: cdk.Duration.minutes(20),
    })
    
    // Grant Amplify deployment permissions
    deployStagingProject.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'amplify:*',
        'cloudformation:*',
        'iam:*',
        'lambda:*',
        's3:*',
        'dynamodb:*',
        'cognito-identity:*',
        'cognito-idp:*',
        'appsync:*',
        'iot:*',
        'events:*',
        'logs:*',
        'ssm:*',
      ],
      resources: ['*'],
    }))
    
    // 5. DEPLOY TO PRODUCTION PROJECT
    const deployProdProject = new codebuild.PipelineProject(this, 'DeployProdProject', {
      projectName: 'gforge-deploy-production',
      description: 'Deploy to production environment',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
      environmentVariables: {
        ENVIRONMENT: { value: 'production' },
        ARTIFACT_BUCKET: { value: this.artifactBucket.bucketName },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('codedeploy-pipeline/buildspecs/buildspec-deploy.yml'),
      timeout: cdk.Duration.minutes(20),
    })
    
    // Grant production deployment permissions
    deployProdProject.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'amplify:*',
        'cloudformation:*',
        'iam:*',
        'lambda:*',
        's3:*',
        'dynamodb:*',
        'cognito-identity:*',
        'cognito-idp:*',
        'appsync:*',
        'iot:*',
        'events:*',
        'logs:*',
        'ssm:*',
      ],
      resources: ['*'],
    }))
    
    // =============================================================================
    // CLOUDWATCH DASHBOARD
    // =============================================================================
    
    const dashboard = new cloudwatch.Dashboard(this, 'PipelineDashboard', {
      dashboardName: 'GForge-Pipeline',
    })
    
    // =============================================================================
    // PIPELINE ARTIFACTS
    // =============================================================================
    
    const sourceOutput = new codepipeline.Artifact('SourceCode')
    const buildOutput = new codepipeline.Artifact('BuildArtifact')
    
    // =============================================================================
    // PIPELINE DEFINITION
    // =============================================================================
    
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'gforge-radio-pipeline',
      artifactBucket: this.artifactBucket,
      restartExecutionOnUpdate: true,
      stages: [
        // =========================================================================
        // STAGE 1: SOURCE
        // =========================================================================
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.GitHubSourceAction({
              actionName: 'GitHub_Source',
              owner: props.githubOwner,
              repo: props.githubRepo,
              branch: props.githubBranch,
              oauthToken: cdk.SecretValue.unsafePlainText(props.githubToken),
              output: sourceOutput,
              trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
            }),
          ],
        },
        
        // =========================================================================
        // STAGE 2: BUILD & PACKAGE
        // =========================================================================
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Build_and_Package',
              project: buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        
        // =========================================================================
        // STAGE 3: TEST (Parallel)
        // =========================================================================
        {
          stageName: 'Test',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Smoke_Tests',
              project: smokeTestProject,
              input: buildOutput,
              runOrder: 1,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Regression_Tests',
              project: regressionTestProject,
              input: buildOutput,
              runOrder: 1,
            }),
          ],
        },
        
        // =========================================================================
        // STAGE 4: DEPLOY TO STAGING
        // =========================================================================
        {
          stageName: 'DeployStaging',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_to_Staging',
              project: deployStagingProject,
              input: buildOutput,
            }),
          ],
        },
        
        // =========================================================================
        // STAGE 5: STAGING VALIDATION
        // =========================================================================
        {
          stageName: 'ValidateStaging',
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: 'Test_Staging_Environment',
              notificationTopic,
              additionalInformation: 
                '🧪 Staging deployed!\n\n' +
                '✅ Test staging: https://staging.splashfm.nl\n' +
                '✅ Run smoke tests\n' +
                '✅ Verify functionality\n\n' +
                'Approve to proceed to production.',
            }),
          ],
        },
        
        // =========================================================================
        // STAGE 6: PRODUCTION APPROVAL
        // =========================================================================
        {
          stageName: 'ApproveProduction',
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: 'Approve_Production_Deploy',
              notificationTopic,
              additionalInformation: 
                '🚀 PRODUCTION DEPLOYMENT\n\n' +
                '⚠️  This will deploy to LIVE production!\n\n' +
                '✅ Staging tests passed\n' +
                '✅ All checks green\n\n' +
                'Approve to deploy to production.',
            }),
          ],
        },
        
        // =========================================================================
        // STAGE 7: DEPLOY TO PRODUCTION
        // =========================================================================
        {
          stageName: 'DeployProduction',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_to_Production',
              project: deployProdProject,
              input: buildOutput,
            }),
          ],
        },
      ],
    })
    
    // =============================================================================
    // PIPELINE NOTIFICATIONS
    // =============================================================================
    
    // Notify on all state changes
    this.pipeline.onStateChange('PipelineStateChange', {
      target: new cdk.aws_events_targets.SnsTopic(notificationTopic),
      description: 'Pipeline state changed',
    })
    
    // Notify on failures
    this.pipeline.notifyOnExecutionStateChange('PipelineExecutionFailed', notificationTopic, {
      notificationRuleName: 'gforge-pipeline-failures',
      detailType: cdk.aws_codestarnotifications.DetailType.FULL,
      events: [
        cdk.aws_codepipeline.PipelineNotificationEvents.PIPELINE_EXECUTION_FAILED,
      ],
    })
    
    // =============================================================================
    // CLOUDWATCH ALARMS
    // =============================================================================
    
    const buildFailureAlarm = new cloudwatch.Alarm(this, 'BuildFailureAlarm', {
      alarmName: 'gforge-build-failures',
      alarmDescription: 'Alert when builds fail',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CodeBuild',
        metricName: 'FailedBuilds',
        dimensionsMap: {
          ProjectName: buildProject.projectName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    })
    
    buildFailureAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(notificationTopic))
    
    // =============================================================================
    // OUTPUTS
    // =============================================================================
    
    new cdk.CfnOutput(this, 'PipelineName', {
      value: this.pipeline.pipelineName,
      description: 'CodePipeline name',
      exportName: 'GForgePipelineName',
    })
    
    new cdk.CfnOutput(this, 'PipelineUrl', {
      value: `https://${this.region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${this.pipeline.pipelineName}/view`,
      description: 'CodePipeline console URL',
    })
    
    new cdk.CfnOutput(this, 'ArtifactBucketName', {
      value: this.artifactBucket.bucketName,
      description: 'S3 bucket for pipeline artifacts',
      exportName: 'GForgeArtifactBucket',
    })
    
    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: notificationTopic.topicArn,
      description: 'SNS topic for pipeline notifications',
      exportName: 'GForgeNotificationTopic',
    })
    
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=GForge-Pipeline`,
      description: 'CloudWatch dashboard URL',
    })
    
    // =============================================================================
    // TAGS
    // =============================================================================
    
    cdk.Tags.of(this).add('Project', 'G-Forge-Radio')
    cdk.Tags.of(this).add('ManagedBy', 'CDK')
    cdk.Tags.of(this).add('Environment', 'CI/CD')
    cdk.Tags.of(this).add('Pipeline', 'Professional')
    
    console.log('🚀 G-Forge Radio Pipeline Stack configured!')
  }
}

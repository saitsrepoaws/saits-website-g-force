# CloudFormation Change Sets - Best Practice Workflow

**Date:** 15 November 2025  
**Gerard's Request:** "werk met change sets maatje tipje voor de volgende keer"

## Why Use Change Sets?

✅ **Preview changes BEFORE deployment**  
✅ **See exact resources: CREATE/UPDATE/DELETE**  
✅ **Avoid surprises** (like unexpected EC2 instances!)  
✅ **Catch resource conflicts early**  
✅ **Safer, more controlled deployments**

---

## Standard CloudFormation Workflow

### 1. Create Change Set
```bash
aws cloudformation create-change-set \
  --stack-name my-stack \
  --change-set-name preview-changes-001 \
  --template-body file://template.yaml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region eu-west-1
```

### 2. Review Changes
```bash
aws cloudformation describe-change-set \
  --stack-name my-stack \
  --change-set-name preview-changes-001 \
  --region eu-west-1 \
  --query 'Changes[*].[Type,ResourceChange.Action,ResourceChange.LogicalResourceId,ResourceChange.ResourceType]' \
  --output table
```

**Example Output:**
```
----------------------------------------------------------------------
| DescribeChangeSet                                                  |
+--------+--------+---------------------+----------------------------+
| Change | CREATE | NewEC2Instance      | AWS::EC2::Instance         |
| Change | UPDATE | ExistingLambda      | AWS::Lambda::Function      |
| Change | DELETE | OldSQSQueue         | AWS::SQS::Queue            |
+--------+--------+---------------------+----------------------------+
```

### 3. Execute (if OK)
```bash
aws cloudformation execute-change-set \
  --stack-name my-stack \
  --change-set-name preview-changes-001 \
  --region eu-west-1
```

### 4. Cancel (if not OK)
```bash
aws cloudformation delete-change-set \
  --stack-name my-stack \
  --change-set-name preview-changes-001 \
  --region eu-west-1
```

---

## Amplify Sandbox (Limited Support)

Amplify manages CloudFormation internally, so direct change sets aren't available.

**Alternative Approach:**

### 1. Review Synthesized Template
```bash
# After synthesis, check what will deploy
ls cdk.out/

# View main template
cat cdk.out/amplify-gforgeiot-gerard3-sandbox-*.template.json | jq '.Resources | keys'
```

### 2. Compare with Current Stack
```bash
# Get current stack resources
aws cloudformation list-stack-resources \
  --stack-name amplify-gforgeiot-gerard3-sandbox-e97da0c3ef \
  --region eu-west-1 \
  --query 'StackResourceSummaries[*].LogicalResourceId' \
  --output text > current-resources.txt

# Get new template resources
cat cdk.out/amplify-*.template.json | jq -r '.Resources | keys[]' > new-resources.txt

# Compare
diff current-resources.txt new-resources.txt
```

### 3. Check for New EC2/Expensive Resources
```bash
# Before deployment, check if EC2 will be created
grep -r "AWS::EC2::Instance" cdk.out/*.template.json && echo "⚠️ EC2 INSTANCE WILL BE CREATED!"

# Check for other expensive resources
grep -r "AWS::RDS::\|AWS::ECS::\|AWS::EKS::" cdk.out/*.template.json
```

---

## What We Would Have Caught Today

If we used change sets, we would have seen:

❌ **New EC2 Instance** → `i-044ea4a949c8f562a` (79.125.44.178)  
❌ **New EventBridge Rules** → Conflicts with existing names  
❌ **New IoT Rules** → Name validation errors (hyphens)  
❌ **New SQS Queue** → `radio-track-stream-queue-v2.fifo`

**We could have:**
1. Seen the EC2 creation before it happened
2. Decided to comment out EC2 code first
3. Fixed IoT rule names BEFORE first deployment
4. Saved 3-4 deployment cycles (2+ hours)

---

## Cascade's Commitment

**Next deployment, I will:**

1. ✅ Synthesize first (`ampx sandbox` → check `cdk.out/`)
2. ✅ Show Gerard what resources will be created/changed
3. ✅ Highlight expensive resources (EC2, RDS, etc.)
4. ✅ Get confirmation before proceeding
5. ✅ Use `--dry-run` when available

**For manual CloudFormation:**
- Always use change sets
- Never deploy directly
- Review every resource action

---

## Quick Reference

```bash
# Create & review in one go
aws cloudformation create-change-set \
  --stack-name MY_STACK \
  --change-set-name preview-$(date +%s) \
  --template-body file://template.yaml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region eu-west-1 && \
  
aws cloudformation wait change-set-create-complete \
  --stack-name MY_STACK \
  --change-set-name preview-$(date +%s) \
  --region eu-west-1 && \
  
aws cloudformation describe-change-set \
  --stack-name MY_STACK \
  --change-set-name preview-$(date +%s) \
  --region eu-west-1 \
  --output table
```

---

## Benefits Recap

| Without Change Sets | With Change Sets |
|---------------------|------------------|
| ❌ Surprises | ✅ Preview |
| ❌ Rollbacks | ✅ Prevent issues |
| ❌ Wasted time | ✅ Faster |
| ❌ Costly mistakes | ✅ Cost control |

---

**Gerard's wisdom:** "werk met change sets maatje tipje voor de volgende keer" 🍕

**Cascade's promise:** Will do! 🤖💪

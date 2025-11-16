# 🔍 VPC DEPENDENCY CLEANUP REPORT

**Date:** 16 November 2025, 17:27 CET  
**Issue:** CloudFormation stack DELETE_FAILED due to VPC dependencies  
**VPC:** vpc-01b81f989bc673299 (10.0.0.0/16)

---

## 🎯 ROOT CAUSE FOUND

### **The Blockers: 2 Network Load Balancers**

```
VPC: vpc-01b81f989bc673299
└── Network Load Balancers (ACTIVE - Blocking deletion!)
    ├── icecast-stream-nlb (internal)
    │   ├── ENI: eni-097e8d5e47579fb2f (10.0.1.121)
    │   └── ENI: eni-039093d28a12b597c (10.0.0.37)
    └── stereo-tool-nlb-public (internet-facing)
        ├── ENI: eni-0464c3d1f7c9ddfe3 (10.0.1.162)
        └── ENI: eni-0925cd6771a109520 (10.0.0.15)
```

---

## 📊 DETAILED ANALYSIS

### **VPC Details:**

```json
{
  "VpcId": "vpc-01b81f989bc673299",
  "State": "available",
  "CidrBlock": "10.0.0.0/16",
  "CloudFormation Stack": "amplify-gforgeiot-gerard-sandbox-28f2e0c620-function1351588B",
  "Created By": "amplify"
}
```

### **Subnets:**

```
subnet-0b65a010f3283e56f  (10.0.0.0/24)  eu-west-1a  249 IPs available
subnet-0f5c4acd548db0c86  (10.0.1.0/24)  eu-west-1b  249 IPs available
```

### **Network Load Balancers:**

#### **1. icecast-stream-nlb**
```
ARN:    arn:aws:elasticloadbalancing:eu-west-1:035636364722:loadbalancer/net/icecast-stream-nlb/56cb20acadce89c7
Type:   Network Load Balancer
Scheme: internal
State:  active
ENIs:   2 (in both AZs)
```

#### **2. stereo-tool-nlb-public**
```
ARN:    arn:aws:elasticloadbalancing:eu-west-1:035636364722:loadbalancer/net/stereo-tool-nlb-public/f36b730594513f57
Type:   Network Load Balancer  
Scheme: internet-facing
State:  active
ENIs:   2 (in both AZs)
```

---

## 🔄 DEPENDENCY CHAIN

```
CloudFormation Stack (DELETE_FAILED)
  └── function1351588B Nested Stack (DELETE_FAILED)
      └── VPC: vpc-01b81f989bc673299 (Can't delete - dependencies!)
          └── Network Load Balancers (BLOCKING!)
              ├── icecast-stream-nlb
              └── stereo-tool-nlb-public
```

**Why CloudFormation Failed:**
1. Tried to delete VPC
2. VPC has active NLBs
3. NLBs have ENIs (Network Interfaces)
4. ENIs are in-use
5. VPC deletion blocked
6. Stack deletion failed

---

## 💡 CLEANUP STRATEGY

### **Option 1: MANUAL CLEANUP** ⭐ **(Recommended)**

**Step-by-step manual cleanup:**

```bash
# 1. Delete Load Balancers (this will auto-delete ENIs)
echo "🗑️ Deleting icecast-stream-nlb..."
aws elbv2 delete-load-balancer \
  --load-balancer-arn arn:aws:elasticloadbalancing:eu-west-1:035636364722:loadbalancer/net/icecast-stream-nlb/56cb20acadce89c7 \
  --region eu-west-1

echo "🗑️ Deleting stereo-tool-nlb-public..."
aws elbv2 delete-load-balancer \
  --load-balancer-arn arn:aws:elasticloadbalancing:eu-west-1:035636364722:loadbalancer/net/stereo-tool-nlb-public/f36b730594513f57 \
  --region eu-west-1

# 2. Wait for deletion (2-3 minutes)
echo "⏳ Waiting for NLBs to delete..."
sleep 180

# 3. Verify ENIs are gone
aws ec2 describe-network-interfaces \
  --filters "Name=vpc-id,Values=vpc-01b81f989bc673299" \
  --region eu-west-1

# 4. Delete nested stack
aws cloudformation delete-stack \
  --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620-function1351588B-18SZQZAVQ6JS8 \
  --region eu-west-1

# 5. Wait for nested stack deletion
aws cloudformation wait stack-delete-complete \
  --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620-function1351588B-18SZQZAVQ6JS8 \
  --region eu-west-1

# 6. Delete parent stack
aws cloudformation delete-stack \
  --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620 \
  --region eu-west-1

# 7. Deploy fresh
pnpm exec ampx sandbox --once
```

**Time:** ~10-15 minutes  
**Risk:** Low (manual control)  
**Result:** Clean slate

---

### **Option 2: NEW SANDBOX NAME** ⚡ **(Faster)**

```bash
# Skip cleanup entirely, deploy new sandbox
pnpm exec ampx sandbox --once --name v2
```

**Time:** ~5-10 minutes  
**Risk:** None  
**Result:** New clean stack, old resources remain

**Note:** Old NLBs will continue running (minimal cost ~$0.05/day)

---

### **Option 3: AWS CONSOLE** 🖱️ **(Visual)**

1. Open AWS Console
2. Navigate to EC2 → Load Balancers
3. Select both NLBs
4. Click "Actions" → "Delete"
5. Confirm deletion
6. Wait 2-3 minutes
7. Try CloudFormation stack deletion again

---

## 💰 COST IMPACT

### **Current (with orphaned NLBs):**

```
Network Load Balancers:
  - icecast-stream-nlb:       ~$0.025/day
  - stereo-tool-nlb-public:   ~$0.025/day
  Total:                      ~$0.05/day = ~$1.50/month
```

### **After Cleanup:**

```
$0/month (all deleted)
```

---

## ⚠️ IMPORTANT NOTES

### **About EC2 Stream Server:**

These NLBs were created for the EC2 stream server setup:
- **icecast-stream-nlb** → Internal load balancing for Icecast
- **stereo-tool-nlb-public** → Public access to Stereo Tool

**Current Status:**
- EC2 is manually managed (79.125.44.178)
- No longer uses CloudFormation
- NLBs are orphaned (not needed anymore)

**Safe to Delete?**
✅ **YES** - EC2 stream server is independent now

### **What EC2 Currently Uses:**

```
EC2: 79.125.44.178
Services:
  - Icecast (port 8000)
  - Liquidsoap
  - Nginx (port 80, 443)
  
Access:
  - Direct IP: 79.125.44.178
  - Domain: splashfm.nl (via A record)
  - CloudFront: d4clnrcifbyms.cloudfront.net
  
No NLBs needed!
```

---

## 🎯 RECOMMENDED ACTION

### **Gerard's Best Choice:**

**Option 2: New Sandbox Name** ⚡

**Why:**
1. ✅ **Fastest** (5-10 min)
2. ✅ **Zero risk** (no deletion)
3. ✅ **Clean deployment**
4. ✅ **Old resources preserved** (for reference)
5. ✅ **Can cleanup later** (at leisure)

**Command:**

```bash
pnpm exec ampx sandbox --once --name v2
```

**Later (when time):**
- Manually delete old NLBs (~5 min)
- Delete old CloudFormation stacks (~5 min)
- Save ~$1.50/month

---

## 📋 CLEANUP CHECKLIST

### **If doing manual cleanup:**

- [ ] Backup current configuration
- [ ] Delete icecast-stream-nlb
- [ ] Delete stereo-tool-nlb-public
- [ ] Wait 2-3 minutes for ENI deletion
- [ ] Verify ENIs gone
- [ ] Delete nested stack (function1351588B)
- [ ] Wait for nested stack deletion
- [ ] Delete parent stack
- [ ] Wait for parent stack deletion
- [ ] Deploy fresh sandbox
- [ ] Verify deployment

**Total Time:** ~15-20 minutes

### **If doing new sandbox:**

- [ ] Run: `pnpm exec ampx sandbox --once --name v2`
- [ ] Wait 5-10 minutes
- [ ] Verify deployment
- [ ] Done!

**Total Time:** ~5-10 minutes

---

## 🔍 VERIFICATION COMMANDS

### **Check NLBs:**

```bash
aws elbv2 describe-load-balancers \
  --region eu-west-1 \
  --query 'LoadBalancers[?VpcId==`vpc-01b81f989bc673299`]'
```

### **Check ENIs:**

```bash
aws ec2 describe-network-interfaces \
  --filters "Name=vpc-id,Values=vpc-01b81f989bc673299" \
  --region eu-west-1
```

### **Check Stack Status:**

```bash
aws cloudformation describe-stacks \
  --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620 \
  --region eu-west-1 \
  --query 'Stacks[0].StackStatus'
```

---

## ✅ CONCLUSION

**Problem:** VPC can't be deleted due to 2 active Network Load Balancers

**Impact:** CloudFormation stack stuck in DELETE_FAILED

**Solution:** 
- Fast: New sandbox name (recommended!)
- Clean: Manual NLB deletion + stack cleanup

**Cost:** ~$1.50/month if left (negligible)

**Risk:** Low (NLBs not critical, EC2 is independent)

**Recommendation:** Deploy new sandbox now, cleanup later!

---

**Created:** 16 November 2025, 17:27 CET  
**By:** Gerard + Cascade AI  
**Status:** ✅ ANALYSIS COMPLETE

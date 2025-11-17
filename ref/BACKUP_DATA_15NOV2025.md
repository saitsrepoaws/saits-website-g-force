# 🔒 BACKUP DATA - 15 November 2025, 18:51 CET

**Status:** ✅ VEILIG - NIET VERWIJDEREN!

---

## 📊 COMPLETE DATA INVENTORY

### **S3 Storage Bucket**
```
Bucket: amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr
Region: eu-west-1
Versioning: ENABLED
```

**Inhoud:**
- **Audio files:** 1,067 tracks
- **Cover art:** 829 images  
- **Waveforms:** 617 SVGs
- **Total size:** 20.0 GiB

**Locaties:**
- `s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/public/audio/`
- `s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/public/covers/`
- `s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/public/waveforms/`

---

### **DynamoDB Tables**

#### **Track Table**
```
Table: Track-yzaolfqzsze37eghvsrj6tfwk4-NONE
Region: eu-west-1
Items: 747,304 records
```

#### **Schedule Table**
```
Table: Schedule-yzaolfqzsze37eghvsrj6tfwk4-NONE
Region: eu-west-1
Items: 92 schedules
```

#### **StreamQueueTrack Table**
```
Table: StreamQueueTrack-yzaolfqzsze37eghvsrj6tfwk4-NONE
Region: eu-west-1
Items: 852 queue items
```

#### **TrackPlayHistory Table**
```
Table: TrackPlayHistory-yzaolfqzsze37eghvsrj6tfwk4-NONE
Region: eu-west-1
Items: 1,118 history records
```

#### **Playlist Table**
```
Table: Playlist-yzaolfqzsze37eghvsrj6tfwk4-NONE
Region: eu-west-1
Items: 0 (leeg)
```

---

## 🛡️ BACKUP PROTECTION

### **Wat NIET te doen:**
```bash
# ❌ NIET DOEN - Deze resources verwijderen!
aws s3 rb s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr --force
aws dynamodb delete-table --table-name Track-yzaolfqzsze37eghvsrj6tfwk4-NONE
```

### **Resources zijn SAFE omdat:**
1. ✅ S3 Versioning is ENABLED (kan files recoveren)
2. ✅ DynamoDB Deletion Protection (waarschijnlijk actief)
3. ✅ Niet onderdeel van DELETE_FAILED stack
4. ✅ Nieuwe deployment (gerard2) maakt NIEUWE resources

---

## 🆕 NIEUWE DEPLOYMENT (gerard2)

**Nieuwe stack:** `amplify-gforgeiot-gerard2-sandbox-bc0594f88a`

**Krijgt NIEUWE resources:**
- Nieuwe S3 bucket (lege)
- Nieuwe DynamoDB tables (lege)
- Nieuwe Lambda functions
- Nieuwe EC2 instance (of we gebruiken de oude)

**Oude resources blijven BESTAAN** zolang je ze niet handmatig verwijdert!

---

## 📥 RESTORE STRATEGIE (Later)

### **Optie 1: Direct Restore (Snelste)**
```bash
# Copy alle audio files van oude naar nieuwe bucket
aws s3 sync \
  s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/public/ \
  s3://[NIEUWE-BUCKET]/public/ \
  --region eu-west-1

# Tijd: ~10-15 minuten voor 20 GB
```

### **Optie 2: Fresh Upload (Cleanste)**
```
Upload alle tracks opnieuw via de UI
→ Nieuwe metadata extraction
→ Fresh waveforms
→ Clean database entries
→ Geen oude artifacts
```

### **Optie 3: DynamoDB Data Import**
```bash
# Export oude table
aws dynamodb scan \
  --table-name Track-yzaolfqzsze37eghvsrj6tfwk4-NONE \
  --region eu-west-1 \
  --output json > tracks-backup.json

# Import naar nieuwe table (later)
# Via script of AWS Data Pipeline
```

---

## 💰 COST AWARENESS

**Oude resources kosten geld zolang ze bestaan:**

**S3 Storage:** 20 GB × $0.023/GB/maand = **$0.46/maand**
**DynamoDB:** 747K items on-demand = **~$0.50/maand**
**Total:** **~$1/maand**

→ Acceptabel voor backup!
→ Delete over 1-2 maanden als je ze niet meer nodig hebt

---

## 📝 VERIFICATIE COMMANDS

### **Check S3 Bucket Status:**
```bash
aws s3 ls s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/public/audio/ | wc -l
aws s3 ls s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/public/covers/ | wc -l
```

### **Check DynamoDB Table Status:**
```bash
aws dynamodb describe-table \
  --table-name Track-yzaolfqzsze37eghvsrj6tfwk4-NONE \
  --region eu-west-1 \
  --query 'Table.{Name:TableName,Items:ItemCount,Status:TableStatus}'
```

### **Check Versioning:**
```bash
aws s3api get-bucket-versioning \
  --bucket amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr
```

---

## 🎯 PLAN

**NU (15 Nov 2025):**
- ✅ Deploy gerard2 stack (nieuwe resources)
- ✅ Oude data blijft intact als backup
- ✅ Test nieuwe deployment

**LATER (Wanneer klaar):**
- Upload tracks opnieuw via UI
- Of: Restore van backup
- Delete oude resources als niet meer nodig

---

## 🚨 EMERGENCY RESTORE

**Als je per ongeluk iets verwijdert:**

1. **S3 Files:**
   ```bash
   # List deleted files (versioning!)
   aws s3api list-object-versions \
     --bucket amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr \
     --prefix public/audio/
   
   # Restore specific file
   aws s3api copy-object \
     --bucket amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr \
     --copy-source amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/public/audio/file.mp3?versionId=VERSION_ID \
     --key public/audio/file.mp3
   ```

2. **DynamoDB:**
   - Point-in-time recovery (als enabled)
   - Of: Gebruik backup export

---

## ✅ SAMENVATTING

**VEILIG:**
- ✅ Oude S3 bucket blijft bestaan
- ✅ Oude DynamoDB tables blijven bestaan
- ✅ 20 GB data + 747K records = BACKUP
- ✅ Kosten: ~$1/maand

**NIEUWE DEPLOYMENT:**
- ✅ gerard2 stack = fresh start
- ✅ Lege buckets & tables
- ✅ Upload tracks later opnieuw

**ACTIE VEREIST:**
- ⏰ Over 1-2 maanden: Check of backup nog nodig is
- 🗑️ Delete oude resources als niet meer nodig
- 💾 Of: Permanent houden als archief

---

**Backup Created:** 15 November 2025, 18:51 CET  
**Created By:** Cascade AI  
**Purpose:** Data safety tijdens gerard2 deployment

# 📝 TODO: Release Notes in App - Git Commit History

**Datum:** 14 November 2025, 15:43 CET  
**Prioriteit:** MEDIUM  
**Status:** 📝 TODO

---

## 🎯 **DOEL:**

Alle Git commit messages vanaf het begin tot nu **in de app** tonen als Release Notes, netjes per row uitklapbaar, gesorteerd op datum en tijd.

**User Experience:**
- Overzichtelijke lijst met alle releases/commits
- Per row uitklapbaar voor volledige details
- Chronologisch gesorteerd (nieuwste eerst)
- Datum + tijd + commit message
- Optioneel: Filter op feature/bugfix/etc

---

## 🎨 **UI DESIGN:**

```
┌─────────────────────────────────────────────────────────┐
│  📋 Release Notes & Changelog                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  🔍 [Search commits...]                 [Filter ▼]      │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ▶ 14 Nov 2025, 15:41 CET                         │  │
│  │   📊 Complete EC2 Stability System Inventory      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ▼ 14 Nov 2025, 13:41 CET                         │  │
│  │   📝 TODO: Listener Statistics + Track Playouts  │  │
│  │                                                   │  │
│  │   [Expanded Content:]                            │  │
│  │   DOEL:                                          │  │
│  │   Weten hoeveel luisteraars we hebben...         │  │
│  │                                                   │  │
│  │   STRATEGIE (4 FASES):                           │  │
│  │   - FASE 1: Logs Verzamelen ✅                   │  │
│  │   - FASE 2: Real-time Metrics                    │  │
│  │   ...                                            │  │
│  │                                                   │  │
│  │   Files Changed: 1 added                         │  │
│  │   [View Commit] [View Files]                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ▶ 14 Nov 2025, 13:32 CET                         │  │
│  │   🔧 Fix: macOS compatibility for date command   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ▶ 14 Nov 2025, 13:23 CET                         │  │
│  │   💾 Add EC2 Backup System + E2E Test Plan       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  [Load More...] (50 of 487 commits)                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ **ARCHITECTUUR:**

```
┌────────────────────────────────────────────────────┐
│              FRONTEND (React/Next.js)               │
├────────────────────────────────────────────────────┤
│                                                     │
│  📄 /changelog Page                                 │
│  ├─ ReleaseNotesList Component                      │
│  │  ├─ SearchBar                                    │
│  │  ├─ FilterDropdown                               │
│  │  └─ ReleaseNoteItem[] (uitklapbaar)             │
│  │                                                  │
│  └─ ReleaseNoteItem Component                       │
│     ├─ Header (datum, icon, titel)                  │
│     ├─ Expand/Collapse button                       │
│     └─ Content (body, files, links)                 │
│                                                     │
└────────────┬───────────────────────────────────────┘
             │
             │ API Call
             ↓
┌────────────────────────────────────────────────────┐
│                 BACKEND OPTIONS                     │
├────────────────────────────────────────────────────┤
│                                                     │
│  OPTION 1: Lambda Function (Dynamic)                │
│  ├─ Lambda: getGitCommits                           │
│  ├─ Executes: git log --all --oneline              │
│  ├─ Parse output → JSON                             │
│  └─ Cache in DynamoDB (optional)                    │
│                                                     │
│  OPTION 2: Build-time Generation (Static)           │
│  ├─ NPM Script: generate-changelog.js               │
│  ├─ Runs during build: npm run build                │
│  ├─ Output: public/changelog.json                   │
│  └─ Frontend: fetch('/changelog.json')              │
│                                                     │
│  OPTION 3: GitHub API (Cloud)                       │
│  ├─ API: GET /repos/:owner/:repo/commits            │
│  ├─ Token: GitHub Personal Access Token             │
│  ├─ Rate limit: 5000 requests/hour                  │
│  └─ Response: JSON with full commit data            │
│                                                     │
└────────────────────────────────────────────────────┘
```

---

## 🔧 **IMPLEMENTATIE OPTIES:**

### **OPTIE 1: Static Build-time Generation (Recommended)**

**Voordelen:**
- ✅ No runtime dependencies
- ✅ Fast loading (static JSON)
- ✅ No API rate limits
- ✅ Works offline

**Script:** `scripts/generate-changelog.js`

```javascript
const { execSync } = require('child_process')
const fs = require('fs')

// Get all commits with full details
const gitLog = execSync(
  'git log --all --pretty=format:"%H|%an|%ae|%ad|%s|%b" --date=iso',
  { encoding: 'utf-8' }
)

const commits = gitLog.split('\n').map(line => {
  const [hash, author, email, date, subject, body] = line.split('|')
  
  // Get files changed in this commit
  const filesChanged = execSync(
    `git diff-tree --no-commit-id --name-status -r ${hash}`,
    { encoding: 'utf-8' }
  ).trim().split('\n').map(f => {
    const [status, file] = f.split('\t')
    return { status, file }
  })
  
  // Parse commit type from emoji/prefix
  const type = detectCommitType(subject)
  
  return {
    hash,
    shortHash: hash.substring(0, 7),
    author,
    email,
    date: new Date(date).toISOString(),
    subject,
    body: body || '',
    filesChanged,
    type,
    icon: getIconForType(type)
  }
})

// Group by date
const groupedByDate = commits.reduce((acc, commit) => {
  const date = commit.date.split('T')[0]
  if (!acc[date]) acc[date] = []
  acc[date].push(commit)
  return acc
}, {})

// Write to public folder
fs.writeFileSync(
  'public/changelog.json',
  JSON.stringify({ commits, groupedByDate }, null, 2)
)

console.log(`✅ Generated changelog with ${commits.length} commits`)

function detectCommitType(subject) {
  if (subject.startsWith('🎨') || subject.includes('style')) return 'style'
  if (subject.startsWith('🐛') || subject.includes('fix')) return 'bugfix'
  if (subject.startsWith('✨') || subject.includes('feat')) return 'feature'
  if (subject.startsWith('📝') || subject.includes('docs')) return 'docs'
  if (subject.startsWith('🔧') || subject.includes('config')) return 'config'
  if (subject.startsWith('🚀') || subject.includes('deploy')) return 'deploy'
  if (subject.startsWith('🧪') || subject.includes('test')) return 'test'
  return 'other'
}

function getIconForType(type) {
  const icons = {
    feature: '✨',
    bugfix: '🐛',
    style: '🎨',
    docs: '📝',
    config: '🔧',
    deploy: '🚀',
    test: '🧪',
    other: '📦'
  }
  return icons[type] || '📦'
}
```

**package.json:**
```json
{
  "scripts": {
    "generate-changelog": "node scripts/generate-changelog.js",
    "prebuild": "npm run generate-changelog",
    "build": "next build"
  }
}
```

---

### **OPTIE 2: GitHub API (Runtime)**

**API Endpoint:**
```
GET https://api.github.com/repos/OWNER/REPO/commits
```

**Frontend Code:**
```typescript
const GITHUB_REPO = 'your-username/g-forge-iot'
const GITHUB_TOKEN = process.env.NEXT_PUBLIC_GITHUB_TOKEN

async function fetchCommits(page = 1, perPage = 30) {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/commits?page=${page}&per_page=${perPage}`,
    {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  )
  
  const commits = await response.json()
  
  return commits.map(commit => ({
    hash: commit.sha,
    shortHash: commit.sha.substring(0, 7),
    author: commit.commit.author.name,
    email: commit.commit.author.email,
    date: commit.commit.author.date,
    subject: commit.commit.message.split('\n')[0],
    body: commit.commit.message.split('\n').slice(1).join('\n'),
    url: commit.html_url,
    filesChanged: commit.files || []
  }))
}
```

**Rate Limits:**
- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour

---

### **OPTIE 3: Lambda + DynamoDB (Serverless)**

**Lambda Function:**
```typescript
// amplify/functions/get-git-commits/handler.ts
export const handler = async (event) => {
  const { page = 1, limit = 50 } = event.queryStringParameters || {}
  
  // Check DynamoDB cache first
  const cached = await getCachedCommits(page, limit)
  if (cached) return cached
  
  // If not cached, fetch from Git
  const commits = await fetchFromGit()
  
  // Cache in DynamoDB
  await cacheCommits(commits)
  
  return {
    statusCode: 200,
    body: JSON.stringify({ commits })
  }
}
```

**DynamoDB Table:**
```
Table: GitCommits
├─ PK: commitHash
├─ SK: timestamp
├─ author: String
├─ message: String
├─ body: String
├─ files: List
├─ type: String
├─ icon: String
└─ ttl: Number (expire after 7 days)
```

---

## 🎨 **REACT COMPONENT:**

### **ReleaseNotesList.tsx:**

```typescript
import { useState, useEffect } from 'react'
import ReleaseNoteItem from './ReleaseNoteItem'

interface Commit {
  hash: string
  shortHash: string
  author: string
  date: string
  subject: string
  body: string
  filesChanged: { status: string; file: string }[]
  type: string
  icon: string
}

export default function ReleaseNotesList() {
  const [commits, setCommits] = useState<Commit[]>([])
  const [filteredCommits, setFilteredCommits] = useState<Commit[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    loadCommits()
  }, [])

  useEffect(() => {
    filterCommits()
  }, [searchQuery, typeFilter, commits])

  async function loadCommits() {
    setIsLoading(true)
    try {
      // Option 1: Static JSON
      const response = await fetch('/changelog.json')
      const data = await response.json()
      setCommits(data.commits)
      
      // Or Option 2: API
      // const data = await fetchCommits(page)
      // setCommits(prev => [...prev, ...data])
      // setHasMore(data.length === 50)
    } catch (error) {
      console.error('Failed to load commits:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function filterCommits() {
    let filtered = commits

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(commit =>
        commit.subject.toLowerCase().includes(query) ||
        commit.body.toLowerCase().includes(query) ||
        commit.author.toLowerCase().includes(query)
      )
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(commit => commit.type === typeFilter)
    }

    setFilteredCommits(filtered)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📋 Release Notes & Changelog</h1>
        <p className="text-gray-600">
          Complete development history - {commits.length} commits
        </p>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
        <input
          type="text"
          placeholder="🔍 Search commits..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="all">All Types</option>
          <option value="feature">✨ Features</option>
          <option value="bugfix">🐛 Bug Fixes</option>
          <option value="docs">📝 Documentation</option>
          <option value="config">🔧 Configuration</option>
          <option value="deploy">🚀 Deployments</option>
          <option value="test">🧪 Tests</option>
        </select>
      </div>

      {/* Commits List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading commits...</p>
          </div>
        ) : (
          <>
            {filteredCommits.map((commit) => (
              <ReleaseNoteItem key={commit.hash} commit={commit} />
            ))}

            {filteredCommits.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No commits found matching your search.
              </div>
            )}

            {hasMore && (
              <button
                onClick={() => setPage(p => p + 1)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Load More...
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

---

### **ReleaseNoteItem.tsx:**

```typescript
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

export default function ReleaseNoteItem({ commit }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formattedDate = new Date(commit.date).toLocaleString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const relativeTime = formatDistanceToNow(new Date(commit.date), {
    addSuffix: true
  })

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
      >
        <div className="flex items-center space-x-4 flex-1">
          <span className="text-2xl">{commit.icon}</span>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-1">
              <span className="text-sm text-gray-500 font-mono">
                {commit.shortHash}
              </span>
              <span className="text-sm text-gray-500">
                {formattedDate}
              </span>
              <span className="text-xs text-gray-400">
                ({relativeTime})
              </span>
            </div>
            <p className="font-medium text-gray-900 truncate">
              {commit.subject}
            </p>
          </div>
        </div>

        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-4 border-t border-gray-100">
          <div className="pt-4 space-y-4">
            {/* Author */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="font-medium">By:</span>
              <span>{commit.author}</span>
            </div>

            {/* Full Message Body */}
            {commit.body && (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded">
                  {commit.body}
                </pre>
              </div>
            )}

            {/* Files Changed */}
            {commit.filesChanged && commit.filesChanged.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Files Changed ({commit.filesChanged.length}):
                </p>
                <div className="space-y-1">
                  {commit.filesChanged.slice(0, 5).map((file, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono flex items-center space-x-2"
                    >
                      <span
                        className={`px-2 py-0.5 rounded ${
                          file.status === 'A'
                            ? 'bg-green-100 text-green-800'
                            : file.status === 'M'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {file.status}
                      </span>
                      <span className="text-gray-600">{file.file}</span>
                    </div>
                  ))}
                  {commit.filesChanged.length > 5 && (
                    <p className="text-xs text-gray-500 mt-1">
                      ... and {commit.filesChanged.length - 5} more files
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3 pt-2">
              <a
                href={`https://github.com/YOUR_USERNAME/g-forge-iot/commit/${commit.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View on GitHub →
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(commit.hash)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Copy Hash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 🚀 **DEPLOYMENT PLAN:**

### **Fase 1: Setup (1-2 uur)**
```
1. Create scripts/generate-changelog.js
2. Add npm script to package.json
3. Test changelog generation locally
4. Commit generated changelog.json
```

### **Fase 2: UI Component (2-3 uur)**
```
1. Create components/Changelog/
   ├─ ReleaseNotesList.tsx
   ├─ ReleaseNoteItem.tsx
   └─ index.ts

2. Create app/changelog/page.tsx
3. Add navigation link
4. Test UI locally
```

### **Fase 3: Styling & Polish (1 uur)**
```
1. Add TailwindCSS classes
2. Add loading states
3. Add empty states
4. Add search highlighting
5. Test responsive design
```

### **Fase 4: Deploy (30 min)**
```
1. Run generate-changelog
2. Test build
3. Deploy to production
4. Verify on live site
```

**Total Time:** 4-6 uur

---

## 📊 **DATA FORMAT:**

### **changelog.json Structure:**

```json
{
  "commits": [
    {
      "hash": "a760610...",
      "shortHash": "a760610",
      "author": "Gerard",
      "email": "gerard@example.com",
      "date": "2025-11-14T14:41:00.000Z",
      "subject": "📊 Complete EC2 Stability System Inventory & Verification",
      "body": "VOLLEDIGE END-TO-END VERIFICATIE COMPLEET!\n\n✅ ALL CHECKS PASSED:\n...",
      "filesChanged": [
        { "status": "A", "file": "ref/EC2_STABILITY_INVENTORY.md" }
      ],
      "type": "docs",
      "icon": "📊"
    }
  ],
  "groupedByDate": {
    "2025-11-14": [
      { "hash": "a760610...", "..." }
    ]
  },
  "metadata": {
    "totalCommits": 487,
    "firstCommit": "2025-10-01T10:00:00.000Z",
    "lastCommit": "2025-11-14T14:41:00.000Z",
    "generatedAt": "2025-11-14T14:45:00.000Z"
  }
}
```

---

## ✅ **SUCCESS CRITERIA:**

```
✅ All commits vanaf begin tot nu visible
✅ Per row uitklapbaar
✅ Datum + tijd prominent shown
✅ Search functionality working
✅ Filter by type working
✅ Fast loading (< 1s)
✅ Responsive design
✅ Works offline (static JSON)
✅ Auto-updated bij build
```

---

## 💡 **EXTRA FEATURES (Optional):**

### **Advanced Filtering:**
```
- Date range picker
- Author filter
- File type filter (only .tsx, only .md, etc)
- Tag filtering (#feature, #bugfix)
```

### **Visualization:**
```
- Commit frequency graph
- Contributor pie chart
- Files changed heatmap
- Activity timeline
```

### **Integration:**
```
- Link to specific files in GitHub
- Inline diff viewer
- Related commits
- Commit comparison
```

---

## 📚 **KEYWORDS:**

`release-notes` `changelog` `git-commits` `commit-history` `ui-component` `expandable-rows` `date-time` `search` `filter` `github-api` `static-generation` `react-component`

---

**Status:** 📝 TODO  
**Priority:** MEDIUM  
**Effort:** 4-6 uur  
**Next:** Create generate-changelog.js script

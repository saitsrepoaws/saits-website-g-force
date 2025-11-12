# Player GraphQL Integration

## Doel
Player page gebruikt GraphQL direct om track info + cover art op te halen

---

## GraphQL Query voor Track Info

```graphql
query GetTrackByArtistTitle($artist: String!, $title: String!) {
  listTracks(filter: {
    and: [
      { artist: { contains: $artist } }
      { title: { contains: $title } }
    ]
  }, limit: 1) {
    items {
      id
      artist
      title
      coverArtUrl
      waveformUrl
      bpm
      key
      energy
      genre
      label
      trackDuration
      year
    }
  }
}
```

---

## Player Implementation

### 1. Add Amplify Client to Player Page

```html
<!-- In player-homepage-v2.html -->
<script type="module">
  import { Amplify } from 'https://cdn.jsdelivr.net/npm/aws-amplify@6/+esm';
  import { generateClient } from 'https://cdn.jsdelivr.net/npm/aws-amplify@6/api/+esm';
  
  // Load config from amplify_outputs.json
  const amplifyConfig = await fetch('/amplify_outputs.json').then(r => r.json());
  Amplify.configure(amplifyConfig);
  
  const client = generateClient();
</script>
```

### 2. Query Function

```javascript
async function getTrackInfo(artist, title) {
  try {
    const query = `
      query GetTrackByArtistTitle($artist: String!, $title: String!) {
        listTracks(filter: {
          and: [
            { artist: { contains: $artist } }
            { title: { contains: $title } }
          ]
        }, limit: 1) {
          items {
            id
            artist
            title
            coverArtUrl
            waveformUrl
            bpm
            key
            energy
            genre
          }
        }
      }
    `;
    
    const result = await client.graphql({
      query,
      variables: { artist, title }
    });
    
    return result.data.listTracks.items[0];
  } catch (error) {
    console.error('GraphQL error:', error);
    return null;
  }
}
```

### 3. Update Cover Art Function

```javascript
async function updateCoverArt(artist, title) {
  const card = document.querySelector('.current-track-card');
  
  // Get track from GraphQL
  const track = await getTrackInfo(artist, title);
  
  if (track && track.coverArtUrl) {
    // Use real cover art from database
    const coverUrl = getCoverArtUrl(track.coverArtUrl);
    card.style.backgroundImage = `url(${coverUrl})`;
    console.log('🎨 Cover art from GraphQL:', coverUrl);
    
    // Store track data for additional info
    currentTrackData = track;
  } else {
    // Fallback to music-themed image
    const fallback = `https://source.unsplash.com/800x800/?music,techno,dj&sig=${Date.now()}`;
    card.style.backgroundImage = `url(${fallback})`;
    console.log('🎨 Using fallback cover art');
  }
}
```

### 4. Helper for S3 URLs

```javascript
function getCoverArtUrl(path) {
  if (!path) return null;
  
  // If already full URL
  if (path.startsWith('http')) return path;
  
  // Convert S3 path to CloudFront/public URL
  const baseUrl = 'https://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr.s3.eu-west-1.amazonaws.com';
  return `${baseUrl}/${path}`;
}
```

---

## Benefits

✅ **Real Cover Art** - Echte artwork van tracks database  
✅ **Extra Metadata** - BPM, Key, Energy beschikbaar  
✅ **Waveform** - Kan waveform ook tonen  
✅ **No Lambda needed** - Direct GraphQL query  
✅ **Real-time** - Altijd up-to-date met database  

---

## Alternative: REST API Endpoint

Als je liever een simpel REST endpoint wilt:

```typescript
// amplify/functions/get-track-info/handler.ts
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';

export const handler: APIGatewayProxyHandler = async (event) => {
  const { artist, title } = event.queryStringParameters || {};
  
  if (!artist || !title) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing artist or title' })
    };
  }
  
  const client = generateClient();
  
  const result = await client.graphql({
    query: `
      query GetTrack($artist: String!, $title: String!) {
        listTracks(filter: {
          and: [
            { artist: { contains: $artist } }
            { title: { contains: $title } }
          ]
        }, limit: 1) {
          items {
            id
            artist
            title
            coverArtUrl
            waveformUrl
            bpm
            key
            energy
            genre
            label
          }
        }
      }
    `,
    variables: { artist, title }
  });
  
  const track = result.data.listTracks.items[0];
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      track: track || null,
      found: !!track
    })
  };
};
```

Usage:
```javascript
const response = await fetch(`/api/track-info?artist=${artist}&title=${title}`);
const data = await response.json();
```

---

## Recommendation

**Optie 1**: GraphQL direct in player (beste voor real-time)  
**Optie 2**: REST API endpoint (simpeler, maar extra Lambda)

**Ik raad Optie 1 aan** omdat:
- Geen extra Lambda nodig
- Direct access tot alle track data
- Kan filteren/sorteren in query
- Real-time updates

Welke wil je?

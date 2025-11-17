var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// handler.ts
var handler_exports = {};
__export(handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(handler_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_s3 = require("@aws-sdk/client-s3");
var import_client_ssm = require("@aws-sdk/client-ssm");
var https = __toESM(require("https"));
var http = __toESM(require("http"));
var dynamodb = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}));
var s3 = new import_client_s3.S3Client({});
var ssm = new import_client_ssm.SSMClient({});
var STORAGE_BUCKET = process.env.STORAGE_BUCKET || "";
var SCHEDULE_TABLE = process.env.SCHEDULE_TABLE || "";
var PLAYLIST_TABLE = process.env.PLAYLIST_TABLE || "";
var TRACK_TABLE = process.env.TRACK_TABLE || "";
var SETTINGS_TABLE = process.env.SETTINGS_TABLE || "";
var EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID || "";
var NEWS_URL = "http://www.downloadlokaalmedia.nl/special/nieuwswildfm.mp3";
async function downloadAllFilesToEC2(downloads) {
  const commands = [
    "#!/bin/bash",
    // NO set -e! Count errors instead
    "SUCCESS=0",
    "FAILED=0",
    'echo "Starting batch download..."',
    ...downloads.map(({ s3Url, localPath }) => {
      const filename = localPath.split("/").pop();
      return `echo "Downloading ${filename}..." && if aws s3 cp "${s3Url}" "${localPath}" 2>/dev/null; then ((SUCCESS++)); else ((FAILED++)); echo "FAILED: ${filename}" >&2; fi`;
    }),
    'echo ""',
    'echo "Download summary: SUCCESS=$SUCCESS, FAILED=$FAILED"',
    "if [ $FAILED -gt 0 ]; then exit 1; else exit 0; fi"
  ];
  const result = await ssm.send(new import_client_ssm.SendCommandCommand({
    InstanceIds: [EC2_INSTANCE_ID],
    DocumentName: "AWS-RunShellScript",
    Parameters: {
      commands
    }
  }));
  const commandId = result.Command?.CommandId;
  if (!commandId) {
    throw new Error("No CommandId returned from SSM");
  }
  console.log(`\u{1F4E4} SSM Command sent: ${commandId}`);
  console.log(`\u23F3 Waiting for downloads to complete (max 2 minutes)...`);
  for (let i = 0; i < 24; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5e3));
    try {
      const invocation = await ssm.send(new import_client_ssm.GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: EC2_INSTANCE_ID
      }));
      const status = invocation.Status;
      console.log(`  Status: ${status} (${i * 5}s)`);
      if (status === "Success") {
        console.log(`\u2705 Downloads completed successfully!`);
        return;
      } else if (status === "Failed" || status === "Cancelled" || status === "TimedOut") {
        throw new Error(`SSM command failed with status: ${status}`);
      }
    } catch (err) {
      if (i < 3) continue;
      throw err;
    }
  }
  console.log(`\u26A0\uFE0F Download timeout reached, proceeding anyway...`);
}
function generateM3U(newsLocalPath, tracks) {
  let m3u = "#EXTM3U\n";
  if (newsLocalPath) {
    m3u += `#EXTINF:300,Splash FM Nieuws
`;
    m3u += `${newsLocalPath}
`;
  }
  for (const { track, localPath } of tracks) {
    const duration = track.trackDuration || 180;
    const artist = track.trackArtist || "Unknown Artist";
    const title = track.trackTitle || "Unknown";
    const coverUrl = track.coverArtUrl || "";
    m3u += `#EXTINF:${duration},${artist} - ${title}
`;
    if (coverUrl) {
      m3u += `#EXTIMG:${coverUrl}
`;
    }
    m3u += `${localPath}
`;
  }
  return m3u;
}
async function isNewsEnabled() {
  try {
    const { Item } = await dynamodb.send(new import_lib_dynamodb.GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingKey: "playlist_update_timing" }
    }));
    const enabled = Item?.newsEnabled === true;
    console.log(`\u{1F4F0} News enabled: ${enabled}`);
    return enabled;
  } catch (err) {
    console.error("\u26A0\uFE0F Failed to get news setting, defaulting to OFF:", err);
    return false;
  }
}
async function downloadNews() {
  return new Promise((resolve, reject) => {
    console.log(`\u{1F4F0} Downloading news from ${NEWS_URL}`);
    const httpModule = NEWS_URL.startsWith("https://") ? https : http;
    httpModule.get(NEWS_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download news: ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => {
        chunks.push(chunk);
      });
      response.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const timestamp = Date.now();
          const key = `public/news/nieuws-${timestamp}.mp3`;
          await s3.send(new import_client_s3.PutObjectCommand({
            Bucket: STORAGE_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: "audio/mpeg"
          }));
          const s3Url = `s3://${STORAGE_BUCKET}/${key}`;
          console.log(`\u2705 News downloaded and uploaded to ${s3Url}`);
          console.log(`   Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
          resolve(s3Url);
        } catch (error) {
          reject(error);
        }
      });
      response.on("error", reject);
    }).on("error", reject);
  });
}
async function getCurrentScheduleSlot() {
  const nowUTC = /* @__PURE__ */ new Date();
  const nowCET = new Date(nowUTC.getTime() + 60 * 60 * 1e3);
  const dayOfWeek = nowCET.getUTCDay();
  const hours = nowCET.getUTCHours().toString().padStart(2, "0");
  const minutes = nowCET.getUTCMinutes().toString().padStart(2, "0");
  const currentTime = `${hours}:${minutes}`;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayName = dayNames[dayOfWeek];
  console.log(`\u{1F5D3}\uFE0F Current time: ${currentDayName} (${dayOfWeek}) ${currentTime} CET (UTC: ${nowUTC.toISOString()})`);
  const { Items = [] } = await dynamodb.send(new import_lib_dynamodb.ScanCommand({
    TableName: SCHEDULE_TABLE
  }));
  console.log(`\u{1F4CB} Found ${Items.length} schedule entries`);
  for (const slot of Items) {
    const slotDay = slot.dayOfWeek;
    const slotStart = slot.startTime;
    const slotEnd = slot.endTime;
    const dayMatches = slotDay === null || slotDay === void 0 || slotDay === dayOfWeek;
    let timeMatches = false;
    if (slotEnd) {
      timeMatches = currentTime >= slotStart && currentTime < slotEnd;
    } else {
      const slotHour = parseInt(slotStart.split(":")[0]);
      const currentHour = parseInt(currentTime.split(":")[0]);
      timeMatches = currentHour === slotHour;
    }
    console.log(`  Checking slot: ${slot.name || slot.slotName || "Unnamed"}`);
    console.log(`    Day: ${slotDay === null || slotDay === void 0 ? "Every day" : dayNames[slotDay]} (${slotDay}) - Match: ${dayMatches}`);
    console.log(`    Time: ${slotStart}-${slotEnd || "end of day"} - Match: ${timeMatches}`);
    console.log(`    Active: ${slot.isActive}`);
    if (dayMatches && timeMatches && slot.isActive) {
      console.log(`\u2705 Found active slot: ${slot.name || slot.slotName || "Hourly Slot"}`);
      console.log(`   Playlist ID: ${slot.playlistId}`);
      return slot;
    }
  }
  console.log("\u26A0\uFE0F No active schedule slot found");
  return null;
}
async function getPlaylistTracks(playlistId) {
  const { Item: playlist } = await dynamodb.send(new import_lib_dynamodb.GetCommand({
    TableName: PLAYLIST_TABLE,
    Key: { id: playlistId }
  }));
  if (!playlist) {
    throw new Error(`Playlist ${playlistId} not found`);
  }
  const tracks = JSON.parse(playlist.tracks || "[]");
  console.log(`\u{1F3B5} Playlist: ${playlist.name} (${tracks.length} tracks)`);
  return {
    playlistId: playlist.id,
    playlistName: playlist.name,
    tracks
  };
}
async function getTrackFileUrl(track) {
  try {
    const { Item: fullTrack } = await dynamodb.send(new import_lib_dynamodb.GetCommand({
      TableName: TRACK_TABLE,
      Key: { id: track.trackId }
    }));
    if (fullTrack?.fileUrl) {
      let fileUrl = fullTrack.fileUrl;
      if (fileUrl && !fileUrl.startsWith("s3://")) {
        fileUrl = `s3://${STORAGE_BUCKET}/${fileUrl}`;
      }
      return fileUrl;
    }
  } catch (err) {
    console.error(`\u26A0\uFE0F Failed to lookup track ${track.trackId}:`, err);
  }
  console.error(`\u274C No fileUrl for track ${track.trackId}`);
  return `s3://${STORAGE_BUCKET}/public/audio/${track.trackId}.mp3`;
}
async function uploadCoversMapToEC2(tracks) {
  console.log("\u{1F5BC}\uFE0F  Generating covers map...");
  const coversMap = {};
  for (const { track, localPath } of tracks) {
    if (track.coverArtUrl) {
      coversMap[localPath] = track.coverArtUrl;
    }
  }
  const jsonContent = JSON.stringify(coversMap, null, 2);
  console.log(`\u{1F4CB} Covers map has ${Object.keys(coversMap).length} entries`);
  const command = `
cat > /var/radio/covers-map.json << 'EOFJSON'
${jsonContent}
EOFJSON
chmod 644 /var/radio/covers-map.json
echo "\u2705 Covers map uploaded"
`;
  try {
    const result = await ssm.send(new import_client_ssm.SendCommandCommand({
      InstanceIds: [EC2_INSTANCE_ID],
      DocumentName: "AWS-RunShellScript",
      Parameters: {
        commands: [command]
      }
    }));
    console.log(`\u2705 Covers map uploaded to EC2, CommandId: ${result.Command?.CommandId}`);
  } catch (error) {
    console.error("\u274C Failed to upload covers map to EC2:", error);
    throw error;
  }
}
async function uploadPlaylistToEC2(m3uContent) {
  console.log("\u{1F4E4} Uploading M3U to EC2...");
  const command = `
cat > /var/radio/playlists/current.m3u << 'EOFM3U'
${m3uContent}
EOFM3U
chmod 644 /var/radio/playlists/current.m3u
echo "\u2705 M3U uploaded successfully"
`;
  try {
    const result = await ssm.send(new import_client_ssm.SendCommandCommand({
      InstanceIds: [EC2_INSTANCE_ID],
      DocumentName: "AWS-RunShellScript",
      Parameters: {
        commands: [command]
      }
    }));
    console.log(`\u2705 M3U uploaded to EC2, CommandId: ${result.Command?.CommandId}`);
  } catch (error) {
    console.error("\u274C Failed to upload M3U to EC2:", error);
    throw error;
  }
}
var handler = async (event) => {
  console.log("\u{1F399}\uFE0F Stream Playlist Updater (PUSH) - Starting...");
  console.log(`\u23F0 Triggered at: ${(/* @__PURE__ */ new Date()).toISOString()}`);
  try {
    const slot = await getCurrentScheduleSlot();
    if (!slot || !slot.playlistId) {
      console.log("\u2139\uFE0F No active schedule slot - Empty M3U (silence)");
      await uploadPlaylistToEC2("#EXTM3U\n");
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "No active schedule slot",
          action: "silence"
        })
      };
    }
    const { playlistId, playlistName, tracks } = await getPlaylistTracks(slot.playlistId);
    if (tracks.length === 0) {
      console.log("\u26A0\uFE0F Playlist has no tracks");
      await uploadPlaylistToEC2("#EXTM3U\n");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Playlist has no tracks" })
      };
    }
    console.log("\u{1F9F9} Cleaning up old tracks...");
    const cleanupCommand = `
find /var/radio/tracks -type f -mmin +120 -delete
echo "Cleanup complete"
`;
    try {
      await ssm.send(new import_client_ssm.SendCommandCommand({
        InstanceIds: [EC2_INSTANCE_ID],
        DocumentName: "AWS-RunShellScript",
        Parameters: { commands: [cleanupCommand] }
      }));
    } catch (err) {
      console.log("\u26A0\uFE0F Cleanup warning:", err);
    }
    console.log("\u{1F4CB} Preparing download list...");
    const downloads = [];
    let newsLocalPath = null;
    const newsEnabledSetting = await isNewsEnabled();
    if (newsEnabledSetting) {
      try {
        const newsS3Url = await downloadNews();
        newsLocalPath = "/var/radio/tracks/news-latest.mp3";
        downloads.push({ s3Url: newsS3Url, localPath: newsLocalPath });
        console.log(`\u{1F4F0} News queued for download`);
      } catch (newsError) {
        console.error("\u274C Failed to fetch news:", newsError);
      }
    } else {
      console.log("\u{1F4F0} News disabled - skipping download");
    }
    console.log(`\u{1F3B5} Preparing ${tracks.length} tracks...`);
    const tracksWithPaths = [];
    for (let index = 0; index < tracks.length; index++) {
      const track = tracks[index];
      try {
        const s3Url = await getTrackFileUrl(track);
        const filename = s3Url.split("/").pop() || `track-${index}.mp3`;
        const localPath = `/var/radio/tracks/${filename}`;
        downloads.push({ s3Url, localPath });
        tracksWithPaths.push({ track, localPath });
        console.log(`  \u2713 ${index + 1}/${tracks.length}: ${track.trackArtist} - ${track.trackTitle}`);
      } catch (err) {
        console.error(`  \u2717 Failed to get URL for track ${track.trackId}:`, err);
      }
    }
    console.log(`\u{1F4E5} Downloading ALL ${downloads.length} files in ONE batch...`);
    console.log(`   Using S3 VPC Endpoint for fast parallel downloads`);
    await downloadAllFilesToEC2(downloads);
    console.log(`\u2705 All ${downloads.length} files downloaded!`);
    const successfulTracks = tracksWithPaths;
    console.log("\u{1F3B5} Generating M3U with local paths...");
    const m3uContent = generateM3U(newsLocalPath, successfulTracks);
    console.log("\u{1F4CB} M3U Preview:");
    console.log(m3uContent.split("\n").slice(0, 10).join("\n") + "\n...");
    await uploadPlaylistToEC2(m3uContent);
    await uploadCoversMapToEC2(successfulTracks);
    const newsTime = newsLocalPath ? 300 : 0;
    const tracksTime = successfulTracks.reduce((sum, { track }) => sum + (track.trackDuration || 180), 0);
    const totalMinutes = Math.floor((newsTime + tracksTime) / 60);
    console.log(`\u2705 LOCAL FILE PLAYLIST COMPLETE!`);
    console.log(`   \u{1F4F0} News: ${newsLocalPath ? "YES" : "NO"}`);
    console.log(`   \u{1F3B5} Tracks: ${successfulTracks.length}/${tracks.length}`);
    console.log(`   \u{1F4BE} Storage: ~${Math.floor(tracksTime / 60)} min of audio`);
    console.log(`   \u23F1\uFE0F  Total duration: ~${totalMinutes} minutes`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        playlistId,
        playlistName,
        hasNews: !!newsLocalPath,
        trackCount: successfulTracks.length,
        totalDuration: totalMinutes,
        slot: {
          name: slot.name || slot.slotName,
          day: slot.dayOfWeek === null ? "Every day" : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][slot.dayOfWeek],
          time: `${slot.startTime}-${slot.endTime || "next hour"}`
        }
      })
    };
  } catch (error) {
    console.error("\u274C Error generating playlist:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});

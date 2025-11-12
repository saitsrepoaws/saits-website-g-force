#!/bin/bash
# Sync playlist from S3 to EC2
# Runs every 5 minutes via cron

PLAYLIST_BUCKET="radio-playlists-035636364722"
MAIN_PLAYLIST="/tmp/current-playlist.m3u"

# Download playlist
/usr/local/bin/aws s3 cp s3://$PLAYLIST_BUCKET/current-playlist.m3u $MAIN_PLAYLIST \
  --quiet \
  --region eu-west-1

# Fix permissions
chown ubuntu:ubuntu $MAIN_PLAYLIST
chmod 644 $MAIN_PLAYLIST

# Signal reload
if [ $? -eq 0 ]; then
  touch /tmp/playlist-updated
  echo "$(date): Playlist synced" >> /var/log/playlist-sync.log
else
  echo "$(date): Sync error" >> /var/log/playlist-sync.log
fi

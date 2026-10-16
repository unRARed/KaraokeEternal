#!/bin/sh
set -e

# YouTube changes often; keep yt-dlp current unless disabled
if [ "${KES_YTDLP_UPDATE:-true}" != "false" ]; then
  yt-dlp --update --no-warnings || echo "yt-dlp update failed; continuing with $(yt-dlp --version)"
fi

exec karaoke-eternal-server "$@"

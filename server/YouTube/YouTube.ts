import { execFile, spawn } from 'child_process'
import fs from 'fs'
import fsPromises from 'node:fs/promises'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { parseFile } from 'music-metadata'
import getLogger from '../lib/Log.js'
import getConfig from '../Scanner/FileScanner/getConfig.js'
import MetaParser from '../Scanner/MetaParser/MetaParser.js'
import Library from '../Library/Library.js'
import Media from '../Media/Media.js'
import Prefs from '../Prefs/Prefs.js'
import Queue from '../Queue/Queue.js'
import Rooms from '../Rooms/Rooms.js'
import pushQueuesAndLibrary from '../lib/pushQueuesAndLibrary.js'
import { QUEUE_PUSH, YOUTUBE_STATUS } from '../../shared/actionTypes.js'
import type { Server as SocketIOServer } from 'socket.io'
import type { Path, YouTubeResult, YouTubeStatus } from '../../shared/types.js'

const log = getLogger('YouTube')
const execFileAsync = promisify(execFile)

// downloads are saved in this subfolder of the media folder with YouTube enabled
export const SUBDIR = 'YouTube'

const YTDLP = process.env.KES_YTDLP_PATH || 'yt-dlp'
const YTDLP_ARGS = ['--no-warnings', '--no-playlist', '--js-runtimes', 'node']
const NUM_RESULTS = 20

// prefer H.264/AAC for broad browser support; cap at 720p to save space
const FORMAT = [
  'bv*[vcodec^=avc1][height<=720]+ba[ext=m4a]',
  'b[ext=mp4][height<=720]',
  'bv*[height<=720]+ba',
  'b',
].join('/')

// bracketed segments containing these words are dropped from guessed titles
const NOISE = /karaoke|lyric|instrumental|version|guide|melody|official|video|audio|backing|minus|\bmr\b|\bhd\b|\b4k\b/i

// channels that title their videos "Title - Artist"
const TITLE_FIRST_CHANNELS = /karafun|edkara/i

interface Job {
  io: SocketIOServer
  roomId: number
  userId: number
  videoId: string
  artist: string
  title: string
}

const inProgress = new Set<string>()
let jobs = Promise.resolve()

class YouTube {
  /**
   * The media folder that downloads are saved to (first with YouTube enabled)
   */
  static getTarget (): Path | undefined {
    const { paths } = Prefs.get()
    const pathId = paths.result.find(id => paths.entities[id].prefs?.isYouTubeEnabled)

    return pathId === undefined ? undefined : paths.entities[pathId]
  }

  static isEnabled (): boolean {
    return !!YouTube.getTarget()
  }

  /**
   * Search YouTube, biased towards karaoke versions
   */
  static async search (query: string): Promise<YouTubeResult[]> {
    const q = /karaoke/i.test(query) ? query : `${query} karaoke`

    const { stdout } = await execFileAsync(YTDLP, [
      ...YTDLP_ARGS,
      '--flat-playlist',
      '--dump-single-json',
      `ytsearch${NUM_RESULTS}:${q}`,
    ], { timeout: 30000, maxBuffer: 32 * 1024 * 1024 })

    const { entries = [] } = JSON.parse(stdout)

    return entries
      .filter(e => e.id && e.duration && e.live_status !== 'is_live')
      .map(e => ({
        videoId: e.id,
        title: e.title,
        channel: e.channel || e.uploader || '',
        duration: Math.round(e.duration),
        thumbnail: `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg`,
        ...YouTube.guessArtistTitle(e.title, e.channel || e.uploader),
      }))
  }

  /**
   * Best-effort artist/title from a video title like "Artist - Title (Karaoke Version)"
   */
  static guessArtistTitle (videoTitle: string, channel = ''): { artist: string, songTitle: string } {
    let s = videoTitle
      .replace(/[([{【「][^)\]}】」]*[)\]}】」]/g, m => NOISE.test(m) ? ' ' : m)
      .split(/\s+[|｜]\s*/)[0]
      .replace(/^karaoke\W*/i, '')
      .replace(/\b(karaoke version|karaoke|with lyrics( on screen)?|lyrics|instrumental)\b/gi, ' ')

    s = s.replace(/\s{2,}/g, ' ').trim()

    const parts = s.split(/\s+[-–—]\s+/)

    if (parts.length >= 2) {
      if (TITLE_FIRST_CHANNELS.test(channel)) {
        return { artist: parts.slice(1).join(' - ').trim(), songTitle: parts[0].trim() }
      }

      return { artist: parts[0].trim(), songTitle: parts.slice(1).join(' - ').trim() }
    }

    return { artist: '', songTitle: s }
  }

  /**
   * Queue a video for download; it's added to the library and the
   * room's queue when done. Downloads run one at a time.
   */
  static enqueue (job: Job): void {
    if (inProgress.has(job.videoId)) {
      throw new Error('This video is already being downloaded')
    }

    inProgress.add(job.videoId)
    YouTube.emitStatus(job, { status: 'pending', pct: 0 })

    jobs = jobs
      .then(() => YouTube.process(job))
      .then(() => YouTube.emitStatus(job, { status: 'done', pct: 100 }))
      .catch((err) => {
        log.error('%s: %s', job.videoId, err.message)
        YouTube.emitStatus(job, { status: 'error', pct: 0, error: err.message })
      })
      .finally(() => inProgress.delete(job.videoId))
  }

  static async process (job: Job): Promise<void> {
    const target = YouTube.getTarget()

    if (!target) {
      throw new Error('YouTube downloads are not enabled for any media folder')
    }

    const name = `${sanitize(job.artist)} - ${sanitize(job.title)}`
    const dir = path.join(target.path, SUBDIR)
    const file = path.join(dir, name + '.mp4')
    const relPath = `${SUBDIR}/${name}.mp4`

    let mediaId = Media.search({ pathId: target.pathId, relPath }).result[0]

    if (mediaId === undefined) {
      if (fs.existsSync(file)) {
        log.info('Already downloaded: %s', file)
      } else {
        await YouTube.download(job, dir, file)
      }

      mediaId = await YouTube.addToLibrary(target, dir, file, relPath, name)
      pushQueuesAndLibrary(job.io)
    } else {
      log.info('Already in library: %s', relPath)
    }

    const { songId } = Media.search({ mediaId }).entities[mediaId]

    // room may have closed while downloading
    await Rooms.validate(job.roomId, null, { validatePassword: false })

    Queue.add({ roomId: job.roomId, songId, userId: job.userId })

    job.io.to(Rooms.prefix(job.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(job.roomId),
    })
  }

  static async download (job: Job, dir: string, file: string): Promise<void> {
    // download to a temp folder first so a partial file never lands in the
    // media folder (where the scanner or folder watcher could see it)
    const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'kes-yt-'))
    const tmpFile = path.join(tmpDir, 'video.mp4')

    log.info('Downloading %s to %s', job.videoId, file)

    try {
      await new Promise<void>((resolve, reject) => {
        let lastEmit = 0
        let stderr = ''

        const proc = spawn(YTDLP, [
          ...YTDLP_ARGS,
          '--format', FORMAT,
          '--merge-output-format', 'mp4',
          '--remux-video', 'mp4',
          '--output', path.join(tmpDir, 'video.%(ext)s'),
          '--newline',
          '--progress-template', 'download:KES_PROGRESS %(progress._percent_str)s',
          `https://www.youtube.com/watch?v=${job.videoId}`,
        ])

        proc.stdout.on('data', (data) => {
          const m = data.toString().match(/KES_PROGRESS\s+([\d.]+)%/g)
          if (!m || Date.now() - lastEmit < 1000) return

          lastEmit = Date.now()
          const pct = parseFloat(m[m.length - 1].replace(/[^\d.]/g, ''))
          YouTube.emitStatus(job, { status: 'downloading', pct })
        })

        proc.stderr.on('data', (data) => {
          stderr += data
        })
        proc.on('error', err => reject(new Error(`Could not run yt-dlp: ${err.message}`)))
        proc.on('close', (code) => {
          if (code === 0) return resolve()
          reject(new Error(stderr.trim().split('\n').pop() || `yt-dlp exited with code ${code}`))
        })
      })

      if (!fs.existsSync(tmpFile)) {
        throw new Error('Download finished but no mp4 file was produced')
      }

      YouTube.emitStatus(job, { status: 'processing', pct: 100 })
      await fsPromises.mkdir(dir, { recursive: true })
      await move(tmpFile, file)
    } finally {
      await fsPromises.rm(tmpDir, { recursive: true, force: true })
    }
  }

  /**
   * Adds a downloaded file the same way the media scanner would, so
   * rescanning the folder later produces the same song
   */
  static async addToLibrary (target: Path, dir: string, file: string, relPath: string, name: string): Promise<number> {
    const data = await parseFile(file, { duration: true, skipCovers: true })

    if (!data.format.duration) {
      throw new Error('Could not determine duration of downloaded video')
    }

    const parser = MetaParser(getConfig(dir, target.path))
    const parsed = parser({ dir, dirSep: path.sep, name, meta: data.common })
    const { songId } = Library.matchSong(parsed)

    return Media.add({
      songId,
      pathId: target.pathId,
      relPath,
      duration: Math.round(data.format.duration),
      rgTrackGain: null,
      rgTrackPeak: null,
      dateAdded: Math.round(Date.now() / 1000), // seconds
    })
  }

  static emitStatus (job: Job, status: Omit<YouTubeStatus, 'videoId' | 'artist' | 'title'>): void {
    const payload: YouTubeStatus = {
      videoId: job.videoId,
      artist: job.artist,
      title: job.title,
      ...status,
    }

    for (const sock of job.io.of('/').sockets.values()) {
      if ((sock as unknown as { user?: { userId: number } }).user?.userId === job.userId) {
        sock.emit('action', { type: YOUTUBE_STATUS, payload })
      }
    }
  }
}

// make a string safe for use in a filename without confusing the
// MetaParser's "Artist - Title" delimiter detection
function sanitize (str: string): string {
  return str
    .replace(/[/\\:*?"<>|\x00-\x1F]/g, '') // eslint-disable-line no-control-regex
    .replace(/\s+-\s+/g, ' – ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .substring(0, 120)
}

// rename, falling back to copy when the temp folder is on another device
async function move (src: string, dest: string): Promise<void> {
  try {
    await fsPromises.rename(src, dest)
  } catch (err) {
    if (err.code !== 'EXDEV') throw err
    await fsPromises.copyFile(src, dest)
    await fsPromises.unlink(src)
  }
}

export default YouTube

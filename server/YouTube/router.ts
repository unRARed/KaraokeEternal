import KoaRouter from '@koa/router'
import getLogger from '../lib/Log.js'
import Rooms from '../Rooms/Rooms.js'
import YouTube from './YouTube.js'

interface RequestWithBody {
  body: Record<string, unknown>
}

const log = getLogger('YouTube')
const router = new KoaRouter({ prefix: '/api/youtube' })

// is YouTube search available?
router.get('/', (ctx) => {
  ctx.body = { isEnabled: YouTube.isEnabled() }
})

// search YouTube
router.get('/search', async (ctx) => {
  const q = typeof ctx.query.q === 'string' ? ctx.query.q.trim() : ''

  if (typeof ctx.user.userId !== 'number') {
    ctx.throw(401)
  }

  if (!YouTube.isEnabled()) {
    ctx.throw(403, 'YouTube search is not enabled')
  }

  if (!q) {
    ctx.throw(422, 'Missing search query')
  }

  try {
    ctx.body = await YouTube.search(q)
  } catch (err) {
    log.error('search failed: %s', err.message)
    ctx.throw(502, 'YouTube search failed')
  }
})

// download a video, add it to the library and queue it
router.post('/queue', async (ctx) => {
  const { videoId, artist, title } = (ctx.request as unknown as RequestWithBody).body

  if (typeof ctx.user.userId !== 'number' || typeof ctx.user.roomId !== 'number') {
    ctx.throw(401)
  }

  if (!YouTube.isEnabled()) {
    ctx.throw(403, 'YouTube search is not enabled')
  }

  if (typeof videoId !== 'string' || !/^[\w-]{11}$/.test(videoId)) {
    ctx.throw(422, 'Invalid videoId')
  }

  if (typeof artist !== 'string' || !artist.trim() || typeof title !== 'string' || !title.trim()) {
    ctx.throw(422, 'Artist and title are required')
  }

  try {
    await Rooms.validate(ctx.user.roomId, null, { validatePassword: false })
    YouTube.enqueue({
      io: ctx.io,
      roomId: ctx.user.roomId,
      userId: ctx.user.userId,
      videoId: videoId as string,
      artist: (artist as string).trim(),
      title: (title as string).trim(),
    })
  } catch (err) {
    ctx.throw(422, err.message)
  }

  ctx.status = 202
  ctx.body = {}
})

export default router

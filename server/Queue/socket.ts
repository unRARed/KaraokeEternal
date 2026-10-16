import Queue, { MIN_PERFORMANCE_SECONDS } from './Queue.js'
import getPlayingQueueId from './getPlayingQueueId.js'
import Rooms from '../Rooms/Rooms.js'
import { QUEUE_ADD, QUEUE_ADJUSTED, QUEUE_MOVE, QUEUE_PLAYED, QUEUE_REMOVE, QUEUE_PUSH } from '../../shared/actionTypes.js'

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [QUEUE_ADD]: async (sock, { payload }, acknowledge) => {
    const { songId } = payload

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false })
    } catch (err) {
      return acknowledge({
        type: QUEUE_ADD + '_ERROR',
        error: err.message,
      })
    }

    Queue.add({
      roomId: sock.user.roomId,
      songId,
      userId: sock.user.userId,
      playingQueueId: getPlayingQueueId(sock.server, sock.user.roomId),
    })

    // success
    acknowledge({ type: QUEUE_ADD + '_SUCCESS' })

    // to all in room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  [QUEUE_MOVE]: async (sock, { payload }, acknowledge) => {
    const { queueId, prevQueueId } = payload

    try {
      await Rooms.validate(sock.user.roomId, null, { validatePassword: false })
    } catch (err) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: err.message,
      })
    }

    if (!sock.user.isAdmin && !(Queue.isOwner(sock.user.userId, queueId))) {
      return acknowledge({
        type: QUEUE_MOVE + '_ERROR',
        error: 'Cannot move another user\'s song',
      })
    }

    // admin moves are pinned so automatic prioritizing leaves them be
    Queue.move({
      prevQueueId,
      queueId,
      roomId: sock.user.roomId,
      pin: sock.user.isAdmin,
    })

    // success
    acknowledge({ type: QUEUE_MOVE + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
  // player finished or skipped an item; played items leave the queue,
  // count toward the singer's performances, and the queue is re-prioritized
  [QUEUE_PLAYED]: (sock, { payload }, acknowledge) => {
    const { queueId, nextQueueId, position } = payload
    const { roomId } = sock.user

    if (!sock.user.isAdmin) {
      return acknowledge({
        type: QUEUE_PLAYED + '_ERROR',
        error: 'Only the player can mark songs as played',
      })
    }

    // may already be gone (e.g. removed by a user while playing)
    if (Queue.getOrder(roomId).some(item => item.queueId === queueId)) {
      if (position >= MIN_PERFORMANCE_SECONDS) Queue.addPerformance(roomId, queueId)
      Queue.remove(queueId)
    }

    const isAdjusted = Queue.reorder(roomId, nextQueueId)

    acknowledge({ type: QUEUE_PLAYED + '_SUCCESS' })

    sock.server.to(Rooms.prefix(roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(roomId),
    })

    if (isAdjusted) {
      sock.server.to(Rooms.prefix(roomId)).emit('action', { type: QUEUE_ADJUSTED })
    }
  },
  [QUEUE_REMOVE]: (sock, { payload }, acknowledge) => {
    const { queueId } = payload
    const ids = Array.isArray(queueId) ? queueId : [queueId]

    if (!sock.user.isAdmin && !(Queue.isOwner(sock.user.userId, ids))) {
      return acknowledge({
        type: QUEUE_REMOVE + '_ERROR',
        error: 'Cannot remove another user\'s song',
      })
    }

    for (const id of ids) {
      Queue.remove(id)
    }

    // success
    acknowledge({ type: QUEUE_REMOVE + '_SUCCESS' })

    // tell room
    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: QUEUE_PUSH,
      payload: Queue.get(sock.user.roomId),
    })
  },
}

export default ACTION_HANDLERS

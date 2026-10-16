import path from 'path'
import { db } from '../lib/Database.js'
import sql from 'sqlate'
import { QueueItem } from '../../shared/types.js'
import getFairIndex from './getFairIndex.js'
import getLogger from '../lib/Log.js'

const log = getLogger('Queue')

class Queue {
  /**
   * Add a songId to a room's queue at the user's fair (round robin) position
   */
  static add ({ roomId, songId, userId }: { roomId: number, songId: number, userId: number }): void {
    const order = Queue.getOrder(roomId)
    const idx = getFairIndex(order.map(item => item.userId), userId)
    const fields = new Map()
    fields.set('roomId', roomId)
    fields.set('songId', songId)
    fields.set('userId', userId)
    fields.set('prevQueueId', sql`(
      SELECT queueId
      FROM queue
      WHERE roomId = ${roomId} AND queueId NOT IN (
        SELECT prevQueueId
        FROM queue
        WHERE prevQueueId IS NOT NULL
      )
    )`)

    const query = sql`
      INSERT INTO queue ${sql.tuple(Array.from(fields.keys()).map(sql.column))}
      VALUES ${sql.tuple(Array.from(fields.values()))}
    `
    const res = db.run(String(query), query.parameters)

    if (res.changes !== 1) {
      throw new Error('Could not add song to queue')
    }

    // inserted at the end; move into place if needed
    if (idx < order.length) {
      Queue.move({ queueId: Number(res.lastID), prevQueueId: order[idx - 1].queueId, roomId })
    }
  }

  /**
   * Get a room's queueIds and userIds in queue order. If the linked list
   * is broken (e.g. a cycle), the order is repaired and saved.
   */
  static getOrder (roomId: number): { queueId: number, userId: number }[] {
    const query = sql`
      SELECT queueId, userId, prevQueueId
      FROM queue
      WHERE roomId = ${roomId}
      ORDER BY queueId
    `
    const rows = db.all<{ queueId: number, userId: number, prevQueueId: number | null }>(String(query), query.parameters)
    const byPrev = new Map(rows.map(row => [row.prevQueueId, row]))
    const seen = new Set<number>()
    const order = []

    for (let row = byPrev.get(null); row && !seen.has(row.queueId); row = byPrev.get(row.queueId)) {
      seen.add(row.queueId)
      order.push({ queueId: row.queueId, userId: row.userId })
    }

    if (order.length < rows.length) {
      log.warn('Repairing queue order for roomId %s', roomId)

      for (const row of rows) {
        if (!seen.has(row.queueId)) order.push({ queueId: row.queueId, userId: row.userId })
      }

      Queue.setOrder(order.map(item => item.queueId))
    }

    return order
  }

  /**
   * Save a room's queue order by rewriting each item's prevQueueId
   */
  static setOrder (queueIds: number[]): void {
    db.exec('BEGIN IMMEDIATE')
    db.exec('PRAGMA defer_foreign_keys = ON')

    try {
      queueIds.forEach((queueId, i) => {
        const query = sql`
          UPDATE queue
          SET prevQueueId = ${i === 0 ? null : queueIds[i - 1]}
          WHERE queueId = ${queueId}
        `
        db.run(String(query), query.parameters)
      })

      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }

  /**
   * Get queued items for a given room
   */
  static get (roomId: number): { result: number[], entities: Record<number, QueueItem> } {
    const entities: Record<number, any> = {}
    const pathData = new Map()

    const query = sql`
      SELECT queueId, songId, userId, prevQueueId,
        media.mediaId, media.relPath, media.rgTrackGain, media.rgTrackPeak,
        users.name AS userDisplayName, users.dateUpdated AS userDateUpdated,
        paths.pathId, paths.data AS pathData,
        MAX(isPreferred) AS isPreferred
      FROM queue
        INNER JOIN users USING(userId)
        INNER JOIN media USING(songId)
        INNER JOIN paths USING(pathId)
      WHERE roomId = ${roomId}
      GROUP BY queueId
      ORDER BY queueId, paths.priority ASC
    `
    const rows = db.all<{
      queueId: number
      songId: number
      userId: number
      prevQueueId: number
      mediaId: number
      relPath: string
      rgTrackGain: number
      rgTrackPeak: number
      userDisplayName: string
      userDateUpdated: number
      pathId: number
      pathData: string
      isPreferred: number
    }>(String(query), query.parameters)

    for (const row of rows) {
      if (!pathData.has(row.pathId)) {
        pathData.set(row.pathId, JSON.parse(row.pathData))
      }

      const pathPrefs = pathData.get(row.pathId)?.prefs

      entities[row.queueId] = row
      entities[row.queueId].mediaType = this.getType(row.relPath)
      entities[row.queueId].isVideoKeyingEnabled = !!pathPrefs?.isVideoKeyingEnabled

      // don't send over the wire
      delete entities[row.queueId].relPath
      delete entities[row.queueId].isPreferred
      delete entities[row.queueId].pathData
    }

    // items without media (e.g. removed from the library) are skipped
    const result = Queue.getOrder(roomId)
      .map(item => item.queueId)
      .filter(queueId => entities[queueId])

    return { result, entities }
  }

  /**
   * Move a queue item to follow prevQueueId (null or -1 = first)
   */
  static move ({ prevQueueId, queueId, roomId }: { prevQueueId: number | null, queueId: number, roomId: number }): void {
    if (prevQueueId === -1) prevQueueId = null

    if (queueId === prevQueueId) {
      throw new Error('Invalid prevQueueId')
    }

    const order = Queue.getOrder(roomId).map(item => item.queueId)

    if (!order.includes(queueId) || (prevQueueId !== null && !order.includes(prevQueueId))) {
      throw new Error('Invalid queueId or prevQueueId')
    }

    const newOrder = order.filter(id => id !== queueId)
    newOrder.splice(prevQueueId === null ? 0 : newOrder.indexOf(prevQueueId) + 1, 0, queueId)

    Queue.setOrder(newOrder)
  }

  /**
   * Delete a queue item
   */
  static remove (queueId: number): void {
    db.exec('BEGIN IMMEDIATE')
    db.exec('PRAGMA defer_foreign_keys = ON') // v0.9 betas didn't have prevQueueId DEFERRABLE

    try {
      const deleteQuery = sql`
        DELETE FROM queue
        WHERE queueId = ${queueId}
        RETURNING prevQueueId
      `
      const deletedRow = db.get<{ prevQueueId: number | null }>(String(deleteQuery), deleteQuery.parameters)

      if (deletedRow === undefined) {
        throw new Error(`Could not remove queueId: ${queueId}`)
      }

      // close the gap
      const updateQuery = sql`
        UPDATE queue
        SET prevQueueId = ${deletedRow.prevQueueId}
        WHERE prevQueueId = ${queueId}
      `
      db.run(String(updateQuery), updateQuery.parameters)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }

  /**
   * Check if user owns queue item(s)
   */
  static isOwner (userId: number, queueId: number | number[]): boolean {
    const ids = Array.isArray(queueId) ? queueId : [queueId]
    if (ids.length === 0) return false

    const query = sql`
      SELECT COUNT(*) AS count
      FROM queue
      WHERE userId = ${userId} AND queueId IN ${sql.tuple(ids)}
    `
    const res = db.get<{ count: number }>(String(query), query.parameters)
    return res.count === ids.length
  }

  /**
   * Get media type from file extension
   */
  static getType (file: string): string {
    return /\.mp4/i.test(path.extname(file)) ? 'mp4' : 'cdg'
  }
}

export default Queue

export interface PrioritizeItem {
  queueId: number
  userId: number
  isPinned: boolean
}

// a singer's song jumps ahead of another singer's when that other
// singer will have sung at least this many times as many songs
export const RATIO = 3

/**
 * Order a room's queue so singers who have sung less go first.
 *
 * Each song's count is its singer's performed songs plus their songs
 * placed ahead of it. A song from a singer with count b goes ahead of a
 * song with count a only if a >= RATIO * b and a > b; otherwise the
 * existing order is kept. So a new singer's (count 0) first song goes
 * ahead of anyone who has sung, but their second song does not.
 *
 * Pinned items (moved by an admin) keep their position, and the fixed
 * item (playing or about to play) is always first.
 *
 * @param items - queue items in current order
 * @param counts - songs performed per userId
 * @param fixedQueueId - queueId that must stay first, if any
 * @return queueIds in the new order
 */
export default function prioritize (
  items: PrioritizeItem[],
  counts: Map<number, number>,
  fixedQueueId?: number | null,
): number[] {
  const fixedIdx = items.findIndex(item => item.queueId === fixedQueueId)

  if (fixedIdx > 0) {
    items = [items[fixedIdx], ...items.slice(0, fixedIdx), ...items.slice(fixedIdx + 1)]
  }

  const result: PrioritizeItem[] = items.map((item, i) => (item.isPinned || (i === 0 && fixedIdx !== -1)) ? item : null)
  const remaining = items.filter((_, i) => result[i] === null)
  const placed = new Map<number, number>()
  const count = (userId: number) => (counts.get(userId) ?? 0) + (placed.get(userId) ?? 0)

  // is userId's next song outranked by another singer's next song?
  const isOutranked = (userId: number) => remaining.some((other) => {
    if (other.userId === userId) return false
    const a = count(userId)
    const b = count(other.userId)
    return a >= RATIO * b && a > b
  })

  for (let i = 0; i < result.length; i++) {
    if (!result[i]) {
      // earliest song whose singer isn't outranked; the singer with
      // the lowest count never is, so there's always a match
      const idx = remaining.findIndex(item => !isOutranked(item.userId))
      result[i] = remaining.splice(idx, 1)[0]
    }

    placed.set(result[i].userId, (placed.get(result[i].userId) ?? 0) + 1)
  }

  return result.map(item => item.queueId)
}

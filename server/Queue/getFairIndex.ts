/**
 * Where a new song should go so singers take turns (round robin).
 *
 * Each queued song's "round" is how many songs its singer has ahead of it.
 * The new song goes before the first song from a later round than its own,
 * but never before the first item (it may be playing).
 *
 * @param userIds - userId of each queued song, in queue order
 * @param userId - the user adding a song
 * @return index to insert at (userIds.length to append)
 */
export default function getFairIndex (userIds: number[], userId: number): number {
  const newRound = userIds.filter(id => id === userId).length
  const rounds = new Map<number, number>()

  for (let i = 0; i < userIds.length; i++) {
    const round = rounds.get(userIds[i]) ?? 0
    rounds.set(userIds[i], round + 1)

    if (i > 0 && round > newRound) return i
  }

  return userIds.length
}

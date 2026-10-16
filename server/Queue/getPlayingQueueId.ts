/**
 * The queueId a room's player is currently on, if any
 */
export default function getPlayingQueueId (io, roomId: number): number | null {
  for (const sock of io.of('/').sockets.values()) {
    const status = sock.user?.roomId === roomId ? sock._lastPlayerStatus : null

    if (status && !status.isAtQueueEnd && status.queueId !== -1) {
      return status.queueId
    }
  }

  return null
}

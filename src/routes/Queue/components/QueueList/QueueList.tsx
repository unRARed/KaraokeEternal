import React from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { ensureState } from 'redux-optimistic-ui'
import QueueItem from '../QueueItem/QueueItem'
import QueueListAnimator from '../QueueListAnimator/QueueListAnimator'
import { formatSeconds } from 'lib/dateTime'
import { moveItem, removeUpcomingItems } from '../../modules/queue'
import getPlayerHistory from '../../selectors/getPlayerHistory'
import getQueue from '../../selectors/getQueue'
import getWaits from '../../selectors/getWaits'
import styles from './QueueList.css'

// non-admins see the current song plus this many upcoming
const MAX_UPCOMING_VISIBLE = 3

const QueueList = () => {
  const artists = useAppSelector(state => state.artists)
  const { errorMessage, isAtQueueEnd, isErrored, isPlaying, position, queueId } = useAppSelector(state => state.status)

  const playerHistory = useAppSelector(getPlayerHistory)
  const queue = useAppSelector(getQueue)
  const songs = useAppSelector(state => state.songs)
  const starredSongs = useAppSelector(state => ensureState(state.userStars).starredSongs)
  const starCounts = useAppSelector(state => state.starCounts)
  const user = useAppSelector(state => state.user)
  const waits = useAppSelector(getWaits)

  // actions
  const dispatch = useAppDispatch()
  const upcoming = queue.result.filter(qId => qId !== queueId && !playerHistory.includes(qId))

  // move an item so it follows prevQueueId (-1 = start of queue)
  const moveAfter = (qId: number, prevQueueId: number | undefined) => {
    dispatch(moveItem({ queueId: qId, prevQueueId: prevQueueId ?? -1 }))
  }

  const handleMoveUp = (qId: number) => {
    const idx = queue.result.indexOf(qId)
    moveAfter(qId, queue.result[idx - 2])
  }

  const handleMoveDown = (qId: number) => {
    const idx = queue.result.indexOf(qId)
    moveAfter(qId, queue.result[idx + 1])
  }

  // admin: play next; others: swap ahead of their own earliest upcoming song
  const getMoveNextTarget = (qId: number) => user.isAdmin
    ? upcoming[0]
    : upcoming.find(id => queue.entities[id].userId === queue.entities[qId].userId)

  const handleMoveNext = (qId: number) => {
    moveAfter(qId, queue.result[queue.result.indexOf(getMoveNextTarget(qId)) - 1])
  }

  const handleRemoveUpcoming = (userId: number) => {
    dispatch(removeUpcomingItems(userId))
  }

  // non-admins only see what's coming up next
  const hiddenIds = user.isAdmin ? [] : upcoming.slice(MAX_UPCOMING_VISIBLE)
  const visibleIds = queue.result.filter(qId => !hiddenIds.includes(qId))

  // build children array
  const items = visibleIds.map((qId) => {
    const item = queue.entities[qId]
    const duration = songs.entities[item.songId].duration
    const isCurrent = (qId === queueId) && !isAtQueueEnd
    const isUpcoming = qId !== queueId && !playerHistory.includes(qId)
    const isOwner = item.userId === user.userId
    const upcomingIdx = upcoming.indexOf(qId)

    return (
      <QueueItem
        {...item}
        artist={artists.entities[songs.entities[item.songId].artistId].name}
        errorMessage={isCurrent && errorMessage ? errorMessage : ''}
        isCurrent={isCurrent}
        isDeletable={user.isAdmin && item.isYouTube}
        mediaId={item.mediaId}
        key={qId}
        isErrored={isCurrent && isErrored}
        isInfoable={user.isAdmin}
        isReorderable={isUpcoming && user.isAdmin}
        isMovableNext={isUpcoming && (isOwner || user.isAdmin) && getMoveNextTarget(qId) !== qId}
        isMovableUp={isUpcoming && user.isAdmin && upcomingIdx > 0}
        isMovableDown={isUpcoming && user.isAdmin && upcomingIdx < upcoming.length - 1}
        isOwner={isOwner}
        isPlayed={!isUpcoming && !isCurrent}
        isPlaying={isCurrent && isPlaying}
        isRemovable={isUpcoming && (isOwner || user.isAdmin)}
        isReplayable={(!isUpcoming || isCurrent) && user.isAdmin}
        isSkippable={isCurrent && (isOwner || user.isAdmin)}
        isStarred={starredSongs.includes(item.songId)}
        isUpcoming={isUpcoming}
        pctPlayed={isCurrent ? position / duration * 100 : 0}
        starCount={starCounts.songs[item.songId] || 0}
        title={songs.entities[item.songId].title}
        wait={formatSeconds(waits[qId], true)} // fuzzy
        // actions
        onMoveNext={handleMoveNext}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onRemoveUpcoming={handleRemoveUpcoming}
      />
    )
  })

  if (hiddenIds.length) {
    items.push(
      <div key='more' className={styles.more}>
        {hiddenIds.length}
        {' more '}
        {hiddenIds.length === 1 ? 'song' : 'songs'}
        {' in the queue'}
      </div>,
    )
  }

  return <QueueListAnimator queueItems={items} />
}

export default QueueList

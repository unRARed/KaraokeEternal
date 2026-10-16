import React, { useRef, useState } from 'react'
import clsx from 'clsx'
import { useSwipeable } from 'react-swipeable'
import { useLongPress } from 'use-long-press'
import { useAppDispatch } from 'store/hooks'
import Button from 'components/Button/Button'
import ButtonStar from 'components/ButtonStar/ButtonStar'
import Buttons from 'components/Buttons/Buttons'
import UserImage from 'components/UserImage/UserImage'
import { requestPlayNext, requestReplay } from 'store/modules/status'
import { showSongInfo } from 'store/modules/songInfo'
import { toggleSongStarred } from 'store/modules/userStars'
import { showErrorMessage } from 'store/modules/ui'
import useIsDesktop from 'lib/useIsDesktop'
import { queueSong, removeItem } from '../../modules/queue'
import styles from './QueueItem.css'

const LONG_PRESS_THRESHOLD_MS = 700

interface QueueItemProps {
  artist: string
  errorMessage: string
  isCurrent: boolean
  isErrored: boolean
  isInfoable: boolean
  isMovableDown: boolean
  isMovableNext: boolean
  isMovableUp: boolean
  isOwner: boolean
  isPlayed: boolean
  isReorderable: boolean
  isPlaying: boolean
  isRemovable: boolean
  isReplayable: boolean
  isSkippable: boolean
  isStarred: boolean
  isUpcoming: boolean
  pctPlayed: number
  queueId: number
  songId: number
  starCount: number
  title: string
  userDateUpdated: number
  userDisplayName: string
  userId: number
  wait?: string
  // actions
  onMoveDown(queueId: number): void
  onMoveNext(queueId: number): void
  onMoveUp(queueId: number): void
  onRemoveUpcoming: (userId: number) => void
}

const QueueItem = ({
  artist,
  errorMessage,
  isCurrent,
  isErrored,
  isInfoable,
  isMovableDown,
  isMovableNext,
  isMovableUp,
  isOwner,
  isPlayed,
  isReorderable,
  isPlaying,
  isRemovable,
  isReplayable,
  isSkippable,
  isStarred,
  isUpcoming,
  onMoveDown,
  onMoveNext,
  onMoveUp,
  onRemoveUpcoming,
  pctPlayed,
  queueId,
  songId,
  starCount,
  title,
  userDateUpdated,
  userDisplayName,
  userId,
  wait,
}: QueueItemProps) => {
  const [isExpanded, setExpanded] = useState(false)
  const isDesktop = useIsDesktop() // buttons always shown; no swiping
  const longPressActiveRef = useRef(false)
  const dispatch = useAppDispatch()

  const handleErrorInfoClick = () => dispatch(showErrorMessage(errorMessage))
  const handleInfoClick = () => dispatch(showSongInfo(songId))
  const handleMoveNextClick = () => {
    onMoveNext(queueId)
    setExpanded(false)
  }
  const handleReplayClick = () => {
    dispatch(requestReplay(queueId))
    setExpanded(false)
  }
  const handleRequeueClick = () => {
    dispatch(queueSong(songId))
    setExpanded(false)
  }
  const handleSkipClick = () => {
    dispatch(requestPlayNext())
    setExpanded(false)
  }
  const handleRemoveClick = () => dispatch(removeItem({ queueId }))
  const handleStarClick = () => dispatch(toggleSongStarred(songId))

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      setExpanded(isErrored || isInfoable || isRemovable || isSkippable || isMovableNext || isReorderable)
    },
    onSwipedRight: () => setExpanded(false),
    preventScrollOnSwipe: true,
    trackMouse: true,
  })

  const bindRemovePressHandlers = useLongPress(() => {
    const confirmText = isOwner ? 'Remove all your upcoming songs?' : `Remove all upcoming songs for "${userDisplayName}"?`
    longPressActiveRef.current = true

    if (confirm(confirmText)) {
      onRemoveUpcoming(userId)
    }
  }, { threshold: LONG_PRESS_THRESHOLD_MS, cancelOnMovement: true })

  const bindSkipPressHandlers = useLongPress(() => {
    const confirmText = isOwner ? 'Skip and remove all your upcoming songs?' : `Skip and remove all upcoming songs for "${userDisplayName}"?`
    longPressActiveRef.current = true

    if (confirm(confirmText)) {
      onRemoveUpcoming(userId)
      handleSkipClick()
    }
  }, { threshold: LONG_PRESS_THRESHOLD_MS, cancelOnMovement: true })

  return (
    <div
      {...swipeHandlers}
      className={clsx(
        styles.container,
        isCurrent && styles.current,
        isCurrent && !isPlaying && styles.paused,
      )}
      style={{ '--progress': (isCurrent && pctPlayed < 2 ? 2 : pctPlayed) + '%' } as React.CSSProperties}
    >
      <div className={styles.content}>
        <div className={clsx(styles.imageContainer, isPlayed && styles.greyed)}>
          <UserImage userId={userId} dateUpdated={userDateUpdated} />
          <div className={styles.waitContainer}>
            {isUpcoming && (
              <div className={clsx(styles.wait, isOwner && styles.isOwner)}>
                {wait}
              </div>
            )}
          </div>
        </div>

        <div className={clsx(styles.primary, isPlayed && styles.greyed)} translate='no'>
          <div className={styles.innerPrimary}>
            <div className={styles.title}>{title}</div>
            <div className={styles.artist}>{artist}</div>
          </div>
          <div className={clsx(styles.user, isOwner && styles.isOwner)}>
            {userDisplayName}
          </div>
        </div>

        <Buttons btnWidth={56} isExpanded={isExpanded || isDesktop} className={styles.btnContainer}>
          {isErrored && (
            <Button
              className={styles.danger}
              icon='INFO_OUTLINE'
              onClick={handleErrorInfoClick}
            />
          )}
          <ButtonStar
            className={styles.btnStar}
            isStarred={isStarred}
            onClick={handleStarClick}
            count={starCount}
          />
          {isInfoable && (
            <Button
              className={styles.active}
              data-hide
              icon='INFO_OUTLINE'
              onClick={handleInfoClick}
            />
          )}
          {/* admins always get all three; unavailable moves are disabled */}
          {isReorderable && (
            <Button
              className={clsx(styles.btnMove, styles.active)}
              data-hide
              disabled={!isMovableUp}
              icon='CHEVRON_UP'
              aria-label='Move up'
              title='Move up'
              onClick={() => onMoveUp(queueId)}
            />
          )}
          {isReorderable && (
            <Button
              className={clsx(styles.btnMove, styles.active)}
              data-hide
              disabled={!isMovableDown}
              icon='CHEVRON_DOWN'
              aria-label='Move down'
              title='Move down'
              onClick={() => onMoveDown(queueId)}
            />
          )}
          {(isReorderable || isMovableNext) && (
            <Button
              className={clsx(styles.btnMove, styles.active)}
              data-hide
              disabled={!isMovableNext}
              icon='MOVE_TOP'
              aria-label={isReorderable ? 'Play next' : 'Move up'}
              title={isReorderable ? 'Play next' : 'Move up'}
              onClick={handleMoveNextClick}
            />
          )}
          {isPlayed && (
            <Button
              className={clsx(styles.btnAdd, styles.active)}
              data-hide
              icon='PLUS'
              onClick={handleRequeueClick}
            />
          )}
          {isReplayable && (
            <Button
              className={clsx(styles.active, styles.danger)}
              data-hide
              icon='REPLAY'
              onClick={handleReplayClick}
            />
          )}
          {isRemovable && (
            <Button
              className={clsx(styles.btnRemove, styles.danger)}
              data-hide
              icon='DELETE'
              onTouchEnd={(e: React.TouchEvent<HTMLButtonElement>) => {
                if (longPressActiveRef.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  longPressActiveRef.current = false
                  return
                }
              }}
              onClick={() => {
                if (longPressActiveRef.current) {
                  longPressActiveRef.current = false
                  return
                }
                handleRemoveClick()
              }}
              {...bindRemovePressHandlers()}
            />
          )}
          {isSkippable && (
            <Button
              className={clsx(styles.btnPlayNext, styles.danger)}
              data-hide
              icon='PLAY_NEXT'
              onTouchEnd={(e: React.TouchEvent<HTMLButtonElement>) => {
                if (longPressActiveRef.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  longPressActiveRef.current = false
                  return
                }
              }}
              onClick={() => {
                if (longPressActiveRef.current) {
                  longPressActiveRef.current = false
                  return
                }
                handleSkipClick()
              }}
              {...bindSkipPressHandlers()}
            />
          )}
        </Buttons>
      </div>
    </div>
  )
}

export default QueueItem

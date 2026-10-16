import React, { useEffect } from 'react'
import clsx from 'clsx'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { dismissYouTubeStatus } from 'store/modules/youtube'
import Button from 'components/Button/Button'
import type { YouTubeStatus as YouTubeStatusType } from 'shared/types'
import styles from './YouTubeStatus.css'

const DONE_DISMISS_MS = 5000

const getText = ({ status, pct, error }: YouTubeStatusType) => {
  switch (status) {
    case 'pending': return 'Waiting to download...'
    case 'downloading': return `Downloading... ${Math.round(pct)}%`
    case 'processing': return 'Adding to library...'
    case 'done': return 'Added to queue'
    case 'error': return `Failed: ${error}`
  }
}

const YouTubeStatus = () => {
  const dispatch = useAppDispatch()
  const statuses = useAppSelector(state => state.youtube.statuses)
  const footerHeight = useAppSelector(state => state.ui.footerHeight)
  const items = Object.values(statuses)
  const doneIds = items.filter(s => s.status === 'done').map(s => s.videoId).join(',')

  // auto-dismiss successful downloads
  useEffect(() => {
    if (!doneIds) return
    const timer = setTimeout(() => {
      doneIds.split(',').forEach(id => dispatch(dismissYouTubeStatus(id)))
    }, DONE_DISMISS_MS)

    return () => clearTimeout(timer)
  }, [dispatch, doneIds])

  if (!items.length) return null

  return (
    <div className={styles.container} style={{ bottom: footerHeight }}>
      {items.map(s => (
        <div key={s.videoId} className={clsx(styles.item, s.status === 'error' && styles.error)}>
          <div className={styles.text}>
            <div className={styles.song}>
              {s.artist}
              {' – '}
              {s.title}
            </div>
            <div className={styles.status}>{getText(s)}</div>
          </div>
          {(s.status === 'error' || s.status === 'done') && (
            <Button
              icon='CLEAR'
              size={24}
              className={styles.btnClose}
              onClick={() => dispatch(dismissYouTubeStatus(s.videoId))}
              aria-label='Dismiss'
            />
          )}
          {s.status === 'downloading' && (
            <div className={styles.progress} style={{ width: `${s.pct}%` }} />
          )}
        </div>
      ))}
    </div>
  )
}

export default YouTubeStatus

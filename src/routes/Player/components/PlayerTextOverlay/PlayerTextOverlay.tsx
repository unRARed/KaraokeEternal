import React, { useState } from 'react'
import { useAppDispatch } from 'store/hooks'
import { requestPlay } from 'store/modules/status'
import ColorCycle from './ColorCycle/ColorCycle'
import UpNow from './UpNow/UpNow'
import Callout from './Callout/Callout'
import Icon from 'components/Icon/Icon'
import type { QueueItem } from 'shared/types'
import styles from './PlayerTextOverlay.css'

const DEBUT_ADJECTIVES = [
  'Legendary', 'Iconic', 'Epic', 'Fabulous', 'Electrifying', 'Glorious', 'Dazzling',
  'Spectacular', 'Historic', 'Triumphant', 'Majestic', 'Unforgettable', 'Sensational',
  'Fearless', 'Magnificent', 'Radiant', 'Stellar', 'Daring', 'Heroic', 'Brilliant',
  'Thunderous', 'Mythical', 'Sparkling', 'Bold', 'Smashing', 'Groovy', 'Showstopping',
]

const DEBUT_MS = 6000
const ADJUSTING_MS = 3000

interface PlayerTextOverlayProps {
  queueAdjustedTime: number
  queueItem?: QueueItem
  nextQueueItem?: QueueItem
  isAtQueueEnd: boolean
  isQueueEmpty: boolean
  isErrored: boolean
  width: number
  height: number
}

const PlayerTextOverlay = ({
  isQueueEmpty,
  isAtQueueEnd,
  isErrored,
  nextQueueItem,
  queueAdjustedTime,
  queueItem,
  width,
  height,
}: PlayerTextOverlayProps) => {
  const dispatch = useAppDispatch()
  const handlePlay = () => dispatch(requestPlay())
  const [errorOffset] = useState(() => Math.random() * -300)

  // adjective is picked by hashing queueId, so it varies by song but is stable across renders
  const queueId = queueItem?.queueId
  const debutText = queueId === undefined
    ? ''
    : `#${DEBUT_ADJECTIVES[(Math.imul(queueId, 2654435761) >>> 0) % DEBUT_ADJECTIVES.length]} Debut`
  const isDebutVisible = !!queueItem?.isDebut && !isErrored && !isAtQueueEnd

  let Component

  if (isQueueEmpty || (isAtQueueEnd && !nextQueueItem)) {
    Component = <ColorCycle text='CAN HAZ MOAR SONGZ?' className={styles.backdrop} />
  } else if (!queueItem || (isAtQueueEnd && nextQueueItem)) {
    Component = (
      <>
        <svg width='0' height='0' style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id='play-icon-gradient' x1='0%' y1='0%' x2='100%' y2='100%'>
              <stop offset='0%' className={styles.gradientStop1} />
              <stop offset='100%' className={styles.gradientStop2} />
            </linearGradient>
          </defs>
        </svg>
        <button className={styles.playButton} onClick={handlePlay} aria-label='Play'>
          <Icon icon='PLAY' />
        </button>
      </>
    )
  } else if (isErrored) {
    Component = (
      <>
        <ColorCycle text='OOPS...' offset={errorOffset} className={styles.backdrop} />
        <ColorCycle text='SEE QUEUE FOR DETAILS' offset={errorOffset} className={styles.backdrop} />
      </>
    )
  } else {
    Component = <UpNow queueItem={queueItem} />
  }

  return (
    <div style={{ width, height }} className={styles.container}>
      {Component}
      <div className={styles.callouts}>
        <Callout showKey={queueId ?? -1} text={isDebutVisible ? debutText : ''} duration={DEBUT_MS} className={styles.debut} />
        <Callout showKey={queueAdjustedTime} text={queueAdjustedTime ? 'Adjusting Queue' : ''} duration={ADJUSTING_MS} />
      </div>
    </div>
  )
}

export default PlayerTextOverlay

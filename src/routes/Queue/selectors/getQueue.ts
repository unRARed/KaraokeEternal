import { RootState } from 'store/store'
import { ensureState } from 'redux-optimistic-ui'
import { createSelector } from '@reduxjs/toolkit'
import type { QueueItem } from 'shared/types'

const getResult = (state: RootState) => ensureState(state.queue).result
const getEntities = (state: RootState) => ensureState(state.queue).entities

// the server keeps the queue in play order (new songs are placed round
// robin when added, and played songs are removed), so use it as-is
const getQueue = createSelector(
  [getResult, getEntities],
  (result, entities) => ({
    result: result.filter(queueId => entities[queueId].isOptimistic !== true),
    entities: entities as Record<number, QueueItem>,
  }),
)

export default getQueue

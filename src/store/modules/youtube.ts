import { createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
import HttpApi from 'lib/HttpApi'
import { LOGOUT, YOUTUBE_STATUS, YOUTUBE_STATUS_DISMISS } from 'shared/actionTypes'
import type { YouTubeStatus } from 'shared/types'

const api = new HttpApi('youtube')

// ------------------------------------
// Actions
// ------------------------------------
const logout = createAction(LOGOUT)
const youtubeStatus = createAction<YouTubeStatus>(YOUTUBE_STATUS)
export const dismissYouTubeStatus = createAction<string>(YOUTUBE_STATUS_DISMISS)

export const fetchYouTubeEnabled = createAsyncThunk(
  'youtube/FETCH_ENABLED',
  async () => {
    const { isEnabled } = await api.get<{ isEnabled: boolean }>('')
    return isEnabled
  },
)

// ------------------------------------
// Reducer
// ------------------------------------
interface YouTubeState {
  isEnabled: boolean
  statuses: Record<string, YouTubeStatus> // by videoId
}

const initialState: YouTubeState = {
  isEnabled: false,
  statuses: {},
}

const youtubeReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchYouTubeEnabled.fulfilled, (state, { payload }) => {
      state.isEnabled = payload
    })
    .addCase(youtubeStatus, (state, { payload }) => {
      state.statuses[payload.videoId] = payload
    })
    .addCase(dismissYouTubeStatus, (state, { payload }) => {
      delete state.statuses[payload]
    })
    .addCase(logout, () => initialState)
})

export default youtubeReducer

import React, { useEffect, useRef, useState } from 'react'
import { ensureState } from 'redux-optimistic-ui'
import { RootState } from 'store/store'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { toggleArtistResultExpanded } from '../../modules/library'
import { fetchYouTubeEnabled } from 'store/modules/youtube'
import getSearchResults from '../../selectors/getSearchResults'
import getSongsStatus from '../../selectors/getSongsStatus'
import PaddedList from 'components/PaddedList/PaddedList'
import ArtistItem from '../ArtistItem/ArtistItem'
import SongList from '../SongList/SongList'
import YouTubeSearch from '../YouTubeSearch/YouTubeSearch'
import Button from 'components/Button/Button'
import type { ListImperativeAPI, RowComponentProps } from 'react-window'
import styles from './SearchResults.css'

const ROW_HEIGHT_RESULT_HEADING = 24
const ROW_HEIGHT_ARTIST = 48
const ROW_HEIGHT_SONG = 56 // 52px + 4px margin
const ROW_HEIGHT_SONG_WITH_ARTIST = 68 // 64px + 4px margin
const ROW_HEIGHT_YOUTUBE = 72

interface SearchResultsProps {
  // starredArtistCounts: Record<number, number> // @todo
  ui: RootState['ui']
}

interface CustomRowProps {
  artists: RootState['artists']
  dispatch: ReturnType<typeof useAppDispatch>
  expandedArtists: number[]
  filterKeywords: string[]
  filterStarred: boolean
  artistsResult: number[]
  songsResult: number[]
  expandedArtistResults: number[]
  onYouTubeClick: () => void
}

// this is outside the SearchResults component to keep the reference as stable as possible,
// as react-window will re-render the list (breaking animations) when RowComponent changes
const RowComponent = ({
  index,
  style,
  // below are also used in SearchResults and passed via rowProps to avoid duplicate effort
  dispatch,
  artists,
  filterKeywords,
  filterStarred,
  artistsResult,
  songsResult,
  expandedArtistResults,
  onYouTubeClick,
}: RowComponentProps<CustomRowProps>) => {
  const { starredSongs } = useAppSelector(state => ensureState(state.userStars))
  const { upcoming } = useAppSelector(getSongsStatus)

  // # artist results heading
  if (index === 0) {
    return (
      <div key='artistsHeading' style={style} className={styles.artistsHeading}>
        {artistsResult.length}
        {' '}
        {filterStarred ? 'starred ' : ''}
        {artistsResult.length === 1 ? 'artist' : 'artists'}
      </div>
    )
  }

  // artist results
  if (index > 0 && index < artistsResult.length + 1) {
    const artistId = artistsResult[index - 1]
    const artist = artists.entities[artistId]

    return (
      <ArtistItem
        artistSongIds={artist.songIds}
        // numStars={props.starredArtistCounts[artistId] || 0}
        filterKeywords={filterKeywords}
        isExpanded={expandedArtistResults.includes(artistId)}
        key={artistId}
        name={artist.name}
        numStars={0}
        onArtistClick={() => dispatch(toggleArtistResultExpanded(artistId))}
        upcomingSongs={upcoming}
        starredSongs={starredSongs}
        style={style}
      />
    )
  }

  // # song results heading
  if (index === artistsResult.length + 1) {
    return (
      <div key='songsHeading' style={style} className={styles.songsHeading}>
        {songsResult.length}
        {' '}
        {filterStarred ? 'starred ' : ''}
        {songsResult.length === 1 ? 'song' : 'songs'}
      </div>
    )
  }

  // YouTube search
  if (index === artistsResult.length + 3) {
    return (
      <div key='youtube' style={style} className={styles.youtube}>
        <Button variant='primary' icon='MAGNIFIER' size={24} onClick={onYouTubeClick}>
          Search YouTube
        </Button>
      </div>
    )
  }

  // song results
  return (
    <div style={style} key='songs'>
      <SongList
        songIds={songsResult}
        showArtist
        filterKeywords={filterKeywords}
      />
    </div>
  )
}

const SearchResults = ({ ui }: SearchResultsProps) => {
  const dispatch = useAppDispatch()
  const artists = useAppSelector(state => state.artists)
  const expandedArtistResults = useAppSelector(state => state.library.expandedArtistResults)
  const { filterStr, filterStarred } = useAppSelector(state => state.library)
  const { artistsResult, songsResult } = useAppSelector(getSearchResults)
  const isYouTubeEnabled = useAppSelector(state => state.youtube.isEnabled) && !filterStarred
  const [isYouTubeVisible, setYouTubeVisible] = useState(false)

  useEffect(() => {
    dispatch(fetchYouTubeEnabled())
  }, [dispatch])

  const listRef = useRef<ListImperativeAPI | null>(null)
  const filterKeywords = filterStr.trim() ? filterStr.trim().toLowerCase().split(' ') : []

  const rowHeight = (index: number) => {
    // artists heading
    if (index === 0) return ROW_HEIGHT_RESULT_HEADING

    // artist results
    if (index > 0 && index < artistsResult.length + 1) {
      const artistId = artistsResult[index - 1]
      let height = ROW_HEIGHT_ARTIST

      if (expandedArtistResults.includes(artistId)) {
        height += artists.entities[artistId].songIds.length * ROW_HEIGHT_SONG
      }

      return height
    }

    // songs heading
    if (index === artistsResult.length + 1) return ROW_HEIGHT_RESULT_HEADING

    // YouTube search
    if (index === artistsResult.length + 3) return ROW_HEIGHT_YOUTUBE

    // song results
    return songsResult.length * ROW_HEIGHT_SONG_WITH_ARTIST
  }

  const handleRef = (ref: ListImperativeAPI) => {
    if (ref) {
      listRef.current = ref
      // listRef.current.scrollToRow({ index: props.scrollRow, align: 'start' })
    }
  }

  return (
    <>
      <PaddedList
        rowComponent={RowComponent}
        rowProps={{
          dispatch,
          artists,
          filterStarred,
          filterKeywords,
          artistsResult,
          songsResult,
          expandedArtistResults,
          onYouTubeClick: () => setYouTubeVisible(true),
        }}
        rowHeight={rowHeight}
        numRows={artistsResult.length + (isYouTubeEnabled ? 4 : 3)}
        paddingTop={ui.headerHeight}
        paddingRight={4}
        paddingBottom={ui.footerHeight}
        height={ui.innerHeight}
        onRef={handleRef}
      />

      {isYouTubeVisible && (
        <YouTubeSearch query={filterStr.trim()} onClose={() => setYouTubeVisible(false)} />
      )}
    </>
  )
}

export default SearchResults

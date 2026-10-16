import React, { useEffect, useState } from 'react'
import HttpApi from 'lib/HttpApi'
import Button from 'components/Button/Button'
import Modal from 'components/Modal/Modal'
import Spinner from 'components/Spinner/Spinner'
import type { YouTubeResult } from 'shared/types'
import styles from './YouTubeSearch.css'

const api = new HttpApi('youtube')

interface YouTubeSearchProps {
  query: string
  onClose: () => void
}

const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

const YouTubeSearch = ({ query, onClose }: YouTubeSearchProps) => {
  const [results, setResults] = useState<YouTubeResult[] | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<YouTubeResult | null>(null)
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')
  const [isSubmitting, setSubmitting] = useState(false)

  useEffect(() => {
    let isCurrent = true

    api.get<YouTubeResult[]>(`/search?q=${encodeURIComponent(query)}`)
      .then(res => isCurrent && setResults(res))
      .catch(err => isCurrent && setError(err.message))

    return () => {
      isCurrent = false
    }
  }, [query])

  const handleSelect = (result: YouTubeResult) => {
    setSelected(result)
    setArtist(result.artist)
    setTitle(result.songTitle)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await api.post('/queue', {
        body: { videoId: selected.videoId, artist, title },
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (selected) {
    return (
      <Modal title='Add from YouTube' onClose={onClose} className={styles.modal}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <img src={selected.thumbnail} alt='' className={styles.preview} />
          <p className={styles.videoTitle}>{selected.title}</p>
          <p className={styles.hint}>Check the artist and title; this is how it will appear in the library.</p>

          <input
            type='text'
            placeholder='artist'
            value={artist}
            onChange={e => setArtist(e.target.value)}
            required
          />
          <input
            type='text'
            placeholder='title'
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />

          {error && <p className={styles.error}>{error}</p>}

          <Button type='submit' variant='primary' disabled={isSubmitting || !artist.trim() || !title.trim()}>
            Download & Queue
          </Button>
          <Button onClick={() => setSelected(null)}>Back</Button>
        </form>
      </Modal>
    )
  }

  return (
    <Modal title='YouTube' onClose={onClose} className={styles.modal} scrollable>
      {!results && !error && (
        <>
          <div className={styles.loading}><Spinner /></div>
          <p className={styles.disclaimer}>
            Not every result will be a karaoke version. Videos from
            {' '}
            <strong>KaraFun Karaoke</strong>
            ,
            {' '}
            <strong>Sing King</strong>
            {' '}
            or
            {' '}
            <strong>Zoom Karaoke</strong>
            {' '}
            are usually the best bet.
          </p>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {results?.length === 0 && <p>No results</p>}

      {results && results.length > 0 && (
        <ul className={styles.results}>
          {results.map(r => (
            <li key={r.videoId}>
              <button type='button' className={styles.result} onClick={() => handleSelect(r)}>
                <img src={r.thumbnail} alt='' loading='lazy' className={styles.thumb} />
                <span className={styles.info}>
                  <span className={styles.title}>{r.title}</span>
                  <span className={styles.meta}>
                    {r.channel}
                    {' · '}
                    {formatDuration(r.duration)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export default YouTubeSearch

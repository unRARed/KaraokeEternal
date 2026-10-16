import { describe, it, expect } from 'vitest'
import getFairIndex from './getFairIndex.js'

const A = 1, B = 2, C = 3

describe('getFairIndex', () => {
  it('appends to an empty queue', () => {
    expect(getFairIndex([], A)).toBe(0)
  })

  it('appends when everyone has had the same number of turns', () => {
    expect(getFairIndex([A, B], C)).toBe(2)
    expect(getFairIndex([A, B, A, B], A)).toBe(4)
  })

  it('lets a new singer go before second-round songs', () => {
    expect(getFairIndex([A, B, A], C)).toBe(2)
    expect(getFairIndex([A, A, A], B)).toBe(1)
  })

  it('places a second song after everyone else\'s first', () => {
    expect(getFairIndex([A, B, C, A, A], B)).toBe(4)
  })

  it('appends to its own round', () => {
    expect(getFairIndex([A, B, A], B)).toBe(3)
  })

  it('never inserts before the first (possibly playing) item', () => {
    expect(getFairIndex([A], B)).toBe(1)
    expect(getFairIndex([A, A], A)).toBe(2)
  })
})

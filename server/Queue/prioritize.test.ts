import { describe, it, expect } from 'vitest'
import prioritize from './prioritize.js'

const A = 1, B = 2, C = 3, D = 4

// build items from a compact spec like 'A A B'; queueIds are 1-based positions
const q = (spec: string, pinned: number[] = []) => spec.split(' ').map((u, i) => ({
  queueId: i + 1,
  userId: { A, B, C, D }[u],
  isPinned: pinned.includes(i + 1),
}))
const counts = (obj: Record<string, number> = {}) => new Map(Object.entries(obj).map(([u, n]) => [{ A, B, C, D }[u], n]))
const users = (ids: number[], items: ReturnType<typeof q>) => ids.map(id => 'ABCD'[items.find(i => i.queueId === id).userId - 1]).join(' ')

describe('prioritize', () => {
  it('keeps order when nobody has priority', () => {
    const items = q('A B C')
    expect(users(prioritize(items, counts()), items)).toBe('A B C')
  })

  it('3:1 is a push below the ratio (A sang 2, B sang 1)', () => {
    const items = q('A B')
    expect(users(prioritize(items, counts({ A: 2, B: 1 })), items)).toBe('A B')
  })

  it('counts A\'s queued songs: after A\'s next song A will have 3, so B goes ahead of A\'s second', () => {
    const items = q('A A B')
    expect(users(prioritize(items, counts({ A: 2, B: 1 })), items)).toBe('A B A')
  })

  it('B goes ahead of all of A\'s songs once A has sung 3x as many', () => {
    const items = q('A A B')
    expect(users(prioritize(items, counts({ A: 3, B: 1 })), items)).toBe('B A A')
  })

  it('a new singer\'s first song goes ahead of singers who have sung', () => {
    const items = q('A B C')
    expect(users(prioritize(items, counts({ A: 1, B: 1 })), items)).toBe('C A B')
  })

  it('only the new singer\'s first song gets priority', () => {
    const items = q('A B C C')
    expect(users(prioritize(items, counts({ A: 1, B: 1 })), items)).toBe('C A B C')
  })

  it('new singers keep their order among themselves', () => {
    const items = q('A C D')
    expect(users(prioritize(items, counts({ A: 1 })), items)).toBe('C D A')
  })

  it('interleaves a newcomer into a queue-hogger\'s songs', () => {
    const items = q('A A A B')
    expect(users(prioritize(items, counts()), items)).toBe('A B A A')
  })

  it('keeps the playing song first', () => {
    const items = q('A B C')
    const order = prioritize(items, counts({ A: 5, B: 1 }), 1)
    expect(order[0]).toBe(1)
    expect(users(order, items)).toBe('A C B')
  })

  it('moves the about-to-play song to the front', () => {
    const items = q('A B C')
    expect(prioritize(items, counts(), 2)[0]).toBe(2)
  })

  it('leaves pinned (admin-moved) songs where they are', () => {
    const items = q('A A B', [1])
    expect(users(prioritize(items, counts({ A: 3, B: 1 })), items)).toBe('A B A')
  })

  it('counts pinned songs toward their singer', () => {
    // A's pinned song counts, so A (3+1) vs C (1) puts C ahead of A's other song
    const items = q('A C A', [1])
    expect(users(prioritize(items, counts({ A: 3, C: 1 })), items)).toBe('A C A')
  })
})

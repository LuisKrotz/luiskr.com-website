/**
 * @file nav-scroll-tails.test.js
 * @description Coverage tails for components/nav/scroll.ts —
 * smoothScrollTo's scrollTo-options throw fallback, the reduced-motion
 * instant/duration arms, and scrollToContact's non-home no-document
 * scrollHeight arm.
 */
import { describe, test, expect, jest, afterEach } from '@jest/globals'
import { scrollToTop, scrollToContact } from '@website/components/nav/scroll.js'
import store from '@core/store.js'

/** Minimal host — only the fields scroll.ts reads. */
const hostStub = (over = {}) => ({
  isHomePage: true,
  locale: 'en',
  activeSection: '',
  ...over,
})

const cleanups = []

afterEach(() => {
  while (cleanups.length) cleanups.pop()()
})

describe('nav scroll tails', () => {
  test('smoothScrollTo falls back to window.scrollTo(0, y) when the options call throws', () => {
    const orig = window.scrollTo
    const spy = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('options unsupported')
      })
      .mockImplementation(() => {})

    window.scrollTo = spy
    cleanups.push(() => {
      window.scrollTo = orig
    })

    scrollToTop(hostStub())

    // First call is the options object, second is the positional fallback.
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(spy.mock.calls[1][0]).toBe(0)
  })

  test('reduced motion takes the instant-behavior + reduced-duration arms', () => {
    const getter = jest.spyOn(store.getters, 'getReducedMotion').mockReturnValue(true)

    cleanups.push(() => getter.mockRestore())

    const orig = window.scrollTo
    const spy = jest.fn()

    window.scrollTo = spy
    cleanups.push(() => {
      window.scrollTo = orig
    })

    scrollToTop(hostStub())

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  })

  test('scrollToContact computes a zero scrollHeight when document is absent', () => {
    const prevDoc = globalThis.document
    const orig = window.scrollTo
    const spy = jest.fn()

    window.scrollTo = spy
    cleanups.push(() => {
      window.scrollTo = orig
      globalThis.document = prevDoc
    })

    delete globalThis.document

    // Non-home host — the else branch measures document height, guarded.
    expect(() => scrollToContact(hostStub({ isHomePage: false }))).not.toThrow()
    expect(spy).toHaveBeenCalled()
  })
})

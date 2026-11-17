/**
 * @file cardstack-settle-tails.test.js
 * @description Coverage tails for <card-stack>'s mount settle gate:
 * the deck's --pending reveal via the RO-less fallback timer and the
 * _deckResize path, _settleDeck's idempotent flip + timer clear,
 * onDestroy's pending-timer teardown + re-mount reset, and the
 * document.fonts.ready half of the reveal — the gate that keeps the
 * font swap from re-posing the pile in view.
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals'
import { CardStack } from '@website/components/home/CardStack.js'
import { mount, waitFor } from '@tests/fixtures/test-constants.js'
import { CARD_STACK_CLASSES as C } from '@core/tokens/classes/card-stack.js'
import { CARD_STACK_SELECTORS as SEL } from '@core/tokens/selectors/card-stack.js'
import { CARD_STACK_LAYOUT } from '@core/tokens/motion/card-stack.js'

/** Card-item factory — unique link/image/label per index. */
const item = (n) => ({
  link: `p-${n}`,
  image: `img-${n}`,
  label: `Project ${n}`,
  description: `Desc ${n}`,
  featured: true,
})

/** Teardown registry — mounts push cleanup fns; afterEach drains them. */
const cleanups = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()()

  // A failed fake-timer test would leak the fake clock into the next
  // test's real-timer waits — restore unconditionally.
  jest.useRealTimers()
})

/** Shadow-DOM lookup for the deck container element. */
const deckEl = (el) => el.shadowRoot.querySelector(SEL.CARD_STACK_DECK)

describe('CardStack mount settle gate', () => {
  test('mount emits --pending and the RO-less fallback timer reveals the deck', async () => {
    const el = new CardStack()
    cleanups.push(mount(el))

    el.processedItems = [item(0), item(1)]

    const deck = deckEl(el)
    expect(deck.classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(true)
    expect(el._settled).toBe(false)
    expect(el._settleTimer).not.toBeNull()

    // happy-dom has no ResizeObserver — the SETTLE_FALLBACK_MS timer is
    // the reveal path here — and no document.fonts, so _fontsReady
    // resolves through the API-absent arm in onUpdated.
    await waitFor(() => el._settled === true)

    expect(deck.classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(false)
    expect(el._settleTimer).toBeNull()
  })

  test('_deckResize lifts the gate once items exist', async () => {
    const el = new CardStack()
    cleanups.push(mount(el))

    // The document is already proven by the first test — simulate an
    // unsettled element BEFORE items so onUpdated arms the fonts wait
    // and the RO-path flip is what gets exercised.
    el._settled = false

    el.processedItems = [item(0), item(1)]

    el._deckResize()

    // The delivery arms the reveal — the quiesce timer force-lifts it
    // once the band goes quiet (happy-dom has no RO hop to absorb).
    expect(el._revealArmed).toBe(true)
    expect(el._settled).toBe(false)

    await waitFor(() => el._settled === true)

    expect(deckEl(el).classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(false)
  })

  test('_settleDeck arms the reveal, holds while the band moves, clears timers, and skips the second flip', () => {
    jest.useFakeTimers()

    const el = new CardStack()
    cleanups.push(mount(el))

    // Proven-document mounts start settled — back the flag off BEFORE
    // items so onUpdated arms the fonts wait (no Font Loading API in
    // happy-dom → _fontsReady resolves through the absent-API arm).
    el._settled = false

    el.processedItems = [item(0)]

    el._settleTimer = setTimeout(() => {}, CARD_STACK_LAYOUT.SETTLE_FALLBACK_MS)

    el._settleDeck()

    // Armed, not settled — happy-dom's tier leaves the band still, so
    // force the moving-band flag to exercise the hold: a delivery while
    // the fit is still resizing the deck must not lift.
    expect(el._revealArmed).toBe(true)
    expect(el._settled).toBe(false)

    el._fitMovedDeck = true
    el._maybeReveal()

    expect(el._settled).toBe(false)

    // The quiesce timer force-lifts — the pending fallback clears with it.
    jest.advanceTimersByTime(CARD_STACK_LAYOUT.SETTLE_FALLBACK_MS)

    expect(el._settled).toBe(true)
    expect(el._settleTimer).toBeNull()
    expect(el._revealTimer).toBeNull()

    el._settleDeck()

    expect(el._settled).toBe(true)

    jest.useRealTimers()
  })

  test('_maybeReveal holds the gate until fonts resolve, then reveals with a final hidden measure', async () => {
    // Stub the Font Loading API with a controllable promise — the real
    // gate: a landed pose pass is not enough, the reveal waits for
    // document.fonts.ready so the font swap can't re-pose in view.
    let resolveFonts
    const ready = new Promise((res) => {
      resolveFonts = res
    })

    Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true })
    cleanups.push(() => delete document.fonts)

    const el = new CardStack()
    cleanups.push(mount(el))

    el._settled = false

    el.processedItems = [item(0), item(1)]

    const deck = deckEl(el)
    expect(deck.classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(true)
    expect(el._fontsArmed).toBe(true)
    expect(el._fontsReady).toBe(false)

    // The measurement half lands — still no reveal while fonts pend.
    el._settleDeck()

    expect(el._settled).toBe(false)
    expect(deck.classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(true)

    // Fonts resolve → the promise edge re-runs the gate and lifts it.
    resolveFonts()
    await waitFor(() => el._settled === true)

    expect(deck.classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(false)

    // The reverse order on a second element: the already-resolved
    // fonts.ready fires _maybeReveal while no pose pass has landed —
    // the first-pose half holds until _settleDeck/_deckResize runs.
    const el2 = new CardStack()
    cleanups.push(mount(el2))

    el2._settled = false

    el2.processedItems = [item(0)]

    // Let the fonts.then microtask land — the gate must still hold.
    await Promise.resolve()

    expect(el2._fontsReady).toBe(true)
    expect(el2._settled).toBe(false)

    el2._deckResize()

    await waitFor(() => el2._settled === true)
  })

  test('_maybeReveal on a detached element is a no-op', () => {
    const el = new CardStack()

    // Both halves armed by hand — the isConnected guard is what stops
    // a post-destroy promise edge from posing a detached deck.
    el._settled = false
    el._firstPoseLanded = true
    el._fontsReady = true

    el._maybeReveal()

    expect(el._settled).toBe(false)
  })

  test('onDestroy clears a pending settle timer and the document-stayed gate skips re-mount pending', async () => {
    // Earlier tests in this file already settled the shared document —
    // a fresh element starts settled (the proven-document contract that
    // keeps view re-render remounts from flashing the deck).
    const el = new CardStack()

    expect(el._settled).toBe(true)

    const unmount = mount(el)

    el.processedItems = [item(0)]

    // Proven document: no pending class, no fallback timer armed.
    expect(deckEl(el).classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(false)
    expect(el._settleTimer).toBeNull()

    unmount()

    expect(el._settleTimer).toBeNull()
    expect(el._settled).toBe(true)

    // Re-mount stays revealed — the fresh nodes land posed via the
    // per-element first-pose suppression, never through the gate.
    cleanups.push(mount(el))

    el.processedItems = [item(0)]

    expect(el._settled).toBe(true)
    expect(deckEl(el).classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(false)
  })

  test('onDestroy clears a live quiesce timer on an armed-but-unlifted reveal', () => {
    jest.useFakeTimers()

    const el = new CardStack()
    const unmount = mount(el)

    // Document already proven — back the flag off and push items so the
    // arm runs; destroy must drop the quiesce timer before it fires on
    // a detached element.
    el._settled = false

    el.processedItems = [item(0)]

    el._settleDeck()

    expect(el._revealArmed).toBe(true)
    expect(el._revealTimer).not.toBeNull()

    unmount()

    expect(el._revealTimer).toBeNull()
    expect(el._settled).toBe(true)
  })
})

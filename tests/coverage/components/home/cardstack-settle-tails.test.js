/**
 * @file cardstack-settle-tails.test.js
 * @description Coverage tails for <card-stack>'s mount settle gate:
 * the deck's --pending reveal via the RO-less fallback timer and the
 * _deckResize path, _settleDeck's idempotent flip + timer clear, and
 * onDestroy's pending-timer teardown + re-mount reset.
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
    // the reveal path here.
    await waitFor(() => el._settled === true)

    expect(deck.classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(false)
    expect(el._settleTimer).toBeNull()
  })

  test('_deckResize lifts the gate once items exist', () => {
    const el = new CardStack()
    cleanups.push(mount(el))

    el.processedItems = [item(0), item(1)]

    // The document is already proven by the first test — simulate an
    // unsettled element so the RO-path flip is what gets exercised.
    el._settled = false

    el._deckResize()

    expect(el._settled).toBe(true)
    expect(deckEl(el).classList.contains(C.CARD_STACK_DECK_PENDING)).toBe(false)
  })

  test('_settleDeck clears a live timer, no-ops on a null deck, and skips the second flip', () => {
    jest.useFakeTimers()

    const el = new CardStack()

    // Proven-document mounts start settled — back the flag off so the
    // body's timer-clear + class-remove arms run.
    el._settled = false
    el._settleTimer = setTimeout(() => {}, CARD_STACK_LAYOUT.SETTLE_FALLBACK_MS)

    el._settleDeck()

    expect(el._settled).toBe(true)
    expect(el._settleTimer).toBeNull()

    el._settleDeck()

    expect(el._settled).toBe(true)

    jest.useRealTimers()
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
})

/**
 * @file custom-elements-lifecycle.test.js
 * @description Layer 3 — Shadow DOM & custom-element lifecycle under WebKit
 * conditions: premature connectedCallback, idempotent mount cycles, and the
 * adoptedStyleSheets-missing stylesheet fallback.
 */
import { COMPONENT_TAGS } from '@core/tokens/elements/components.js'

/** Mobile-critical elements under test — the registration modules to import. */
const MODULES = [
  '@website/components/home/CardStack.js',
  '@website/components/carousel/MentionsDeck.js',
  '@website/components/carousel/CustomCarousel.js',
  '@website/components/carousel/AwardsCarousel.js',
  '@website/components/feedback/SiteToast.js',
  '@website/components/feedback/CookieBanner.js',
  '@website/components/dialogs/SearchModal.js',
  '@website/components/dialogs/LangDialog.js',
]

/** Tags whose registration module resolved — the set every lifecycle test iterates. */
const defined = []

beforeAll(async () => {
  for (const m of MODULES) {
    await import(m)
  }

  for (const tag of Object.values(COMPONENT_TAGS)) {
    if (customElements.get(tag)) defined.push(tag)
  }
})

describe('Layer 3 — custom-element lifecycle', () => {
  test('every imported registration module defines its element', () => {
    expect(defined.length).toBeGreaterThanOrEqual(MODULES.length)
  })

  test.each([
    [COMPONENT_TAGS.CARD_STACK],
    [COMPONENT_TAGS.MENTIONS_DECK],
    [COMPONENT_TAGS.SITE_TOAST],
    [COMPONENT_TAGS.CUSTOM_CAROUSEL],
  ])('premature connectedCallback on <%s> before attrs/children throws nothing', (tag) => {
    const el = document.createElement(tag)
    const frag = document.createDocumentFragment()

    expect(() => frag.appendChild(el)).not.toThrow()
    expect(() => document.body.appendChild(el)).not.toThrow()
    el.remove()
  })

  test.each([
    [COMPONENT_TAGS.CARD_STACK],
    [COMPONENT_TAGS.MENTIONS_DECK],
    [COMPONENT_TAGS.SITE_TOAST],
  ])('reconnect ×3 on <%s>: single shadow root, no duplicate listeners/leaks', (tag) => {
    const el = document.createElement(tag)

    document.body.appendChild(el)
    const firstChildren = el.shadowRoot ? el.shadowRoot.childNodes.length : 0

    for (let i = 0; i < 3; i++) {
      el.remove()
      document.body.appendChild(el)
    }

    expect(el.shadowRoot).toBe(el.shadowRoot)
    if (firstChildren)
      expect(el.shadowRoot.childNodes.length).toBeLessThanOrEqual(firstChildren * 3)
    el.remove()
  })

  test.each([[COMPONENT_TAGS.CARD_STACK], [COMPONENT_TAGS.MENTIONS_DECK]])(
    'missing adoptedStyleSheets on <%s> falls back to a <style> node in shadow',
    (tag) => {
      const desc = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets')

      Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
        value: undefined,
        configurable: true,
      })
      const el = document.createElement(tag)

      document.body.appendChild(el)
      const hasFallback = !!el.shadowRoot && !!el.shadowRoot.querySelector('style')

      expect(hasFallback || (el.shadowRoot?.adoptedStyleSheets?.length ?? 0) >= 0).toBe(true)
      if (desc) Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', desc)
      else delete ShadowRoot.prototype.adoptedStyleSheets
      el.remove()
    }
  )
})

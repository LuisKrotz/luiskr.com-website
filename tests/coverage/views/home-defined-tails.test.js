/**
 * @file home-defined-tails.test.js
 * @description Coverage tail for views/home/Home.tsx — the
 * `customElements.get` registration guard's defined arm: the module body
 * must evaluate while the view-home tag already resolves, so a stub is
 * predefined here before the module is dynamically imported.
 */

import { describe, test, expect } from '@jest/globals'
import { VIEW_TAGS } from '@core/tokens/elements/views.js'

describe('view-home registration guard', () => {
  test('an already-defined tag skips re-registration', async () => {
    if (!customElements.get(VIEW_TAGS.VIEW_HOME)) {
      customElements.define(VIEW_TAGS.VIEW_HOME, class extends HTMLElement {})
    }

    const mod = await import('@website/views/home/Home.js')

    expect(mod.ViewHome ?? mod.default ?? mod).toBeDefined()
    expect(customElements.get(VIEW_TAGS.VIEW_HOME)).not.toBe(mod.ViewHome)
  })
})

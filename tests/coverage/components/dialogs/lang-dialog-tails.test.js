/**
 * @file lang-dialog-tails.test.js
 * @description Coverage tails for components/dialogs/lang-dialog —
 * `localeUrl`'s earthPlayground `||` fallback (a fetched slugs dictionary
 * carrying an empty slug collapses to the static route segment) and the
 * `!isPlainClick` early return on the locale option anchors.
 */
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { localeUrl } from '@website/components/dialogs/lang-dialog/locale.js'
import { renderLangDialog } from '@website/components/dialogs/lang-dialog/render.js'
import { fetchBodyNames } from '@core/locale/starfield-names.js'
import { routeSlugs } from '@core/locale/ui-text.js'
import store from '@core/store.js'
import router from '@core/router/router.js'
import { LANG_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { ROUTE_NAMES } from '@core/tokens/routes/names.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { MOUSE_EVENTS } from '@core/tokens/events/dom.js'
import { DATA_ATTRS } from '@core/tokens/attrs/data.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'

describe('lang-dialog locale + render tails', () => {
  afterEach(() => {
    store.commit(LANG_MUTATIONS.SET_SLUGS_LANG, null)
    router.currentRoute = { name: ROUTE_NAMES.HOME }
  })

  test('localeUrl falls back to the static playground segment on an empty slug', () => {
    router.currentRoute = { name: ROUTE_NAMES.EARTH_PLAYGROUND }

    // A live DB slugs node can carry an empty value — the || arm must
    // produce the untranslated segment instead of a bare locale root.
    store.commit(LANG_MUTATIONS.SET_SLUGS_LANG, { earthPlayground: CHAR_STRINGS.EMPTY })

    const url = localeUrl(LOCALES.DE)

    expect(url).toContain(ROUTE_PATHS.EARTH_PLAYGROUND_SEGMENT)
  })

  test('lang option anchors keep native semantics on a modified click', () => {
    const host = { isOpen: true, selectLang: jest.fn(), close: jest.fn() }
    const tree = renderLangDialog(host)
    const anchor = tree.querySelector(`a[${DATA_ATTRS.DATA_LANG}]`)

    expect(anchor).toBeTruthy()

    const ev = new MouseEvent(MOUSE_EVENTS.CLICK, {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    })

    anchor.dispatchEvent(ev)

    expect(ev.defaultPrevented).toBe(false)
    expect(host.selectLang).not.toHaveBeenCalled()
  })
})

describe('lang-dialog localized route branches', () => {
  const BODY_ID = 'milky-way'

  const jsonRes = (body) => ({ ok: true, json: async () => body })

  let origFetch

  beforeEach(() => {
    origFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = origFetch
    store.commit(LANG_MUTATIONS.SET_SLUGS_LANG, null)
    router.currentRoute = { name: ROUTE_NAMES.HOME }
  })

  test('star-field index rebuilds on the target locale slug', () => {
    router.currentRoute = { name: ROUTE_NAMES.STAR_FIELD, lang: LOCALES.EN, params: {} }

    expect(localeUrl(LOCALES.ES)).toBe(
      `${ROUTE_PATHS.ROOT}${LOCALES.ES}${ROUTE_PATHS.ROOT}${routeSlugs(LOCALES.ES).starField}`
    )
  })

  test('star-field body segment re-keys slug→id→target slug via names tables', async () => {
    globalThis.fetch = jest.fn(async (url) => {
      const u = String(url)

      if (u.endsWith('/zz/names.json')) return jsonRes({ [BODY_ID]: 'Camino de Santiago' })
      if (u.endsWith(`/${LOCALES.EN}/names.json`)) return jsonRes({ [BODY_ID]: 'Milky Way' })

      return { ok: false, status: 404 }
    })

    await fetchBodyNames('zz')
    await fetchBodyNames(LOCALES.EN)

    router.currentRoute = {
      name: ROUTE_NAMES.STAR_FIELD,
      lang: 'zz',
      params: { body: 'camino-de-santiago' },
    }

    expect(localeUrl(LOCALES.EN)).toBe(
      `${ROUTE_PATHS.ROOT}${ROUTE_PATHS.STAR_FIELD_SEGMENT}${ROUTE_PATHS.ROOT}${BODY_ID}`
    )
  })

  test('star-field body id passes through when it is not a localized slug', () => {
    router.currentRoute = {
      name: ROUTE_NAMES.STAR_FIELD,
      lang: 'zz',
      params: { body: BODY_ID },
    }

    expect(localeUrl(LOCALES.EN)).toContain(`${ROUTE_PATHS.ROOT}${BODY_ID}`)
  })

  test('star-field body segment falls back to the raw segment without names tables', () => {
    router.currentRoute = {
      name: ROUTE_NAMES.STAR_FIELD,
      lang: 'yy',
      params: { body: 'via-lactea' },
    }

    expect(localeUrl(LOCALES.EN)).toContain('via-lactea')
  })

  test('star-field url falls back to the static segment on an empty slug', () => {
    router.currentRoute = { name: ROUTE_NAMES.STAR_FIELD, params: {} }

    store.commit(LANG_MUTATIONS.SET_SLUGS_LANG, { starField: CHAR_STRINGS.EMPTY })

    expect(localeUrl(LOCALES.DE)).toContain(ROUTE_PATHS.STAR_FIELD_SEGMENT)
  })

  test('animations, search and sitemap rebuild on their localized slugs', () => {
    const cases = [
      [ROUTE_NAMES.ANIMATIONS, 'animations', ROUTE_PATHS.ANIMATIONS_SEGMENT],
      [ROUTE_NAMES.SEARCH, 'search', ROUTE_PATHS.SEARCH_SEGMENT],
      [ROUTE_NAMES.SITEMAP, 'sitemap', ROUTE_PATHS.SITEMAP_SEGMENT],
    ]

    for (const [name, slugKey, segment] of cases) {
      router.currentRoute = { name, lang: LOCALES.EN, params: {} }

      expect(localeUrl(LOCALES.ES)).toBe(
        `${ROUTE_PATHS.ROOT}${LOCALES.ES}${ROUTE_PATHS.ROOT}${routeSlugs(LOCALES.ES)[slugKey]}`
      )

      store.commit(LANG_MUTATIONS.SET_SLUGS_LANG, { [slugKey]: CHAR_STRINGS.EMPTY })

      expect(localeUrl(LOCALES.DE)).toContain(segment)

      store.commit(LANG_MUTATIONS.SET_SLUGS_LANG, null)
    }
  })
})

/**
 * @file portfolio/related/data.ts — the two-node SWR fetch behind
 * <portfolio-related>: the home page node (portfoliolist join table)
 * and components/related (title, path, socials, project pointers).
 */

import { CMS_KEYS } from '@core/tokens/data/cms-keys.js'
import { DATA_MUTATIONS } from '@core/tokens/events/mutations.js'
import { LOCALES } from '@core/tokens/locales.js'
import { DB_PATHS } from '@core/tokens/routes/paths.js'
import store from '@core/store.js'
import { fetchFirebaseDb } from '@core/utils/data/db.js'
import type { DbSnapshot } from '@core/utils/data/db.js'
import type { HomeItem, RelatedTranslations } from './types.js'
import type { PortfolioRelated } from '../Related.js'
import { devError } from '@core/devlog.js'

/** components/related translations from the store dictionary, if loaded. */
export function storedTranslations(): RelatedTranslations {
  return (
    (store.getters.getlang()?.components as Record<string, RelatedTranslations> | undefined)?.[
      CMS_KEYS.RELATED
    ] || {}
  )
}

/**
 * Fires two SWR reads in parallel: the home page node (for the
 * portfoliolist used as the image/description join table) and the
 * components/related node (title, path, socials, project pointers).
 * A store hit resolves instantly; a miss round-trips Firebase. Each read
 * passes its applier as onUpdate so a build-snapshot↔live divergence
 * (CMS edits landing after the snapshot was cut) re-renders the strip
 * instead of pinning the stale list until the next mount.
 */
export function fetchData(host: PortfolioRelated): void {
  const lang = store.getters.getlang()

  const locale = lang.locale || LOCALES.EN

  const dbpath = `${lang.database}${locale}${lang.pagesPath}${CMS_KEYS.HOME}`

  const relatedPath = `${lang.database}${locale}${DB_PATHS.COMPONENTS_RELATED}`

  const applyRelated = (snap: DbSnapshot): void => {
    if (snap?.exists()) {
      host.translations = snap.val() as RelatedTranslations

      host._updateDom()
    }
  }

  const applyHome = (snap: DbSnapshot): void => {
    if (snap?.exists()) {
      const data = snap.val() as { portfoliolist?: HomeItem[] | Record<string, HomeItem> }

      if (data.portfoliolist) {
        const list = Array.isArray(data.portfoliolist)
          ? data.portfoliolist
          : Object.values(data.portfoliolist)

        host.homePortfolio = list

        store.commit(DATA_MUTATIONS.SET_PORTFOLIO_LIST, list)

        host._updateDom()
      }
    }
  }

  Promise.all([
    fetchFirebaseDb(dbpath, applyHome).then(applyHome),
    fetchFirebaseDb(relatedPath, applyRelated).then(applyRelated),
  ]).catch(devError)
}

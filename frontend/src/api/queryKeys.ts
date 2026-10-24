/** Ключи кэша TanStack Query, которые делят несколько компонентов */

/** «Где работает»: карточка компании и пунктир на карте радара читают один кэш */
export const companyLocationsKey = (companyId: number) => ['company-locations', companyId] as const

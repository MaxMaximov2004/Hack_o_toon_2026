// API типы данных

export interface User {
  id: number
  email: string
  fullName: string
  roles: string[]
}

export interface LoginResponse {
  mfaToken: string
  mfaSetupRequired: boolean
  otpauthUrl?: string
  qrPngBase64?: string
}

export interface TwoFactorVerifyResponse {
  accessToken: string
  expiresIn: number
  user: User
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ErrorResponse {
  error: ApiError
}

// Справочники
export interface Industry {
  code: string
  name: string
}

export interface Municipality {
  id: number
  name: string
  kind: 'city' | 'district'
  lat: number
  lon: number
}

export interface SizeCategory {
  code: string
  name: string
}

export interface Stage {
  code: string
  name: string
}

export interface Need {
  code: string
  name: string
}

export interface Dictionaries {
  industries: Industry[]
  municipalities: Municipality[]
  sizeCategories: SizeCategory[]
  stages: Stage[]
  needs: Need[]
}

// Карта
export interface MapCell {
  lat: number
  lon: number
  total: number
  ours: number
  others: number
  excluded: number
}

export interface MapPoint {
  id: number
  lat: number
  lon: number
  kind: 'ours' | 'others' | 'excluded'
}

export interface MapCellsResponse {
  mode: 'cells'
  cellDeg: number
  total: number
  cells: MapCell[]
}

export interface MapPointsResponse {
  mode: 'points'
  total: number
  points: MapPoint[]
}

export type MapDataResponse = MapCellsResponse | MapPointsResponse

// Компании
export type CompanyKind = 'ours' | 'others' | 'excluded'
export type CompanyStatus = 'active' | 'excluded'
export type SubjectType = 'ip' | 'legal'
export type SizeCategoryCode = 'micro' | 'small' | 'medium'
export type RevenueSource = 'fns' | 'model'

export interface CompanyShort {
  id: number
  inn: string
  name: string
  industry: string
  industryName: string
  okvedCode: string
  okvedName: string
  municipalityId: number
  municipalityName: string
  settlement: string | null
  lat: number
  lon: number
  sizeCategory: SizeCategoryCode
  employees: number | null
  revenueEst: number | null
  revenueGrowthEst: number | null
  revenueSource: RevenueSource
  isEstimated: boolean
  isClient: boolean
  status: CompanyStatus
  kind: CompanyKind
  excludedAt: string | null
  isNew: boolean
  registeredAt: string
  relocated?: boolean // задача со звёздочкой
}

export interface Company extends CompanyShort {
  ogrn: string
  subjectType: SubjectType
  phone: string | null
  email: string | null
  website: string | null
  hasLicenses: boolean
  isInnovative: boolean
  isSocial: boolean
}

export interface CompaniesResponse {
  items: CompanyShort[]
  page: number
  size: number
  total: number
}

// Статистика районов
export interface MunicipalityStats {
  municipalityId: number
  name: string
  kind: 'city' | 'district'
  lat: number
  lon: number
  industry: string
  companies: number
  clients: number
  excludedClients: number
  coverage: number
  newShare: number
  revenueEstSum: number
  potentialScore: number
  isWhiteSpot: boolean
  reason: string
}

// Белые пятна
export interface WhiteSpot {
  municipalityId: number
  name: string
  lat: number
  lon: number
  potentialScore: number
  companies: number
  clients: number
  reason: string
}

// Импорт клиентов
export interface ImportClientsResponse {
  rows: number
  matched: number
  notFound: string[]
  mode: 'append' | 'replace'
  whiteSpots: number
}

// Проекты (продукт 2 - Навигатор)
export type ProjectStage = 'design' | 'construction' | 'launch'

export interface RecommendedOffer {
  need: string
  needName: string
  offers: string[]
}

export interface ProjectShort {
  id: number
  title: string
  initiator: string
  municipalityId: number
  municipalityName: string
  lat: number
  lon: number
  isKey: boolean
  curator: string
  startYear: number
  launchYear: number
  amountMln: number
  jobs: number
  stage: ProjectStage
  stageName: string
  industry: string
  industryName: string
  needs: string[]
  recommendedOffers: RecommendedOffer[]
  updatedAt: string
}

export interface Project extends ProjectShort {
  // Все поля уже в ProjectShort, но явно обозначаем полную форму
}

export interface ProjectsResponse {
  items: ProjectShort[]
  page: number
  size: number
  total: number
}

// Таймлайн проектов
export type TimelineEventType = 'start' | 'launch'

export interface TimelineEvent {
  projectId: number
  type: TimelineEventType
  title: string
  municipalityId: number
  municipalityName: string
  stage: ProjectStage
  amountMln: number
}

export interface TimelineYear {
  year: number
  events: TimelineEvent[]
}

export interface TimelineResponse {
  minYear: number
  maxYear: number
  total: number
  years: TimelineYear[]
}

// Связанные компании проекта
export type ProjectCompanyRelation = 'initiator' | 'same_area_industry'

export interface ProjectRelatedCompany {
  id: number
  inn: string
  name: string
  industry: string
  industryName: string
  municipalityId: number
  municipalityName: string
  revenueEst: number | null
  isEstimated: boolean
  kind: CompanyKind
  relation: ProjectCompanyRelation
}

export interface ProjectRelatedCompaniesResponse {
  items: ProjectRelatedCompany[]
  sameAreaIndustryTotal: number
  radarQuery: string | null
}

// Подписки
export interface Subscription {
  id: number
  userId: number
  industry: string | null
  industryName: string | null
  municipalityId: number | null
  municipalityName: string | null
  need: string | null
  needName: string | null
  stage: ProjectStage | null
  stageName: string | null
  createdAt: string
}

/** GET /api/subscriptions — массив подписок, новые сверху (contracts/examples/subscriptions.json) */
export type SubscriptionsResponse = Subscription[]

// Уведомления
export interface Notification {
  id: number
  userId: number
  projectId: number
  projectTitle: string
  municipalityName: string
  read: boolean
  createdAt: string
}

export interface NotificationsResponse {
  items: Notification[]
  unreadCount: number
}

// Telegram-линк
export interface TelegramLinkResponse {
  botConfigured: boolean
  linked: boolean
  url: string | null
}

import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { calcHandlers } from '../calc/mockHandlers'

export const worker = setupWorker(...handlers, ...calcHandlers)

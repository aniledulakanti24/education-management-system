import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { phase2Handlers } from './handlers-phase2'
import { phase3Handlers } from './handlers-phase3'
import { phase3bHandlers } from './handlers-phase3b'

export const worker = setupWorker(...handlers, ...phase2Handlers, ...phase3Handlers, ...phase3bHandlers)

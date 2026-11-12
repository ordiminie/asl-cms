import {campaignScheduledJobHandlers} from '../campaign-service'
import {
  RunDueScheduledJobsResult,
  ScheduledJobHandlers,
} from '../types/domain/scheduled-job-types'
import scheduledJobServiceInterceptor from './interceptors/scheduled-job-service-logger-interceptor'

/**
 * Le planificateur (ADR 006, ADR 052). La facade compose le registre
 * `type -> gestionnaire` a partir des services qui portent des taches : un
 * service ne connait pas les gestionnaires des autres.
 */
const scheduledJobHandlers: ScheduledJobHandlers = {
  ...campaignScheduledJobHandlers,
}

/** Un passage : toutes les associations, ou une seule. */
export const runDueScheduledJobsService = (
  now: Date,
  organizationId?: string
): Promise<RunDueScheduledJobsResult> =>
  scheduledJobServiceInterceptor.runDueScheduledJobsService({
    handlers: scheduledJobHandlers,
    now,
    ...(organizationId ? {organizationId} : {}),
  })

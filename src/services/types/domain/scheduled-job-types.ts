/**
 * Types de domaine du planificateur (ADR 006, ADR 052). Ecrits **sans
 * importer le modele Drizzle** (`rule-architecture`).
 *
 * Le `payload` d'une tache ne porte que des identifiants : jamais d'adresse
 * ni de contenu.
 */

/** Une tache prise par un passage, telle qu'un gestionnaire la recoit. */
export type ScheduledJob = {
  id: string
  organizationId: string
  kind: string
  payload: Record<string, string>
  /** Tentatives comptees, celle en cours comprise. */
  attempts: number
  /**
   * La tache portait encore un verrou, perime, quand ce passage l'a prise :
   * son detenteur precedent est mort ou a echoue sans la rendre. Ce qu'il
   * avait commence ne sera jamais termine par lui.
   */
  resumedAfterStaleLock: boolean
}

/** Ce qu'un gestionnaire rend ; le planificateur l'ecrit. */
export type ScheduledJobOutcome =
  | {status: 'completed'}
  | {status: 'retry'; runAfter: Date}
  | {status: 'failed'}
  /** Rendue sans avoir ete tentee : la tentative n'est pas comptee. */
  | {status: 'released'}

export type ScheduledJobHandler = (
  job: ScheduledJob,
  now: Date
) => Promise<ScheduledJobOutcome>

/** Le registre `type -> gestionnaire` d'un passage. */
export type ScheduledJobHandlers = Readonly<Record<string, ScheduledJobHandler>>

export type RunDueScheduledJobsInput = {
  handlers: ScheduledJobHandlers
  /** L'instant du passage, lu par l'appelant. */
  now: Date
  /** Une seule association (passage immediat apres une creation). */
  organizationId?: string
}

export type RunDueScheduledJobsResult = {
  organizations: number
  processed: number
  /** Les associations dont un traitement a echoue. */
  failed: string[]
}

/**
 * Age au-dela duquel le verrou d'une tache est perime (ADR 052) : un
 * redemarrage pendant l'execution rend la tache reprenable.
 */
export const SCHEDULED_JOB_LOCK_STALE_MS = 15 * 60 * 1000

/** Taches prises au plus par association et par passage. */
export const SCHEDULED_JOBS_BATCH_SIZE = 20

/** La livraison d'une part de campagne (s26). Cle : l'identifiant de la part. */
export const CAMPAIGN_DELIVER_PART_JOB_KIND = 'campaign.deliver_part'

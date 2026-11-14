import {z} from 'zod'

import {MEMBER_QUESTION_BODY_MAX_LENGTH} from '../types/domain/member-question-types'

/** Validation des questions posees par un membre au bureau (s23). */

export const memberQuestionOrganizationIdSchema = z.string().uuid()
export const memberQuestionIdSchema = z.string().uuid()

const isNotBlank = (value: string) => value.trim().length > 0

/**
 * Ce qu'un membre connecte envoie : **aucun champ d'identite ni `memberId`**
 * — Zod retire ce qui y serait glisse ; la fiche vient de la session et du
 * domaine appele (ADR 049). Le sujet est obligatoire (D2).
 */
export const createMyQuestionServiceSchema = z.object({
  organizationId: memberQuestionOrganizationIdSchema,
  locale: z.string(),
  categoryId: z.string().uuid(),
  body: z.string().max(MEMBER_QUESTION_BODY_MAX_LENGTH).refine(isNotBlank),
})

export const memberQuestionsPageServiceSchema = z.object({
  organizationId: memberQuestionOrganizationIdSchema,
  page: z.number().int().min(1),
})

export const memberQuestionServiceSchema = z.object({
  organizationId: memberQuestionOrganizationIdSchema,
  questionId: memberQuestionIdSchema,
})

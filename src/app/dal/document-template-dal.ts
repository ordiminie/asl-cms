import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageDocumentTemplatesService,
  getDocumentTemplateService,
  getTemplateDocumentRecipientService,
  listDocumentLotGroupsService,
  listDocumentTemplatesService,
} from '@/services/facades/document-template-service-facade'
import {
  DocumentRecipientDTO,
  DocumentTemplateDTO,
  DocumentTemplateListItemDTO,
} from '@/services/types/domain/document-template-types'
import {RecipientGroupDTO} from '@/services/types/domain/recipient-group-types'

/**
 * Modeles de documents (s36, ADR 074). **Aucun `'use cache'`** : donnees du
 * bureau, lues par session et streamees derriere un `<Suspense>`. `cache()`
 * deduplique dans la requete. Le service ouvre le scope du tenant passe,
 * celui du domaine appele.
 */
export const getDocumentTemplatesForBureauDal = cache(
  async (organizationId: string): Promise<DocumentTemplateListItemDTO[]> =>
    listDocumentTemplatesService(organizationId)
)

/**
 * Un modele ouvert. L'absence, ou un identifiant malforme, devient
 * `undefined`, que la page traduit en 404 ; un refus ou une panne remonte. Un
 * modele d'une autre association est absent : la RLS ne le rend pas.
 */
export const getDocumentTemplateForBureauDal = cache(
  async (
    organizationId: string,
    templateId: string
  ): Promise<DocumentTemplateDTO | undefined> =>
    getDocumentTemplateService({organizationId, templateId}).catch(
      (error: unknown) => {
        if (error instanceof ValidationParsedZodError) return undefined
        throw error
      }
    )
)

/** Les groupes que la generation en lot peut viser (s27), par nom. */
export const getDocumentLotGroupsForBureauDal = cache(
  async (organizationId: string): Promise<RecipientGroupDTO[]> =>
    listDocumentLotGroupsService(organizationId)
)

/**
 * L'utilisateur connecte gere-t-il les modeles de l'association du domaine
 * appele ? Donnee par utilisateur : jamais cachee au-dela de la requete.
 */
export const canManageCurrentDocumentTemplatesDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageDocumentTemplatesService(tenant.id)
  }
)

/**
 * L'adresse que la lettre imprimera pour une fiche (ecran 3, ADR 067). Un
 * identifiant malforme devient `undefined` ; un refus remonte.
 */
export const getTemplateDocumentRecipientForBureauDal = cache(
  async (
    organizationId: string,
    memberProfileId: string
  ): Promise<DocumentRecipientDTO | undefined> =>
    getTemplateDocumentRecipientService({
      organizationId,
      memberProfileId,
    }).catch((error: unknown) => {
      if (error instanceof ValidationParsedZodError) return undefined
      throw error
    })
)

import {z} from 'zod'

import {PARCEL_NUMBER_MAX_LENGTH} from '../types/domain/parcel-ownership-types'
import {newsDateSchema} from './news-validation'

/**
 * Validation de la propriete datee des parcelles (s12, ADR 029).
 *
 * Les dates sont des chaines ISO `YYYY-MM-DD` d'un jour qui existe
 * (`2026-02-30` est refusee) : le schema des actualites, verifie en UTC, sans
 * lire l'horloge.
 */

const uuid = z.string().uuid()

export const ownershipDateSchema = newsDateSchema

export const parcelNumberSchema = z
  .string()
  .trim()
  .min(1)
  .max(PARCEL_NUMBER_MAX_LENGTH)

export const attachParcelServiceSchema = z.object({
  organizationId: uuid,
  memberProfileId: uuid,
  parcelNumber: parcelNumberSchema,
  startsOn: ownershipDateSchema,
})

export const recordSaleServiceSchema = z.object({
  organizationId: uuid,
  parcelId: uuid,
  sellerId: uuid,
  buyerId: uuid,
  date: ownershipDateSchema,
})

export const parcelOwnerAtServiceSchema = z.object({
  organizationId: uuid,
  parcelId: uuid,
  date: ownershipDateSchema,
})

export const memberParcelsServiceSchema = z.object({
  organizationId: uuid,
  memberProfileId: uuid,
})

export const saleContextServiceSchema = z.object({
  organizationId: uuid,
  sellerId: uuid,
  parcelId: uuid,
})

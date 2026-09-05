import {beforeEach, describe, expect, it, vi} from 'vitest'

import {getAdminStatisticsDao} from '@/db/repositories/admin-statistics-repository'
import {RoleConst} from '@/services/types/domain/auth-types'

import {
  getDashboardStatsService,
  getDashboardStatsWithParamsService,
} from '../admin-dashboard-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ValidationError} from '../errors/validation-error'
import {AdminDashboardStats} from '../types/domain/admin-dashboard-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin} from './service-test-data'

// Mock des DAOs
vi.mock('@/db/repositories/admin-statistics-repository')

describe('[ADMIN] Admin Dashboard Service', () => {
  const mockStatsData: AdminDashboardStats = {
    totalUsers: 150,
    totalOrganizations: 25,
    userGrowth: [
      {month: '2024-01', count: 10},
      {month: '2024-02', count: 15},
      {month: '2024-03', count: 20},
    ],
    organizationGrowth: [
      {month: '2024-01', count: 2},
      {month: '2024-02', count: 3},
      {month: '2024-03', count: 5},
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminStatisticsDao).mockResolvedValue(mockStatsData)
  })

  describe('[ADMIN] getDashboardStatsService', () => {
    beforeEach(() => {
      const user = {
        ...userTestAdmin,
        role: RoleConst.ADMIN,
        banned: false,
        banReason: null,
        banExpires: null,
        emailVerified: true,
        roles: undefined,
      }
      setupAuthUserMocked(user)
    })

    it('should return admin dashboard stats for admin user', async () => {
      const result = await getDashboardStatsService()

      expect(result).toEqual(mockStatsData)
      expect(getAdminStatisticsDao).toHaveBeenCalledTimes(1)
    })

    it('should validate returned data structure', async () => {
      // Mock de données invalides
      vi.mocked(getAdminStatisticsDao).mockResolvedValue({
        totalUsers: -1, // Invalide : nombre négatif
        totalOrganizations: 'invalid' as unknown as number, // Invalide : string au lieu de number
        userGrowth: [],
        organizationGrowth: [],
      })

      await expect(getDashboardStatsService()).rejects.toThrow(ValidationError)
    })
  })

  describe('[ADMIN] getDashboardStatsWithParamsService', () => {
    beforeEach(() => {
      const user = {
        ...userTestAdmin,
        role: RoleConst.ADMIN,
        banned: false,
        banReason: null,
        banExpires: null,
        emailVerified: true,
        roles: undefined,
      }
      setupAuthUserMocked(user)
    })

    it('should return stats with valid parameters', async () => {
      const result = await getDashboardStatsWithParamsService({months: 3})

      expect(result).toEqual(mockStatsData)
    })

    it('should use default parameters when none provided', async () => {
      const result = await getDashboardStatsWithParamsService()

      expect(result).toEqual(mockStatsData)
    })

    it('should validate input parameters', async () => {
      await expect(
        getDashboardStatsWithParamsService({months: 15}) // Plus de 12 mois
      ).rejects.toThrow(ValidationError)
    })

    it('should reject invalid parameters', async () => {
      await expect(
        getDashboardStatsWithParamsService({months: 0}) // Moins de 1 mois
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('[USER] Authorization Tests', () => {
    beforeEach(() => {
      const user = {
        ...userTest,
        role: RoleConst.USER,
        banned: false,
        banReason: null,
        banExpires: null,
        emailVerified: true,
        roles: undefined,
      }
      setupAuthUserMocked(user)
    })

    it('should reject non-admin user for getDashboardStatsService', async () => {
      await expect(getDashboardStatsService()).rejects.toThrow(
        AuthorizationError
      )
      expect(getAdminStatisticsDao).not.toHaveBeenCalled()
    })

    it('should reject non-admin user for getDashboardStatsWithParamsService', async () => {
      await expect(
        getDashboardStatsWithParamsService({months: 6})
      ).rejects.toThrow(AuthorizationError)
      expect(getAdminStatisticsDao).not.toHaveBeenCalled()
    })
  })

  describe('[PUBLIC] No Authentication Tests', () => {
    beforeEach(() => {
      // Pas d'utilisateur authentifié
      setupAuthUserMocked(undefined)
    })

    it('should reject unauthenticated user for getDashboardStatsService', async () => {
      await expect(getDashboardStatsService()).rejects.toThrow(
        AuthorizationError
      )
      expect(getAdminStatisticsDao).not.toHaveBeenCalled()
    })

    it('should reject unauthenticated user for getDashboardStatsWithParamsService', async () => {
      await expect(
        getDashboardStatsWithParamsService({months: 6})
      ).rejects.toThrow(AuthorizationError)
      expect(getAdminStatisticsDao).not.toHaveBeenCalled()
    })
  })
})

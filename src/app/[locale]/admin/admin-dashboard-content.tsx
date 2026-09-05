// import {
//   getAdminDashboardStatsDal,
//   getAdminStripeSubscriptionMRRDal,
// } from '@/app/dal/admin-dashboard-dal'
import {
  type AdminDashboardStatsDTO,
  // getAdminDashboardStatsDal,
  //getAdminStripeSubscriptionMRRDal,
} from '@/app/dal/admin-dashboard-dal'
import {AdminDashboard} from '@/components/features/admin/dashboard/admin-dashboard'
import type {MRRStats} from '@/services/types/domain/subscription-types'

const fakeDashboardStats: AdminDashboardStatsDTO = {
  totalUsers: 18945,
  totalOrganizations: 1248,
  userGrowth: [
    {month: '2024-01', count: 540},
    {month: '2024-02', count: 620},
    {month: '2024-03', count: 710},
    {month: '2024-04', count: 820},
    {month: '2024-05', count: 910},
    {month: '2024-06', count: 980},
    {month: '2024-07', count: 1040},
    {month: '2024-08', count: 1125},
    {month: '2024-09', count: 1210},
    {month: '2024-10', count: 1350},
    {month: '2024-11', count: 1485},
    {month: '2024-12', count: 1620},
  ],
  organizationGrowth: [
    {month: '2024-01', count: 48},
    {month: '2024-02', count: 52},
    {month: '2024-03', count: 58},
    {month: '2024-04', count: 63},
    {month: '2024-05', count: 70},
    {month: '2024-06', count: 74},
    {month: '2024-07', count: 81},
    {month: '2024-08', count: 88},
    {month: '2024-09', count: 96},
    {month: '2024-10', count: 109},
    {month: '2024-11', count: 118},
    {month: '2024-12', count: 126},
  ],
}

const fakeMRRStats: MRRStats = {
  totalMRR: 12382700,
  currency: 'eur',
  totalActiveSubscriptions: 873,
  newSubscriptionsThisMonth: 149,
  subscriptionGrowthPercent: 17,
  subscriptionGrowth: [
    {month: '2024-01', count: 68},
    {month: '2024-02', count: 72},
    {month: '2024-03', count: 80},
    {month: '2024-04', count: 85},
    {month: '2024-05', count: 90},
    {month: '2024-06', count: 97},
    {month: '2024-07', count: 104},
    {month: '2024-08', count: 112},
    {month: '2024-09', count: 120},
    {month: '2024-10', count: 128},
    {month: '2024-11', count: 136},
    {month: '2024-12', count: 149},
  ],
  planBreakdowns: [
    {
      planCode: 'starter',
      planName: 'Starter',
      subscriptionCount: 420,
      totalMRR: 2058000,
      averageAmount: 4900,
      currency: 'eur',
    },
    {
      planCode: 'growth',
      planName: 'Growth',
      subscriptionCount: 260,
      totalMRR: 3354000,
      averageAmount: 12900,
      currency: 'eur',
    },
    {
      planCode: 'scale',
      planName: 'Scale',
      subscriptionCount: 135,
      totalMRR: 3496500,
      averageAmount: 25900,
      currency: 'eur',
    },
    {
      planCode: 'enterprise',
      planName: 'Enterprise',
      subscriptionCount: 58,
      totalMRR: 3474200,
      averageAmount: 59900,
      currency: 'eur',
    },
  ],
  monthlyMRR: 12382700,
  yearlyMRR: 148592400,
  averageRevenuePerUser: 14200,
}

export default async function AdminDashboardContent() {
  // const stats = await getAdminDashboardStatsDal()
  // const mrrStats = await getAdminStripeSubscriptionMRRDal()

  return <AdminDashboard stats={fakeDashboardStats} mrrStats={fakeMRRStats} />
}

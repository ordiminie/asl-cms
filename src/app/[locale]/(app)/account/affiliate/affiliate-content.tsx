import {getMyAffiliateDashboardDal} from '@/app/dal/affiliate-dal'
import {AffiliateDashboard} from '@/components/features/affiliate/affiliate-dashboard'
import {env} from '@/env'

export async function AffiliateContent() {
  const dashboard = await getMyAffiliateDashboardDal()

  return (
    <AffiliateDashboard
      dashboard={dashboard}
      appUrl={env.NEXT_PUBLIC_APP_URL}
    />
  )
}

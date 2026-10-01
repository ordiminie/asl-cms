import * as sitemapServiceMethods from '../../sitemap-service'
import {createServiceInterceptor} from './create-service-interceptor'

const sitemapServiceInterceptor = createServiceInterceptor(
  sitemapServiceMethods,
  'SITEMAP-SERVICE'
)

export default sitemapServiceInterceptor

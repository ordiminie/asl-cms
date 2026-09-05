import userServiceInterceptor from './interceptors/user-service-logger-interceptor'

//POST SERVICE
export const updateUserService = userServiceInterceptor.updateUserService
export const getUserByIdService = userServiceInterceptor.getUserByIdService
export const getUserByEmailService =
  userServiceInterceptor.getUserByEmailService
export const createUserService = userServiceInterceptor.createUserService
export const createUserFromStripeService =
  userServiceInterceptor.createUserFromStripeService
export const getAllUsersWithPaginationService =
  userServiceInterceptor.getAllUsersWithPaginationService
export const isEmailAvailableService =
  userServiceInterceptor.isEmailAvailableService
export const createOrganizationForUserService =
  userServiceInterceptor.createOrganizationForUserService
export const initializeRegisterUserDataService =
  userServiceInterceptor.initializeRegisterUserDataService

// Facade pour les paramètres utilisateur
export const createUserSettingsService =
  userServiceInterceptor.createUserSettingsService
export const getUserSettingsService =
  userServiceInterceptor.getUserSettingsService
export const updateUserSettingsService =
  userServiceInterceptor.updateUserSettingsService
export const deleteUserSettingsService =
  userServiceInterceptor.deleteUserSettingsService
export const upsertUserSettingsService =
  userServiceInterceptor.upsertUserSettingsService
export const getUsersByOrganizationService =
  userServiceInterceptor.getUsersByOrganizationService

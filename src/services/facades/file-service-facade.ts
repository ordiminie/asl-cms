import fileServiceInterceptor from './interceptors/file-service-logger-interceptor'

export const uploadFileService = fileServiceInterceptor.uploadFileService
export const uploadFileForEntityService =
  fileServiceInterceptor.uploadFileForEntityService
export const uploadImageForEntityService =
  fileServiceInterceptor.uploadImageForEntityService
export const deleteFileService = fileServiceInterceptor.deleteFileService
export const getFileService = fileServiceInterceptor.getFileService
export const listFilesService = fileServiceInterceptor.listFilesService
export const uploadFilePostService =
  fileServiceInterceptor.uploadFilePostService
export const listFilesByPostIdService =
  fileServiceInterceptor.listFilesByPostIdService
export const deleteFileByPostIdService =
  fileServiceInterceptor.deleteFileByPostIdService

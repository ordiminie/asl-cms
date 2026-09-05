export class FileError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'FileError'
  }
}

export const FileErrors = {
  UPLOAD_FAILED: (message: string) =>
    new FileError(message, 'UPLOAD_FAILED', 500),
  DOWNLOAD_FAILED: (message: string) =>
    new FileError(message, 'DOWNLOAD_FAILED', 500),
  DELETE_FAILED: (message: string) =>
    new FileError(message, 'DELETE_FAILED', 500),
  LIST_FAILED: (message: string) => new FileError(message, 'LIST_FAILED', 500),
  INVALID_FILE_TYPE: (type: string) =>
    new FileError(`Invalid file type: ${type}`, 'INVALID_FILE_TYPE', 400),
  FILE_TOO_LARGE: (size: number, maxSize: number) =>
    new FileError(
      `File size ${size} exceeds maximum allowed size of ${maxSize}`,
      'FILE_TOO_LARGE',
      400
    ),
}

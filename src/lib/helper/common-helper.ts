export const generateSlug = (baseName: string): string => {
  return `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(2, 6)}`
}

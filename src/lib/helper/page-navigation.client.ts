/**
 * Recharge la page entiere a l'adresse donnee, sans navigation douce : apres
 * un changement de session (s48, D10), le chrome cache de l'ancienne identite
 * ne doit pas survivre.
 */
export const reloadPageAt = (url: string): void => {
  window.location.assign(url)
}

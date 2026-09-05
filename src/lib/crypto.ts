import bcrypt from 'bcrypt'

/**
 * Génère un hash pour un mot de passe avec un salt
 * @param password - Le mot de passe à hasher
 * @returns Le hash du mot de passe avec le salt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12 // Nombre de rounds pour le hachage (plus c'est élevé, plus c'est sécurisé mais plus lent)
  return bcrypt.hash(password, saltRounds)
}

/**
 * Vérifie si un mot de passe correspond à un hash
 * @param password - Le mot de passe à vérifier
 * @param hashedPassword - Le hash du mot de passe stocké
 * @returns true si le mot de passe correspond, false sinon
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

/**
 * Génère un salt aléatoire
 * @param rounds - Nombre de rounds pour la génération du salt (défaut: 12)
 * @returns Le salt généré
 */
export async function generateSalt(rounds: number = 12): Promise<string> {
  return bcrypt.genSalt(rounds)
}

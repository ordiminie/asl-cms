/**
 * Chemin historique des fichiers de pages (s04). Servi par **le meme**
 * gestionnaire que `/api/files` (ADR 023) pour ne casser aucune adresse deja
 * rendue. Ne pas l'etendre : tout nouveau client passe par `/api/files`.
 */
export {GET} from '@/app/api/files/[...key]/route'

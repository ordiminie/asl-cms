import {getPostLoginPathDal} from '@/app/dal/user-dal'

/**
 * Route de passage apres connexion (s46b, ADR 034), commune aux quatre modes :
 * le lien magique et Google fixent leur destination avant de savoir qui se
 * connecte. Un Route Handler rend un vrai 307 avant tout rendu (ADR 013). Le
 * `Location` est relatif : il reste sur le domaine appele.
 */
export async function GET(): Promise<Response> {
  const path = (await getPostLoginPathDal()) ?? '/login'

  return new Response(null, {status: 307, headers: {Location: path}})
}

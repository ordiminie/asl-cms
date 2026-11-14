/** Chemins du back-office des questions des membres (s23). */
export const MEMBER_QUESTIONS_PATH = '/bureau/questions'
export const MEMBER_QUESTION_CATEGORIES_PATH = `${MEMBER_QUESTIONS_PATH}/sujets`

export const memberQuestionPathOf = (id: string) =>
  `${MEMBER_QUESTIONS_PATH}/${id}`

/**
 * Motifs de route (arborescence de fichiers) a revalider apres une ecriture
 * des sujets : le segment du back-office — file, detail et sujets, en
 * `layout` — et le formulaire du membre, qui propose les sujets actifs.
 */
export const MEMBER_QUESTIONS_ROUTE_PATTERN =
  '/[locale]/(bureau)/bureau/questions'
export const MEMBER_QUESTION_FORM_ROUTE_PATTERN =
  '/[locale]/(app)/dashboard/question'

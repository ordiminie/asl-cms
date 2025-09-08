import {NextRequest, NextResponse} from 'next/server'

import {withAuth, withUserAuth} from '@/lib/api-auth'
import {
  createProjectService,
  getProjectsWithPaginationService,
} from '@/services/facades/project-service-facade'
import {RoleConst} from '@/services/types/domain/auth-types'
import {CreateProject} from '@/services/types/domain/project-types'
import {createProjectServiceSchema} from '@/services/validation/project-validation'

// GET - Récupérer les projets avec pagination
export const GET = withAuth(async (request: NextRequest, authUser) => {
  try {
    const {searchParams} = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || undefined
    const organizationId = searchParams.get('organizationId') || undefined

    const offset = (page - 1) * limit

    const result = await getProjectsWithPaginationService(
      {limit, offset},
      {
        ...(search && {name: search}),
        ...(organizationId && {organizationId}),
        ...(!organizationId && {createdBy: authUser.id}),
      }
    )

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('Erreur GET /api/projects:', error)
    return NextResponse.json(
      {error: 'Erreur lors de la récupération des projets'},
      {status: 500}
    )
  }
}, RoleConst.USER)

// POST - Créer un nouveau projet
export const POST = withUserAuth(async (request: NextRequest, authUser) => {
  try {
    const body = await request.json()

    // Validation des données
    const validation = createProjectServiceSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Données invalides',
          details: validation.error.issues,
        },
        {status: 400}
      )
    }

    const projectData: CreateProject = {
      ...validation.data,
      createdBy: authUser.id, // Ajouter l'utilisateur connecté
    }

    const newProject = await createProjectService(projectData)

    return NextResponse.json(
      {
        success: true,
        message: 'Projet créé avec succès',
        data: newProject,
      },
      {status: 201}
    )
  } catch (error) {
    console.error('Erreur POST /api/projects:', error)
    return NextResponse.json(
      {error: 'Erreur lors de la création du projet'},
      {status: 500}
    )
  }
})

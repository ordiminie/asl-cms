import {NextRequest, NextResponse} from 'next/server'

import {withAuthToken} from '@/lib/api-auth'
import {getProjectsWithPaginationService} from '@/services/facades/project-service-facade'

// GET - Test d'authentification par token Bearer
export const GET = withAuthToken(async (request: NextRequest, authUser) => {
  try {
    const {searchParams} = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const offset = (page - 1) * limit

    const result = await getProjectsWithPaginationService(
      {limit, offset},
      {
        createdBy: authUser.id, // Filtrer par utilisateur connecté
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Authentification par token réussie',
      user: {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
      },
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('Erreur GET /api/projects/token-test:', error)
    return NextResponse.json(
      {error: 'Erreur lors de la récupération des projets'},
      {status: 500}
    )
  }
})

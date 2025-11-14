/* eslint-disable no-restricted-properties */
import dotenv from 'dotenv'
//import path from 'path'

async function initDotEnv(
  environment: string = process.env.NODE_ENV || 'development'
) {
  // const environment = process.env.NEXT_PUBLIC_NODE_ENV || 'development'
  console.log('initDotEnv environment', environment)
  let envFilePath

  // Utilisation d'un switch-case pour choisir le bon fichier .env
  switch (environment) {
    case 'production': {
      envFilePath = '.env.production'
      break
    }
    case 'test': {
      envFilePath = '.env.test'
      break
    }
    case 'development': {
      envFilePath = '.env.development'
      break
    }

    default: {
      envFilePath = '.env'
      break
    }
  }

  // Chargement du fichier .env correspondant
  const result = dotenv.config({path: envFilePath})

  // Gestion des erreurs
  if (result.error) {
    console.warn(
      `Erreur lors du chargement du fichier ${envFilePath}:`,
      result.error
    )
  } else {
    console.log(`Environnement chargé à partir de ${envFilePath}`)
  }
}

export function getEnvFromArg() {
  const envOption = process.argv[3]
  const env = envOption?.split('=')[1]
  console.log('getEnvFromArg env', env)
  return env
}

export default initDotEnv

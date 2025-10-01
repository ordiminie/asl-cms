#!/usr/bin/env tsx

import {execSync} from 'child_process'
import * as path from 'path'

interface HookInput {
  tool_input?: {
    file_path?: string
    [key: string]: unknown
  }
  tool_name?: string
  [key: string]: unknown
}

// Extensions de fichiers qui nécessitent du linting/formatting
const CODE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.css',
  '.scss',
]

function log(message: string, emoji = '🔧') {
  console.log(`${emoji} [Hook] ${message}`)
}

function isCodeFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return CODE_EXTENSIONS.includes(ext)
}

async function runCommand(
  command: string
): Promise<{success: boolean; output: string}> {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout: 30000, // 30 secondes max
    })
    return {success: true, output: output.toString()}
  } catch (error: unknown) {
    return {
      success: false,
      output: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function main() {
  try {
    // Lecture des données du hook via stdin
    let inputData: string = ''

    if (process.stdin.isTTY) {
      log('No stdin data available', '⚠️')
      return
    }

    // Lecture asynchrone du stdin
    for await (const chunk of process.stdin) {
      inputData += chunk
    }

    if (!inputData.trim()) {
      log('No input data received', '⚠️')
      return
    }

    const hookInput: HookInput = JSON.parse(inputData)
    const filePath = hookInput.tool_input?.file_path
    const toolName = hookInput.tool_name

    if (!filePath) {
      log('No file path found in hook input', '⚠️')
      return
    }

    log(`File modified: ${path.basename(filePath)} (${toolName})`)

    // Vérifier si c'est un fichier de code
    if (!isCodeFile(filePath)) {
      log(`Skipping non-code file: ${path.extname(filePath)}`, '⏭️')
      return
    }

    log('Running auto-fix commands...', '🚀')

    // Exécuter lint:fix
    log('Running lint:fix...', '🔍')
    const lintResult = await runCommand('pnpm lint:fix')

    if (lintResult.success) {
      log('Lint fixes applied successfully', '✅')
    } else {
      log(`Lint warning: ${lintResult.output}`, '⚠️')
    }

    // Exécuter format:fix
    log('Running format:fix...', '🎨')
    const formatResult = await runCommand('pnpm format:fix')

    if (formatResult.success) {
      log('Format fixes applied successfully', '✅')
    } else {
      log(`Format warning: ${formatResult.output}`, '⚠️')
    }

    // Vérification TypeScript optionnelle pour les fichiers .ts/.tsx
    if (['.ts', '.tsx'].includes(path.extname(filePath))) {
      log('Running TypeScript check...', '📝')
      const typeResult = await runCommand('pnpm typecheck')

      if (typeResult.success) {
        log('TypeScript check passed', '✅')
      } else {
        log('TypeScript issues detected (check output above)', '⚠️')
      }
    }

    log('Auto-fix completed successfully', '🎉')
  } catch (error) {
    log(`Hook error: ${error}`, '❌')
    // Ne pas faire échouer le processus principal
    process.exit(0)
  }
}

main().catch((error) => {
  log(`Unexpected error: ${error}`, '💥')
  process.exit(0)
})

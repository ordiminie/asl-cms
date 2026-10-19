import {execFileSync} from 'node:child_process'
import {readdirSync, readFileSync, statSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

const OPS_DIR = import.meta.dirname
const read = (relative: string) =>
  readFileSync(path.join(OPS_DIR, relative), 'utf8')

/** Directives actives : sans les commentaires, une par ligne. */
const directives = (content: string) =>
  content
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)

const sizeInMegabytes = (value: string) => {
  const match = /^(\d+)([kmg]?)$/i.exec(value)
  if (!match) {
    throw new Error(`Taille illisible : ${value}`)
  }
  const factor = {'': 1 / (1024 * 1024), k: 1 / 1024, m: 1, g: 1024}[
    match[2].toLowerCase() as '' | 'k' | 'm' | 'g'
  ]
  return Number(match[1]) * factor
}

describe('ops/nginx/asl-cms-site.conf.template — le proxy devant l’application', () => {
  const template = read('nginx/asl-cms-site.conf.template')
  const lines = directives(template)

  it('n’ajoute jamais l’adresse du client à un X-Forwarded-For reçu', () => {
    expect(template).not.toContain('$proxy_add_x_forwarded_for')
  })

  it.each([
    ['Host', '$host'],
    ['X-Forwarded-Host', '$host'],
    ['X-Forwarded-Proto', '$scheme'],
    ['X-Forwarded-For', '$remote_addr'],
  ])('écrase l’en-tête %s par %s', (header, value) => {
    expect(lines).toContain(`proxy_set_header ${header} ${value};`)
  })

  it('accepte des corps d’au moins 16 Mo (enveloppe applicative, ADR 026)', () => {
    const directive =
      lines.find((line) => line.startsWith('client_max_body_size ')) ?? ''
    expect(directive).not.toBe('')
    const value = directive
      .replace('client_max_body_size ', '')
      .replace(';', '')
    expect(sizeInMegabytes(value)).toBeGreaterThanOrEqual(16)
  })

  it('ne met pas les réponses en tampon (streaming)', () => {
    expect(lines).toContain('proxy_buffering off;')
  })

  it('transmet à l’application sur la boucle locale seulement', () => {
    expect(lines).toContain('proxy_pass http://127.0.0.1:3100;')
  })

  it('redirige HTTP vers HTTPS en 301, sauf le défi ACME', () => {
    expect(lines).toContain('location /.well-known/acme-challenge/ {')
    expect(lines).toContain('return 301 https://$host$request_uri;')
  })

  it('sert HTTPS avec le certificat de son propre domaine', () => {
    expect(lines).toContain(
      'ssl_certificate /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;'
    )
    expect(lines).toContain(
      'ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;'
    )
  })
})

describe('ops/add-domain.sh — ajout d’un domaine', () => {
  const script = read('add-domain.sh')

  it('obtient un certificat par domaine, par le webroot, avec rechargement de nginx au renouvellement', () => {
    expect(script).toMatch(
      /certbot certonly[\s\\]+--webroot[\s\S]*--cert-name "\$domain"[\s\S]*--deploy-hook "systemctl reload nginx"/
    )
  })

  it('vérifie la configuration avant chaque rechargement', () => {
    const reloads = script.match(/systemctl reload nginx\n/g) ?? []
    const checks = script.match(/nginx -t/g) ?? []
    expect(reloads.length).toBeGreaterThan(0)
    expect(checks.length).toBeGreaterThanOrEqual(reloads.length)
  })

  it('relancé sur un domaine déjà certifié, ne repasse pas par le bloc HTTP seul', () => {
    expect(script).toMatch(
      /if \[\[ ! -f "\/etc\/letsencrypt\/live\/\$domain\/fullchain\.pem" \]\]; then\n(?:(?!\nfi\n)[\s\S])*BEGIN HTTPS(?:(?!\nfi\n)[\s\S])*\nfi\n/
    )
  })

  it('n’écrit que le fichier de son domaine', () => {
    expect(script).toContain(
      'site_file="/etc/nginx/sites-available/asl-cms-$domain.conf"'
    )
    expect(script).not.toMatch(/sites-(available|enabled)\/default/)
  })
})

describe('ops/deploy.sh — déploiement', () => {
  const script = read('deploy.sh')

  it('quitte le répertoire de l’administrateur avant toute commande sous asl-cms', () => {
    const cdAt = script.indexOf('cd "$APP_ROOT"\n')
    const firstAsApp = script.indexOf('as_app git')
    expect(cdAt).toBeGreaterThan(-1)
    expect(cdAt).toBeLessThan(firstAsApp)
  })

  it('lie le cache de Next de la version vers shared/next-cache/<version>, créé sous asl-cms, avant l’orchestrateur', () => {
    expect(script).toContain('cache_dir="$APP_ROOT/shared/next-cache/$short"')
    const mkdirAt = script.indexOf(
      'as_app mkdir -p "$cache_dir" "$release/.next"'
    )
    const linkAt = script.indexOf(
      'as_app ln -s "$cache_dir" "$release/.next/cache"'
    )
    const orchestratorAt = script.indexOf('ops:deploy-release')
    expect(mkdirAt).toBeGreaterThan(-1)
    expect(linkAt).toBeGreaterThan(mkdirAt)
    expect(orchestratorAt).toBeGreaterThan(linkAt)
  })

  it('reconstruire une version repart d’un cache vide', () => {
    expect(script).toContain('rm -rf "$release" "$cache_dir"')
  })

  it('refuse de reconstruire la version désignée par previous (cible du retour arrière)', () => {
    const previousAt = script.indexOf(
      'previous="$(readlink "$APP_ROOT/previous" || true)"'
    )
    const refusalAt = script.search(
      /if \[\[ "\$previous" == "\$release" \]\]; then\n[^\n]*\n(?:[^\n]*\n)*?\s*exit 1\n/
    )
    const rebuildAt = script.indexOf('rm -rf "$release"')
    expect(previousAt).toBeGreaterThan(-1)
    expect(refusalAt).toBeGreaterThan(previousAt)
    expect(rebuildAt).toBeGreaterThan(refusalAt)
  })
})

describe('ops/rollback.sh — retour arrière', () => {
  const script = read('rollback.sh')

  it('sans argument, revient à la version servie avant celle en service (lien previous)', () => {
    expect(script).toContain('readlink "$APP_ROOT/previous"')
    expect(script).not.toMatch(/ls -1d?t/)
  })

  it('sans argument et sans lien previous, refuse avant toute bascule', () => {
    expect(script).toMatch(
      /target="\$\(readlink "\$APP_ROOT\/previous" \|\| true\)"\n\s*if \[\[ -z "\$target" \]\]; then\n(?:(?!\n\s*fi\n)[\s\S])*\n\s*exit 1\n\s*fi\n/
    )
    const refusalAt = script.indexOf('if [[ -z "$target" ]]; then')
    const switchAt = script.indexOf('ln -sfn "$target"')
    expect(refusalAt).toBeGreaterThan(-1)
    expect(switchAt).toBeGreaterThan(refusalAt)
  })

  it('n’accepte qu’une version entièrement construite (.next/BUILD_ID), jamais un build interrompu', () => {
    expect(script).toContain('if [[ ! -f "$target/.next/BUILD_ID" ]]; then')
    expect(script).not.toContain('[[ ! -d "$target/.next" ]]')
    const checkAt = script.indexOf('"$target/.next/BUILD_ID"')
    const switchAt = script.indexOf('ln -sfn "$target"')
    expect(switchAt).toBeGreaterThan(checkAt)
  })

  it('après la bascule, retient la version quittée comme précédente', () => {
    const switchAt = script.indexOf('mv -T "$APP_ROOT/current.next"')
    const recordAt = script.indexOf('mv -T "$APP_ROOT/previous.next"')
    expect(switchAt).toBeGreaterThan(-1)
    expect(recordAt).toBeGreaterThan(switchAt)
  })

  it('vérifie en HTTP local que la version restaurée répond, après le redémarrage', () => {
    const restartAt = script.indexOf('systemctl restart "$SERVICE"')
    const verifyAt = script.search(/curl [^\n]*"\$LOCAL_URL"/)
    expect(script).toContain('LOCAL_URL=http://127.0.0.1:3100/')
    expect(restartAt).toBeGreaterThan(-1)
    expect(verifyAt).toBeGreaterThan(restartAt)
  })
})

describe('ops/systemd — le service et la purge quotidienne', () => {
  const service = directives(read('systemd/asl-cms.service'))
  const purgeService = directives(read('systemd/asl-cms-purge.service'))
  const purgeTimer = directives(read('systemd/asl-cms-purge.timer'))

  it('tourne sous l’utilisateur dédié, en production', () => {
    expect(service).toContain('User=asl-cms')
    expect(service).toContain('Environment=NODE_ENV=production')
  })

  it('écoute sur 127.0.0.1:3100, jamais sur toutes les interfaces', () => {
    const execStart = service.find((line) => line.startsWith('ExecStart='))
    expect(execStart).toMatch(/next start -H 127\.0\.0\.1 -p 3100$/)
    expect(service.join('\n')).not.toContain('0.0.0.0')
  })

  it('redémarre en cas d’échec, durci, n’écrit que dans shared/ (le cache de Next y est lié)', () => {
    expect(service).toContain('Restart=on-failure')
    expect(service).toContain('ProtectSystem=strict')
    expect(
      service.filter((line) => line.startsWith('ReadWritePaths='))
    ).toEqual(['ReadWritePaths=/srv/asl-cms/shared'])
    expect(service).toContain('NoNewPrivileges=true')
  })

  it('ne peut jamais écrire dans le code des versions ni leurs node_modules', () => {
    const writable = [...service, ...purgeService]
      .filter((line) => line.startsWith('ReadWritePaths='))
      .join(' ')
    expect(writable).not.toContain('releases')
    expect(writable).not.toContain('current')
  })

  it('la purge n’écrit que dans shared/', () => {
    expect(purgeService).toContain('ProtectSystem=strict')
    expect(
      purgeService.filter((line) => line.startsWith('ReadWritePaths='))
    ).toEqual(['ReadWritePaths=/srv/asl-cms/shared'])
  })

  it('la purge lance le script de s08b sous le même utilisateur', () => {
    expect(purgeService).toContain('User=asl-cms')
    expect(purgeService).toContain('Environment=NODE_ENV=production')
    expect(
      purgeService.find((line) => line.startsWith('ExecStart='))
    ).toContain('src/db/scripts/purge-rate-limit-fingerprints.ts')
  })

  it('la minuterie est quotidienne et rattrape un passage manqué', () => {
    expect(purgeTimer).toContain('OnCalendar=daily')
    expect(purgeTimer).toContain('Persistent=true')
    expect(purgeTimer).toContain('Unit=asl-cms-purge.service')
  })
})

describe('ops/ — aucun domaine écrit en dur', () => {
  const DOMAIN_PATTERN =
    /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:fr|com|org|net|eu|io|dev|app|info|test|re|be|ch)\b/i

  const filesOf = (directory: string): string[] =>
    readdirSync(directory).flatMap((entry) => {
      const full = path.join(directory, entry)
      return statSync(full).isDirectory() ? filesOf(full) : [full]
    })

  const files = filesOf(OPS_DIR).filter((file) => !file.endsWith('.test.ts'))

  it('parcourt bien les fichiers d’exploitation', () => {
    expect(files.length).toBeGreaterThanOrEqual(7)
  })

  it.each(files.map((file) => [path.relative(OPS_DIR, file), file]))(
    '%s ne contient aucun nom de domaine',
    (_name, file) => {
      expect(readFileSync(file, 'utf8')).not.toMatch(DOMAIN_PATTERN)
    }
  )
})

/**
 * Le mode des scripts se lit dans l’index git : hors d’un dépôt (copie par
 * `git archive`, par exemple), ces tests sont ignorés plutôt qu’en échec.
 */
const insideGitWorkTree = () => {
  try {
    return (
      execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: OPS_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() === 'true'
    )
  } catch {
    return false
  }
}

describe('ops/*.sh — scripts exécutables tels que documentés', () => {
  const SCRIPTS = ['ops/add-domain.sh', 'ops/deploy.sh', 'ops/rollback.sh']

  /** Mode enregistré dans l’index git : c’est lui qui part sur le serveur. */
  const gitModes = () =>
    Object.fromEntries(
      execFileSync('git', ['ls-files', '--stage', '--', ...SCRIPTS], {
        cwd: path.join(OPS_DIR, '..'),
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .map((line) => {
          const [mode, , , file] = line.split(/\s+/)
          return [file, mode]
        })
    )

  it.skipIf(!insideGitWorkTree()).each(SCRIPTS)(
    '%s est versionné en 100755',
    (script) => {
      expect(gitModes()[script]).toBe('100755')
    }
  )
})

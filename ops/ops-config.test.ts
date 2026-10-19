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

  it('n’écrit que le fichier de son domaine', () => {
    expect(script).toContain(
      'site_file="/etc/nginx/sites-available/asl-cms-$domain.conf"'
    )
    expect(script).not.toMatch(/sites-(available|enabled)\/default/)
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

  it('redémarre en cas d’échec, durci, n’écrit que dans shared/', () => {
    expect(service).toContain('Restart=on-failure')
    expect(service).toContain('ProtectSystem=strict')
    expect(service).toContain('ReadWritePaths=/srv/asl-cms/shared')
    expect(service).toContain('NoNewPrivileges=true')
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

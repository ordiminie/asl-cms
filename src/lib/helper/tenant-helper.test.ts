import {describe, expect, it} from 'vitest'

import {isModuleEnabled, normalizeTenantHost} from './tenant-helper'

describe('normalizeTenantHost', () => {
  it('rend le domaine tel quel quand il est deja normalise', () => {
    expect(normalizeTenantHost('asl-lafourche.fr')).toBe('asl-lafourche.fr')
  })

  it('retire le port, que le Host porte toujours en developpement', () => {
    expect(normalizeTenantHost('localhost:3000')).toBe('localhost')
  })

  it('abaisse la casse : un Host est insensible a la casse, une colonne non', () => {
    expect(normalizeTenantHost('ASL-LaFourche.FR')).toBe('asl-lafourche.fr')
  })

  it('retire le point final, forme absolue valide du DNS', () => {
    expect(normalizeTenantHost('asl-lafourche.fr.')).toBe('asl-lafourche.fr')
  })

  it('ne rend rien pour un Host absent ou vide', () => {
    expect(normalizeTenantHost(null)).toBeUndefined()
    expect(normalizeTenantHost(undefined)).toBeUndefined()
    expect(normalizeTenantHost('   ')).toBeUndefined()
  })

  it('ne rend rien pour un Host qui ne porte que le port', () => {
    expect(normalizeTenantHost(':3000')).toBeUndefined()
  })

  it('garde les crochets hors du domaine pour une adresse IPv6', () => {
    expect(normalizeTenantHost('[::1]:3000')).toBe('[::1]')
  })
})

describe('isModuleEnabled', () => {
  it('reconnait un module active', () => {
    expect(isModuleEnabled(['vote', 'voirie'], 'voirie')).toBe(true)
  })

  it('refuse un module que l association n a pas active', () => {
    expect(isModuleEnabled(['vote'], 'voirie')).toBe(false)
  })

  it('refuse tout module quand aucun n est active', () => {
    expect(isModuleEnabled([], 'vote')).toBe(false)
  })

  it('traite une cle inconnue comme inactive, jamais comme active', () => {
    // ADR 010 : une cle inconnue est inactive. C'est ce qui rend le critere 4
    // vrai pour un module fictif comme pour un module reel desactive.
    expect(isModuleEnabled(['vote'], 'module-fictif')).toBe(false)
  })

  it('ne se laisse pas prendre a une cle inconnue presente dans la liste', () => {
    // Une valeur hors enumere ne peut pas etre persistee ; si elle l'etait par
    // une ecriture directe en base, elle resterait inactive.
    expect(isModuleEnabled(['vote', 'module-fictif'], 'module-fictif')).toBe(
      false
    )
  })
})

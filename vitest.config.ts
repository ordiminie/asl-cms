import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import path from 'path'
import {defineConfig} from 'vitest/config'
dotenv.config({path: path.resolve(import.meta.dirname, '.env.test')})

// Configuration avec projects pour différents environnements
export default defineConfig({
  plugins: [react()],
  resolve: {tsconfigPaths: true},
  test: {
    projects: [
      // Projet pour les tests client (jsdom)
      {
        plugins: [react()],
        resolve: {tsconfigPaths: true},
        test: {
          name: 'client',
          environment: 'jsdom',
          setupFiles: ['./src/__tests__/setup-test.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [
            'src/services/**/*.test.{ts,tsx}',
            'src/**/*.real-i18n.test.{ts,tsx}',
          ],
          globals: true,
          server: {
            deps: {
              // https://github.com/vercel/next.js/issues/77200
              inline: ['next-intl'],
            },
          },
        },
      },
      // Projet pour les servers (node)
      {
        plugins: [react()],
        resolve: {tsconfigPaths: true},
        test: {
          name: 'server',
          environment: 'node',
          setupFiles: ['./src/services/__tests__/setup-mocks.ts'],
          include: ['src/services/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.real-i18n.test.{ts,tsx}'],
          globals: true,
        },
      },
      /*
       * Projet pour la vraie chaine de traduction serveur : l'entree
       * react-server de next-intl (celle que Next sert aux Server Actions et
       * aux composants serveur) branchee sur le vrai `src/i18n/request.ts`.
       * Aucun double de `getTranslations` : ce que ces tests voient est ce que
       * voit la production. Le setup simule une Server Action depuis un
       * navigateur neuf (root-params indisponible, aucun cookie).
       */
      {
        plugins: [react()],
        resolve: {
          tsconfigPaths: true,
          alias: {
            'next-intl/server': path.resolve(
              import.meta.dirname,
              'node_modules/next-intl/dist/esm/development/server.react-server.js'
            ),
            'next-intl/config': path.resolve(
              import.meta.dirname,
              'src/i18n/request.ts'
            ),
          },
        },
        test: {
          name: 'i18n',
          environment: 'node',
          setupFiles: ['./src/__tests__/setup-real-i18n.ts'],
          include: ['src/**/*.real-i18n.test.{ts,tsx}'],
          globals: true,
          server: {deps: {inline: ['next-intl']}},
        },
      },
    ],
  },
})

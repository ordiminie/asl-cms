#!/usr/bin/env node
/* eslint-disable no-restricted-properties */

import pg from 'pg'

import initDotEnv from './env'

initDotEnv()

// Stripe Price IDs constants
const STRIPE_PRICE_IDS = {
  PRO_MONTHLY: 'price_1Rfz5wCkPpvUnhXxvh6yJOOM',
  PRO_YEARLY: 'price_1Rfz6ZCkPpvUnhXxc6ky9bl2',
  ENTREPRISE_MONTHLY: 'price_1RedsMCkPpvUnhXxu3Z0g2mE',
  ENTREPRISE_YEARLY: 'price_1RedsnCkPpvUnhXx6PfNSaHW',
  LIFETIME: 'price_1QoOzLCkPpvUnhXxTNRAOlEe',
} as const

const seed = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Do not use in production')
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined')
  }
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  })

  console.log('⏳ Checking connexion ...')
  console.log(`🗄️  URL : ${process.env.DATABASE_URL}`)

  await client.connect()

  const start = Date.now()

  // 0. Insérer les plans de subscription
  await client.query(`
    INSERT INTO "subscription_plan" (
      "code",
      "price_id", 
      "annual_discount_price_id",
      "plan_name",
      "description",
      "limits",
      "free_trial",
      "features",
      "price",
      "yearly_price",
      "currency",
      "is_recurring",
      "status",
      "display_order",
      "created_at",
      "updated_at"
    )
    VALUES
      -- Plan FREE
      (
        'free',
        'free',
        NULL,
        'Free',
        'Idéal pour débuter',
        '{"projects": 1, "storage": 1, "organizationMembers": 2}',
        NULL,
        '["1 utilisateur", "1 projet", "1 GB stockage", "Support communautaire"]',
        0,
        0,
        'EUR',
        true,
        'active',
        1,
        NOW(),
        NOW()
      ),
      -- Plan PRO
      (
        'pro',
        '${STRIPE_PRICE_IDS.PRO_MONTHLY}',
        '${STRIPE_PRICE_IDS.PRO_YEARLY}',
        'Pro',
        'Parfait pour les équipes en croissance',
        '{"projects": 2, "storage": 10, "organizationMembers": 3}',
        NULL,
        '["Jusqu''à 5 utilisateurs", "2 projets", "10 GB stockage", "Support prioritaire", "Intégrations avancées"]',
        29,
        249,
        'EUR',
        true,
        'active',
        2,
        NOW(),
        NOW()
      ),
      -- Plan ENTREPRISE
      (
        'enterprise',
        '${STRIPE_PRICE_IDS.ENTREPRISE_MONTHLY}',
        '${STRIPE_PRICE_IDS.ENTREPRISE_YEARLY}',
        'Enterprise',
        'Pour les grandes organisations',
        '{"projects": 3, "storage": 50, "organizationMembers": 5}',
        NULL,
        '["Utilisateurs illimités", "3 projets", "50 GB stockage", "Support 24/7", "SSO & sécurité avancée"]',
        99,
        990,
        'EUR',
        true,
        'active',
        3,
        NOW(),
        NOW()
      ),
      -- Plan LIFETIME
      (
        'lifetime',
        '${STRIPE_PRICE_IDS.LIFETIME}',
        NULL,
        'Lifetime',
        'Pour les longues durées',
        '{"projects": 20, "storage": 50}',
        '{"days": 14}',
        '["Introduction Course / Components", "PRO: Complete Email Integration Guide", "PRO: All Features Access", "PRO: Code Review Sessions", "PRO: 100% Money Back Guarantee", "20 projets", "50 GB stockage"]',
        70,
        NULL,
        'EUR',
        false,
        'active',
        4,
        NOW(),
        NOW()
      )
    ON CONFLICT (code) DO NOTHING;
  `)

  // 1. Insérer les utilisateurs avec leurs rôles directement
  await client.query(`
    INSERT INTO "user" (email, name, email_verified, image, visibility, role)
    VALUES
      -- Rôles globaux purs (sans organisations)
      ('superadmin@gmail.com', 'Frank', true, 'https://randomuser.me/api/portraits/med/men/9.jpg', 'public', 'super_admin'),
      ('admin@gmail.com', 'Admin', true, 'https://randomuser.me/api/portraits/med/men/4.jpg', 'public', 'admin'),
      ('moderator@gmail.com', 'David', true, 'https://randomuser.me/api/portraits/med/men/7.jpg', 'public', 'moderator'),
      ('redactor@gmail.com', 'Grace', true, 'https://randomuser.me/api/portraits/med/women/11.jpg', 'public', 'redactor'),
      ('public@gmail.com', 'Charlie', true, 'https://randomuser.me/api/portraits/med/men/5.jpg', 'public', 'public'),
      
      -- Utilisateur multi-organisations (cas complexe)
      ('user@gmail.com', 'Bob', true, 'https://randomuser.me/api/portraits/med/men/3.jpg', 'public', 'user'),
      
      -- Utilisateurs spécialisés par rôle organisationnel
      ('user-owner@gmail.com', 'Julien', true, 'https://randomuser.me/api/portraits/med/men/6.jpg', 'public', 'user'),
      ('user-admin@gmail.com', 'Sophie', true, 'https://randomuser.me/api/portraits/med/women/12.jpg', 'public', 'user'),
      ('user-member@gmail.com', 'Lucas', true, 'https://randomuser.me/api/portraits/med/men/13.jpg', 'public', 'user'),
      
      -- Cas de chevauchement intéressants
      ('admin-owner@gmail.com', 'Emma', true, 'https://randomuser.me/api/portraits/med/women/14.jpg', 'public', 'admin'),
      ('moderator-member@gmail.com', 'Julie', true, 'https://randomuser.me/api/portraits/med/women/10.jpg', 'public', 'moderator'),
      
      -- Utilisateur isolé (sans organisations)
      ('user-isolated@gmail.com', 'Thomas', true, 'https://randomuser.me/api/portraits/med/men/15.jpg', 'public', 'user')
    ON CONFLICT (email) DO NOTHING;
  `)

  // 2. Insérer les comptes avec mots de passe
  await client.query(`
    INSERT INTO "account" (
      "account_id",
      "provider_id",
      "user_id",
      "password",
      "created_at",
      "updated_at"
    )
    SELECT 
      uuid_generate_v4() as "account_id",
      'credential' as "provider_id",
      u.id as "user_id",
      '48ea88853800794bc5312d8ad65fe149:d8503b790be4373e803d663b895438fa1e8f0b809a1b86a2b3fb6290f7f2310c4acb82dfe3737d2a3dd318a786653af3438022f24286ee0e9e8b2dda9b91f8f9' as "password",
      NOW() as "created_at",
      NOW() as "updated_at"
    FROM "user" u
    WHERE u.email IN (
      'superadmin@gmail.com',
      'admin@gmail.com',
      'moderator@gmail.com',
      'redactor@gmail.com',
      'public@gmail.com',
      'user@gmail.com',
      'user-owner@gmail.com',
      'user-admin@gmail.com',
      'user-member@gmail.com',
      'admin-owner@gmail.com',
      'moderator-member@gmail.com',
      'user-isolated@gmail.com'
    )
    ON CONFLICT ("account_id", "provider_id") DO NOTHING;
  `)

  // 2.5 Insérer les paramètres utilisateur pour les 4 premiers utilisateurs
  await client.query(`
    INSERT INTO "user_settings" (
      "user_id",
      "theme",
      "language",
      "timezone",
      "two_factor_type",
      "enable_email_notifications",
      "enable_push_notifications",
      "notification_channel",
      "email_digest",
      "marketing_emails",
      "created_at",
      "updated_at"
    )
    SELECT 
      u.id as "user_id",
      CASE 
        WHEN u.email = 'superadmin@gmail.com' THEN 'system'
        ELSE 'dark'
      END::theme_type as "theme",
      CASE 
        WHEN u.email = 'superadmin@gmail.com' THEN 'en'
        ELSE 'fr'
      END::language_type as "language",
      'Europe/Paris' as "timezone",
      CASE 
        WHEN u.email = 'superadmin@gmail.com' THEN 'totp'
        ELSE 'otp'
      END::two_factor_type as "two_factor_type",
      true as "enable_email_notifications",
      true as "enable_push_notifications",
      CASE 
        WHEN u.email = 'superadmin@gmail.com' THEN 'both'
        ELSE 'push'
      END::notification_channel as "notification_channel",
      true as "email_digest",
      CASE 
        WHEN u.email = 'superadmin@gmail.com' THEN true
        ELSE false
      END as "marketing_emails",
      NOW() as "created_at",
      NOW() as "updated_at"
    FROM "user" u
    WHERE u.email IN (
      'superadmin@gmail.com',
      'admin@gmail.com'
    )
    ON CONFLICT (user_id) DO NOTHING;
  `)

  // 3. Insérer les organisations
  await client.query(`
    INSERT INTO "organization" (name, slug, description, logo, created_at, updated_at)
    VALUES
      ('TechCorp Solutions', 'techcorp-solutions', 'Une entreprise de développement logiciel innovante', 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400', NOW(), NOW()),
      ('Marketing Pro', 'marketing-pro', 'Agence de marketing digital et communication', 'https://images.unsplash.com/photo-1553484771-371a605b060b?w=400', NOW(), NOW()),
      ('Acme Corp.', 'acme-corp', 'Startup innovante en technologie', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400', NOW(), NOW()),
      ('Evil Corp.', 'evil-corp', 'Entreprise de cybersécurité', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400', NOW(), NOW())
    ON CONFLICT (slug) DO NOTHING;
  `)

  // 4. Assigner les utilisateurs aux organisations avec des rôles
  await client.query(`
    INSERT INTO "member" (organization_id, user_id, role, created_at)
    SELECT 
      o.id as "organization_id",
      u.id as "user_id",
      CASE 
        -- admin@gmail.com dans 3 organisations avec rôles différents
        WHEN u.email = 'admin@gmail.com' AND o.slug = 'techcorp-solutions' THEN 'member'
        WHEN u.email = 'admin@gmail.com' AND o.slug = 'marketing-pro' THEN 'admin'
        WHEN u.email = 'admin@gmail.com' AND o.slug = 'acme-corp' THEN 'owner'
        
        -- user@gmail.com : Cas multi-organisations complexe
        -- MEMBER dans TechCorp, ADMIN dans Acme Corp, OWNER dans Evil Corp
        WHEN u.email = 'user@gmail.com' AND o.slug = 'techcorp-solutions' THEN 'member'
        WHEN u.email = 'user@gmail.com' AND o.slug = 'acme-corp' THEN 'admin'
        WHEN u.email = 'user@gmail.com' AND o.slug = 'evil-corp' THEN 'owner'
        
        -- Utilisateurs spécialisés par rôle organisationnel
        WHEN u.email = 'user-owner@gmail.com' AND o.slug = 'techcorp-solutions' THEN 'owner'
        WHEN u.email = 'user-admin@gmail.com' AND o.slug = 'marketing-pro' THEN 'admin'
        WHEN u.email = 'user-member@gmail.com' AND o.slug = 'acme-corp' THEN 'member'
        
        -- Cas de chevauchement (rôle global élevé + rôle org)
        WHEN u.email = 'admin-owner@gmail.com' AND o.slug = 'marketing-pro' THEN 'owner'
        WHEN u.email = 'moderator-member@gmail.com' AND o.slug = 'techcorp-solutions' THEN 'member'
        
        ELSE 'member'
      END::organization_role,
      NOW()
    FROM "user" u, "organization" o
    WHERE 
      -- admin@gmail.com dans 3 organisations
      (u.email = 'admin@gmail.com' AND o.slug = 'techcorp-solutions') OR
      (u.email = 'admin@gmail.com' AND o.slug = 'marketing-pro') OR
      (u.email = 'admin@gmail.com' AND o.slug = 'acme-corp') OR
      
      -- user@gmail.com dans 3 organisations avec rôles différents
      (u.email = 'user@gmail.com' AND o.slug = 'techcorp-solutions') OR
      (u.email = 'user@gmail.com' AND o.slug = 'acme-corp') OR
      (u.email = 'user@gmail.com' AND o.slug = 'evil-corp') OR
      
      -- Utilisateurs spécialisés (1 org chacun)
      (u.email = 'user-owner@gmail.com' AND o.slug = 'techcorp-solutions') OR
      (u.email = 'user-admin@gmail.com' AND o.slug = 'marketing-pro') OR
      (u.email = 'user-member@gmail.com' AND o.slug = 'acme-corp') OR
      
      -- Cas de chevauchement
      (u.email = 'admin-owner@gmail.com' AND o.slug = 'marketing-pro') OR
      (u.email = 'moderator-member@gmail.com' AND o.slug = 'techcorp-solutions')
      
      -- Note: user-isolated@gmail.com n'est dans aucune organisation (test isolation)
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  `)

  // 5. Insérer des projets pour tester les permissions
  await client.query(`
    INSERT INTO "project" (name, description, "organization_id", "created_by")
    SELECT 
      project_data.name,
      project_data.description,
      o.id as "organization_id",
      u.id as "created_by"
    FROM (
      VALUES 
        -- 1 projet pour TechCorp Solutions
        ('Plateforme E-commerce', 'Développement d''une plateforme de vente en ligne moderne avec Next.js', 'techcorp-solutions', 'user-owner@gmail.com'),
        
        -- 2 projets pour Marketing Pro
        ('Campagne Digitale 2024', 'Stratégie marketing complète pour les réseaux sociaux', 'marketing-pro', 'user-admin@gmail.com'),
        ('Site Web Corporate', 'Refonte complète du site vitrine de l''entreprise', 'marketing-pro', 'admin-owner@gmail.com'),
        
        -- 0 projet pour Acme Corp (comme demandé - vide)
        
        -- 1 projet pour Evil Corp
        ('Audit Sécurité', 'Audit complet de la sécurité informatique', 'evil-corp', 'user@gmail.com')
    ) AS project_data(name, description, org_slug, creator_email)
    JOIN "organization" o ON o.slug = project_data.org_slug
    JOIN "user" u ON u.email = project_data.creator_email
    ON CONFLICT DO NOTHING;
  `)

  // 6. Insérer des tâches pour tester différents états de projets
  await client.query(`
    INSERT INTO "task" (title, description, status, "due_date", "project_id", "organization_id", "created_by")
    SELECT 
      task_data.title,
      task_data.description,
      task_data.status::task_status,
      task_data.due_date::timestamp,
      p.id as "project_id",
      p."organization_id",
      u.id as "created_by"
    FROM (
      VALUES 
        -- 2 tâches pour TechCorp - Plateforme E-commerce
        ('Configuration Next.js', 'Mise en place de l''architecture Next.js avec TypeScript', 'done', '2024-09-15', 'Plateforme E-commerce', 'user-owner@gmail.com'),
        ('Intégration Stripe', 'Implémentation du système de paiement avec Stripe', 'in_progress', '2024-12-01', 'Plateforme E-commerce', 'user@gmail.com'),
        
        -- 1 tâche pour Marketing Pro - Campagne Digitale
        ('Création des visuels', 'Design des bannières pour les réseaux sociaux', 'todo', '2024-11-15', 'Campagne Digitale 2024', 'user-admin@gmail.com'),
        
        -- 0 tâche pour Marketing Pro - Site Web Corporate (pas de VALUES pour ce projet)
        
        -- 1 tâche pour Evil Corp - Audit Sécurité  
        ('Scan des vulnérabilités', 'Analyse complète des failles de sécurité', 'in_progress', '2024-10-30', 'Audit Sécurité', 'user@gmail.com')
    ) AS task_data(title, description, status, due_date, project_name, creator_email)
    JOIN "project" p ON p.name = task_data.project_name
    JOIN "user" u ON u.email = task_data.creator_email
    ON CONFLICT DO NOTHING;
  `)

  // 7. Insérer des catégories de blog
  await client.query(`
    INSERT INTO "categories" (name, description, icon, image)
    VALUES
      ('Tech', 'Articles sur les technologies web et développement', '💻', 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400'),
      ('Tutorial', 'Tutoriels et guides pratiques', '📚', 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400')
    ON CONFLICT (name) DO NOTHING;
  `)

  // 7.5. Insérer des hashtags
  await client.query(`
    INSERT INTO "hashtags" (name)
    VALUES
      ('javascript'),
      ('react'),
      ('nextjs'),
      ('typescript'),
      ('css'),
      ('backend'),
      ('frontend'),
      ('tutorial'),
      ('tips'),
      ('webdev')
    ON CONFLICT (name) DO NOTHING;
  `)

  // 8. Insérer des posts avec traductions
  await client.query(`
    INSERT INTO "posts" (status, "authorid", "categoryid", "nbview", "nblike")
    SELECT 
      'published'::post_status,
      u.id as "authorid",
      c.id as "categoryid",
      post_data.nb_view,
      post_data.nb_like
    FROM (
      VALUES 
        ('user@gmail.com', 'Tech', 150, 12),
        ('admin@gmail.com', 'Tutorial', 89, 8)
    ) AS post_data(author_email, category_name, nb_view, nb_like)
    JOIN "user" u ON u.email = post_data.author_email
    JOIN "categories" c ON c.name = post_data.category_name
    ON CONFLICT DO NOTHING;
  `)

  // 9. Insérer les traductions des posts
  await client.query(`
    INSERT INTO "posts_translation" ("postid", language, title, slug, content, description)
    SELECT 
      p.id as "postid",
      trans_data.language,
      trans_data.title,
      trans_data.slug,
      trans_data.content,
      trans_data.description
    FROM (
      VALUES 
        -- Post 1 - Tech (par user@gmail.com)
        ('user@gmail.com', 'Tech', 'fr', 'Les Nouveautés de React 19', 'nouveautes-react-19', '# Les Nouveautés de React 19\n\nReact 19 introduit des changements majeurs qui révolutionnent la façon de développer avec React.\n\n## Comparaison des versions\n\n| Feature        | React 18 | React 19 |\n| -------------- | -------- | -------- |\n| Ref as prop    | ❌        | ✅        |\n| Server Actions | ❌        | ✅        |\n| Actions        | ❌        | ✅        |\n| use() Hook     | 🚧       | ✅        |\n\n![React 19 Features](https://images.unsplash.com/photo-1633356122544-f134324a6cee)\n\n## Migration\n\nPour migrer vers React 19, suivez ces étapes :\n\n1. Mettre à jour les dépendances\n2. Retirer les forwardRef inutiles\n3. Adopter les Server Actions\n4. Utiliser le hook use() pour les promesses', 'Découvrez les nouvelles fonctionnalités révolutionnaires de React 19'),
        ('user@gmail.com', 'Tech', 'en', 'React 19 New Features', 'react-19-new-features', '# React 19 New Features\n\nReact 19 introduces major changes that revolutionize the way we develop with React.\n\n## Version Comparison\n\n| Feature        | React 18 | React 19 |\n| -------------- | -------- | -------- |\n| Ref as prop    | ❌        | ✅        |\n| Server Actions | ❌        | ✅        |\n| Actions        | ❌        | ✅        |\n| use() Hook     | 🚧       | ✅        |\n\n![React 19 Features](https://images.unsplash.com/photo-1633356122544-f134324a6cee)\n\n## Migration\n\nTo migrate to React 19, follow these steps:\n\n1. Update dependencies\n2. Remove unnecessary forwardRef\n3. Adopt Server Actions\n4. Use the use() hook for promises', 'Discover the revolutionary new features of React 19'),
        ('user@gmail.com', 'Tech', 'es', 'Novedades de React 19', 'novedades-react-19', '# Novedades de React 19\n\nReact 19 introduce cambios importantes que revolucionan la forma de desarrollar con React.\n\n## Comparación de versiones\n\n| Feature        | React 18 | React 19 |\n| -------------- | -------- | -------- |\n| Ref as prop    | ❌        | ✅        |\n| Server Actions | ❌        | ✅        |\n| Actions        | ❌        | ✅        |\n| use() Hook     | 🚧       | ✅        |\n\n![React 19 Features](https://images.unsplash.com/photo-1633356122544-f134324a6cee)\n\n## Migración\n\nPara migrar a React 19, sigue estos pasos:\n\n1. Actualizar las dependencias\n2. Eliminar los forwardRef innecesarios\n3. Adoptar las Server Actions\n4. Usar el hook use() para las promesas', 'Descubre las nuevas características revolucionarias de React 19'),
        
        -- Post 2 - Tutorial (par admin@gmail.com)
        ('admin@gmail.com', 'Tutorial', 'fr', 'Guide Next.js pour Débutants', 'guide-nextjs-debutants', '# Guide Next.js pour Débutants\n\nApprenez les bases de Next.js...', 'Un guide complet pour débuter avec Next.js'),
        ('admin@gmail.com', 'Tutorial', 'en', 'Next.js Guide for Beginners', 'nextjs-guide-beginners', '# Next.js Guide for Beginners\n\nLearn the basics of Next.js...', 'A complete guide to get started with Next.js'),
        ('admin@gmail.com', 'Tutorial', 'es', 'Guía de Next.js para Principiantes', 'guia-nextjs-principiantes', '# Guía de Next.js para Principiantes\n\nAprende lo básico de Next.js...', 'Una guía completa para empezar con Next.js')
    ) AS trans_data(author_email, category_name, language, title, slug, content, description)
    JOIN "user" u ON u.email = trans_data.author_email
    JOIN "posts" p ON p."authorid" = u.id
    JOIN "categories" c ON c.name = trans_data.category_name AND p."categoryid" = c.id
    ON CONFLICT ("postid", language) DO NOTHING;
  `)

  // 9.5. Associer des hashtags aux posts
  await client.query(`
    INSERT INTO "post_hashtags" ("postid", "hashtagid")
    SELECT 
      p.id as "postid",
      h.id as "hashtagid"
    FROM (
      VALUES 
        -- Post 1 (React 19) : javascript, react, frontend, tips
        ('user@gmail.com', 'Tech', 'javascript'),
        ('user@gmail.com', 'Tech', 'react'),
        ('user@gmail.com', 'Tech', 'frontend'),
        ('user@gmail.com', 'Tech', 'tips'),
        
        -- Post 2 (Guide Next.js) : nextjs, typescript, tutorial, webdev
        ('admin@gmail.com', 'Tutorial', 'nextjs'),
        ('admin@gmail.com', 'Tutorial', 'typescript'),
        ('admin@gmail.com', 'Tutorial', 'tutorial'),
        ('admin@gmail.com', 'Tutorial', 'webdev')
    ) AS hashtag_data(author_email, category_name, hashtag_name)
    JOIN "user" u ON u.email = hashtag_data.author_email
    JOIN "posts" p ON p."authorid" = u.id
    JOIN "categories" c ON c.name = hashtag_data.category_name AND p."categoryid" = c.id
    JOIN "hashtags" h ON h.name = hashtag_data.hashtag_name
    ON CONFLICT ("postid", "hashtagid") DO NOTHING;
  `)

  // 10. Insérer des notifications de test
  await client.query(`
    INSERT INTO "notifications" (
      "user_id",
      "type", 
      "title",
      "message",
      "metadata",
      "read",
      "created_at"
    )
    SELECT 
      u.id as "user_id",
      notif_data.type,
      notif_data.title,
      notif_data.message,
      notif_data.metadata::jsonb,
      notif_data.read::boolean,
      (NOW() - (notif_data.days_ago || ' days')::interval)::timestamp as "created_at"
    FROM (
      VALUES 
        -- Notifications pour user@gmail.com (utilisateur multi-organisations)
        ('user@gmail.com', 'organization_invitation', 'Nouvelle invitation', 'Vous avez été invité à rejoindre Evil Corp en tant que propriétaire.', '{"organization": "evil-corp", "role": "owner"}', 'true', '7'),
        ('user@gmail.com', 'project_created', 'Projet Audit Sécurité', 'Votre projet Audit Sécurité a été créé dans Evil Corp.', '{"project_id": "uuid", "organization": "evil-corp"}', 'false', '3'),
        ('user@gmail.com', 'security_alert', 'Connexion suspecte détectée', 'Une tentative de connexion depuis un nouvel appareil a été détectée.', '{"ip": "192.168.1.100", "device": "Chrome/Linux"}', 'false', '1'),
        
        -- Notifications pour admin@gmail.com (admin global)
        ('admin@gmail.com', 'system_maintenance', 'Maintenance programmée', 'Une maintenance du système est programmée ce week-end.', '{"scheduled_date": "2024-11-16", "duration": "2 hours"}', 'true', '4'),
        ('admin@gmail.com', 'user_banned', 'Utilisateur suspendu', 'Utilisateur test@spam.com a été suspendu pour violation des conditions.', '{"banned_user": "test@spam.com", "reason": "spam"}', 'true', '6'),
        
        -- Notifications pour user-admin@gmail.com 
        ('user-admin@gmail.com', 'project_created', 'Campagne Digitale créée', 'Votre projet Campagne Digitale 2024 a été créé dans Marketing Pro.', '{"project_id": "uuid", "organization": "marketing-pro"}', 'false', '4'),
        ('user-admin@gmail.com', 'subscription_updated', 'Plan mis à jour', 'Votre organisation a migré vers le plan Pro.', '{"old_plan": "free", "new_plan": "pro"}', 'true', '8'),
        
        -- Notifications pour user-owner@gmail.com
        ('user-owner@gmail.com', 'payment_succeeded', 'Paiement confirmé', 'Votre paiement de 29€ pour le plan Pro a été traité avec succès.', '{"amount": 29, "currency": "EUR", "plan": "pro"}', 'true', '10'),
        ('user-owner@gmail.com', 'subscription_created', 'Abonnement créé', 'Votre abonnement Pro a été activé pour TechCorp Solutions.', '{"plan": "pro", "organization": "techcorp-solutions"}', 'true', '10'),
        
        -- Notifications système pour superadmin@gmail.com
        ('superadmin@gmail.com', 'system', 'Rapport hebdomadaire', 'Rapport activité de la plateforme - 45 nouveaux utilisateurs cette semaine.', '{"new_users": 45, "active_projects": 127, "revenue": 2340}', 'false', '1'),
        ('superadmin@gmail.com', 'security_alert', 'Tentatives de piratage', 'Plusieurs tentatives de connexion suspectes détectées sur le système.', '{"attempts": 23, "blocked_ips": ["1.2.3.4", "5.6.7.8"]}', 'false', '2'),
        
        -- Notifications pour user-member@gmail.com
        ('user-member@gmail.com', 'organization_invitation', 'Bienvenue dans Acme Corp', 'Vous avez rejoint Acme Corp en tant que membre.', '{"organization": "acme-corp", "role": "member"}', 'true', '15'),
        
        -- Notifications de paiement pour différents utilisateurs
        ('admin-owner@gmail.com', 'payment_failed', 'Échec du paiement', 'Le paiement pour votre abonnement Enterprise a échoué. Veuillez mettre à jour votre carte.', '{"amount": 99, "currency": "EUR", "retry_date": "2024-11-20"}', 'false', '1'),
        ('moderator-member@gmail.com', 'subscription_canceled', 'Abonnement annulé', 'Votre abonnement a été annulé. Vous garderez accès jusqu''au 30 novembre.', '{"plan": "pro", "access_until": "2024-11-30"}', 'false', '3'),
        
        -- Notifications anciennes (lues) pour tester l'historique
        ('user@gmail.com', 'project_updated', 'Tâche terminée', 'La tâche Configuration Next.js a été marquée comme terminée.', '{"task": "Configuration Next.js", "project": "Plateforme E-commerce"}', 'true', '20'),
        ('admin@gmail.com', 'user_unbanned', 'Utilisateur réactivé', 'Utilisateur previously-banned@test.com a été réactivé.', '{"unbanned_user": "previously-banned@test.com"}', 'true', '30')
    ) AS notif_data(user_email, type, title, message, metadata, read, days_ago)
    JOIN "user" u ON u.email = notif_data.user_email
    ON CONFLICT DO NOTHING;
  `)

  const end = Date.now()

  console.log('✅ Seed inserted in', end - start, 'ms')
  console.log('')
  console.log('💎 Plans de subscription créés :')
  console.log('🔹 FREE : 1 projet, 1 GB stockage (€0)')
  console.log('🔹 PRO : 2 projets, 10 GB stockage (€29/mois, €249/an)')
  console.log('🔹 ENTERPRISE : 3 projets, 50 GB stockage (€99/mois, €990/an)')
  console.log(
    '🔹 LIFETIME : 20 projets, 50 GB stockage (€70 unique, 14j trial)'
  )
  console.log('')
  console.log('📊 Jeu de test créé avec succès :')
  console.log(
    '🔹 Rôles globaux purs : superadmin, admin, moderator, redactor, public'
  )
  console.log('🔹 Utilisateur multi-org : user@gmail.com (MEMBER→ADMIN→OWNER)')
  console.log(
    '🔹 Utilisateurs spécialisés : user-owner, user-admin, user-member'
  )
  console.log('🔹 Cas de chevauchement : admin-owner, moderator-member')
  console.log('🔹 Utilisateur isolé : user-isolated (aucune organisation)')
  console.log('')
  console.log('📝 Projets et tâches créés par organisation :')
  console.log('🔹 TechCorp Solutions : 1 projet (2 tâches)')
  console.log('  └─ Plateforme E-commerce: Configuration ✅ + Intégration 🔄')
  console.log('🔹 Marketing Pro : 2 projets (1 tâche total)')
  console.log('  ├─ Campagne Digitale: Création visuels 📋')
  console.log('  └─ Site Web Corporate: 0 tâche (vide)')
  console.log('🔹 Acme Corp : 0 projet (vide pour tests)')
  console.log('🔹 Evil Corp : 1 projet (1 tâche)')
  console.log('  └─ Audit Sécurité: Scan vulnérabilités 🔄')
  console.log('')
  console.log('📊 Statuts des tâches : ✅ Done | 🔄 In Progress | 📋 Todo')
  console.log('')
  console.log('📝 Articles de blog créés :')
  console.log('🔹 2 catégories : Tech et Tutorial')
  console.log(
    '🔹 10 hashtags : javascript, react, nextjs, typescript, css, backend, frontend, tutorial, tips, webdev'
  )
  console.log('🔹 2 posts traduits en 3 langues (fr, en, es)')
  console.log(
    '  └─ "Les Nouveautés de React 19" par user@gmail.com (hashtags: javascript, react, frontend, tips)'
  )
  console.log(
    '  └─ "Guide Next.js pour Débutants" par admin@gmail.com (hashtags: nextjs, typescript, tutorial, webdev)'
  )
  console.log('')
  console.log('🔔 Notifications de test créées :')
  console.log('🔹 22 notifications réparties sur tous les utilisateurs')
  console.log(
    '🔹 Types : system, project_*, subscription_*, organization_*, payment_*, security_alert, user_*'
  )
  console.log('🔹 Métadonnées typées pour chaque type de notification')
  console.log(
    '🔹 Mix de notifications lues/non lues avec dates étalées (0 à 30 jours)'
  )
  console.log('🔹 Cas de test : notifications récentes, moyennes et anciennes')
  console.log('')

  process.exit(0)
}

export default seed

try {
  await seed()
} catch (error) {
  console.error('❌ Connexion failed')
  console.error(error)
  process.exit(1)
}

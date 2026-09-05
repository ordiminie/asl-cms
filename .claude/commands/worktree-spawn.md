# Spawn Agent in Worktree

## Variables

FEATURE: $ARGUMENTS

## Instructions

Lance un agent Claude Code autonome dans un worktree isolé.

1. Crée le worktree et la branche :
   RUN `git worktree add ./.worktrees/$FEATURE -b $FEATURE`

2. Lance l'agent en background :
   RUN `cd ./.worktrees/$FEATURE && claude --dir . -p "Implémente la feature: $FEATURE. Respecte les conventions du projet. Les tests doivent passer. Commit quand terminé." &`

3. Confirme le lancement avec :

- Nom de la feature
- Path du worktree
- Branche créée

# Cleanup Worktree

## Variables

FEATURE: $ARGUMENTS

## Instructions

Supprime un worktree et sa branche après merge ou abandon.

1. Vérifie que le worktree existe :
   RUN `git worktree list | grep $FEATURE`

2. Supprime le worktree :
   RUN `git worktree remove ./.worktrees/$FEATURE --force`

3. Supprime la branche locale :
   RUN `git branch -d $FEATURE 2>/dev/null || git branch -D $FEATURE`

4. Confirme la suppression :

- Worktree supprimé
- Branche supprimée
- Espace libéré

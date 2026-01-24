# Cleanup All Worktrees

## Instructions

Supprime tous les worktrees du dossier trees/.

1. Liste les worktrees à supprimer :
RUN `ls ./.worktrees/ 2>/dev/null || echo "Aucun worktree"`

2. Pour chaque worktree dans .worktrees/, supprime-le :
RUN `for dir in ./.worktrees/*/; do feature=$(basename "$dir"); git worktree remove "./.worktrees/$feature" --force 2>/dev/null; git branch -D "$feature" 2>/dev/null; done`

3. Nettoie les références orphelines :
RUN `git worktree prune`

4. Confirme :
- Tous les worktrees supprimés
- Branches nettoyées

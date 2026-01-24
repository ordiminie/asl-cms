# Status des Worktrees

## Instructions

Affiche l'état de tous les worktrees et agents en cours.

1. Liste les worktrees actifs :
RUN `git worktree list`

2. Affiche le contenu du dossier .worktrees :
RUN `ls -la ./.worktrees/ 2>/dev/null || echo "Aucun worktree actif"`

3. Liste les branches de features :
RUN `git branch -a | grep -v main | grep -v HEAD`

4. Résume :
- Nombre de worktrees actifs
- Features en cours
- Branches à merger

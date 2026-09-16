FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    build-essential \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI : requis par /ks-ship (ouverture de la PR, relecture de son état).
# Version épinglée plutôt que dépôt apt, même logique que pnpm plus bas :
# pas de dérive entre machines ni entre reconstructions.
ARG GH_VERSION=2.101.0
RUN ARCH="$(dpkg --print-architecture)" \
    && curl -fsSL -o /tmp/gh.deb \
       "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${ARCH}.deb" \
    && apt-get update \
    && apt-get install -y --no-install-recommends /tmp/gh.deb \
    && rm -rf /tmp/gh.deb /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

# pnpm via corepack : la version exacte est celle du champ "packageManager"
# du package.json du boilerplate, donc pas de dérive entre machines.
RUN corepack enable

RUN useradd -m -s /bin/bash dev \
    && mkdir -p /home/dev/.claude \
    && chown -R dev:dev /home/dev

# Le volume nommé monté sur /workspace/node_modules hérite du propriétaire
# que ce chemin a DANS L'IMAGE. Sans ce mkdir, Docker crée un volume vide
# appartenant à root et pnpm install échoue en EACCES pour l'utilisateur dev.
RUN mkdir -p /workspace/node_modules /home/dev/.pnpm-store \
    && chown -R dev:dev /workspace /home/dev/.pnpm-store

USER dev
WORKDIR /workspace

# safe.directory : /workspace est un bind mount Windows, git y voit un
# propriétaire (root) différent de l'utilisateur courant (dev) et refuse de
# travailler. Sans cette ligne, toute commande git échoue en "dubious ownership".
# credential helper : délègue l'authentification HTTPS de git à gh, qui lit
# GH_TOKEN. C'est ce qui permet à "git push" de fonctionner sans mot de passe.
RUN git config --global --add safe.directory /workspace \
    && git config --global credential."https://github.com".helper '!gh auth git-credential'

# Pré-télécharge pnpm dans le cache corepack de l'utilisateur dev
RUN corepack prepare pnpm@latest --activate

CMD ["bash"]

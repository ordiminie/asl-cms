FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    build-essential \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

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

# Pré-télécharge pnpm dans le cache corepack de l'utilisateur dev
RUN corepack prepare pnpm@latest --activate

CMD ["bash"]

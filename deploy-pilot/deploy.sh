#!/usr/bin/env bash
# Deploy the pilot to Vercel: project ageing-navigator-pilot, team servi-tec, https://ageing-navigator-pilot.vercel.app
# Deploys demo/ from the committed HEAD of this repository, as a git-free export (the team refuses deployments whose
# git commit author has no Vercel account). Secrets live in Vercel's environment variables, never in files here.
# Needs the Vercel CLI, signed in with access to the servi-tec team.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(git -C "$HERE" rev-parse --show-toplevel)
[ -z "$(git -C "$ROOT" status --porcelain -- demo)" ] || { echo "demo/ has uncommitted changes: commit first"; exit 1; }
rm -rf "$HERE/.export" && mkdir "$HERE/.export"
git -C "$ROOT" archive --format=tar HEAD:demo | tar -x -C "$HERE/.export"
cp -r "$HERE/.vercel" "$HERE/.export/"
echo "Deploying demo/ at $(git -C "$ROOT" log --oneline -1 -- demo)"
cd "$HERE/.export" && vercel --prod --yes --scope servi-tec

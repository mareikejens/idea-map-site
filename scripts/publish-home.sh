#!/bin/zsh
# Publish the idea map to mareikejens.com (it is the homepage since 26 Nov 2026).
# Takes what is on this repo's main branch on GitHub (so only merged work goes live), copies it over the root of the
# homepage repo (mareikejens/mareikejens.com) and pushes. GitHub Pages then serves it.
# Files that belong only to the homepage repo stay untouched: CNAME, imprint.html, privacy.html, favicons, robots.txt,
# sitemap.xml, branding/ and previous/ (the old homepage). Nothing is deleted there; a file removed from the idea map
# stays until removed by hand.
#
# Usage: scripts/publish-home.sh
set -euo pipefail
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
git clone -q --depth 1 https://github.com/mareikejens/idea-map-site.git "$work/site"
git clone -q https://github.com/mareikejens/mareikejens.com.git "$work/home"
sha=$(git -C "$work/site" rev-parse --short HEAD)
# The site, without git history, the backend source, the scripts and the readme.
rsync -a --exclude .git --exclude backend --exclude scripts --exclude README.md --exclude .nojekyll "$work/site/" "$work/home/"
# The homepage is plain HTML. Without this file GitHub runs it through Jekyll, which leaves out folders such as vendor/.
touch "$work/home/.nojekyll"
cd "$work/home"
git add -A
if git diff --cached --quiet; then echo "Nothing new: mareikejens.com already has idea-map-site $sha."; exit 0; fi
git commit -q -m "Publish the idea map (idea-map-site $sha)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD:main
echo "Pushed idea-map-site $sha to mareikejens.com. GitHub Pages needs about a minute."

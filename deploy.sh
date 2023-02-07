#!/usr/bin/env sh

REPO="stick-generator.git"

# abort on errors
set -e

# build
pnpm build

# navigate into the build output directory
cd build

touch .nojekyll
# if you are deploying to a custom domain
# echo 'www.example.com' > CNAME

git init
git branch -m main
git add -A
git commit -m 'deploy'

# if you are deploying to https://<USERNAME>.github.io
# git push -f git@github.com:<USERNAME>/<USERNAME>.github.io.git main

# if you are deploying to https://<USERNAME>.github.io/<REPO>
git push -f git@github.com:minutelabsio/$REPO main:gh-pages

cd -

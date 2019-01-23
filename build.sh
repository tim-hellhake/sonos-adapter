#!/usr/bin/env bash

rm -rf *.tgz package/
TARFILE=$(npm pack)
tar xzf ${TARFILE}
npm ci --ignore-scripts
npm run licenses
cd package
sha256sum LICENSE > SHA256SUMS
cd ..
sha256sum package.json adapter.js property.js readonly-property.js speaker.js >> package/SHA256SUMS
rm -rf node_modules
npm ci --production --ignore-scripts
find node_modules -type f -exec sha256sum {} \; >> package/SHA256SUMS
cp -r node_modules ./package
tar czf ${TARFILE} package
rm -rf package
sha256sum ${TARFILE}
echo "Created ${TARFILE}"

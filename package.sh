#!/bin/bash

rm -rf node_modules
npm install --production

shasum --algorithm 256 package.json manifest.json lib/*.js LICENSE README.md > SHA256SUMS
find node_modules -type f -exec shasum --algorithm 256 {} \; >> SHA256SUMS

TARFILE=`npm pack`
tar xzf ${TARFILE}
cp -r node_modules ./package
tar czf ${TARFILE} package

shasum --algorithm 256 ${TARFILE} > ${TARFILE}.sha256sum

rm SHA256SUMS
rm -rf package

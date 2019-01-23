#! /usr/bin/env node
const nlf = require("nlf");
const fs = require("fs");
const { promisify } = require("util");
const packageInfo = require("./package.json");

Promise.all([
    promisify(fs.readFile)('./LICENSE'),
    promisify(nlf.find)({
        directory: __dirname,
        production: true
    })
]).then(([ baseLicense, info ]) => {
    const licenses = ([
        baseLicense
    ].concat(info.filter((package) => package.name != packageInfo.name).map((package) => {
        if(package.licenseSources.license && package.licenseSources.license.sources.length) {
            return `License for ${package.name}:
${package.licenseSources.license.sources.map((s) => s.text).join("\n\n")}`;
        }
        return `License for ${package.name}: ${package.licenseSources.package.sources.map((s) => s.license).join(', ')}`;
}))).join('\n\n');
    return promisify(fs.writeFile)('./package/LICENSE', licenses);
});

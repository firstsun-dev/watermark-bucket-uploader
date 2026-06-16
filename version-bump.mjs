import fs from 'fs';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const { version } = manifest;

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = version;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

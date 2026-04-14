#!/usr/bin/env node
/**
 * Bump version across package.json, src-tauri/tauri.conf.json and
 * src-tauri/Cargo.toml, then commit and tag.
 *
 * Usage:
 *   node scripts/release.mjs 0.2.0
 *
 * Does NOT push — you run `git push && git push --tags` yourself.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/release.mjs <X.Y.Z>');
  process.exit(1);
}

console.log(`→ Bumping to v${version}`);

// 1) package.json
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('  ✓ package.json');

// 2) tauri.conf.json
const confPath = resolve(root, 'src-tauri/tauri.conf.json');
const conf = JSON.parse(readFileSync(confPath, 'utf8'));
conf.version = version;
writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');
console.log('  ✓ src-tauri/tauri.conf.json');

// 3) Cargo.toml — replace the first `version = "..."` under [package]
const cargoPath = resolve(root, 'src-tauri/Cargo.toml');
let cargo = readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(
  /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/m,
  `$1${version}$2`,
);
writeFileSync(cargoPath, cargo);
console.log('  ✓ src-tauri/Cargo.toml');

// Git commit + tag
const tag = `v${version}`;
console.log(`→ Committing and tagging ${tag}`);
execSync('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml', { stdio: 'inherit', cwd: root });
execSync(`git commit -m "chore: release ${tag}"`, { stdio: 'inherit', cwd: root });
execSync(`git tag ${tag}`, { stdio: 'inherit', cwd: root });

console.log(`\n✓ Done. Push with:\n  git push && git push --tags`);
console.log('\nThen GitHub Actions will build the installer and publish the release.');

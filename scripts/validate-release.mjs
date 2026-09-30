import { readFile } from 'node:fs/promises';

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const tag = process.argv[2] ?? process.env.RELEASE_TAG;
if (!tag || tag.replace(/^v/, '') !== version) {
  throw new Error(
    `Release tag ${JSON.stringify(tag)} must be ${version} or v${version} (package.json version).`,
  );
}
console.log(`Release tag ${tag} matches package version ${version}.`);

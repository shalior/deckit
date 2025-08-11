#!/usr/bin/env node

// Minimal ESM CLI to scaffold a controller file from this package's template.
// Usage:
//   deckit make:controller <dest> [--name Name] [--force]
// Examples:
//   deckit make:controller src/routes/api/user/+server.controller.ts --name UserController
//   deckit make:controller src/controllers --name EditController

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function print(s) {
	process.stdout.write(String(s) + '\n');
}

function printErr(s) {
	process.stderr.write(String(s) + '\n');
}

function usage() {
	print(`Usage:\n  deckit make:controller <dest> [--name Name] [--force]\n\nArgs:\n  <dest>   Destination file or directory. If a directory, the file will be named <Name>.ts.\n\nOptions:\n  --name   Class name to use inside the generated file (default: EditController)\n  --force  Overwrite the destination file if it exists`);
}

function parseOptions(argv) {
	const opts = { name: undefined, force: false, positional: '' };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--force') {
			opts.force = true;
		} else if (a === '--name') {
			const n = argv[i + 1];
			if (!n || n.startsWith('--')) {
				printErr('Missing value for --name');
				process.exit(2);
			}
			opts.name = n;
			i++;
		} else if (a.startsWith('--name=')) {
			opts.name = a.split('=')[1] || opts.name;
		} else if (a === '-h' || a === '--help') {
			usage();
			process.exit(0);
		} else {
			opts.positional = ('src/routes/' + a);
		}
	}

	if (!opts.name) {

		opts.name = opts.positional.match(/.+\/(\w+)(\.ts)?/)?.[1];

		if (!opts.name){
			printErr('Invalid name provided');
			process.exit(1);
		}

	}

	return opts;
}

function resolveTemplatePath() {
	// Template is shipped inside this package under ../templates/controller.base.ts
	const p = path.resolve(__dirname, '../templates/controller.base.ts');
	if (!fs.existsSync(p)) {
		printErr('Template file not found in package: ' + p);
		process.exit(1);
	}
	return p;
}

function ensureTsExt(p) {
	return p.endsWith('.ts') ? p : p + '.ts';
}

function main() {
	const argv = process.argv.slice(2);
	if (argv.length === 0) {
		usage();
		process.exit(2);
	}

	const command = argv[0];
	const rest = argv.slice(1);

	if (command !== 'make:controller') {
		printErr(`Unknown command: ${command}`);
		usage();
		process.exit(2);
	}

	const opts = parseOptions(rest);
	const destArg = opts.positional;
	if (!destArg) {
		printErr('Destination path is required.');
		usage();
		process.exit(2);
	}

	const cwd = process.cwd();
	let destPath = path.resolve(cwd, destArg);

	// If destination is a directory (existing or indicated by trailing slash),
	// construct the file path using the provided name.
	let isDirTarget = false;
	if (destArg.endsWith(path.sep)) {
		isDirTarget = true;
	} else if (fs.existsSync(destPath) && fs.statSync(destPath).isDirectory()) {
		isDirTarget = true;
	}
	if (isDirTarget) {
		destPath = path.join(destPath, ensureTsExt(opts.name));
	} else {
		// If a file path without extension, add .ts
		const dir = path.dirname(destPath);
		const base = path.basename(destPath);
		destPath = path.join(dir, ensureTsExt(base));
	}

	const destDir = path.dirname(destPath);
	fs.mkdirSync(destDir, { recursive: true });

	if (fs.existsSync(destPath) && !opts.force) {
		printErr(`Refusing to overwrite existing file: ${path.relative(cwd, destPath)} (use --force to overwrite)`);
		process.exit(3);
	}

	const templatePath = resolveTemplatePath();
	let content = fs.readFileSync(templatePath, 'utf8');

	// Replace the class name if a custom name is provided
	if (opts.name && opts.name !== 'EditController') {
		content = content.replace(/export\s+default\s+class\s+\w+/, `export default class ${opts.name}`);
	}

	fs.writeFileSync(destPath, content, 'utf8');

	print(`Controller created: ${path.relative(cwd, destPath)}`);
}

main();

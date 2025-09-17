#!/usr/bin/env node

// Minimal ESM CLI to scaffold a controller file from this package's template.
// Usage:
//   deckit make:controller <dest> [--name Name] [--force]
//   deckit make:route <dest> [--name Name] [--force]
// Examples:
//   deckit make:controller src/routes/api/user/+server.controller.ts --name UserController
//   deckit make:controller src/controllers --name EditController
//   deckit make:route src/routes/users --name UserController

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
	print(
		"Usage:\n  deckit make:controller <dest> [--name Name] [--force]\n  deckit make:route <dest> [--name Name] [--force]\n\nCommands:\n  make:controller  Create a controller file\n  make:route       Create a complete route with controller, +page.server.ts and +page.svelte\n\nArgs:\n  <dest>   Destination file or directory. If a directory, the file will be named <Name>.ts.\n\nOptions:\n  --name   Class name to use inside the generated file (default: Controller)\n  --force  Overwrite the destination file if it exists"
	);
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
			// For make:controller, we want to respect the full path provided
			// Only prefix with 'src/routes/' if it's not already an absolute path or doesn't start with src/routes
			if (!a.startsWith('src/routes/') && !path.isAbsolute(a)) {
				opts.positional = 'src/routes/' + a;
			} else {
				opts.positional = a;
			}
		}
	}

	if (!opts.name) {
		opts.name = opts.positional.match(/.+\/(\w+)(\.ts)?/)?.[1];

		if (!opts.name) {
			printErr('Invalid name provided');
			process.exit(1);
		}
	}

	return opts;
}

function resolveTemplatePath(templateName = 'controller.base.ts') {
	// First check if package user has a /templates directory in their project
	const userTemplatePath = path.resolve(process.cwd(), `templates/${templateName}`);
	if (fs.existsSync(userTemplatePath)) {
		return userTemplatePath;
	}

	const p = path.resolve(__dirname, `../templates/${templateName}`);
	if (!fs.existsSync(p)) {
		printErr('Template file not found in package: ' + p);
		process.exit(1);
	}
	return p;
}

function ensureTsExt(p) {
	return p.endsWith('.ts') ? p : p + '.ts';
}

function createController(destPath, opts) {
	const cwd = process.cwd();
	const destDir = path.dirname(destPath);
	fs.mkdirSync(destDir, { recursive: true });

	if (fs.existsSync(destPath) && !opts.force) {
		printErr(
			`Refusing to overwrite existing file: ${path.relative(cwd, destPath)} (use --force to overwrite)`
		);
		process.exit(3);
	}

	const templatePath = resolveTemplatePath();
	let content = fs.readFileSync(templatePath, 'utf8');

	// Replace the class name if a custom name is provided
	if (opts.name && opts.name !== 'Controller') {
		content = content.replace(
			/export\s+default\s+class\s+\w+/,
			`export default class ${opts.name}`
		);
	}

	fs.writeFileSync(destPath, content, 'utf8');

	print(`Controller created: ${path.relative(cwd, destPath)}`);
}

function createRoute(destArg, opts) {
	const cwd = process.cwd();
	let destPath = path.resolve(cwd, destArg);

	// Ensure destination is a directory
	if (!fs.existsSync(destPath)) {
		fs.mkdirSync(destPath, { recursive: true });
	} else if (!fs.statSync(destPath).isDirectory()) {
		printErr('Destination must be a directory for make:route command.');
		process.exit(2);
	}

	const controllerName = opts.name.replace(/[^\w\-_]/g, '').replace(/[-_]\w/g, (match) => match[1].toUpperCase()) + 'Controller';

	// Create controller file
	const controllerPath = path.join(destPath, `${controllerName}.ts`);
	if (fs.existsSync(controllerPath) && !opts.force) {
		printErr(
			`Refusing to overwrite existing file: ${path.relative(cwd, controllerPath)} (use --force to overwrite)`
		);
		process.exit(3);
	}

	const controllerTemplatePath = resolveTemplatePath();
	let controllerContent = fs.readFileSync(controllerTemplatePath, 'utf8');

	// Replace the class name
	if (opts.name && opts.name !== 'Controller') {
		controllerContent = controllerContent.replace(
			/export\s+default\s+class\s+\w+/,
			`export default class ${controllerName}`
		);
	}

	fs.writeFileSync(controllerPath, controllerContent, 'utf8');
	print(`Controller created: ${path.relative(cwd, controllerPath)}`);

	// Create +page.server.ts file
	const pageServerPath = path.join(destPath, '+page.server.ts');
	if (fs.existsSync(pageServerPath) && !opts.force) {
		printErr(
			`Refusing to overwrite existing file: ${path.relative(cwd, pageServerPath)} (use --force to overwrite)`
		);
		process.exit(3);
	}

	const pageServerTemplatePath = resolveTemplatePath('page.server.base.ts');
	let pageServerContent = fs.readFileSync(pageServerTemplatePath, 'utf8');

	// Replace placeholders
	pageServerContent = pageServerContent.replace(/{Name}/g, opts.name);

	fs.writeFileSync(pageServerPath, pageServerContent, 'utf8');
	print(`+page.server.ts created: ${path.relative(cwd, pageServerPath)}`);

	// Create +page.svelte file
	const pageSveltePath = path.join(destPath, '+page.svelte');
	if (fs.existsSync(pageSveltePath) && !opts.force) {
		printErr(
			`Refusing to overwrite existing file: ${path.relative(cwd, pageSveltePath)} (use --force to overwrite)`
		);
		process.exit(3);
	}

	const pageSvelteTemplatePath = resolveTemplatePath('page.svelte.base');
	let pageSvelteContent = fs.readFileSync(pageSvelteTemplatePath, 'utf8');

	// Replace placeholders
	pageSvelteContent = pageSvelteContent.replace(/{Name}/g, opts.name);

	fs.writeFileSync(pageSveltePath, pageSvelteContent, 'utf8');
	print(`+page.svelte created: ${path.relative(cwd, pageSveltePath)}`);
}

function main() {
	const argv = process.argv.slice(2);
	if (argv.length === 0) {
		usage();
		process.exit(2);
	}

	const command = argv[0];
	const rest = argv.slice(1);

	if (command !== 'make:controller' && command !== 'make:route') {
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

	if (command === 'make:controller') {
		let destPath = path.resolve(process.cwd(), destArg);

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

		createController(destPath, opts);
	} else if (command === 'make:route') {
		createRoute(destArg, opts);
	}
}

main();
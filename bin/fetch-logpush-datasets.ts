#!/usr/bin/env tsx

import fs from "fs";
import { join } from "path";

import {
	downloadToDotTempIfNotPresent,
	extractTarGz,
} from "../src/util/custom-loaders";

const MIDDLECACHE_BASE_URL =
	process.env.MIDDLECACHE_BASE_URL ?? "https://middlecache.ced.cloudflare.com/";
const ARCHIVE_MIDDLECACHE_PATH = "v1/logpush-datasets/datasets.tar.gz";
const ARCHIVE_DOT_TMP_PATH = `middlecache/${ARCHIVE_MIDDLECACHE_PATH}`;
const DATASETS_DIR =
	process.env.LOGPUSH_DATASETS_DIR ??
	"src/content/docs/logs/logpush/logpush-job/datasets";
const EXTRACTED_DIR = join(".tmp", "logpush-datasets");

const soft = process.argv.includes("--soft");
const force = process.argv.includes("--force");

const fail = (message: string): never => {
	if (soft) {
		console.warn(
			`Warning: ${message} - continuing with checked-in Logpush dataset pages`,
		);
		process.exit(0);
	}
	console.error(`Error: ${message}`);
	process.exit(1);
};

const archivePath = join(".tmp", ...ARCHIVE_DOT_TMP_PATH.split("/"));
if (!fs.existsSync(DATASETS_DIR) || !fs.statSync(DATASETS_DIR).isDirectory()) {
	fail(`Logpush dataset directory does not exist: ${DATASETS_DIR}`);
}
if (force) {
	fs.rmSync(archivePath, { force: true });
}

console.log("Fetching Logpush dataset pages from middlecache");

try {
	await downloadToDotTempIfNotPresent(
		`${MIDDLECACHE_BASE_URL}${ARCHIVE_MIDDLECACHE_PATH}`,
		ARCHIVE_DOT_TMP_PATH,
	);

	fs.rmSync(EXTRACTED_DIR, { recursive: true, force: true });
	await extractTarGz(archivePath, EXTRACTED_DIR);

	for (const scope of fs.readdirSync(EXTRACTED_DIR, { withFileTypes: true })) {
		if (!scope.isDirectory()) continue;

		const destination = join(DATASETS_DIR, scope.name);
		if (
			!fs.existsSync(destination) ||
			!fs.statSync(destination).isDirectory()
		) {
			console.log(`Skipping ${scope.name} scope: no destination directory`);
			continue;
		}

		for (const page of fs.readdirSync(destination)) {
			if (page.endsWith(".md")) {
				fs.rmSync(join(destination, page));
			}
		}
		fs.cpSync(join(EXTRACTED_DIR, scope.name), destination, {
			recursive: true,
		});
	}
	console.log("Logpush dataset pages ready");
} catch (err) {
	fail(`Logpush dataset fetch failed: ${(err as Error).message}`);
}

import { readdir, readFile } from "fs/promises";
import path from "path";
import { createInterface } from "readline/promises";

import { EpubBook } from "./epubBook.ts";
import "./logger.ts";

const rl = createInterface({
	input: process.stdin,
	output: process.stdout,
});

// Root directory to search for EPUB files (recursively)
let rootDirectory = process.argv[2] || (await rl.question("Root directory: "));

console.log(`Searching for EPUB files in ${rootDirectory}...`);

const allFiles = await readdir(rootDirectory, {
	withFileTypes: true,
	recursive: true,
});
for (const file of allFiles) {
	const name = file.name;
	if (file.isFile() && name.toLowerCase().endsWith(".epub")) {
		const fullPath = path.join(file.parentPath, file.name);
		console.log(`Processing ${name}...`);

		const data = await readFile(fullPath);
		const inputBlob = new Blob([data]);

		const epub = await EpubBook.processEPUB(inputBlob);

		if (!epub) {
			console.error(`Failed to process ${name}. Skipping.`);
		} else if (!epub.fixedProblems.length) {
			console.log(`No issues found in ${name}. Skipping.`);
		} else {
			// Replace original file
			await epub.writeEPUB(fullPath);

			console.log(
				`Fixed ${name} with the following problems: \n\t- ${epub.fixedProblems.join("\n\t- ")}`,
			);
		}
	}
}

console.log("\nDone processing all files.");
await rl.question("\nPress Enter to exit...");
rl.pause();

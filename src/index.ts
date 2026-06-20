import { readFile } from "fs/promises";
import { processEPUB } from "./epubProcessor.ts";
import { collectEpubFiles, saveEpubFile } from "./fileSystem.ts";
import "./logger.ts";

// Root directory to search for EPUB files (recursively)
const rootDirectory = "A:\\Books";

const epubFiles = await collectEpubFiles(rootDirectory);

for (const file of epubFiles) {
	const data = await readFile(file.path);
	const inputBlob = new Blob([data]);
	const epub = await processEPUB(inputBlob, file.name);
	if (epub) {
		if (epub.fixedProblems.length > 0) {
			// Write EPUB
			console.log(
				`Fixed ${file.name} with the following problems: ${epub.fixedProblems.join(", ")}`,
			);
			const outPath = await saveEpubFile(file, epub);
			console.log(`Wrote fixed EPUB: ${outPath}`);
		} else {
			console.log(`No issues found in ${file.name}.`);
		}
	} else {
		console.error(`Failed to process ${file.name}.`);
	}
}

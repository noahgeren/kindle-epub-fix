import { EpubBook } from "./epubBook.js";

export async function processEPUB(
	inputBlob: Blob,
	name: string,
): Promise<Blob | null> {
	try {
		// Load EPUB
		const epub = new EpubBook();
		await epub.readEPUB(inputBlob);

		// Run fixing procedure
		epub.fixBodyIdLink();
		epub.fixBookLanguage();
		epub.fixStrayIMG();
		epub.fixEncoding();

		// Write EPUB
		const blob = await epub.writeEPUB();

		if (epub.fixedProblems.length > 0) {
			console.log(
				`Fixed ${name} with the following problems: ${epub.fixedProblems.join(", ")}`,
			);
		} else {
			console.log(`No issues found in ${name}.`);
		}

		return blob;
	} catch (e) {
		console.error(e);
		return null;
	}
}

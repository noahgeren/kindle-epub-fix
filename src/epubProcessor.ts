import { EpubBook } from "./epubBook.ts";

export async function processEPUB(
	inputBlob: Blob,
	name: string,
): Promise<EpubBook | null> {
	try {
		console.log(`Processing ${name}...`);
		// Load EPUB
		const epub = new EpubBook();
		await epub.readEPUB(inputBlob);

		// Run fixing procedure
		epub.fixBodyIdLink();
		epub.fixBookLanguage();
		epub.fixStrayIMG();
		epub.fixEncoding();

		return epub;
	} catch (e) {
		console.error(e);
		return null;
	}
}

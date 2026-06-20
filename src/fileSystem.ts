import { readdir, rename, writeFile } from "fs/promises";
import path from "path";
import { EpubBook } from "./epubBook.ts";

export const collectEpubFiles = async (
	dir: string,
): Promise<Array<{ path: string; name: string }>> => {
	const entries = await readdir(dir, { withFileTypes: true });
	const results: Array<{ path: string; name: string }> = [];
	for (const e of entries) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) {
			results.push(...(await collectEpubFiles(full)));
		} else if (e.isFile() && e.name.toLowerCase().endsWith(".epub")) {
			results.push({ path: full, name: e.name });
		}
	}
	return results;
};

export const saveEpubFile = async (
	file: { path: string; name: string },
	epub: EpubBook,
) => {
	const backupPath = `${file.path}.bak`;
	await rename(file.path, backupPath);

	const blob = await epub.writeEPUB();
	const array = await blob.arrayBuffer();

	const outPath = path.join(path.dirname(file.path), file.name);
	await writeFile(outPath, Buffer.from(array));
	return outPath;
};

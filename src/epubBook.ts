import {
	BlobReader,
	BlobWriter,
	TextReader,
	TextWriter,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipReader,
	ZipWriter,
} from "@zip.js/zip.js";
import { writeFile } from "fs/promises";
import { JSDOM } from "jsdom";
import { allowed_languages } from "./allowLanguages.ts";

export class EpubBook {
	fixedProblems: string[] = [];
	files: Record<string, string> = {};
	binary_files: Record<string, Uint8Array<ArrayBuffer>> = {};

	// Add UTF-8 encoding declaration if missing
	fixEncoding() {
		const encoding = '<?xml version="1.0" encoding="utf-8"?>';
		const regex =
			/^<\?xml\s+version=["'][\d.]+["']\s+encoding=["'][a-zA-Z\d-.]+["'].*?\?>/i;

		for (const filename in this.files) {
			const ext = filename.split(".").pop();
			if (ext === "html" || ext === "xhtml") {
				let html = this.files[filename];
				html = html.trimStart();
				if (!regex.test(html)) {
					html = encoding + "\n" + html;
					this.fixedProblems.push(
						`Fixed encoding for file ${filename}`,
					);
				}
				this.files[filename] = html;
			}
		}
	}

	// Fix linking to body ID showing up as unresolved hyperlink
	fixBodyIdLink() {
		const basename = (path: string) => {
			return path.split("/").pop();
		};
		const bodyIDList: [string, string | undefined][] = [];

		// Create list of ID tag of <body>
		for (const filename in this.files) {
			const ext = filename.split(".").pop();
			if (ext === "html" || ext === "xhtml") {
				let html = this.files[filename];
				const { document: dom } = new JSDOM(html).window;
				const bodyID = dom.getElementsByTagName("body")[0].id;
				if (bodyID.length > 0) {
					const linkTarget = basename(filename) + "#" + bodyID;
					bodyIDList.push([linkTarget, basename(filename)]);
				}
			}
		}

		// Replace all
		for (const filename in this.files) {
			for (const [src, target] of bodyIDList) {
				if (
					src != null &&
					target != null &&
					this.files[filename].includes(src)
				) {
					this.files[filename] = this.files[filename].replaceAll(
						src,
						target,
					);
					this.fixedProblems.push(
						`Replaced link target ${src} with ${target} in file ${filename}.`,
					);
				}
			}
		}
	}

	// Fix language field not defined or not available
	fixBookLanguage() {
		// Find OPF file
		if (!("META-INF/container.xml" in this.files)) {
			console.error("Cannot find META-INF/container.xml");
			return;
		}
		const meta_inf_str = this.files["META-INF/container.xml"];
		const { document: meta_inf } = new JSDOM(meta_inf_str, {
			contentType: "text/xml",
		}).window;
		let opf_filename: string | null = "";
		for (const rootfile of meta_inf.getElementsByTagName("rootfile")) {
			if (
				rootfile.getAttribute("media-type") ===
				"application/oebps-package+xml"
			) {
				opf_filename = rootfile.getAttribute("full-path");
			}
		}

		// Read OPF file
		if (!opf_filename || !(opf_filename in this.files)) {
			console.error("Cannot find OPF file!");
			return;
		}

		const opf_str = this.files[opf_filename];
		try {
			const opf = new JSDOM(opf_str, {
				contentType: "text/xml",
			});
			const language_tags =
				opf.window.document.getElementsByTagName("dc:language");
			let language = "en";
			let original_language = "undefined";
			if (language_tags.length === 0) {
				language = "en";
			} else {
				language = language_tags[0].innerHTML;
				original_language = language;
			}
			if (
				!allowed_languages.includes(
					language.split("-").shift()!.toLowerCase(),
				)
			) {
				language = "en";
			}
			if (language_tags.length === 0) {
				const language_tag =
					opf.window.document.createElement("dc:language");
				language_tag.innerHTML = language;
				opf.window.document
					.getElementsByTagName("metadata")[0]
					.appendChild(language_tag);
			} else {
				language_tags[0].innerHTML = language;
			}
			if (language !== original_language) {
				this.files[opf_filename] = opf.serialize();
				this.fixedProblems.push(
					`Change document language from ${original_language} to ${language}.`,
				);
			}
		} catch (e) {
			console.error(e);
			console.error("Error trying to parse OPF file as XML.");
		}
	}

	fixStrayIMG() {
		for (const filename in this.files) {
			const ext = filename.split(".").pop();
			if (ext === "html" || ext === "xhtml") {
				let html = new JSDOM(this.files[filename], {
					contentType:
						ext === "xhtml" ? "application/xhtml+xml" : "text/html",
				});
				let strayImg = [];
				for (const img of html.window.document.getElementsByTagName(
					"img",
				)) {
					if (!img.getAttribute("src")) {
						strayImg.push(img);
					}
				}
				if (strayImg.length > 0) {
					for (const img of strayImg) {
						img.parentElement?.removeChild(img);
					}
					this.fixedProblems.push(
						`Remove stray image tag(s) in ${filename}`,
					);
					this.files[filename] = html.serialize();
				}
			}
		}
	}

	async readEPUB(blob: Blob) {
		const reader = new ZipReader(new BlobReader(blob));
		const entries = await reader.getEntries();
		this.files = {};
		this.binary_files = {};
		for (const entry of entries) {
			if (entry.directory) {
				continue;
			}
			const filename = entry.filename;
			const ext = filename.split(".").pop();
			if (
				filename === "mimetype" ||
				[
					"html",
					"xhtml",
					"htm",
					"xml",
					"svg",
					"css",
					"opf",
					"ncx",
				].includes(ext ?? "")
			) {
				this.files[filename] = await entry.getData(
					new TextWriter("utf-8"),
				);
			} else {
				this.binary_files[filename] = await entry.getData(
					new Uint8ArrayWriter(),
				);
			}
		}
	}

	async writeEPUB(path: string): Promise<void> {
		const blobWriter = new BlobWriter("application/epub+zip");

		// EPUB Zip cannot have extra attributes, so no extended timestamp
		const writer = new ZipWriter(blobWriter, {
			extendedTimestamp: false,
		});

		// First write mimetype file
		if ("mimetype" in this.files) {
			await writer.add(
				"mimetype",
				new TextReader(this.files["mimetype"]),
				{ level: 0 },
			);
		}

		// Add text file
		for (const file in this.files) {
			if (file === "mimetype") {
				// We have already added mimetype file
				continue;
			}
			await writer.add(file, new TextReader(this.files[file]));
		}

		// Add binary file
		for (const file in this.binary_files) {
			await writer.add(
				file,
				new Uint8ArrayReader(this.binary_files[file]),
			);
		}

		// Finalize file
		await writer.close();
		const blob = await blobWriter.getData();
		const array = await blob.arrayBuffer();
		await writeFile(path, Buffer.from(array));
	}

	static async processEPUB(inputBlob: Blob): Promise<EpubBook | null> {
		try {
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
}

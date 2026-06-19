const TXT_PROCESSING = "Processing...";
const TXT_DONE = "Finished processing all files.";
const TXT_NO_ERROR =
	"No errors detected. Perhaps there are other errors?<br>Output file is available for download anyway.";
const TXT_SYS_ERROR = "The program encountered an internal error.";

const mainStatusDiv = document.getElementById("main_status");
const outputDiv = document.getElementById("output");
const btnDlAll = document.getElementById("btnDlAll");
const keepOriginalFilename = document.getElementById("keepOriginalFilename");

const filePicker = document.getElementById("file");

let filenames = [],
	fixedBlobs = [],
	dlfilenames = [];

function build_output_html(idx, status) {
	const statusDiv = document.createElement("div");
	const dlBtn = document.createElement("button");
	statusDiv.style.margin = "1em 0";
	dlBtn.style.margin = "1em 0";
	dlBtn.innerHTML = "Download";
	dlBtn.addEventListener("click", () => {
		saveAs(fixedBlobs[idx], dlfilenames[idx]);
	});

	let btn = false;

	if (status === TXT_NO_ERROR) {
		statusDiv.innerHTML = status;
		statusDiv.style.color = "blue";
		btn = true;
	} else if (status === TXT_SYS_ERROR) {
		statusDiv.innerHTML = status;
		statusDiv.style.color = "red";
		btn = false;
	} else {
		statusDiv.innerHTML = `<ul class="scroll">${status.map((x) => `<li>${x}</li>`).join("")}</ul>`;
		statusDiv.style.color = "green";
		btn = "block";
	}

	const section = document.createElement("section");
	section.style.margin = "2em 0";
	section.innerHTML = `<h3>${filenames[idx]}</h3>`;
	section.appendChild(statusDiv);
	if (btn) {
		section.appendChild(dlBtn);
	}

	return section;
}

function setMainStatus(type) {
	if (type === "") {
		mainStatusDiv.style.display = "none";
		mainStatusDiv.style.display = "none";
	} else {
		mainStatusDiv.style.display = "block";
		if (type === TXT_PROCESSING) {
			mainStatusDiv.innerHTML = type;
			mainStatusDiv.style.color = "blue";
		} else if (type === TXT_DONE) {
			mainStatusDiv.innerHTML = type;
			mainStatusDiv.style.color = "blue";
		}
	}
}

filePicker.addEventListener("change", async (e) => {
	const selectedFile = e.target.files[0];
	setMainStatus(TXT_PROCESSING);
	outputDiv.innerHTML = "";
	btnDlAll.style.display = "none";

	for (const file of e.target.files) {
		await processEPUB(file, file.name);
	}
	setMainStatus(TXT_DONE);

	if (e.target.files.length > 1) {
		btnDlAll.style.display = "block";
	}
});

async function processEPUB(inputBlob, name) {
	try {
		// Load EPUB
		const epub = new EPUBBook();
		await epub.readEPUB(inputBlob);

		// Run fixing procedure
		epub.fixBodyIdLink();
		epub.fixBookLanguage();
		epub.fixStrayIMG();
		epub.fixEncoding();

		// Write EPUB
		const blob = await epub.writeEPUB();
		const idx = filenames.length;
		filenames.push(name);
		fixedBlobs.push(blob);

		if (epub.fixedProblems.length > 0) {
			keepOriginalFilename.checked
				? dlfilenames.push(name)
				: dlfilenames.push("(fixed) " + name);
			outputDiv.appendChild(build_output_html(idx, epub.fixedProblems));
		} else {
			keepOriginalFilename.checked
				? dlfilenames.push(name)
				: dlfilenames.push("(repacked) " + name);
			outputDiv.appendChild(build_output_html(idx, TXT_NO_ERROR));
		}
	} catch (e) {
		console.error(e);
		const idx = filenames.length;
		filenames.push(name);
		while (fixedBlobs.length !== filenames.length) {
			fixedBlobs.push(null);
		}
		while (dlfilenames.length !== filenames.length) {
			dlfilenames.push(null);
		}
		outputDiv.appendChild(build_output_html(idx, TXT_SYS_ERROR));
	}
}

async function downloadAll() {
	const old = mainStatusDiv.innerHTML;
	mainStatusDiv.innerHTML = "Preparing download...";
	const blobWriter = new zip.BlobWriter("application/zip");
	const writer = new zip.ZipWriter(blobWriter, { extendedTimestamp: false });
	for (let i = 0; i < fixedBlobs.length; i++) {
		if (fixedBlobs[i])
			await writer.add(dlfilenames[i], new zip.BlobReader(fixedBlobs[i]));
	}
	await writer.close();
	const blob = blobWriter.getData();
	saveAs(blob, "fixed-epubs.zip");
	mainStatusDiv.innerHTML = old;
}

btnDlAll.addEventListener("click", downloadAll);

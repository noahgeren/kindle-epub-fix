// Lightweight logger that mirrors console.log and console.error to a file
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const logDir = path.resolve(process.cwd(), "logs");
if (!existsSync(logDir)) {
	try {
		mkdirSync(logDir, { recursive: true });
	} catch (e) {
		// If we can't create the directory, fall back to no-file logging
	}
}

const logPath = path.join(logDir, "app.log");

// Clear the log file at startup so each run begins with a fresh log
if (existsSync(logDir)) {
	try {
		writeFileSync(logPath, "", { encoding: "utf8" });
	} catch {
		// ignore write errors
	}
}

const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);

function safeStringify(value: unknown) {
	try {
		if (typeof value === "string") return value;
		if (value instanceof Error) {
			return value.stack || value.message;
		}
		return JSON.stringify(value);
	} catch {
		try {
			return String(value);
		} catch {
			return "[unserializable]";
		}
	}
}

function formatArgs(args: unknown[]) {
	return args.map((a) => safeStringify(a)).join(" ");
}

function writeToFile(level: "INFO" | "ERROR", args: unknown[]) {
	try {
		const line = `[${new Date().toISOString()}] [${level}] ${formatArgs(args)}\n`;
		appendFileSync(logPath, line, { encoding: "utf8" });
	} catch {
		// swallow file write errors to avoid interfering with app behavior
	}
}

console.log = (...args: unknown[]) => {
	originalLog(...args);
	writeToFile("INFO", args);
};

console.error = (...args: unknown[]) => {
	originalError(...args);
	writeToFile("ERROR", args);
};

export {};

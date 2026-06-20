// TODO: Search directory for Epub files
import inquirer from "inquirer";
import inquirerFileTreeSelection from "inquirer-file-tree-selection-prompt";

// Register the custom file tree plugin
inquirer.registerPrompt("file-tree-selection", inquirerFileTreeSelection);

const { selectedDirectory } = await inquirer.prompt([
	{
		type: "file-tree-selection",
		name: "selectedDirectory",
		message: "Choose a target directory:",
		onlyShowDir: true, // Strictly hides files, displaying only directories
		enableGoUpperDirectory: true, // Appends ".." to let users climb up the tree hierarchy
		root: "A:/", // Sets the starting directory boundary
	},
]);
console.log("Selected directory:", selectedDirectory);
// const files: File[] = [];
// for (const file of files) {
// 	const blob = await processEPUB(file, file.name);
// 	// TODO: Save blob as file
// }

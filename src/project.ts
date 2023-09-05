import MathBooster from "main";
import { ButtonComponent, Modal, TAbstractFile, TFile, TFolder } from "obsidian";
import { pathToBaseName } from "utils";

export class Project {
    name: string;

    constructor(public root: TAbstractFile, name?: string) {
        this.name = name ?? (root instanceof TFile ? root.basename : root.name);
    }
}

export type DumpedProject = { rootPath: string, name: string };

export class ProjectManager {
    plugin: MathBooster;
    projects: Map<TAbstractFile, Project>;
    dumped: DumpedProject[];

    constructor(plugin: MathBooster, dumped?: DumpedProject[]) {
        this.plugin = plugin;
        this.projects = new Map();
        this.dumped = dumped ?? [];

        this.plugin.registerEvent(
            this.plugin.app.vault.on("rename", (file, oldPath) => {
                const project = this.projects.get(file);
                const basename = pathToBaseName(oldPath);
                if (project?.name == basename) {
                    new ProjectRootRenameModal(this.plugin, project, oldPath).open();
                }
            })
        );
    }

    add(root: TAbstractFile, name?: string) {
        this.projects.set(root, new Project(root, name));
        const index = root instanceof TFile ? this.plugin.index.getNoteIndex(root)
            : root instanceof TFolder ? this.plugin.index.getNoteIndex(root)
                : undefined;
        if (index) {
            index.isProjectRoot = true;
        }
    }

    delete(root: TAbstractFile): boolean {
        const index = root instanceof TFile ? this.plugin.index.getNoteIndex(root)
            : root instanceof TFolder ? this.plugin.index.getNoteIndex(root)
                : undefined;
        if (index) {
            index.isProjectRoot = false;
        }
        return this.projects.delete(root);
    }

    isRoot(file: TFile | TFolder): boolean;
    isRoot(file: TAbstractFile): boolean | undefined {
        if (file instanceof TFile) {
            const index = this.plugin.index.getNoteIndex(file);
            return index.isProjectRoot;
        } else if (file instanceof TFolder) {
            const index = this.plugin.index.getFolderIndex(file);
            return index.isProjectRoot;
        }
    }

    /**
     * Return the project that `file` belongs to, if exists.
     * @param file 
     * @returns 
     */
    getProject(file: TAbstractFile): Project | null {
        let root: TAbstractFile | null = file;
        while (root) {
            if (root instanceof TFile || root instanceof TFolder) {
                if (this.isRoot(root)) {
                    break;
                }
            }
            root = root.parent;
        }
        if (root) {
            return this.projects.get(root) ?? null;
        }
        return null;
    }

    /**
     * Return the project that `file` belongs to, the parent-project that the project belongs to, and so on.
     * The first element of the returned array is the project that `file` directly belongs to.
     * @param file 
     * @returns 
     */
    getNestedProjects(file: TAbstractFile): Project[] {
        const projects = [];
        let project = this.getProject(file);
        while (project?.root.parent) {
            projects.push(project);
            project = this.getProject(project.root.parent);
        }
        return projects;
    }

    dump() {
        const dumped: DumpedProject[] = [];
        for (const project of this.projects.values()) {
            dumped.push({ rootPath: project.root.path, name: project.name });
        }
        return dumped;
    }

    load(dumped?: DumpedProject[]) {
        dumped = dumped ?? this.dumped;
        for (const { rootPath, name } of dumped) {
            const rootFile = this.plugin.app.vault.getAbstractFileByPath(rootPath);
            if (rootFile) {
                this.add(rootFile, name);
            }
        }
    }
}

export const makePrefixer = (plugin: MathBooster) => (sourceFile: TFile, targetFile: TFile): string | null => {
    const sourceProjects = plugin.projectManager.getNestedProjects(sourceFile);
    const targetProjects = plugin.projectManager.getNestedProjects(targetFile);
    if (targetProjects.length) {
        let prefix = "";
        for (let i = 0; i < targetProjects.length; i++) {
            if (sourceProjects[i]?.root == targetProjects[i].root) {
                break;
            }
            prefix = targetProjects[i].name + (i ? plugin.extraSettings.projectSep : "") + prefix
        }
        if (prefix) {
            prefix += plugin.extraSettings.projectInfix;
        }
        return prefix;
    }
    // targetFile doesn't belong to any project
    return null;
};


export class ProjectRootRenameModal extends Modal {
    newName: string;
    constructor(public plugin: MathBooster, public project: Project, public oldPath: string) {
        super(plugin.app);
        this.newName = this.project.root instanceof TFile ? this.project.root.basename : this.project.root.name;
    }

    onOpen(): void {
        let { contentEl } = this;
        contentEl.createEl("h3", {text: "Rename project?"});
        contentEl.createDiv({
            text: `The project "${this.project.name}" was named after its root ${this.oldPath}, but the root has been renamed ${this.project.root.path}. Do you want to rename the project \"${this.newName}\" accordingly?`
        });

        const buttonContainerEl = contentEl.createDiv({ cls: "math-booster-button-container" });
        new ButtonComponent(buttonContainerEl)
            .setButtonText("Rename")
            .setCta()
            .onClick(async () => {
                this.project.name = this.newName;
                this.close();
            })
        new ButtonComponent(buttonContainerEl)
            .setButtonText("Keep it")
            .onClick(() => {
                this.close();
            });

    }

    onClose(): void {
        let { contentEl } = this;
        contentEl.empty();
    }
}

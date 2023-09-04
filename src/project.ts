import MathBooster from "main";
import { App, TAbstractFile, TFile, TFolder } from "obsidian";

export class Project {
    name: string;

    constructor(public root: TAbstractFile, name?: string) {
        this.name = name ?? this.root.name;
    }
}


export class ProjectManager {
    plugin: MathBooster;
    projects: Map<TAbstractFile, Project>;

    constructor(plugin: MathBooster) {
        this.plugin = plugin;
        this.projects = new Map();
    }

    add(root: TAbstractFile, name?: string) {
        this.projects.set(root, new Project(root, name));
    }

    delete(root: TAbstractFile): boolean {
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

    dump() {
        const dumped: { rootPath: string, name: string }[] = [];
        for (const project of Object.values(this.projects)) {
            dumped.push({ rootPath: project.root.path, name: project.name });
        }
        return dumped;
    }

    static load(dumped: { rootPath: string, name: string }[], plugin: MathBooster): ProjectManager {
        const projectManager = new ProjectManager(plugin);
        for (const { rootPath, name } of dumped) {
            const rootFile = plugin.app.vault.getAbstractFileByPath(rootPath);
            if (rootFile) {
                projectManager.add(rootFile, name);
            }
        }
        return projectManager;
    }
}

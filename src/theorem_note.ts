import { App, TFile, MarkdownView } from 'obsidian';
import { Env, TheoremLikeEnv, ENVs, PROOF, SOLUTION, getTheoremLikeEnv } from './env';
import LanguageManager from './language';
import { linktext2TFile, getLinksAndEmbedsInFile, getCurrentMarkdown } from 'utils';


// export interface MathMetadata {
//     type: string;
//     number?: string | number;
//     title?: string;
//     label?: string;
//     parent?: TFile;
//     children?: TFile[];
//     lang?: string;
//     number_prefix?: string;
//     number_suffix?: string;
//     number_init?: number;
//     label_prefix?: string;
//     print?: Record<string, string>;
// }





// export class MathNote {
//     public file: TFile;
//     public metadata: MathMetadata;
//     public isTheoremLike: boolean; // true if this.metadata.type indicates a theorem-like env
//     public env: TheoremLikeEnv; // stored if this.isTheoremLike

//     constructor(public app: App, file?: TFile) {
//         this.app = app;
//         if (file) {
//             this.file = file;
//         } else {
//             this.file = getCurrentMarkdown(this.app);
//         }
//     }

//     async loadMetadata() {
//         await this.app.fileManager.processFrontMatter(
//             this.file,
//             (frontMatter: any) => {
//                 this.metadata = { type: '' };
//                 for (let key in frontMatter.math) {
//                     if (key == 'type') {
//                         try {
//                             this.env = getTheoremLikeEnv(key);
//                             this.isTheoremLike = true;
//                         } catch (err) {
//                             this.isTheoremLike = false;
//                         } finally {
//                             this.metadata.type = frontMatter.metadata.type;
//                         }
//                     } else if (key == 'parent') {
//                         let parent = frontMatter.math.parent;
//                         if (parent) {
//                             this.metadata.parent = linktext2TFile(this.app, parent);
//                         }
//                     } else if (key == 'print') {
//                         this.metadata.print = {};
//                         for (let envKey in frontMatter.math.print) {
//                             let env = getTheoremLikeEnv(envKey);
//                             let newPrintedName = frontMatter.math.print[envKey];
//                             this.metadata.print[env.id] = newPrintedName;
//                         }
//                     } else if (key == 'children') {
//                         this.metadata.children = [];
//                         let children = frontMatter.math.children;
//                         let childrenArray;
//                         if (Array.isArray(children)) {
//                             childrenArray = children;
//                         } else {
//                             childrenArray = [children];
//                         }
//                         for (let child of childrenArray) {
//                             this.metadata.children.push(
//                                 linktext2TFile(this.app, child)
//                             );
//                         }
//                     } else {
//                         // @ts-ignore
//                         this.metadata[key] = frontMatter.math[key];
//                     }
//                 }
//             }
//         );
//         if (this.isTheoremLike) {
//             this.env = getTheoremLikeEnv(this.metadata.type);
//         }
//     }

//     async buildChildren() {
//         if (!this.metadata) {
//             throw Error('Load metadata of parent before building children');
//         }
//         let childrenFiles = this.metadata.children;
//         if (childrenFiles) {
//             for (let childFile of childrenFiles) {
//                 let child = new MathNote(this.app, childFile);
//                 child.loadMetadata();
//             }
//         }
//     }
// }



// interface TheoremMetadata {
//     type: string,
//     number?: string | number,
//     title?: string,
//     label?: string,
//     parent?: TFile,
//     children?: TFile[],
//     lang?: string,
// }


// export class TheoremNote extends MathNote {
//     public metadata: TheoremMetadata;
//     public env: TheoremLikeEnv;
//     // public file: TFile;
//     // public app: App;

//     constructor(app: App, file?: TFile) {
//         super(app, file);
//     }

//     async loadMetadata(): Promise<void> {
//         await super.loadMetadata();

//     }

//     // async getMetadata() {
//     //     await this.app.fileManager.processFrontMatter(
//     //         this.file,
//     //         (frontMatter: any) => {
//     //             this.metadata = { type: frontMatter.theorem.type };
//     //             this.metadata.number = frontMatter.theorem.number;
//     //             this.metadata.title = frontMatter.theorem.title;
//     //             this.metadata.label = frontMatter.theorem.label;
//     //             this.metadata.lang = frontMatter.theorem.lang;
//     //             let parent = frontMatter.theorem.parent;
//     //             if (parent) {
//     //                 this.metadata.parent = linktext2TFile(this.app, parent);
//     //             }
//     //         }
//     //     );
//     //     this.env = getTheoremLikeEnv(this.metadata.type);
//     // }

//     getLatexLabel(): string {
//         return this.env.prefix + ':' + this.metadata.label;
//     }

//     // print() {
//     //     for (let k in this.metadata) {
//     //         let v = this.metadata[k];
//     //         console.log(k);
//     //         console.log(v);
//     //     }
//     // }

//     getOffset() {
//         if (this.metadata.parent) {
//             let links = getLinksAndEmbedsInFile(this.app, this.metadata.parent);
//             // let childrenPath = parentPage.file.outlinks.where(outlink => outlink.embed).path;
//             // let currentIndex = childrenPath.indexOf(currentPath);
//             // return currentIndex; // 0-origin
//         }
//     }


//     // numberTheorem(dv, currentPage, prefix = '', suffix = '', initIndex = 1) {
//     //     let offset = getTheoremIndex(dv, currentPage);
//     //     if (offset == -1) { // not embedded in parent; leave unnumbered
//     //         return '';
//     //     }
//     //     let currentIndex = initIndex + offset;
//     //     return `${prefix}${currentIndex}${suffix}`;
//     // }


//     // getTheoremCalloutTitle(dv, currentPage, prefix, suffix, initIndex) {
//     //     const info = currentPage.theorem;
//     //     const lang = LanguageManager.validate(info.lang);
//     //     const parentPage = dv.page(info.parent.path);
//     //     prefix = prefix ?? parentPage.theorem.number_prefix ?? '';
//     //     suffix = suffix ?? parentPage.theorem.number_suffix ?? '';
//     //     initIndex = initIndex ?? parentPage.theorem.number_init ?? 1;

//     //     if (!info.type) {
//     //         return "[Fill in the theorem properties in the frontmatter]";
//     //     }
//     //     env = getTheoremLikeEnv(info.type);
//     //     console.log(env);

//     //     calloutTitle = parentPage.theorem[env.prefix] ?? parentPage.theorem[env.env] ?? env.print[lang];

//     //     if (typeof info.number == "number") {
//     //         calloutTitle += ` ${info.number}`;
//     //     } else if (info.number == "auto" && info.parent) {
//     //         let numberStr = numberTheorem(dv, currentPage, prefix, suffix, initIndex);
//     //         if (numberStr) {
//     //             calloutTitle += ' ' + numberStr;
//     //         }
//     //     }

//     //     if (info.title) {
//     //         calloutTitle += (lang == 'ja') ? `（${info.title}）` : ` (${info.title})`
//     //     }

//     //     return calloutTitle;
//     // }


//     // getProofTitle(currentPage, title) {
//     //     if (title) {
//     //         return title;
//     //     }
//     //     const info = currentPage.theorem;
//     //     const lang = LanguageManager.validate(info.lang);
//     //     let printedName = "";
//     //     const env = getTheoremLikeEnv(info.type);
//     //     if (env.requires_proof) {
//     //         if (env.prefix == 'exr') {
//     //             printedName = SOLUTION.print[lang];
//     //         } else {
//     //             printedName = PROOF.print[lang];
//     //         }
//     //     }
//     //     return printedName;
//     // }
// }
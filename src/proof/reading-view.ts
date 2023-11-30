import MathBooster from "main";
import { App, MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from "obsidian";
import { resolveSettings } from "utils/plugin";
import { makeProofClasses, makeProofElement } from "./common";
import { renderMarkdown } from "utils/render";
import { Profile } from "settings/profile";

export const createProofProcessor = (plugin: MathBooster) => (element: HTMLElement, context: MarkdownPostProcessorContext) => {
    if (!plugin.extraSettings.enableProof) return;

    const { app } = plugin;

    const file = app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile)) return;

    const settings = resolveSettings(undefined, plugin, file);
    const codes = element.querySelectorAll<HTMLElement>("code");
    for (const code of codes) {
        const text = code.textContent;
        if (!text) continue;

        if (text.startsWith(settings.beginProof)) {
            const rest = text.slice(settings.beginProof.length);
            let displayMatch;
            if (!rest) {
                context.addChild(new ProofRenderer(app, plugin, code, "begin", file));
            } else if (displayMatch = rest.match(/^\[(.*)\]$/)) {
                const display = displayMatch[1];
                context.addChild(new ProofRenderer(app, plugin, code, "begin", file, display));
            }
        } else if (code.textContent == settings.endProof) {
            context.addChild(new ProofRenderer(app, plugin, code, "end", file));
        }
    }
};


function parseAtSignLink(codeEl: HTMLElement) {
    const next = codeEl.nextSibling;
    const afterNext = next?.nextSibling;
    const afterAfterNext = afterNext?.nextSibling;
    if (afterNext) {
        if (next.nodeType == Node.TEXT_NODE && next.textContent == "@"
            && afterNext instanceof HTMLElement && afterNext.matches("a.original-internal-link")
            && afterAfterNext instanceof HTMLElement && afterAfterNext.matches("a.mathLink-internal-link")) {
            return { atSign: next, links: [afterNext, afterAfterNext] };
        }
    }
}

export class ProofRenderer extends MarkdownRenderChild {
    atSignParseResult: { atSign: ChildNode, links: HTMLElement[] } | undefined;

    constructor(public app: App, public plugin: MathBooster, containerEl: HTMLElement, public which: "begin" | "end", public file: TFile, public display?: string) {
        super(containerEl);
        this.atSignParseResult = parseAtSignLink(this.containerEl);
    }

    onload(): void {
        this.update();
        this.registerEvent(
            this.plugin.indexManager.on("local-settings-updated", (file) => {
            // this.app.metadataCache.on("math-booster:local-settings-updated", (file) => {
                if (file == this.file) {
                    this.update();
                }
            })
        );
        this.registerEvent(
            this.plugin.indexManager.on("global-settings-updated", () => {
                this.update();
            })
        );
    }

    update(): void {
        const settings = resolveSettings(undefined, this.plugin, this.file);
        const profile = this.plugin.extraSettings.profiles[settings.profile];

        /**
         * `\begin{proof}`@[[<link to Theorem 1>]] => Proof of Theorem 1.
         */
        if (this.atSignParseResult) {
            const { atSign, links } = this.atSignParseResult;
            const newEl = createSpan({ cls: makeProofClasses(this.which, profile) });
            newEl.replaceChildren(profile.body.proof.linkedBeginPrefix, ...links, profile.body.proof.linkedBeginSuffix);
            this.containerEl.replaceWith(newEl);
            this.containerEl = newEl;
            atSign.textContent = "";
            return;
        }

        /**
         * `\begin{proof}[Foo.]` => Foo.
         */
        if (this.display) {
            this.renderDisplay(profile);
            return;
        }

        /**
         * `\begin{proof}` => Proof.
         */
        const newEl = makeProofElement(this.which, profile);
        this.containerEl.replaceWith(newEl);
        this.containerEl = newEl;
    }

    async renderDisplay(profile: Profile) {
        if (this.display) {
            const children = await renderMarkdown(this.display, this.file.path, this.plugin);
            if (children) {
                const el = createSpan({ cls: makeProofClasses(this.which, profile) });
                el.replaceChildren(...children);
                this.containerEl.replaceWith(el);
                this.containerEl = el;
            }
        }
    }
}


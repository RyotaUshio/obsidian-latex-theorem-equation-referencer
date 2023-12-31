import { DataviewQuerySearchCore, QueryType, SearchRange, WholeVaultTheoremEquationSearchCore } from 'search/core';

import LatexReferencer from "main";
import { App, EditorSuggestContext, MarkdownView, Setting, SuggestModal, TextAreaComponent } from "obsidian";
import { MathSearchCore, SuggestParent } from "./core";
import { MathBlock } from "index/typings/markdown";

export class MathSearchModal extends SuggestModal<MathBlock> implements SuggestParent {
    app: App;
    core: MathSearchCore;
    queryType: QueryType;
    range: SearchRange;
    dvQueryField: Setting;
    topEl: HTMLElement;

    constructor(public plugin: LatexReferencer) {
        super(plugin.app);
        this.app = plugin.app;
        this.core = new WholeVaultTheoremEquationSearchCore(this);
        this.core.setScope();
        this.setPlaceholder('Type here...');

        this.queryType = this.plugin.extraSettings.searchModalQueryType;
        this.range = this.plugin.extraSettings.searchModalRange;

        this.topEl = this.modalEl.createDiv({ cls: 'math-booster-modal-top' });
        this.modalEl.insertBefore(this.topEl, this.modalEl.firstChild)
        this.inputEl.addClass('math-booster-search-input');

        this.limit = this.plugin.extraSettings.suggestNumber;

        new Setting(this.topEl)
            .setName('Query type')
            .addDropdown((dropdown) => {
                dropdown.addOption('both', 'Theorems and equations')
                    .addOption('theorem', 'Theorems')
                    .addOption('equation', 'Equations');

                // recover the last state
                dropdown.setValue(this.plugin.extraSettings.searchModalQueryType)

                dropdown.onChange((value: QueryType) => {
                    this.queryType = value;
                    this.resetCore();
                    // @ts-ignore
                    this.onInput();

                    // remember the last state
                    this.plugin.extraSettings.searchModalQueryType = value;
                    this.plugin.saveSettings();
                })
            });

        new Setting(this.topEl)
            .setName('Search range')
            .addDropdown((dropdown) => {
                dropdown.addOption('vault', 'Vault')
                    .addOption('recent', 'Recent notes')
                    .addOption('active', 'Active note')
                    .addOption('dataview', 'Dataview query');

                // recover the last state
                dropdown.setValue(this.plugin.extraSettings.searchModalRange)
                dropdown.onChange((value: SearchRange) => {
                    this.range = value;
                    this.resetCore();
                    // @ts-ignore
                    this.onInput();

                    // remember the last state
                    this.plugin.extraSettings.searchModalRange = value;
                    this.plugin.saveSettings();
                })
            });

        this.dvQueryField = new Setting(this.topEl)
            .setName('Dataview query')
            .setDesc('Only LIST queries are supported.')
            .then(setting => {
                setting.controlEl.style.width = '60%';
            })
            .addTextArea((text) => {
                text.inputEl.addClass('math-booster-dv-query')
                text.inputEl.style.width = '100%';

                text.setValue(this.plugin.extraSettings.searchModalDvQuery) // recover the last state
                    .setPlaceholder('LIST ...')
                    .onChange((dvQuery) => {
                        if (this.core instanceof DataviewQuerySearchCore) {
                            this.core.dvQuery = dvQuery;
                            // @ts-ignore
                            this.onInput();

                            // remember the last state
                            this.plugin.extraSettings.searchModalDvQuery = dvQuery;
                            this.plugin.saveSettings();
                        }
                    })
            });

        this.modalEl.insertBefore(this.inputEl, this.modalEl.firstChild);

        this.resetCore();
    }

    resetCore() {
        const core = MathSearchCore.getCore(this);
        if (core) this.core = core;
        if (this.range === 'dataview') {
            if (!core) {
                this.dvQueryField.setDisabled(true);
                this.dvQueryField.setDesc('Retry after enabling Dataview.')
                    .then(setting => setting.descEl.style.color = '#ea5555');
            }
            this.dvQueryField.settingEl.show();
        }
        else this.dvQueryField.settingEl.hide();
    }

    get dvQuery(): string {
        return (this.dvQueryField.components[0] as TextAreaComponent).getValue();
    }

    getContext(): Omit<EditorSuggestContext, 'query'> | null {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return null;

        const start = view.editor.getCursor('from');
        const end = view.editor.getCursor('to');

        return { file: view.file, editor: view.editor, start, end }
    }

    getSelectedItem(): MathBlock {
        return this.chooser.values![this.chooser.selectedItem];
    };

    getSuggestions(query: string) {
        return this.core.getSuggestions(query);
    }

    renderSuggestion(value: MathBlock, el: HTMLElement) {
        this.core.renderSuggestion(value, el);
    }

    onChooseSuggestion(item: MathBlock, evt: MouseEvent | KeyboardEvent) {
        this.core.selectSuggestion(item, evt);
    }
}
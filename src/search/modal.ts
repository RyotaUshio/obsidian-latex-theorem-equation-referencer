import { ActiveNoteSearchCore, DataviewQuerySearchCore, QueryType, RecentNotesSearchCore, WholeVaultEquationSearchCore, WholeVaultTheoremEquationSearchCore, WholeVaultTheoremSearchCore } from 'search/core';
import * as Dataview from 'obsidian-dataview';

import MathBooster from "main";
import { App, EditorSuggestContext, MarkdownView, Notice, Setting, SuggestModal, TextAreaComponent } from "obsidian";
import { MathSearchCore, SuggestParent } from "./core";
import { MathBoosterBlock } from "index/typings/markdown";

type SearchRange = 'active' | 'vault' | 'recent' | 'dataview';

export class MathSearchModal extends SuggestModal<MathBoosterBlock> implements SuggestParent {
    app: App;
    core: MathSearchCore;
    queryType: QueryType;
    range: SearchRange;
    dvQueryField: Setting;
    topEl: HTMLElement;

    constructor(public plugin: MathBooster) {
        super(plugin.app);
        this.app = plugin.app;
        // @ts-ignore
        window['modal'] = this;
        this.core = new WholeVaultTheoremEquationSearchCore(this);
        this.core.setScope();

        this.queryType = 'both';
        this.range = 'vault';

        this.topEl = this.modalEl.createDiv({ cls: 'math-booster-modal-top' });
        this.modalEl.insertBefore(this.topEl, this.modalEl.firstChild)

        new Setting(this.topEl)
            .setName('Query type')
            .addDropdown((dropdown) => {
                dropdown.addOption('both', 'Theorems and equations');
                dropdown.addOption('theorem', 'Theorems');
                dropdown.addOption('equation', 'Equations');
                dropdown.onChange((value: QueryType) => {
                    this.queryType = value;
                    this.resetCore();
                })
            });

        new Setting(this.topEl)
            .setName('Search range')
            .addDropdown((dropdown) => {
                dropdown.addOption('vault', 'Vault');
                dropdown.addOption('recent', 'Recent notes');
                dropdown.addOption('active', 'Active note');
                if (Dataview.isPluginEnabled(this.app)) dropdown.addOption('dataview', 'Dataview query');
                dropdown.onChange((value: SearchRange) => {
                    this.range = value;
                    this.resetCore();
                })
            });

        this.dvQueryField = new Setting(this.topEl)
            .setName('Dataview query')
            .setDesc('Only LIST query is supported.')
            .addTextArea((text) => {
                text.setPlaceholder('LIST ...').onChange((dvQuery) => {
                    if (this.core instanceof DataviewQuerySearchCore) {
                        this.core.dvQuery = dvQuery;
                        // @ts-ignore
                        this.onInput();
                    }
                })
            });
        this.dvQueryField.settingEl.hide();
    }

    resetCore() {
        if (this.range === 'dataview') {
            const dv = Dataview.getAPI(this.app);
            if (!dv) {
                new Notice('Failed to access Dataview API.')
                return;
            }
            this.core = new DataviewQuerySearchCore(this, this.queryType, dv, (this.dvQueryField.components[0] as TextAreaComponent).getValue());
            this.dvQueryField.settingEl.show();
            return;
        }
        this.dvQueryField.settingEl.hide();
        if (this.range === 'vault') {
            if (this.queryType === 'both') this.core = new WholeVaultTheoremEquationSearchCore(this);
            else if (this.queryType === 'theorem') this.core = new WholeVaultTheoremSearchCore(this);
            else if (this.queryType === 'equation') this.core = new WholeVaultEquationSearchCore(this);
        } else if (this.range === 'recent') this.core = new RecentNotesSearchCore(this, this.queryType);
        else if (this.range === 'active') this.core = new ActiveNoteSearchCore(this, this.queryType);
    }

    getContext(): Omit<EditorSuggestContext, 'query'> | null {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return null;

        const start = view.editor.getCursor('from');
        const end = view.editor.getCursor('to');

        return { file: view.file, editor: view.editor, start, end }
    }

    getSelectedItem(): MathBoosterBlock {
        // @ts-ignore
        return this.chooser.values[this.chooser.selectedItem];
    };

    getSuggestions(query: string) {
        return this.core.getSuggestions(query);
    }

    renderSuggestion(value: MathBoosterBlock, el: HTMLElement) {
        this.core.renderSuggestion(value, el);
    }

    onChooseSuggestion(item: MathBoosterBlock, evt: MouseEvent | KeyboardEvent) {
        this.core.selectSuggestion(item, evt);
    }
}
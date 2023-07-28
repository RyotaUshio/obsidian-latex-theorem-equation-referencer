import { WorkspaceLeaf, ItemView, TextFileView } from 'obsidian';

export const VIEW_TYPE_EXAMPLE = "example-view";


export class ExampleView extends TextFileView {
    constructor(leaf: WorkspaceLeaf) {
      super(leaf);
    }

    clear() {

    }

    getViewData(): string {
        console.log(this.data);
        return this.data;
    }   
  
    getViewType() {
      return VIEW_TYPE_EXAMPLE;
    }
  
    getDisplayText() {
      return "Example view";
    }

    setViewData(data: string, clear: boolean): void {
        if (clear) {
            this.clear()
        }
        this.data = data;
    }
  
    async onOpen() {
      const container = this.containerEl.children[1];
      container.empty();
      container.createEl("h4", { text: "Example view" });
    }
  
    async onClose() {
      // Nothing to clean up.
    }
  }
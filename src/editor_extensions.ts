// import { CalloutContent } from './callout';
import { EditorView, WidgetType, Decoration, DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { Extension, RangeSetBuilder, StateField, Transaction } from "@codemirror/state"
import { readMathCalloutSettingsAndTitle, readMathCalloutTitle } from "smart_callouts";
import { Callout } from 'emulate_callouts';
import { MarkdownRenderer } from "obsidian";



export class MathCalloutWidget extends WidgetType {
    constructor(
        public calloutTitleInfo: {from: number, to: number, text: string}, 
        public calloutContentInfo: {from: number, to: number, text: string}[]
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        // Build the DOM structure for this widget instance.
        let callout = new Callout(
            document.createDiv(), 
            {type: "math", title: this.calloutTitleInfo.text}, 
            document.createDiv()
        );
        callout.onload();
        return callout.containerEl;
    }
}

type InfoType = {from: number, to: number, text: string};

type CalloutInfoType =
{ 
    calloutTitle: InfoType,
    calloutContent: InfoType[]
};



export const MathCalloutField = StateField.define<DecorationSet>({
	create(state): DecorationSet {
		return Decoration.none;
	},

	update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();

        let calloutInfos: CalloutInfoType[] = [];
        let calloutInfo: CalloutInfoType = {} as CalloutInfoType;

		syntaxTree(transaction.state).iterate({
			enter(node) {
                const line = transaction.state.doc.sliceString(node.from, node.to);
                if (node.type.name == "HyperMD-callout_HyperMD-quote_HyperMD-quote-1") {
                    if (calloutInfo) {
                        calloutInfos.push(calloutInfo);
                        calloutInfo = {} as CalloutInfoType;
                        calloutInfo["calloutContent"] = [];
                    }
                    const calloutParseResult = readMathCalloutSettingsAndTitle(line);
                    if (calloutParseResult) {
                        calloutInfo["calloutTitle"] = {from: node.from, to: node.to, text: calloutParseResult.title};
                    }
                } else if (node.type.name == "quote_quote-1" && calloutInfo["calloutTitle"] && node.from > calloutInfo["calloutTitle"].to) {
                    calloutInfo["calloutContent"].push({from: node.from, to: node.to, text: line});
                }
			},
		});

        if (calloutInfo) {
            calloutInfos.push(calloutInfo);
        }

        for (calloutInfo of calloutInfos) {
            // console.log("CI: ", calloutInfo);
            // builder.add(
            //     calloutInfo.calloutTitle.from, 
            //     calloutInfo.calloutContent[calloutInfo.calloutContent.length - 1].to, 
            //     Decoration.replace(
            //         {widget: new MathCalloutWidget(calloutInfo.calloutTitle, calloutInfo.calloutContent)}
            //     )
            //);
        }
		return builder.finish();
	},

	provide(field: StateField<DecorationSet>): Extension {
		return EditorView.decorations.from(field);
	},
});


// export class EmojiWidget extends WidgetType {
//     constructor(public title: string) {
//         super();
//     }

//     toDOM(view: EditorView): HTMLElement {
//         // Build the DOM structure for this widget instance.
//         const div = document.createElement("div");
//         div.innerText = "👉";
//         return div;
//     }
// }



export const emojiListField = StateField.define<DecorationSet>({
	create(state): DecorationSet {
		return Decoration.none;
	},

	update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();
		// DecorationSet = RangeSet<Decoration> なのでOK

		syntaxTree(transaction.state).iterate({
			enter(node) {
				console.log(`${node.type.name}: ${node.from}--${node.to}`);
				console.log("sliceString:", transaction.state.doc.sliceString(node.from, node.to));
				// if (node.type.name.contains("HyperMD-callout_HyperMD-quote_HyperMD-quote-1")) {
				// 	const line = transaction.state.doc.sliceString(node.from, node.to);
                //     let calloutInfo = readMathCalloutSettingsAndTitle(line);
                //     if (calloutInfo) {
                //         builder.add(
                //             node.from,
                //             node.to,
                //             Decoration.replace({
                //                 widget: 
                //             })
                //         );    
                //     }
				// }
			},
		});
		return builder.finish();
	},

	provide(field: StateField<DecorationSet>): Extension {
		return EditorView.decorations.from(field);
	},
});



export class MathCalloutWidget extends WidgetType {
    constructor(
        public calloutTitleInfo: {from: number, to: number, text: string}, 
        public calloutContentInfo: {from: number, to: number, text: string}[]
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        // Build the DOM structure for this widget instance.
        let callout = new Callout(
            document.createDiv(), 
            {type: "math", title: this.calloutTitleInfo.text}, 
            document.createDiv()
        );
        callout.onload();
        return callout.containerEl;
    }
}

type InfoType = {from: number, to: number, text: string};

type CalloutInfoType =
{ 
    calloutTitle: InfoType,
    calloutContent: InfoType[]
};



export const MathCalloutField = StateField.define<DecorationSet>({
	create(state): DecorationSet {
		return Decoration.none;
	},

	update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();

        let calloutInfos: CalloutInfoType[] = [];
        let calloutInfo: CalloutInfoType = {} as CalloutInfoType;

		syntaxTree(transaction.state).iterate({
			enter(node) {
                const line = transaction.state.doc.sliceString(node.from, node.to);
                if (node.type.name == "HyperMD-callout_HyperMD-quote_HyperMD-quote-1") {
                    if (calloutInfo) {
                        calloutInfos.push(calloutInfo);
                        calloutInfo = {} as CalloutInfoType;
                        calloutInfo["calloutContent"] = [];
                    }
                    const calloutParseResult = readMathCalloutSettingsAndTitle(line);
                    if (calloutParseResult) {
                        calloutInfo["calloutTitle"] = {from: node.from, to: node.to, text: calloutParseResult.title};
                    }
                } else if (node.type.name == "quote_quote-1" && calloutInfo["calloutTitle"] && node.from > calloutInfo["calloutTitle"].to) {
                    calloutInfo["calloutContent"].push({from: node.from, to: node.to, text: line});
                }
			},
		});

        if (calloutInfo) {
            calloutInfos.push(calloutInfo);
        }

        for (calloutInfo of calloutInfos) {
            // console.log("CI: ", calloutInfo);
            // builder.add(
            //     calloutInfo.calloutTitle.from, 
            //     calloutInfo.calloutContent[calloutInfo.calloutContent.length - 1].to, 
            //     Decoration.replace(
            //         {widget: new MathCalloutWidget(calloutInfo.calloutTitle, calloutInfo.calloutContent)}
            //     )
            //);
        }
		return builder.finish();
	},

	provide(field: StateField<DecorationSet>): Extension {
		return EditorView.decorations.from(field);
	},
});

type CalloutType = string;
type CalloutFoldType = "+" | "-";
type CalloutMetadata = Record<string, string>;
interface CalloutConfig {
    type: CalloutType;
    title?: string;
    fold?: CalloutFoldType;
    metadata?: CalloutMetadata;
};


function metadataToString(metadata: CalloutMetadata | undefined): string {
    let ret = "";
    if (metadata) {
        for (let k in metadata) {
            let v = metadata[k];
            ret += `${k}:${v}`;
        }
    }
    return ret;
}


export class Callout {
    title: CalloutTitle;
    content: CalloutContent;
    div: HTMLDivElement;
    fold?: CalloutFoldType;

    constructor(
        public containerEl: HTMLElement,
        config: CalloutConfig, 
        srcEl: HTMLElement, 
    ) {
        let classes = ["callout"];
        if (config.fold) {
            classes.push("is-collapsible");
            this.fold = config.fold;
        }
        this.div = createDiv({
            cls: classes,
            attr: {
                "data-callout-metadata": metadataToString(config.metadata),
                "data-callout-fold": (config.fold ?? "") as string,
                "data-callout": config.type,
            }
        });
        CalloutTitle.addTo(this, String(config.title), config.fold);
        CalloutContent.addTo(this, srcEl);

        this.title.div.addEventListener("click", () => {
            this.toggleFold();
        });
    }

    onload(): void {
        this.containerEl.replaceWith(this.div);
    }

    toggleFold() {
        if (this.fold) {
            console.log("toggleFold() if begins");
            this.content.div.setAttribute(
                "style", 
                this.isCollapsed() ? "" : "display: none;"
            );
            console.log("toggleFold() a");
            this.div.classList.toggle('is-collapsed');
            console.log("toggleFold() b");
            this.title.fold?.div.classList.toggle('is-collapsed');
            console.log("toggleFold() c");
        }
        console.log("toggleFold() ends");
    }

    isCollapsed(): boolean {
        return this.div.classList.contains('is-collapsed');
    }
}


export class CalloutTitle {
    public icon: CalloutIcon;
    public titleInner: CalloutTitleInner;
    fold?: CalloutFold;
    div: HTMLDivElement;
    callout: Callout; 

    static addTo(callout: Callout, titleString: string, fold?: "+" | "-") {
        let calloutTitle = new CalloutTitle();
        calloutTitle.callout = callout;
        calloutTitle.div = callout.div.createDiv({ cls: "callout-title" })
        CalloutIcon.addTo(calloutTitle);
        CalloutTitleInner.addTo(calloutTitle, titleString);
        if (fold) {
            CalloutFold.addTo(calloutTitle);
            // calloutTitle.div.onclick = calloutTitle.callout.toggleFold;
        }
        callout.title = calloutTitle;
        return calloutTitle;
    }
}


export class CalloutIcon {
    constructor(public div: HTMLDivElement) {
        this.setSvg();
    }

    static addTo(calloutTitle: CalloutTitle) {
        let div = calloutTitle.div.createDiv({ cls: "callout-icon" });
        let icon = new CalloutIcon(div);
        calloutTitle.icon = icon;
        return icon;
    }

    setSvg() {
        const iconName = "lucide-pencil";
        let svg = createSvg(
            'svg',
            {
                cls: ["svg-icon", iconName],
                attr: {
                    xmlns: "http://www.w3.org/2000/svg",
                    width: "24",
                    height: "24",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": "2",
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round",
                }
            }
        );

        svg.createSvg(
            'line',
            { attr: { x1: "18", y1: "2", x2: "22", y2: "6" } }
        );

        svg.createSvg(
            'path',
            { attr: { d: "M7.5 20.5 19 9l-4-4L3.5 16.5 2 22z" } }
        );
        this.div.appendChild(svg);
    }
}

export class CalloutTitleInner {
    constructor(public div: HTMLDivElement) { }

    static addTo(calloutTitle: CalloutTitle, titleString: string) {
        let titleInnerDiv = calloutTitle.div.createDiv({
            cls: "callout-title-inner",
            text: titleString,
        })
        let titleInner = new CalloutTitleInner(titleInnerDiv);
        calloutTitle.titleInner = titleInner;
        return titleInner
    }
}



export class CalloutFold {

    constructor(public div: HTMLDivElement) {
        this.setSvg();
    }

    static addTo(calloutTitle: CalloutTitle) {
        let div = calloutTitle.div.createDiv({ cls: "callout-fold" });
        let fold = new CalloutFold(div);
        calloutTitle.fold = fold;
        return fold;
    }



    setSvg() {
        let svg = createSvg(
            'svg',
            {
                cls: ["svg-icon", "lucide-chevron-down"],
                attr: {
                    xmlns: "http://www.w3.org/2000/svg",
                    width: "24",
                    height: "24",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": "2",
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round",
                }
            }
        );

        svg.createSvg(
            'polyline',
            { attr: { points: "6 9 12 15 18 9" } }
        );

        this.div.appendChild(svg);
    }

}


export class CalloutContent {
    constructor(public div: HTMLDivElement, public callout: Callout) { }

    static addTo(callout: Callout, srcEl: HTMLElement) {
        let div = callout.div.createDiv({ cls: "callout-content" });
        div.innerHTML = srcEl.innerHTML;
        let calloutContent = new CalloutContent(div, callout);
        callout.content = calloutContent;
        return calloutContent;
    }
}
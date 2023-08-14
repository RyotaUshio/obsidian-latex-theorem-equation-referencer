# Generate styles.css

from pathlib import Path
import textwrap

if __name__ == "__main__":
    source = Path("./styles")
    target = Path("./styles.css")

    lines = []
    for source_style in source.glob("*.css"):
        with open(source_style) as f:
            for line in f:
                if line.lstrip().startswith('.math-callout'):
                    if line.lstrip().startswith('.math-callout-subtitle'):
                        line = f'.math-callout-{source_style.stem}' + ' ' + line    
                    else:
                        line = f'.math-callout-{source_style.stem}' + line
                lines.append(line)

    with open(target, 'w') as f:
        f.write(
            textwrap.dedent("""
            /* This file is auto-generated. Do not edit it. */
                            
            .math-booster-preview {
                cursor: text;
            }
                            
            .cm-embed-block {
                position: relative;
            }

            .cm-embed-block .math-booster-preview-edit-button {
                padding: var(--size-2-2) var(--size-2-3);
                position: absolute;
                right: var(--size-2-2);
                top: var(--size-2-2);
                opacity: 0;
                display: flex;
                border-radius: var(--radius-s);
            }           
                            
            .cm-embed-block:hover .math-booster-preview-edit-button {
                transition: 0s;
                opacity: 1
            }

            /* Unlike in callouts, Obsidian natively renders MathJax in blockquotes. But it is rather buggy 
            (see https://forum.obsidian.md/t/live-preview-support-math-block-in-quotes/32564/2), 
            so we need to replace it with this plugin's editor extension. */
            .cm-line .math.math-block.cm-embed-block:has(> mjx-container.MathJax:not(.math-booster-preview) > mjx-math[display="true"]) {
                display: none;
            }
                            
            .math-callout {
                position: relative;
            }
                            
            .math-callout-setting-button {
                padding-bottom: var(--size-2-2);
                padding-right: var(--size-2-3);
                position: absolute;
                right: var(--size-2-2);
                bottom: var(--size-2-2);
                opacity: 0;
            }
            
            .math-callout:hover .math-callout-setting-button {
                transition: 0s;
                opacity: 1
            }

            """)
            + ''.join(lines)
            + textwrap.dedent(
            """
            .font-family-inherit {
                font-family: inherit !important;
            }
            """)
        )

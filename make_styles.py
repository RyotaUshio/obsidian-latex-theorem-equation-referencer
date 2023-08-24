"""Generate styles.css from styles/*.css.

Each of CSS files other than styles_main.css defines a preset style, and 
styles_main.css defines other styles needed for this plugin.
"""

from pathlib import Path

if __name__ == "__main__":
    source = Path("./styles")
    main = Path("./styles/styles_main.css")
    target = Path("./styles.css")

    assert main.exists()

    lines = []
    for source_style in source.glob("*.css"):
        if source_style == main:
            continue

        # preset styles
        with open(source_style) as f:
            for line in f:
                if line.lstrip().startswith('.theorem-callout'):
                    if line.lstrip().startswith('.theorem-callout-subtitle'):
                        line = f'.theorem-callout-{source_style.stem}' + ' ' + line    
                    else:
                        line = f'.theorem-callout-{source_style.stem}' + line
                lines.append(line)
        lines.append("\n")

    with open(main) as f:
        main_content = f.read()

    with open(target, 'w') as f:
        f.write(
            "/* This file is auto-generated. Do not edit it. */\n\n"
            + main_content + "\n"
            + ''.join(lines)
        )

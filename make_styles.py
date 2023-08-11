# Generate styles.css containing sample styles in the documentation's styles gallery

from pathlib import Path

if __name__ == "__main__":
    source = Path("./styles")
    target = Path("./styles.css")

    lines = []
    for source_style in source.iterdir():
        with open(source_style) as f:
            for line in f:
                if line.lstrip().startswith('.math-callout'):
                    if line.lstrip().startswith('.math-callout-subtitle'):
                        line = f'.math-callout-{source_style.stem}' + ' ' + line    
                    else:
                        line = f'.math-callout-{source_style.stem}' + line
                lines.append(line)

    with open(target, 'w') as f:
        f.writelines(lines + [".font-family-inherit {\n    font-family: inherit !important;\n}\n"])

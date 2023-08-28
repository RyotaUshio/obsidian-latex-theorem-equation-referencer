---
layout: page
title: Importing from LaTeX
---

## Troubleshooting

Pandoc cannot recognize a proof environment if it is overwritten like this:

```latex
\newenvironment{proof}{\noindent{\bf Proof:}}{\hfill\rule{7pt}{7pt}\medskip}
```

To avoid problems, this kind of line must be commented out.

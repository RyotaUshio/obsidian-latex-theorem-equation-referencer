#!/usr/bin/env python

import panflute as pf
import json
import re
import random
from typing import Callable

ENVS = [
    "axiom",
    "definition",
    "lemma",
    "proposition",
    "theorem",
    "corollary",
    "claim",
    "assumption",
    "example",
    "exercise",
    "conjecture",
    "hypothesis",
    "remark",
]

PROFILES = {
    "English": {
        "id": "English",
        "meta": {
            "tags": ["en"],
        },
        "body": {
            "theorem": {
                "axiom": "Axiom",
                "definition": "Definition",
                "lemma": "Lemma",
                "proposition": "Proposition",
                "theorem": "Theorem",
                "corollary": "Corollary",
                "claim": "Claim",
                "assumption": "Assumption",
                "example": "Example",
                "exercise": "Exercise",
                "conjecture": "Conjecture",
                "hypothesis": "Hypothesis",
                "remark": "Remark",
            },
            "proof": {
                "begin": "Proof.",
                "end": "□",
                "linkedBeginPrefix": "Proof of ",
                "linkedBeginSuffix": ".",                
            },
        },
    },
    "日本語": {
        "id": "日本語",
        "meta": {
            "tags": ["ja"],
        },
        "body": {
            "theorem": {
                "axiom": "公理",
                "definition": "定義",
                "lemma": "補題",
                "proposition": "命題",
                "theorem": "定理",
                "corollary": "系",
                "claim": "主張",
                "assumption": "仮定",
                "example": "例",
                "exercise": "演習問題",
                "conjecture": "予想",
                "hypothesis": "仮説",
                "remark": "注",
            },
            "proof": {
                "begin": "証明.",
                "end": "□",
                "linkedBeginPrefix": "",
                "linkedBeginSuffix": "の証明.",
            },
        },
    },
}

KEYWORDS = []
for profile in PROFILES.values():
    KEYWORDS.extend(profile['body']['theorem'].values())


def strip(elem: pf.Element):
    if elem.content:
        for i, child in enumerate(elem.content):
            if not isinstance(child, pf.Space):
                break

        for j, child in enumerate(elem.content[::-1]):
            if not isinstance(child, pf.Space):
                break

        elem.content = elem.content[i : len(elem.content) - j]


def is_str_st(elem: pf.Element, f: Callable):
    return isinstance(elem, pf.Str) and f(elem.text)


def parseTheoremCalloutSettings(elem: pf.Element, doc: pf.Doc, auto_number: bool):
    if isinstance(elem, pf.Para) and elem.prev is None and elem.content:
        if isinstance(elem.content[0], pf.Strong):
            """
            elem.content[0]: **Theorem 1**
            """
            altered = None
            formated_title = elem.content[0].content
            if len(formated_title) >= 3 and isinstance(formated_title[-1], pf.Str):
                doc.theorem_callout_settings[-1]["number"] = (
                    "auto" if auto_number else formated_title[-1].text
                )

            if len(elem.content) >= 2:
                for i, child in enumerate(elem.content):
                    if isinstance(child, pf.Space) and isinstance(child.next, pf.Space):
                        if isinstance(elem.content[1], pf.Space):
                            assert i >= 3
                            """
                            0             : e.g. **Theorem 1**
                            1             : Space
                            2 , ..., i - 1: Theorem subtitle. e.g. "(Hoeffding's inequality)."
                            i             : Space
                            i + 1         : Space
                            i + 2, ...    : Content of theorem
                            """
                            title = pf.stringify(elem.content[2 : i + 1])
                            match = re.match(r"\((.*)\)\.?", title.strip())
                            if match:
                                doc.theorem_callout_settings[-1]["title"] = match.groups()[0]
                            
                        else:
                            assert i == 2
                            """
                            0              : e.g. **Theorem 1**
                            1              : "."
                            i = 2          : Space
                            i + 1 = 3      : Space
                            i + 2 = 4, ... : Content of theorem
                            """
                        altered = pf.Para(*elem.content[i + 2 :])
                        break
            else:
                altered = pf.Para(*elem.content[1:])

            if altered is not None:
                strip(altered)
                # Remove italic style applying the whole theorem content.
                # Such styling should not be hard-coded. It should be done by CSS instead.
                if len(altered.content) == 1 and isinstance(
                    altered.content[0], pf.Emph
                ):
                    altered = pf.Para(*altered.content[0].content)

            return altered


def format(string: str):
    return string.replace("\u2018", "'").replace("\u2019", "'")


def convert_theorem_callout(elem: pf.Element, doc: pf.Doc, auto_number: bool):
    if isinstance(elem, pf.Div):
        theorem_type = [cls for cls in elem.classes if cls in ENVS]
        if theorem_type:
            doc.theorem_callout_settings.append(
                {"type": theorem_type[0], "label": elem.identifier}
            )
            content = elem.content.walk(
                lambda elem, doc: parseTheoremCalloutSettings(elem, doc, auto_number)
            )

            settings = doc.theorem_callout_settings[-1]

            for k, v in settings.items():
                settings[k] = format(v)
            
            return make_callout(type='math', metadata=json.dumps(settings), content=content)

def convert_proof(elem: pf.Element, doc: pf.Doc):
    if isinstance(elem, pf.Div) and 'proof' in elem.classes:
        first = elem.content[0]
        last = elem.content[-1]
        if isinstance(first, pf.Para) and len(first.content) >= 3 and isinstance(first.content[1], pf.Space) and isinstance(first.content[0], pf.Emph):
            for child in first.content[0].content:
                if isinstance(child, pf.Link):
                    first.content = [pf.Code('\\begin{proof}'), pf.Str('@'), child, pf.Space()] + list(first.content[2:])
                    break
            else:
                begin_proof_text = pf.stringify(first.content[0])
                if begin_proof_text == 'Proof.':
                    first.content = [pf.Code('\\begin{proof}'), pf.Space()] + list(first.content[2:])
                else:
                    first.content = [pf.Code('\\begin{proof}[' + begin_proof_text + ']'), pf.Space()] + list(first.content[2:])
            
        if isinstance(last, pf.Para) and len(last.content) >= 2:
            last.content = list(last.content[:-1]) + [pf.Space(), pf.Code('\\end{proof}')]

        return list(elem.content)

def display_math_spacing(elem: pf.Element, doc: pf.Doc):
    if isinstance(elem, pf.Para):
        paras = []
        display_math_spacing_impl(elem.content, paras)
        return paras

def display_math_spacing_impl(content: pf.ListContainer, paras: list):
    if not content:
        return 
    display_math_index = None
    for i, child in enumerate(content):
        if isinstance(child, pf.Math) and child.format == 'DisplayMath':
            display_math_index = i
            break
    if display_math_index is None:
        paras.append(pf.Para(*content))
    else:
        text = content[display_math_index].text
        if not text.startswith('\n'):
            text = '\n' + text
        if not text.endswith('\n'):
            text = text + '\n'
        paras.extend([
            pf.Para(*content[:display_math_index]), 
            pf.Para(pf.Math(text=text, format='DisplayMath'))
        ])
    return display_math_spacing_impl(content[i + 1:], paras)

def aligned_to_align(elem: pf.Element, doc: pf.Doc):
    if isinstance(elem, pf.Math) and elem.format == 'DisplayMath':
        elem.text = re.sub(r'\\(begin|end)\{(aligned)\}', r'\\\1{align}', elem.text)

def remove_line_break_in_inline_math(elem: pf.Element, doc: pf.Doc):
    if isinstance(elem, pf.Math) and elem.format == 'InlineMath':
        return pf.Math(' '.join(map(remove_comment, elem.text.split('\n'))).strip(), 'InlineMath')
    
def remove_comment(line: str, start: int=0):
    begin_comment = line.find('%', start)
    if begin_comment == -1:
        return line
    if begin_comment >= 1 and line[begin_comment - 1] == '\\':
        # escaped '%'
        return remove_comment(line, begin_comment + 1)
    return line[:begin_comment]

def is_label_span(elem: pf.Element):
    if not isinstance(elem, pf.Span):
        return False
    if elem.content:
        return False
    if not hasattr(elem, 'identifier') or not hasattr(elem, 'attributes'):
        return False
    return elem.identifier == elem.attributes.get('label') != None

def process_label_span(elem: pf.Element, doc: pf.Doc, identifiers: list):
    if is_label_span(elem):
        identifiers.append(elem.identifier)
        e = elem
        while not isinstance(e.parent, pf.Doc):
            e = e.parent
        return []
    
def preprocess_label_in_math(elem: pf.Element, doc: pf.Doc, identifiers: list):
    if isinstance(elem, pf.Math) and elem.format == 'DisplayMath':
        for match in reversed(list(re.finditer(r'\\label\{(.*?)\}', elem.text))):
            label = match.groups()[0]
            identifiers.append(label)
            begin, end = match.span()
            elem.text = elem.text[:begin] + " " + elem.text[end:]


def preprocess_link(elem: pf.Element, doc: pf.Doc):
    if isinstance(elem.parent, pf.Doc):
        identifiers = []
        elem.walk(lambda elem, doc: process_label_span(elem, doc, identifiers))
        elem.walk(lambda elem, doc: preprocess_label_in_math(elem, doc, identifiers))

        if hasattr(elem, 'identifier'):
            identifiers.append(elem.identifier)

        if identifiers:
            if isinstance(elem, pf.Header):
                for identifier in identifiers:            
                    doc.links[identifier.replace('\n', ' ')] = pf.stringify(elem)
                return pf.Header(*elem.content, level=elem.level) # remove identifier, attributes, classes
            else:
                id = generate_block_id()
                for identifier in identifiers:
                    doc.links[identifier.replace('\n', ' ')] = '^' + id
                    # insert block ID
                return [elem, pf.RawBlock(doc.links[identifier], 'markdown')]
        

def make_wikilink(elem: pf.Link, doc: pf.Doc):
    assert isinstance(elem, pf.Link)
    identifier = elem.attributes.get('reference')
    if identifier:
        identifier.replace('\n', ' ')
        link = doc.links.get(identifier)
        if link is not None:
            link = f'[[#{link}]]'
            return pf.RawInline(link, 'markdown')

            
def process_link(elem: pf.Element, doc: pf.Doc):
    if isinstance(elem, pf.Link):
        another = elem.prev

        # case 1: Theorem [[link]] => [[link]]
        neighbors = []
        added_to_be_removed = False
        while another:
            neighbors.append(another)
            if isinstance(another, pf.Str) and another.text in KEYWORDS:
                doc.to_be_removed.extend(neighbors)
                added_to_be_removed = True
                break
            if not isinstance(another, (pf.Space, pf.SoftBreak)):
                break
            another = another.prev

        # case 2: ([[link]]) => [[link]]
        if not added_to_be_removed:
            if is_str_st(elem.prev, lambda s: s.endswith('(')) and is_str_st(elem.next, lambda s: s.startswith(')')):
                elem.prev.text = elem.prev.text[:-1]
                elem.next.text = elem.next.text[1:]

        return make_wikilink(elem, doc)
    
def generate_block_id(length: int=6):
    return f'{random.randrange(16**length):0{length}x}'

def cleanup(elem: pf.Element, doc: pf.Doc):
    for removed in doc.to_be_removed:
        if elem is removed: # DON'T DO "if elem == removed"!!!
            return []
        
def make_callout(*, content: pf.ListContainer, type: str='NOTE', title: str=None, metadata: str=None):
    return pf.BlockQuote(
        pf.RawBlock(f'[!{type}{"|" + metadata if metadata else ""}] {title if title else ""}', 'markdown'),
        *content
    )

def remove_soft_breaks(elem: pf.Element, doc: pf.Doc):
    if isinstance(elem, pf.SoftBreak):
        return pf.Space()
    
def bib(elem: pf.Element, doc: pf.Doc):
    if isinstance(elem, pf.Div) and 'thebibliography' in elem.classes:
        return [pf.Header(pf.Str('References')), *elem.content[1:]]

def prepare(doc: pf.Doc):
    # abstract = doc.metadata['abstract']
    # if abstract:
    #     doc.content.insert(0, make_callout(type='ABSTRACT', content=abstract.content))
    doc.theorem_callout_settings = []
    doc.links = {} # look-up table of the form {label/identifier: linktext, ...}
    doc.to_be_removed = []

def finalize(doc: pf.Doc):
    # doc.metadata = {}
    del doc.theorem_callout_settings
    del doc.links
    del doc.to_be_removed

def main(doc: pf.Doc=None):
    auto_number = False
    pf.run_filters(
        [
            remove_soft_breaks,
            bib,
            display_math_spacing,
            convert_proof,
            preprocess_link,
            process_link,
            remove_line_break_in_inline_math,
            lambda elem, doc: convert_theorem_callout(elem, doc, auto_number),
            display_math_spacing,
            aligned_to_align,
            cleanup
        ],
        doc=doc,
        prepare=prepare,
        finalize=finalize,
    )


if __name__ == "__main__":
    main()

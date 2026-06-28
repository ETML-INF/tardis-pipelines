# -*- coding: utf-8 -*-
from docutils import nodes
from docutils.parsers.rst import Directive, directives
import re
import json
import html as html_mod

try:
    from markdown_it import MarkdownIt as _MarkdownIt
    _md = _MarkdownIt().enable("table")
except ImportError:
    _md = None

HOLE_RE = re.compile(r'\[___\]')

# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------

def slugify(s: str) -> str:
    s = re.sub(r"\s+", "-", s.strip())
    s = re.sub(r"[^a-zA-Z0-9._\-]", "-", s)
    return s

def is_code_lang(lang: str) -> bool:
    if not lang:
        return False
    lang = lang.strip().lower()
    codey = {
        "code", "shell", "bash", "sh", "zsh", "powershell",
        "python", "py", "javascript", "js", "typescript", "ts",
        "c", "cpp", "c++", "java", "go", "rust",
        "sql", "yaml", "json", "dockerfile", "makefile",
        "text/x-csharp", "csharp", "cs",
    }
    return lang in codey

# ---------------------------------------------------------------------------
# Nœuds Docutils
# ---------------------------------------------------------------------------

class answer_node(nodes.General, nodes.Element):
    pass

class export_answers_node(nodes.General, nodes.Element):
    pass

class qcm_answer_node(nodes.General, nodes.Element):
    pass

class hole_answer_node(nodes.General, nodes.Element):
    pass

# ---------------------------------------------------------------------------
# Directives
# ---------------------------------------------------------------------------

class AnswerBlockDirective(Directive):
    """
    Usage (MyST) — inchangé côté auteur :
    ```{answer} E-182-ALL01-ids-q1
    :label: Décrivez les étapes d'un IDS
    :lang: shell
    :lines: 8           # optionnel (défaut 6)
    ```
    - Argument (optionnel) = id stable (recommandé).
    - :label: (optionnel) — libellé descriptif.
    - :lang:  (optionnel) — p.ex. shell|powershell|javascript|text/x-csharp|...
    - :lines: (optionnel) — hauteur de la zone (défaut 6).
    """
    required_arguments = 0
    optional_arguments = 1
    has_content = False
    option_spec = {
        "label": directives.unchanged,
        "lang": directives.unchanged,
        "lines": directives.nonnegative_int,
    }

    def run(self):
        env = getattr(self.state.document.settings, "env", None)
        docname = env.docname if env else "page"
        data_id = self.arguments[0] if self.arguments else ""
        if not data_id:
            data_id = slugify(f"{docname}-answer-L{self.lineno}")

        label = self.options.get("label", "")
        lang  = self.options.get("lang", "")
        lines = self.options.get("lines", 6)

        node = answer_node()
        node["data_id"] = data_id
        node["label"]   = label
        node["lang"]    = lang
        node["lines"]   = lines
        return [node]


class ExportAnswersDirective(Directive):
    """Bouton HTML pour exporter les réponses; ignoré en PDF."""
    has_content = False
    option_spec = {}
    def run(self):
        return [export_answers_node()]


class QcmAnswerDirective(Directive):
    """
    QCM exportable sans correction — les coches sont incluses dans l'export.

    Usage (MyST) :
    ```{qcm-answer} id-optionnel
    :label: C1. Un switch KVM permet de :
    - Connecter plusieurs serveurs à un seul clavier, écran et souris
    - Amplifier le signal réseau entre deux armoires
    - Alimenter les équipements en cas de coupure électrique
    - Segmenter le réseau en VLANs
    ```
    """
    required_arguments = 0
    optional_arguments = 1
    has_content = True
    option_spec = {
        "label":  directives.unchanged,
        "single": directives.flag,
    }

    def run(self):
        env = getattr(self.state.document.settings, "env", None)
        docname = env.docname if env else "page"
        data_id = self.arguments[0] if self.arguments else ""
        if not data_id:
            data_id = slugify(f"{docname}-qcm-L{self.lineno}")

        label  = self.options.get("label", "")
        single = "single" in self.options
        items  = []
        for line in self.content:
            line = line.strip()
            if line.startswith("- "):
                items.append(line[2:].strip())
            elif line.startswith("-") and len(line) > 1:
                items.append(line[1:].strip())

        node = qcm_answer_node()
        node["data_id"] = data_id
        node["label"]   = label
        node["items"]   = items
        node["single"]  = single
        return [node]


class HoleAnswerDirective(Directive):
    """
    Texte lacunaire — les trous sont marqués [___] dans le contenu Markdown.
    Supporte le texte brut et les tableaux Markdown.

    ```{hole-answer} id-optionnel
    :label: Complétez le tableau :
    | Couche | Protocole |
    |--------|-----------|
    | 7      | [___]     |
    | 4      | [___]     |
    ```
    """
    required_arguments = 0
    optional_arguments = 1
    has_content = True
    option_spec = {"label": directives.unchanged}

    def run(self):
        env = getattr(self.state.document.settings, "env", None)
        docname = env.docname if env else "page"
        data_id = self.arguments[0] if self.arguments else ""
        if not data_id:
            data_id = slugify(f"{docname}-hole-L{self.lineno}")
        label = self.options.get("label", "")
        content = "\n".join(self.content)
        hole_count = len(HOLE_RE.findall(content))
        node = hole_answer_node()
        node["data_id"]    = data_id
        node["label"]      = label
        node["content"]    = content
        node["hole_count"] = hole_count
        return [node]

# ---------------------------------------------------------------------------
# Visitors HTML
# ---------------------------------------------------------------------------

def visit_answer_html(self, node: answer_node):
    data_id = node["data_id"]
    label   = node["label"]
    lang    = node["lang"]
    lines   = node["lines"]
    attrs = [f'data-id="{data_id}"']
    if label:
        attrs.append(f'data-label="{label}"')
    if lang:
        attrs.append(f'data-lang="{lang}"')

    label_html = f'<p class="answer-label">{self.encode(label)}</p>' if label else ""
    self.body.append(
        f'<div class="answer-block" {" ".join(attrs)}>'
        f'{label_html}'
        f'<textarea class="answer-area" rows="{int(lines)}"></textarea>'
        f'</div>'
    )
    raise nodes.SkipNode

def depart_answer_html(self, node):  # SkipNode -> rien
    pass

def visit_export_html(self, node: export_answers_node):
    self.body.append('<button id="export-answers" class="export-btn">📥 Exporter mes réponses</button>')
    raise nodes.SkipNode

def depart_export_html(self, node):  # SkipNode -> rien
    pass

# ---------------------------------------------------------------------------
# Visitors LaTeX
# ---------------------------------------------------------------------------

def visit_answer_latex(self, node: answer_node):
    lines = int(node.get("lines", 6) or 6)
    self.body.append(r'\par\vspace{0.5ex}' + '\n')
    for _ in range(lines):
        self.body.append(r'\noindent\dotfill\par\vspace{0.5\baselineskip}' + '\n')
    self.body.append('\n')
    raise nodes.SkipNode

def depart_answer_latex(self, node):  # SkipNode -> rien
    pass

def visit_export_latex(self, node: export_answers_node):
    raise nodes.SkipNode

def depart_export_latex(self, node):
    pass

# ---------------------------------------------------------------------------
# Visitors qcm_answer
# ---------------------------------------------------------------------------

def visit_qcm_answer_html(self, node: qcm_answer_node):
    data_id = node["data_id"]
    label   = node["label"]
    items   = node["items"]
    single  = node.get("single", False)

    input_type = "radio" if single else "checkbox"
    attrs = f'data-id="{data_id}"'
    if label:
        attrs += f' data-label="{self.encode(label)}"'
    if single:
        attrs += ' data-single="1"'

    label_html = f'<p class="answer-label">{self.encode(label)}</p>' if label else ""
    self.body.append(f'<div class="tardis-qcm-answer" {attrs}>')
    self.body.append(label_html)
    self.body.append('<ul class="tardis-qcm-answer-list">')
    for idx, item in enumerate(items):
        txt = self.encode(item)
        self.body.append(
            f'<li><label>'
            f'<input type="{input_type}" class="tardis-qcm-check" '
            f'name="{data_id}" data-idx="{idx}"/> {txt}'
            f'</label></li>'
        )
    self.body.append('</ul></div>')
    raise nodes.SkipNode

def depart_qcm_answer_html(self, node):
    pass

def visit_qcm_answer_latex(self, node: qcm_answer_node):
    label  = node.get("label", "")
    single = node.get("single", False)
    marker = r'$\bigcirc$' if single else r'$\square$'
    if label:
        self.body.append(r'\noindent\textbf{%s}\par' % self.encode(label) + '\n')
    self.body.append(r'\begin{itemize}' + '\n')
    for item in node["items"]:
        self.body.append(r'\item ' + marker + r'~' + self.encode(item) + '\n')
    self.body.append(r'\end{itemize}' + '\n\n')
    raise nodes.SkipNode

def depart_qcm_answer_latex(self, node):
    pass

# ---------------------------------------------------------------------------
# Visitors hole_answer
# ---------------------------------------------------------------------------

def visit_hole_answer_html(self, node: hole_answer_node):
    data_id    = node["data_id"]
    label      = node["label"]
    raw        = node["content"]
    hole_count = node["hole_count"]

    # Remplace [___] par des placeholders alphanumériques avant le rendu Markdown
    inputs_html = []
    def make_placeholder(m):
        idx = len(inputs_html)
        inputs_html.append(
            f'<input type="text" class="hole-input" '
            f'data-block="{data_id}" data-idx="{idx}" />'
        )
        return f"TARDISHOLE{idx:04d}"

    processed = HOLE_RE.sub(make_placeholder, raw)
    rendered  = _md.render(processed) if _md else f"<p>{html_mod.escape(processed)}</p>"

    for idx, inp in enumerate(inputs_html):
        rendered = rendered.replace(f"TARDISHOLE{idx:04d}", inp)

    template_attr = html_mod.escape(json.dumps(raw))
    label_html    = f'<p class="answer-label">{self.encode(label)}</p>' if label else ""

    self.body.append(
        f'<div class="tardis-hole-answer" data-id="{data_id}" '
        f'data-holes="{hole_count}" data-template="{template_attr}">'
        f'{label_html}{rendered}</div>'
    )
    raise nodes.SkipNode

def depart_hole_answer_html(self, node):
    pass


def _md_table_to_latex(content, encode_fn):
    """Convertit un bloc Markdown (texte + tableaux pipe) en LaTeX."""
    lines   = content.split('\n')
    result  = []
    in_table = False
    col_count = 0

    for line in lines:
        s = line.strip()
        if s.startswith('|') and s.endswith('|'):
            if re.match(r'^\|[\s\-:|]+\|$', s):
                if in_table:
                    result.append(r'\hline')
                continue
            cells = [c.strip() for c in s.strip('|').split('|')]
            if not in_table:
                col_count = len(cells)
                result.append(r'\begin{tabular}{|' + 'l|' * col_count + '}')
                result.append(r'\hline')
                in_table = True
            latex_cells = [
                HOLE_RE.sub(r'\\underline{\\hspace{3cm}}', encode_fn(c))
                for c in cells
            ]
            result.append(' & '.join(latex_cells) + r' \\')
            result.append(r'\hline')
        else:
            if in_table:
                result.append(r'\end{tabular}')
                result.append('')
                in_table = False
            if s:
                result.append(
                    r'\noindent ' +
                    HOLE_RE.sub(r'\\underline{\\hspace{3cm}}', encode_fn(s)) +
                    r'\par'
                )
    if in_table:
        result.append(r'\end{tabular}')
    return '\n'.join(result)


def visit_hole_answer_latex(self, node: hole_answer_node):
    label = node.get("label", "")
    if label:
        self.body.append(r'\noindent\textbf{' + self.encode(label) + r'}\par' + '\n')
    self.body.append(_md_table_to_latex(node["content"], self.encode) + '\n\n')
    raise nodes.SkipNode

def depart_hole_answer_latex(self, node):
    pass

# ---------------------------------------------------------------------------
# Setup Sphinx
# ---------------------------------------------------------------------------

def setup(app):
    app.add_node(
        answer_node,
        html=(visit_answer_html, depart_answer_html),
        latex=(visit_answer_latex, depart_answer_latex),
    )
    app.add_node(
        export_answers_node,
        html=(visit_export_html, depart_export_html),
        latex=(visit_export_latex, depart_export_latex),
    )
    app.add_node(
        qcm_answer_node,
        html=(visit_qcm_answer_html, depart_qcm_answer_html),
        latex=(visit_qcm_answer_latex, depart_qcm_answer_latex),
    )
    app.add_node(
        hole_answer_node,
        html=(visit_hole_answer_html, depart_hole_answer_html),
        latex=(visit_hole_answer_latex, depart_hole_answer_latex),
    )
    app.add_directive("answer", AnswerBlockDirective)
    app.add_directive("export-answers", ExportAnswersDirective)
    app.add_directive("qcm-answer", QcmAnswerDirective)
    app.add_directive("hole-answer", HoleAnswerDirective)
    return {"parallel_read_safe": True, "parallel_write_safe": True}

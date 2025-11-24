# -*- coding: utf-8 -*-
from docutils import nodes
from docutils.parsers.rst import Directive, directives
import re

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

    # textarea avec rows={lines} (défaut 6)
    self.body.append(
        f'<div class="answer-block" {" ".join(attrs)}>'
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
    # Mappe vers les macros LaTeX définies dans ton .sty :
    lines = int(node.get("lines", 6) or 6)
    self.body.append(rf"\AnswerSpace[{lines}]" + "\n")
    raise nodes.SkipNode

def depart_answer_latex(self, node):  # SkipNode -> rien
    pass

def visit_export_latex(self, node: export_answers_node):
    # En PDF, on ne met rien (pas de bouton).
    raise nodes.SkipNode

def depart_export_latex(self, node):
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
    app.add_directive("answer", AnswerBlockDirective)
    app.add_directive("export-answers", ExportAnswersDirective)
    return {"parallel_read_safe": True, "parallel_write_safe": True}

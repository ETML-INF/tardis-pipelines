# -*- coding: utf-8 -*-
"""
TARDIS - Sphinx extension: {html} — Inclusion d'un fichier HTML interactif
---------------------------------------------------------------------------
Usage (MyST colon_fence — accolades obligatoires) :

    :::{html} cidr-explorer.html
    :::

Ou avec la syntaxe backtick :

    ```{html} cidr-explorer.html
    ```

Le fichier est résolu depuis html/ adjacent au source MD :
    <docdir>/html/cidr-explorer.html

Build HTML : lit et injecte le contenu brut du fichier dans la page.
Build PDF/LaTeX : note statique italique [Vue interactive : cidr-explorer.html]
Build Marp : non traité par Sphinx, le shortcode est ignoré nativement.
"""

import os
import logging

from docutils import nodes
from sphinx.util.docutils import SphinxDirective

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Nœud Docutils
# ---------------------------------------------------------------------------

class html_include_node(nodes.General, nodes.Element):
    pass


# ---------------------------------------------------------------------------
# Directive
# ---------------------------------------------------------------------------

class HtmlIncludeDirective(SphinxDirective):
    """Directive {html} — un seul argument obligatoire : le nom du fichier."""

    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = False
    has_content = False

    def run(self):
        filename = self.arguments[0].strip()
        env = self.env
        docdir = os.path.dirname(env.docname)

        # Chemin absolu source — résolu depuis html/ parallèle au MD
        html_path = os.path.join(env.srcdir, docdir, 'html', filename) if docdir \
            else os.path.join(env.srcdir, 'html', filename)

        if not os.path.isfile(html_path):
            logger.warning(
                "tardis_html: fichier HTML introuvable : %s "
                "(attendu dans html/ adjacent au source MD)",
                html_path,
            )
            return []

        try:
            content = open(html_path, encoding='utf-8').read()
        except OSError as exc:
            logger.warning("tardis_html: impossible de lire %s : %s", html_path, exc)
            return []

        node = html_include_node()
        node['filename'] = filename
        node['content'] = content

        # Signale la dépendance à Sphinx pour les rebuilds incrémentiels
        env.note_dependency(html_path)

        return [node]


# ---------------------------------------------------------------------------
# Visiteurs HTML
# ---------------------------------------------------------------------------

def visit_html_include_html(self, node: html_include_node):
    self.body.append(node['content'])
    raise nodes.SkipNode


def depart_html_include_html(self, node: html_include_node):
    pass


# ---------------------------------------------------------------------------
# Visiteurs LaTeX (PDF) — note statique, pas d'interactif
# ---------------------------------------------------------------------------

def visit_html_include_latex(self, node: html_include_node):
    filename = self.encode(node['filename'])
    self.body.append(r'\par\noindent\textit{[Vue interactive~: ' + filename + r']}\par' + '\n')
    raise nodes.SkipNode


def depart_html_include_latex(self, node: html_include_node):
    pass


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def setup(app):
    app.add_node(
        html_include_node,
        html=(visit_html_include_html, depart_html_include_html),
        latex=(visit_html_include_latex, depart_html_include_latex),
    )
    app.add_directive("html", HtmlIncludeDirective)
    return {
        "version": "1.0",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }

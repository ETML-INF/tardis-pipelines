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

Paramétrage via options `data-*` (transmises telles quelles en attributs
data-* sur un conteneur `<div data-sim>` qui enveloppe le fichier injecté —
le script embarqué peut les lire via `document.querySelector('[data-sim]').dataset`) :

    :::{html} network-sim.html
    :data-router-lan-ip: 192.168.10.1
    :data-clients: 4
    :data-client1-ip: 192.168.10.10
    :::

Build HTML : lit et injecte le contenu brut du fichier dans la page.
Build PDF/LaTeX : note statique italique [Vue interactive : cidr-explorer.html]
Build Marp : non traité par Sphinx, le shortcode est ignoré nativement.
"""

import os
import re
import logging
from html import escape as html_escape

from docutils import nodes
from docutils.parsers.rst import directives
from sphinx.util.docutils import SphinxDirective

logger = logging.getLogger(__name__)

# Attributs acceptés : uniquement data-* (évite l'injection d'attributs
# arbitraires comme onclick/onmouseover via le champ MyST)
_DATA_ATTR_RE = re.compile(r'^data-[a-z0-9-]+$')


class _DataOptions(dict):
    """option_spec permissif : accepte n'importe quelle option data-*,
    en nombre variable (ex. data-client1-ip, data-client2-ip, ...).

    Doit rester "truthy" (non vide) : MyST ne cherche un bloc d'options
    que si `bool(directive_class.option_spec)` est vrai.
    """

    def __bool__(self):
        return True

    def __contains__(self, key):
        return True

    def __getitem__(self, key):
        return directives.unchanged


# ---------------------------------------------------------------------------
# Nœud Docutils
# ---------------------------------------------------------------------------

class html_include_node(nodes.General, nodes.Element):
    pass


# ---------------------------------------------------------------------------
# Directive
# ---------------------------------------------------------------------------

class HtmlIncludeDirective(SphinxDirective):
    """Directive {html} — un seul argument obligatoire : le nom du fichier.

    Options facultatives `data-*` transmises en attributs data-* du
    conteneur enveloppant le contenu injecté.
    """

    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = False
    has_content = False
    option_spec = _DataOptions()

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

        data_attrs = {}
        for key, value in self.options.items():
            if not _DATA_ATTR_RE.match(key):
                logger.warning(
                    "tardis_html: option ignorée (doit être 'data-*' en minuscules) : %s",
                    key,
                )
                continue
            data_attrs[key] = value

        node = html_include_node()
        node['filename'] = filename
        node['content'] = content
        node['data_attrs'] = data_attrs

        # Signale la dépendance à Sphinx pour les rebuilds incrémentiels
        env.note_dependency(html_path)

        return [node]


# ---------------------------------------------------------------------------
# Visiteurs HTML
# ---------------------------------------------------------------------------

def visit_html_include_html(self, node: html_include_node):
    data_attrs = node.get('data_attrs') or {}
    if data_attrs:
        attrs = ' '.join(
            '{}="{}"'.format(key, html_escape(value, quote=True))
            for key, value in data_attrs.items()
        )
        self.body.append('<div data-sim {}>'.format(attrs))
        self.body.append(node['content'])
        self.body.append('</div>')
    else:
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

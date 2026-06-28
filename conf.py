# Configuration Sphinx pour Module ICT
import os
import sys
from datetime import datetime

# -- Informations générales ---------------------------------------------------
project = os.getenv("ICT_MODULE", "Module ICT non défini")
author = os.getenv("AUTHOR", "ETML (Section Informatique)")
copyright = f"{datetime.now().year}, {author}"
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
SPHINX_THEME  = os.getenv("SPHINX_THEME", "etml-2026-furo")

# -- Extensions Sphinx --------------------------------------------------------
EXTENSIONS_DIR = os.path.join(BASE_DIR, "extensions")
sys.path.insert(0, EXTENSIONS_DIR)

extensions = [
    "sphinx_external_toc",
    "myst_parser",
    "tardis_textarea",
    "tardis_qcm",
    "tardis_cards",
    "tardis_video",
    "tardis_html",
    "tardis_analytics",
]

myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "linkify",
    "attrs_inline",
    "substitution",
]

myst_html_meta = {
    "width": "global",
    "align": "global",
}

myst_substitutions = {
    "today": datetime.now().strftime("%d.%m.%Y")
}

language = 'fr'
latex_engine = 'xelatex'

def _latex_escape(s):
    """Échappe les caractères spéciaux LaTeX dans une chaîne."""
    for ch, rep in [('\\', r'\textbackslash{}'), ('&', r'\&'), ('%', r'\%'),
                    ('$', r'\$'), ('#', r'\#'), ('^', r'\textasciicircum{}'),
                    ('_', r'\_'), ('{', r'\{'), ('}', r'\}')]:
        s = s.replace(ch, rep)
    return s

_pub_date    = datetime.now().strftime("%d.%m.%Y")
_author_tex  = _latex_escape(author)
_logo_file   = "etml_logo_complet.png"

latex_additional_files = [
    os.path.join(BASE_DIR, "themes", "pdf", "etml-2025", "images", _logo_file),
]

latex_elements = {
    'extrapackages': r'\usepackage{lastpage}',
    'preamble': (
        r'\setlength{\headheight}{24pt}' '\n'
        r'\addtolength{\topmargin}{-12pt}' '\n'
        r'\makeatletter' '\n'
        r'\AtBeginDocument{%' '\n'
        r'  \g@addto@macro\ps@normal{%' '\n'
        r'    \fancyhead[L]{\includegraphics[height=0.7cm]{' + _logo_file + r'}}%' '\n'
        r'    \fancyhead[R]{\small\leftmark}%' '\n'
        r'    \fancyfoot[L]{\small Auteur~: ' + _author_tex + r'}%' '\n'
        r'    \fancyfoot[C]{\small \thepage~/~\pageref*{LastPage}}%' '\n'
        r'    \fancyfoot[R]{\small Publi\'{e} le~: ' + _pub_date + r'}%' '\n'
        r'  }%' '\n'
        r'}' '\n'
        r'\makeatother'
    ),
}

templates_path = ["_templates"]
exclude_patterns = []

# -- Options HTML --------------------------------------------------------------
html_title = "ETML"
html_copy_source = False
html_show_sourcelink = False

html_theme = "furo"

html_theme_options = {
    "navigation_with_keys": True,
}

# Determine html_baseurl based on context
# - Local dev: /cours/
# - Production with ICT_MODULE: /moduleICT/{ICT_MODULE}/cours/
# - Override with HTML_BASEURL env var
ict_module = os.getenv("ICT_MODULE", "")
if os.getenv("HTML_BASEURL"):
    html_baseurl = os.getenv("HTML_BASEURL")
elif ict_module:
    html_baseurl = f"/moduleICT/{ict_module}/cours/"
else:
    html_baseurl = "/cours/"
html_favicon = 'favicon.png'
html_static_path = [
    os.path.join("themes", "sphinx", SPHINX_THEME),
    os.path.join("themes", "sphinx", "js"),
]
html_css_files = [
    "etml.css",
    "https://unpkg.com/monaco-editor@0.52.0/min/vs/editor/editor.main.css",
    "cards.css",
]
html_js_files = [
    "https://unpkg.com/monaco-editor@0.52.0/min/vs/loader.js",
    "monaco-init.js",
    "responses.js",
]

# -- Paths ---------------------------------------------------------------------
sys.path.insert(0, os.path.abspath("."))

# Configuration Sphinx pour Module ICT
import os
import sys
from datetime import datetime

# -- Informations générales ---------------------------------------------------
project = os.getenv("ICT_MODULE", "Module ICT non défini")
author = "ETML (Section Informatique)"
copyright = f"{datetime.now().year}, {author}"
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
SPHINX_THEME  = os.getenv("SPHINX_THEME", "etml-2025")

# -- Extensions Sphinx --------------------------------------------------------
EXTENSIONS_DIR = os.path.join(BASE_DIR, "extensions")
sys.path.insert(0, EXTENSIONS_DIR)

extensions = [
    "myst_parser",
    "tardis_textarea",
    "tardis_qcm",
    "tardis_cards",
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

templates_path = ["_templates"]
exclude_patterns = []

# -- Options HTML --------------------------------------------------------------
html_copy_source = False
html_show_sourcelink = False

html_theme = "sphinx_rtd_theme"
html_static_path = [
    os.path.join("themes", "sphinx", SPHINX_THEME),
    os.path.join("themes", "sphinx", "js"),
]
html_css_files = [
    "customLight.css",
    "https://unpkg.com/monaco-editor@0.52.0/min/vs/editor/editor.main.css",
    "print-cards.css",
]
html_js_files = [
    "customToggle.js",
    "https://unpkg.com/monaco-editor@0.52.0/min/vs/loader.js",
    "monaco-init.js",
    "responses.js",
]

# -- Paths ---------------------------------------------------------------------
sys.path.insert(0, os.path.abspath("."))

# Configuration Sphinx pour Module ICT
import os
import sys
from datetime import datetime

# -- Informations générales ---------------------------------------------------
project = os.getenv("ICT_MODULE", "Module ICT non défini")
author = "ETML (Section Informatique)"
release = "1.0"
version = "1.0"
copyright = f"{datetime.now().year}, {author}"

# -- Extensions Sphinx --------------------------------------------------------
extensions = [
    "myst_parser",
    "tardis_textarea",
    "tardis_qcm",
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
html_theme = "sphinx_rtd_theme"
html_static_path = ["Theme_Sphinx_ETML", "assets"]
html_css_files = [
    "customLight.css",
    "https://unpkg.com/monaco-editor@0.52.0/min/vs/editor/editor.main.css",
]
html_js_files = [
    "customToggle.js",
    "https://unpkg.com/monaco-editor@0.52.0/min/vs/loader.js",
    "monaco-init.js",
    "responses.js",
]

# -- Paths ---------------------------------------------------------------------
sys.path.insert(0, os.path.abspath("."))

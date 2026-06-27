# -*- coding: utf-8 -*-
"""
TARDIS - Sphinx extension: {video} — Vidéo locale
--------------------------------------------------
Usage (MyST colon_fence — accolades obligatoires) :

    :::{video} demo.mp4
    :::

Ou avec la syntaxe backtick :

    ```{video} demo.mp4
    ```

Le fichier est résolu depuis video/ adjacent au source MD :
    <docdir>/video/demo.mp4

Build HTML : copie video/ dans _static/<docdir>/video/ et génère
    <video autoplay loop muted playsinline controls>

Build PDF/LaTeX : note statique italique [Vidéo : demo.mp4]
Build Marp : non traité par Sphinx, le shortcode est ignoré nativement.
"""

import os
import shutil
import logging

from docutils import nodes
from sphinx.util.docutils import SphinxDirective

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Nœud Docutils
# ---------------------------------------------------------------------------

class video_node(nodes.General, nodes.Element):
    pass


# ---------------------------------------------------------------------------
# Directive
# ---------------------------------------------------------------------------

class VideoDirective(SphinxDirective):
    """Directive {video} — un seul argument obligatoire : le nom du fichier."""

    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = False
    has_content = False

    def run(self):
        filename = self.arguments[0].strip()
        env = self.env
        docdir = os.path.dirname(env.docname)  # ex. "module1" ou ""

        node = video_node()
        node['filename'] = filename
        node['docdir'] = docdir
        node['docname'] = env.docname

        # Chemin absolu source — résolu depuis video/ parallèle au MD
        src = os.path.join(env.srcdir, docdir, 'video', filename) if docdir \
            else os.path.join(env.srcdir, 'video', filename)
        node['src'] = src

        # Collecte pour la copie en build-finished
        if not hasattr(env, 'tardis_video_files'):
            env.tardis_video_files = []
        env.tardis_video_files.append({
            'src': src,
            'docdir': docdir,
            'filename': filename,
            'docname': env.docname,
        })

        return [node]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _html_src(current_docname: str, docdir: str, filename: str) -> str:
    """Chemin relatif depuis la page HTML courante vers _static/.../video/fichier."""
    depth = current_docname.count('/')
    prefix = '../' * depth
    if docdir:
        return f"{prefix}_static/{docdir}/video/{filename}"
    return f"{prefix}_static/video/{filename}"


# ---------------------------------------------------------------------------
# Visiteurs HTML
# ---------------------------------------------------------------------------

def visit_video_html(self, node: video_node):
    src = _html_src(self.builder.current_docname, node['docdir'], node['filename'])
    self.body.append(
        f'<video class="tardis-video" src="{src}" '
        f'autoplay loop muted playsinline controls style="max-width:100%;display:block;margin:1rem 0"></video>\n'
    )
    raise nodes.SkipNode


def depart_video_html(self, node: video_node):
    pass


# ---------------------------------------------------------------------------
# Visiteurs LaTeX (PDF) — note statique, pas de vidéo
# ---------------------------------------------------------------------------

def visit_video_latex(self, node: video_node):
    filename = self.encode(node['filename'])
    self.body.append(r'\par\noindent\textit{[Vid\'{e}o~: ' + filename + r']}\par' + '\n')
    raise nodes.SkipNode


def depart_video_latex(self, node: video_node):
    pass


# ---------------------------------------------------------------------------
# Événements Sphinx
# ---------------------------------------------------------------------------

def on_env_purge_doc(app, env, docname):
    """Nettoie les entrées du document recalculé (rebuild incrémental)."""
    if hasattr(env, 'tardis_video_files'):
        env.tardis_video_files = [
            vf for vf in env.tardis_video_files if vf['docname'] != docname
        ]


def on_env_merge_info(app, env, docnames, other):
    """Fusionne les données collectées en lecture parallèle."""
    if not hasattr(other, 'tardis_video_files'):
        return
    if not hasattr(env, 'tardis_video_files'):
        env.tardis_video_files = []
    env.tardis_video_files.extend(other.tardis_video_files)


def on_build_finished(app, exception):
    """Copie les fichiers vidéo référencés vers _static/ du build HTML."""
    if exception:
        return
    if app.builder.format != 'html':
        return

    seen = set()
    for vf in getattr(app.env, 'tardis_video_files', []):
        src = vf['src']
        docdir = vf['docdir']
        filename = vf['filename']

        key = (docdir, filename)
        if key in seen:
            continue
        seen.add(key)

        if not os.path.isfile(src):
            logger.warning(
                "tardis_video: fichier vidéo introuvable : %s "
                "(attendu dans video/ adjacent au source MD)",
                src,
            )
            continue

        dest_dir = os.path.join(app.outdir, '_static', docdir, 'video') if docdir \
            else os.path.join(app.outdir, '_static', 'video')
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, filename)
        shutil.copy2(src, dest)
        logger.debug("tardis_video: copié %s → %s", src, dest)


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def setup(app):
    app.add_node(
        video_node,
        html=(visit_video_html, depart_video_html),
        latex=(visit_video_latex, depart_video_latex),
    )
    app.add_directive("video", VideoDirective)
    app.connect("env-purge-doc", on_env_purge_doc)
    app.connect("env-merge-info", on_env_merge_info)
    app.connect("build-finished", on_build_finished)
    return {
        "version": "1.0",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }

# -*- coding: utf-8 -*-
"""
TARDIS - Sphinx extension: Analytics GoatCounter
-------------------------------------------------
Active uniquement si la variable d'environnement GOATCOUNTER_URL est définie.

    GOATCOUNTER_URL=https://goat.vps.section-inf.tech make html

Injecte le script GoatCounter dans toutes les pages HTML générées.
La variable est lue au moment du build — aucun cookie, RGPD-friendly.
"""

import os
import logging

logger = logging.getLogger(__name__)


def on_builder_inited(app):
    if app.builder.format != 'html':
        return

    gc_url = os.getenv('GOATCOUNTER_URL', '').strip().rstrip('/')
    if not gc_url:
        return

    if not gc_url.startswith(('http://', 'https://')):
        gc_url = 'https://' + gc_url

    # Génère : <script async src="{gc_url}/count.js"
    #                   data-goatcounter="{gc_url}/count"></script>
    app.add_js_file(
        f"{gc_url}/count.js",
        loading_method="async",
        **{"data-goatcounter": f"{gc_url}/count"},
    )
    logger.info("tardis_analytics: GoatCounter activé → %s", gc_url)


def setup(app):
    app.connect('builder-inited', on_builder_inited)
    return {
        'version': '1.0',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }

from __future__ import annotations

import re
from docutils import nodes
from docutils.parsers.rst import Directive, directives

# --- Helpers -----------------------------------------------------------------

_LEN_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(mm|cm)\s*$", re.I)

def _parse_len(value: str | None) -> str | None:
    """
    Validate and normalize a physical length (mm or cm).
    Returns None if value is None.
    """
    if value is None:
        return None
    m = _LEN_RE.match(value)
    if not m:
        raise ValueError(f"invalid length '{value}' (expected e.g. 63mm or 8.8cm)")
    num, unit = m.group(1), m.group(2).lower()
    return f"{num}{unit}"

# --- Node --------------------------------------------------------------------

class tardis_card(nodes.General, nodes.Element):
    pass

# --- Directive ---------------------------------------------------------------

class CardDirective(Directive):
    has_content = True

    option_spec = {
        "width": directives.unchanged,     # mm / cm
        "height": directives.unchanged,    # mm / cm
        "title": directives.unchanged,
        "class": directives.class_option,
        "bg": directives.unchanged,        # free CSS color (stored as CSS var)
        "clip": directives.flag,            # overflow hidden
    }

    def run(self):
        self.assert_has_content()

        width = _parse_len(self.options.get("width"))
        height = _parse_len(self.options.get("height"))
        title = self.options.get("title", "")
        classes = ["tardis-card"] + self.options.get("class", [])
        bg = self.options.get("bg")
        clip = "clip" in self.options

        node = tardis_card()
        node["width"] = width
        node["height"] = height
        node["title"] = title
        node["classes"] = classes
        node["bg"] = bg
        node["clip"] = clip

        # Optional title block
        if title:
            title_node = nodes.paragraph()
            title_node["classes"].append("tardis-card__title")
            title_node += nodes.strong(text=title)
            node += title_node

        # Card content
        content_node = nodes.container()
        content_node["classes"].append("tardis-card__content")
        self.state.nested_parse(self.content, self.content_offset, content_node)
        node += content_node

        return [node]

# --- HTML visitors ------------------------------------------------------------

def visit_card_html(self, node: tardis_card):
    classes = " ".join(node.get("classes", ["tardis-card"]))
    styles: list[str] = []

    if node.get("width"):
        styles.append(f"width:{node['width']}")
    if node.get("height"):
        styles.append(f"height:{node['height']}")
    if node.get("clip"):
        styles.append("overflow:hidden")
    if node.get("bg"):
        # Allow free creativity, but only through a CSS variable
        styles.append(f"--card-bg:{node['bg']}")

    style_attr = ";".join(styles)
    self.body.append("<!-- TARDIS_CARD_RENDERED -->")
    self.body.append(
        self.starttag(
            node,
            "div",
            CLASS=classes,
            style=style_attr
        )
    )

def depart_card_html(self, node: tardis_card):
    self.body.append("</div>")

# --- Setup -------------------------------------------------------------------

def setup(app):
    app.add_node(
        tardis_card,
        html=(visit_card_html, depart_card_html),
    )
    app.add_directive("card", CardDirective)

    return {
        "version": "0.1",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }

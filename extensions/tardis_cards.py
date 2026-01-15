from __future__ import annotations

import re
from docutils import nodes
from docutils.parsers.rst import Directive, directives

# --- Helpers -----------------------------------------------------------------

_LEN_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(mm|cm)\s*$", re.I)
_HEX_RE = re.compile(r"^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$")


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


def _normalize_bg(value: str | None) -> str | None:
    """
    Normalize a background value.
    - Accept '#ffccaa' (quoted or not)
    - Accept '\\#ffccaa' (escaped)
    - Accept 'ffccaa' (no '#')
    - Keep other CSS values as-is (e.g. 'linear-gradient(...)')
    """
    if value is None:
        return None

    v = value.strip()
    if v == "":
        return None

    # Allow escaped hex: \#ffccaa
    if v.startswith(r"\#"):
        v = "#" + v[2:]

    # Allow raw hex without '#'
    if _HEX_RE.match(v):
        v = "#" + v

    return v


# --- Nodes -------------------------------------------------------------------

class tardis_card(nodes.General, nodes.Element):
    pass


class tardis_cardgrid(nodes.General, nodes.Element):
    pass


# --- Directives --------------------------------------------------------------

class CardDirective(Directive):
    """
    A single printable card.
    """
    has_content = True

    option_spec = {
        "width": directives.unchanged,      # mm / cm (optional if inside cardgrid)
        "height": directives.unchanged,     # mm / cm (optional if inside cardgrid)
        "title": directives.unchanged,
        "class": directives.class_option,
        "bg": directives.unchanged,         # free CSS color/value
        "clip": directives.flag,            # overflow hidden
    }

    def run(self):
        self.assert_has_content()

        width = _parse_len(self.options.get("width"))
        height = _parse_len(self.options.get("height"))
        title = self.options.get("title", "")
        classes = ["tardis-card"] + self.options.get("class", [])
        bg = _normalize_bg(self.options.get("bg"))
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


class CardGridDirective(Directive):
    """
    A grid (sheet) of cards. This avoids relying on MyST container/div behavior,
    which may vary by version/config.

    Usage (MyST):
    ```{cardgrid}
    :cols: 3
    :gap: 4mm
    :width: 63.5mm
    :height: 88.9mm

    ```{}
    ...
    ```
    ```
    """
    has_content = True

    option_spec = {
        "cols": directives.nonnegative_int,  # default 3
        "gap": directives.unchanged,         # mm/cm, default 4mm
        "width": directives.unchanged,       # mm/cm, default 63.5mm
        "height": directives.unchanged,      # mm/cm, default 88.9mm
        "class": directives.class_option,
    }

    def run(self):
        self.assert_has_content()

        cols = self.options.get("cols", 3)
        gap = _parse_len(self.options.get("gap", "4mm"))
        card_w = _parse_len(self.options.get("width", "63.5mm"))
        card_h = _parse_len(self.options.get("height", "88.9mm"))

        classes = ["tardis-cardgrid", f"cols-{cols}"] + self.options.get("class", [])

        node = tardis_cardgrid()
        node["cols"] = cols
        node["gap"] = gap
        node["card_w"] = card_w
        node["card_h"] = card_h
        node["classes"] = classes

        # Parse nested content (cards inside)
        self.state.nested_parse(self.content, self.content_offset, node)
        return [node]


# --- HTML visitors ------------------------------------------------------------

def visit_cardgrid_html(self, node: tardis_cardgrid):
    classes = " ".join(node.get("classes", ["tardis-cardgrid"]))
    styles = [
        f"--card-w:{node.get('card_w', '63.5mm')}",
        f"--card-h:{node.get('card_h', '88.9mm')}",
        f"--card-gap:{node.get('gap', '4mm')}",
    ]
    style_attr = ";".join(styles)

    self.body.append(self.starttag(node, "div", CLASS=classes, style=style_attr))


def depart_cardgrid_html(self, node: tardis_cardgrid):
    self.body.append("</div>")


def visit_card_html(self, node: tardis_card):
    classes = " ".join(node.get("classes", ["tardis-card"]))
    styles: list[str] = []

    # Allow per-card overrides (still valid inside a grid)
    if node.get("width"):
        styles.append(f"width:{node['width']}")
    if node.get("height"):
        styles.append(f"height:{node['height']}")
    if node.get("clip"):
        styles.append("overflow:hidden")
    if node.get("bg") is not None:
        # Allow free creativity, but only through a CSS variable
        styles.append(f"--card-bg:{node['bg']}")

    style_attr = ";".join(styles)

    # Optional debug marker (handy when diagnosing pipelines)
    # self.body.append("<!-- TARDIS_CARD_RENDERED -->")

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
        tardis_cardgrid,
        html=(visit_cardgrid_html, depart_cardgrid_html),
    )
    app.add_node(
        tardis_card,
        html=(visit_card_html, depart_card_html),
    )

    app.add_directive("cardgrid", CardGridDirective)
    app.add_directive("card", CardDirective)

    return {
        "version": "0.2",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }

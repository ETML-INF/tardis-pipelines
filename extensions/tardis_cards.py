from __future__ import annotations

import re
from typing import List, Optional

from docutils import nodes
from docutils.parsers.rst import Directive, directives
from docutils.transforms import Transform

# --- Helpers -----------------------------------------------------------------

_LEN_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(mm|cm)\s*$", re.I)
_HEX_RE = re.compile(r"^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$")


def _parse_len(value: str | None) -> str | None:
    if value is None:
        return None
    m = _LEN_RE.match(value)
    if not m:
        raise ValueError(f"invalid length '{value}' (expected e.g. 63mm or 8.8cm)")
    num, unit = m.group(1), m.group(2).lower()
    return f"{num}{unit}"


def _normalize_bg(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    if v.startswith(r"\#"):
        v = "#" + v[2:]
    if _HEX_RE.match(v):
        v = "#" + v
    return v


def _chunk(lst: List[nodes.Node], size: int) -> List[List[nodes.Node]]:
    return [lst[i : i + size] for i in range(0, len(lst), size)]


# --- Nodes -------------------------------------------------------------------

class tardis_card(nodes.General, nodes.Element):
    pass


class tardis_cardgrid(nodes.General, nodes.Element):
    pass


class tardis_cardsheet(nodes.General, nodes.Element):
    """Wrapper per printed page (forces page break)."""
    pass


# --- Directives --------------------------------------------------------------

class CardDirective(Directive):
    """A single card. Author writes only these in Markdown."""
    has_content = True

    option_spec = {
        "width": directives.unchanged,      # optional override
        "height": directives.unchanged,     # optional override
        "title": directives.unchanged,
        "class": directives.class_option,
        "bg": directives.unchanged,
        "accent": directives.unchanged,
        "clip": directives.flag,
    }

    def run(self):
        self.assert_has_content()

        width = _parse_len(self.options.get("width"))
        height = _parse_len(self.options.get("height"))
        title = self.options.get("title", "")
        classes = ["tardis-card"] + self.options.get("class", [])
        bg = _normalize_bg(self.options.get("bg"))
        clip = "clip" in self.options
        accent = _normalize_bg(self.options.get("accent"))

        node = tardis_card()
        node["width"] = width
        node["height"] = height
        node["title"] = title
        node["classes"] = classes
        node["bg"] = bg
        node["clip"] = clip
        node["accent"] = accent

        if title:
            title_node = nodes.paragraph()
            title_node["classes"].append("tardis-card__title")
            title_node += nodes.strong(text=title)
            node += title_node

        content_node = nodes.container()
        content_node["classes"].append("tardis-card__content")
        self.state.nested_parse(self.content, self.content_offset, content_node)
        node += content_node

        return [node]


# --- Auto grouping (Transform) ------------------------------------------------

class AutoCardSheetsTransform(Transform):
    """
    Groups consecutive tardis_card nodes into pages (cardsheets) and grids.
    Triggered late enough to see cards, early enough to influence HTML.
    """
    default_priority = 700  # after most parsing, before final writing

    def apply(self):
        doc = self.document
        env = getattr(doc.settings, "env", None)
        app = getattr(env, "app", None) if env else None

        # Defaults (can be overridden in conf.py via app.add_config_value)
        cols = getattr(app.config, "tardis_cards_cols", 3) if app else 3
        rows = getattr(app.config, "tardis_cards_rows", 3) if app else 3
        per_page = cols * rows

        card_w = getattr(app.config, "tardis_cards_width", "63.5mm") if app else "63.5mm"
        card_h = getattr(app.config, "tardis_cards_height", "88.9mm") if app else "88.9mm"
        gap = getattr(app.config, "tardis_cards_gap", "4mm") if app else "4mm"

        # Normalize/validate lengths (fail fast)
        card_w = _parse_len(card_w) or "63.5mm"
        card_h = _parse_len(card_h) or "88.9mm"
        gap = _parse_len(gap) or "4mm"

        # Walk every container-like node; regroup sequences of consecutive cards.
        for parent in list(doc.findall(nodes.Element)):
            # Only regroup within nodes that have children list
            if not hasattr(parent, "children"):
                continue

            i = 0
            while i < len(parent.children):
                # Find start of a run of cards
                if not isinstance(parent.children[i], tardis_card):
                    i += 1
                    continue

                start = i
                run: List[tardis_card] = []
                while i < len(parent.children) and isinstance(parent.children[i], tardis_card):
                    run.append(parent.children[i])
                    i += 1
                end = i  # exclusive

                # Replace [start:end] with one or more sheets
                replacement: List[nodes.Node] = []
                for page_cards in _chunk(run, per_page):
                    sheet = tardis_cardsheet()
                    sheet["classes"] = ["tardis-cardsheet"]

                    grid = tardis_cardgrid()
                    grid["classes"] = ["tardis-cardgrid", f"cols-{cols}"]
                    grid["cols"] = cols
                    grid["gap"] = gap
                    grid["card_w"] = card_w
                    grid["card_h"] = card_h

                    # Docutils often likes a container; keep it simple/stable
                    inner = nodes.container()
                    for c in page_cards:
                        inner += c
                    grid += inner
                    sheet += grid
                    replacement.append(sheet)

                # Splice into parent's children
                parent.children[start:end] = replacement


# --- HTML visitors ------------------------------------------------------------

def visit_cardsheet_html(self, node: tardis_cardsheet):
    classes = " ".join(node.get("classes", ["tardis-cardsheet"]))
    self.body.append(self.starttag(node, "div", CLASS=classes))


def depart_cardsheet_html(self, node: tardis_cardsheet):
    self.body.append("</div>")


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
    styles: List[str] = []

    if node.get("width"):
        styles.append(f"width:{node['width']}")
    if node.get("height"):
        styles.append(f"height:{node['height']}")
    if node.get("clip"):
        styles.append("overflow:hidden")
    if node.get("bg") is not None:
        styles.append(f"--card-bg:{node['bg']}")
    if node.get("accent") is not None:
        styles.append(f"--card-accent:{node['accent']}")

    style_attr = ";".join(styles)
    self.body.append(self.starttag(node, "div", CLASS=classes, style=style_attr))


def depart_card_html(self, node: tardis_card):
    self.body.append("</div>")


# --- Setup -------------------------------------------------------------------

def setup(app):
    # Config knobs (conf.py can override)
    app.add_config_value("tardis_cards_cols", 3, "env")
    app.add_config_value("tardis_cards_rows", 3, "env")
    app.add_config_value("tardis_cards_width", "63.5mm", "env")
    app.add_config_value("tardis_cards_height", "88.9mm", "env")
    app.add_config_value("tardis_cards_gap", "4mm", "env")

    # Nodes
    app.add_node(tardis_cardsheet, html=(visit_cardsheet_html, depart_cardsheet_html))
    app.add_node(tardis_cardgrid, html=(visit_cardgrid_html, depart_cardgrid_html))
    app.add_node(tardis_card, html=(visit_card_html, depart_card_html))

    # Directives
    app.add_directive("card", CardDirective)

    # Transform
    app.add_transform(AutoCardSheetsTransform)

    return {
        "version": "0.3",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }

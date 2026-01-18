from __future__ import annotations

import re
from typing import List

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


def _normalize_hex_color(value: str | None) -> str | None:
    """Accepts '#abc', '#aabbcc', 'abc', 'aabbcc'. Returns '#rrggbb' or '#rgb'."""
    if value is None:
        return None
    v = value.strip().strip('"').strip("'")
    if not v:
        return None
    if v.startswith(r"\#"):
        v = "#" + v[2:]
    if v.startswith("#"):
        v = v[1:]
    if not _HEX_RE.match(v):
        # Keep "None" to avoid injecting garbage into CSS var
        return None
    return "#" + v


def _chunk(lst: List[nodes.Node], size: int) -> List[List[nodes.Node]]:
    return [lst[i : i + size] for i in range(0, len(lst), size)]


def _collect_cards_excluding_subsections(section: nodes.section) -> List["tardis_card"]:
    """
    Collect tardis_card that belong to THIS section level.
    Cards inside nested subsections are intentionally excluded.
    """
    out: List[tardis_card] = []

    def walk(n: nodes.Node):
        # Stop descent at nested sections
        if isinstance(n, nodes.section) and n is not section:
            return
        if isinstance(n, tardis_card):
            out.append(n)
            return
        if isinstance(n, nodes.Element):
            for ch in n.children:
                walk(ch)

    for ch in section.children:
        walk(ch)

    return out


# --- Nodes -------------------------------------------------------------------

class tardis_card(nodes.General, nodes.Element):
    pass


class tardis_cardgrid(nodes.General, nodes.Element):
    pass


class tardis_cardsheet(nodes.General, nodes.Element):
    """Wrapper per printed page (CSS should enforce page break after)."""
    pass


# --- Directives --------------------------------------------------------------

class CardDirective(Directive):
    """A single card. Authors write only these in Markdown."""
    has_content = True

    option_spec = {
        "width": directives.unchanged,       # optional override
        "height": directives.unchanged,      # optional override
        "title": directives.unchanged,
        "class": directives.class_option,
        "bg": directives.unchanged,          # hex
        "accent": directives.unchanged,      # hex
        "clip": directives.flag,
        "counter": directives.flag,          # when present => DISABLE counter on this card
    }

    def run(self):
        self.assert_has_content()

        width = _parse_len(self.options.get("width"))
        height = _parse_len(self.options.get("height"))
        title = self.options.get("title", "")
        classes = ["tardis-card"] + self.options.get("class", [])
        bg = _normalize_hex_color(self.options.get("bg"))
        accent = _normalize_hex_color(self.options.get("accent"))
        clip = "clip" in self.options

        # Counter handling:
        # - default is enabled
        # - when :counter: flag is present -> disabled (simple mental model: "I mention it to disable it")
        counter_enabled = "counter" not in self.options

        node = tardis_card()
        node["width"] = width
        node["height"] = height
        node["title"] = title
        node["classes"] = classes
        node["bg"] = bg
        node["accent"] = accent
        node["clip"] = clip
        node["counter_enabled"] = counter_enabled  # NEW

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


# --- Transform: group cards per section --------------------------------------

class AutoCardSheetsTransform(Transform):
    """
    For each section:
      - collect tardis_card (excluding nested subsections)
      - assign per-run counters (1..N)
      - remove them from the tree
      - insert one or more cardsheets (chunks of cols*rows) at the first card position
    """
    default_priority = 700

    def apply(self):
        doc = self.document
        env = getattr(doc.settings, "env", None)
        app = getattr(env, "app", None) if env else None

        cols = getattr(app.config, "tardis_cards_cols", 3) if app else 3
        rows = getattr(app.config, "tardis_cards_rows", 3) if app else 3
        per_page = max(1, int(cols) * int(rows))

        card_w = _parse_len(getattr(app.config, "tardis_cards_width", "63.5mm") if app else "63.5mm") or "63.5mm"
        card_h = _parse_len(getattr(app.config, "tardis_cards_height", "88.9mm") if app else "88.9mm") or "88.9mm"
        gap = _parse_len(getattr(app.config, "tardis_cards_gap", "4mm") if app else "4mm") or "4mm"

        # Global default for counters (conf.py can override)
        default_counter_enabled = getattr(app.config, "tardis_cards_counter", True) if app else True

        # Iterate all sections (including nested); we exclude sub-sections' cards per section anyway
        for section in doc.findall(nodes.section):
            cards = _collect_cards_excluding_subsections(section)
            if not cards:
                continue

            # Assign counters for THIS run
            total = len(cards)
            for idx, c in enumerate(cards, start=1):
                # If conf disables globally, keep it off unless author explicitly enabled per-card (we don't have that)
                effective_enabled = bool(default_counter_enabled) and bool(c.get("counter_enabled", True))
                c["counter_enabled"] = effective_enabled
                c["card_index"] = idx
                c["card_total"] = total

            # Anchor: where the first card currently lives
            first = cards[0]
            first_parent = first.parent
            if first_parent is None:
                continue
            try:
                first_index = first_parent.children.index(first)
            except ValueError:
                continue

            # Remove ALL collected cards wherever they are
            for c in cards:
                p = c.parent
                if p is None:
                    continue
                # delete that exact node from parent children
                for i, child in enumerate(list(p.children)):
                    if child is c:
                        del p.children[i]
                        break

            # Build replacement sheets
            sheets: List[nodes.Node] = []
            for page_cards in _chunk(cards, per_page):
                sheet = tardis_cardsheet()
                sheet["classes"] = ["tardis-cardsheet"]

                grid = tardis_cardgrid()
                grid["classes"] = ["tardis-cardgrid", f"cols-{cols}"]
                grid["cols"] = cols
                grid["gap"] = gap
                grid["card_w"] = card_w
                grid["card_h"] = card_h

                inner = nodes.container()
                for c in page_cards:
                    inner += c
                grid += inner
                sheet += grid
                sheets.append(sheet)

            # Insert at anchor
            first_parent.children[first_index:first_index] = sheets


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
    self.body.append(self.starttag(node, "div", CLASS=classes, style=";".join(styles)))


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

    self.body.append(self.starttag(node, "div", CLASS=classes, style=";".join(styles)))

    # Counter (X/Y) injected as a real element (robust for print)
    if node.get("counter_enabled", True):
        idx = int(node.get("card_index", 0) or 0)
        total = int(node.get("card_total", 0) or 0)
        if idx > 0 and total > 0:
            self.body.append(
                f"<span class='tardis-card__counter'>{idx}/{total}</span>"
            )


def depart_card_html(self, node: tardis_card):
    self.body.append("</div>")


# --- Setup -------------------------------------------------------------------

def setup(app):
    app.add_config_value("tardis_cards_cols", 3, "env")
    app.add_config_value("tardis_cards_rows", 3, "env")
    app.add_config_value("tardis_cards_width", "63.5mm", "env")
    app.add_config_value("tardis_cards_height", "88.9mm", "env")
    app.add_config_value("tardis_cards_gap", "4mm", "env")

    # NEW: global default for counter display
    app.add_config_value("tardis_cards_counter", True, "env")

    app.add_node(tardis_cardsheet, html=(visit_cardsheet_html, depart_cardsheet_html))
    app.add_node(tardis_cardgrid, html=(visit_cardgrid_html, depart_cardgrid_html))
    app.add_node(tardis_card, html=(visit_card_html, depart_card_html))

    app.add_directive("card", CardDirective)
    app.add_transform(AutoCardSheetsTransform)

    return {
        "version": "0.5",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }

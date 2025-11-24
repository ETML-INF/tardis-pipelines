# -*- coding: utf-8 -*-
"""
TARDIS - Sphinx extension: {qcm} avec QCM/QCU
---------------------------------------------
Usage :

```{qcm}
:id: q1
:multiple_answers: false   # QCU (par défaut: true → QCM)
:feedback_right: Bien vu.
:feedback_wrong: Regarde la notion X.
:explain: A et C sont correctes car ...
:correct: La réponse A
:wrong:   La réponse B
:correct: La réponse C
:wrong:   La réponse D
```

Fonctionnalités :
- QCM (checkbox) ou QCU (radio) via :multiple_answers:
- Vérification locale, feedback, reset
- Pas d'export/persistance/solution
- Rendu HTML et PDF (symboles adaptés)
"""

from docutils import nodes
from sphinx.util.docutils import SphinxDirective
from docutils.parsers.rst import directives


class qcm_node(nodes.General, nodes.Element):
    """Nœud Docutils pour les blocs {qcm}."""
    pass


def _bool(val):
    """Convertit un texte en booléen."""
    if isinstance(val, bool):
        return val
    v = (val or "").strip().lower()
    return v in ("1", "true", "yes", "on", "y", "t")


class QcmDirective(SphinxDirective):
    """Directive {qcm}"""
    has_content = True
    option_spec = {
        "id": directives.unchanged,
        "multiple_answers": directives.unchanged,  # true (default) → QCM, false → QCU
        "feedback_right": directives.unchanged,
        "feedback_wrong": directives.unchanged,
        "explain": directives.unchanged,
        "label": directives.unchanged,
    }

    def run(self):
        env = self.env
        env.tardis_qcm_counter = getattr(env, "tardis_qcm_counter", {})
        doc = env.docname
        env.tardis_qcm_counter[doc] = env.tardis_qcm_counter.get(doc, 0) + 1

        qid = self.options.get("id") or f"{doc.replace('/','_')}__qcm{env.tardis_qcm_counter[doc]}"
        label = self.options.get("label", "")
        multiple = _bool(self.options.get("multiple_answers", "true"))
        feedback_right = self.options.get("feedback_right", "Correct.")
        feedback_wrong = self.options.get("feedback_wrong", "Il y a encore des erreurs.")
        explain = self.options.get("explain", "")

        items = []
        for raw in self.content:
            line = raw.strip()
            if not line:
                continue
            if line.startswith(":correct:"):
                text = line[len(":correct:"):].strip()
                if text:
                    items.append({"text": text, "correct": True})
            elif line.startswith(":wrong:"):
                text = line[len(":wrong:"):].strip()
                if text:
                    items.append({"text": text, "correct": False})

        node = qcm_node()
        node["qid"] = qid
        node["label"] = label
        node["multiple"] = multiple
        node["feedback_right"] = feedback_right
        node["feedback_wrong"] = feedback_wrong
        node["explain"] = explain
        node["items"] = items
        return [node]


# --------------------------
# HTML render
# --------------------------

def visit_qcm_html(self, node: qcm_node):
    qid = node["qid"]
    label = self.encode(node.get("label", ""))
    feedback_right = self.encode(node.get("feedback_right", "Correct."))
    feedback_wrong = self.encode(node.get("feedback_wrong", "Il y a encore des erreurs."))
    explain = self.encode(node.get("explain", ""))
    items = node["items"]
    multiple = bool(node.get("multiple", True))

    input_type = "checkbox" if multiple else "radio"

    self.body.append(f'<fieldset class="tardis-qcm" data-qid="{qid}" data-multiple="{str(multiple).lower()}">')
    if label:
        self.body.append(f'<legend>{label}</legend>')

    self.body.append('<ul class="tardis-qcm-list">')
    for idx, it in enumerate(items):
        txt = self.encode(it["text"])
        correct = "true" if it["correct"] else "false"
        name_attr = f' name="{qid}"' if input_type == "radio" else ""
        self.body.append(
            f'<li class="tardis-qcm-item" data-correct="{correct}">'
            f'<label><input type="{input_type}" class="tardis-qcm-check"{name_attr}/> {txt}</label>'
            f'</li>'
        )
    self.body.append('</ul>')

    # Use triple double quotes to avoid conflict with the outer source string
    self.body.append(
        f"""
<div class="tardis-qcm-actions">
  <button type="button" class="tardis-qcm-verify">Vérifier</button>
  <button type="button" class="tardis-qcm-reset">Réinitialiser</button>
</div>
<div class="tardis-qcm-feedback" aria-live="polite"></div>
{(f'<details class="tardis-qcm-explain" style="display:none"><summary>Explication</summary><div>{explain}</div></details>' if explain else '')}
</fieldset>

<script>
document.addEventListener("DOMContentLoaded", function(){{
  document.querySelectorAll(".tardis-qcm").forEach(function(root){{
    const fb = root.querySelector(".tardis-qcm-feedback");

    function clearMarks() {{
      root.querySelectorAll(".tardis-qcm-item").forEach(li => li.classList.remove("is-correct","is-wrong"));
    }}

    root.querySelector(".tardis-qcm-verify").addEventListener("click", function(){{
      let ok = true;
      let anyChecked = false;
      clearMarks();
      root.querySelectorAll(".tardis-qcm-item").forEach(li => {{
        const checked = li.querySelector(".tardis-qcm-check").checked;
        const correct = (li.dataset.correct === "true");
        anyChecked = anyChecked || checked;
        if (checked === correct) {{
          li.classList.add("is-correct");
        }} else {{
          li.classList.add("is-wrong");
          ok = false;
        }}
      }});
      if (!anyChecked) {{
        fb.textContent = "Sélectionne au moins une proposition.";
        return;
      }}
      fb.textContent = ok ? "{feedback_right}" : "{feedback_wrong}";
      if (exp) exp.style.display = "block";  
    
    }});

    root.querySelector(".tardis-qcm-reset").addEventListener("click", function(){{
      root.querySelectorAll(".tardis-qcm-check").forEach(c => c.checked = false);
      clearMarks();
      fb.textContent = "";
      if (exp) exp.style.display = "none"; 
    }});
  }});
}});
</script>
<style>
.tardis-qcm {{ margin: 1rem 0; border: 1px solid #ccc; padding: .75rem 1rem; border-radius: .5rem; }}
.tardis-qcm legend {{ font-weight: 600; }}
.tardis-qcm-list {{ list-style:none; padding:0; margin:.5rem 0; }}
.tardis-qcm-item {{ margin:.3rem 0; padding:.2rem .3rem; border-radius:.25rem; }}
.tardis-qcm-item.is-correct {{ background:#c8e6c933; outline:1px solid #4caf5033; }}
.tardis-qcm-item.is-wrong   {{ background:#ffcdd233; outline:1px solid #f4433633; }}
.tardis-qcm-actions {{ margin:.5rem 0; display:flex; gap:.5rem; flex-wrap:wrap; }}
.tardis-qcm-feedback {{ margin-top:.25rem; font-weight:600; }}
.tardis-qcm-explain {{ margin-top:.5rem; }}
</style>
"""
    )


def depart_qcm_html(self, node: qcm_node):
    pass


# --------------------------
# LaTeX render
# --------------------------

def visit_qcm_latex(self, node: qcm_node):
    label = node.get("label", "")
    multiple = bool(node.get("multiple", True))
    if label:
        self.body.append(r"\noindent\textbf{%s}\par" % self.encode(label))
    self.body.append(r"\begin{itemize}" + "\n")
    bullet = r"$\square$~" if multiple else r"$\circ$~"
    for it in node["items"]:
        txt = self.encode(it["text"])
        self.body.append(r"\item %s%s" % (bullet, txt) + "\n")
    self.body.append(r"\end{itemize}" + "\n\n")
    explain = node.get("explain", "")
    if explain:
        self.body.append(r"\small\emph{Explication : %s}\normalsize" % self.encode(explain))
        self.body.append("\n\n")


def depart_qcm_latex(self, node: qcm_node):
    pass


def setup(app):
    app.add_node(
        qcm_node,
        html=(visit_qcm_html, depart_qcm_html),
        latex=(visit_qcm_latex, depart_qcm_latex),
    )
    app.add_directive("qcm", QcmDirective)
    return {"version": "1.1", "parallel_read_safe": True, "parallel_write_safe": True}

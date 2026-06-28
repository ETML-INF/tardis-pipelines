// assets/responses.js
(function () {
  const KEY_PREFIX = "m182:answer:";
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // --------- utils ----------
  function safeTitleText(raw) {
    return (raw || "Exercices")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s\-]/g, "").trim();
  }
  function getPageTitle() {
    const raw = document.querySelector("h1, h2")?.textContent?.trim() || "Exercices";
    return safeTitleText(raw);
  }
  function previousHeading(el) {
    let cur = el.previousElementSibling;
    while (cur) {
      const tag = cur.tagName?.toLowerCase();
      if (tag && /^(h1|h2)$/.test(tag)) return cur;
      cur = cur.previousElementSibling;
    }
    const p = el.parentElement;
    if (p) {
      cur = p.previousElementSibling;
      while (cur) {
        const tag = cur.tagName?.toLowerCase();
        if (tag && /^(h1|h2)$/.test(tag)) return cur;
        cur = cur.previousElementSibling;
      }
    }
    return null;
  }
  function getBlockLabel(block) {
    if (block.dataset.label?.trim()) return block.dataset.label.trim();
    const h = previousHeading(block);
    if (h?.textContent) return h.textContent.trim();
    return block.dataset.id || "Réponse";
  }

  // --------- fallback textarea: autosave (Monaco autosave est dans monaco-init.js) ----------
  function initTextareaFallbackAutosave() {
    $$(".answer-block").forEach(block => {
      const ta = block.querySelector(".answer-area");
      if (!ta) return;
      const id = block.dataset.id || crypto.randomUUID();
      if (!block.dataset.id) block.dataset.id = id;

      const saved = localStorage.getItem(KEY_PREFIX + id);
      if (saved !== null) ta.value = saved;

      ta.addEventListener("input", () => {
        localStorage.setItem(KEY_PREFIX + id, ta.value);
      });
    });
  }

  // --------- hole-answer: autosave ----------
  function initHoleAnswerAutosave() {
    $$(".tardis-hole-answer").forEach(block => {
      const id = block.dataset.id;
      if (!id) return;
      const holes = $$(".hole-input", block);

      const saved = localStorage.getItem(KEY_PREFIX + "hole:" + id);
      if (saved) {
        try {
          const values = JSON.parse(saved);
          holes.forEach((inp, idx) => { if (values[idx] !== undefined) inp.value = values[idx]; });
        } catch (e) {}
      }

      block.addEventListener("input", () => {
        localStorage.setItem(KEY_PREFIX + "hole:" + id, JSON.stringify(holes.map(i => i.value)));
      });
    });
  }

  // --------- qcm-answer: autosave ----------
  function initQcmAnswerAutosave() {
    $$(".tardis-qcm-answer").forEach(block => {
      const id     = block.dataset.id;
      const single = block.dataset.single === "1";
      if (!id) return;

      const saved = localStorage.getItem(KEY_PREFIX + "qcm:" + id);
      if (saved) {
        try {
          const state = JSON.parse(saved);
          $$(".tardis-qcm-check", block).forEach((inp, idx) => {
            inp.checked = single ? state === idx : !!state[idx];
          });
        } catch (e) {}
      }

      block.addEventListener("change", () => {
        const inputs = $$(".tardis-qcm-check", block);
        const state  = single
          ? inputs.findIndex(i => i.checked)
          : inputs.map(i => i.checked);
        localStorage.setItem(KEY_PREFIX + "qcm:" + id, JSON.stringify(state));
      });
    });
  }

  // --------- export ----------
  function getBlockText(block) {
    // 1) Monaco (préféré)
    if (window.MONACO_ANSWER?.getValue) {
      return window.MONACO_ANSWER.getValue(block) || "";
    }
    // 2) Fallback textarea
    return block.querySelector(".answer-area")?.value || "";
  }

  function buildExportMarkdown() {
    const lines = [];
    const title = getPageTitle();
    const dateISO = new Date().toISOString().slice(0, 10);

    lines.push(`# Réponses – ${title}`);
    lines.push(`_Export du ${dateISO}_`);
    lines.push("");

    $$(".answer-block, .tardis-qcm-answer, .tardis-hole-answer").forEach(block => {
      const label = getBlockLabel(block);
      lines.push(`## ${label}`);

      if (block.classList.contains("tardis-hole-answer")) {
        const template = JSON.parse(block.dataset.template || '""');
        const holes = $$(".hole-input", block);
        let idx = 0;
        const result = template.replace(/\[___\]/g, () => {
          const val = (holes[idx++]?.value || "").trim();
          return val ? `[${val}]` : "[___]";
        });
        lines.push(result);
      } else if (block.classList.contains("tardis-qcm-answer")) {
        $$("li", block).forEach(li => {
          const cb = li.querySelector(".tardis-qcm-check");
          const txt = li.querySelector("label").textContent.trim();
          lines.push(`- ${cb?.checked ? "[x]" : "[ ]"} ${txt}`);
        });
      } else {
        const txt = getBlockText(block);
        lines.push("```");
        lines.push((txt || "").trim());
        lines.push("```");
      }
      lines.push("");
    });

    return lines.join("\n");
  }

  function download(text, filename) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function bindExport() {
    const btn = $("#export-answers");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const md = buildExportMarkdown();
      const dateISO = new Date().toISOString().slice(0, 10);
      const base = safeTitleText(document.title || "reponses").toLowerCase().replace(/\s+/g, "-");
      download(md, `${base}-${dateISO}.md`);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.MONACO_ANSWER?.getValue) {
      initTextareaFallbackAutosave();
    }
    initHoleAnswerAutosave();
    initQcmAnswerAutosave();
    bindExport();
  });
})();

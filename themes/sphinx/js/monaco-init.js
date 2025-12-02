// assets/monaco-init.js
(function () {
  const KEY_PREFIX = "m182:answer:";
  const editors = new WeakMap();
  const MONACO_THEME = "vs-dark"; // ou "hc-black"

  // --- mapping d'alias simples ---
  function mapLang(v) {
    if (!v) return "plaintext";
    v = String(v).toLowerCase();
    if (v === "bash" || v === "sh") return "shell";
    if (v === "ps" || v === "powershell") return "powershell";
    if (v === "js" || v === "javascript") return "javascript";
    if (v === "ts" || v === "typescript") return "typescript";
    if (v === "csharp" || v === "c#") return "csharp";
    if (v === "cpp" || v === "c++") return "cpp";
    return v;
  }

  function whenRequireReady(cb, tries = 50) {
    if (typeof window.require === "function") return cb();
    if (tries <= 0) { console.error("[monaco-init] loader.js introuvable"); return; }
    setTimeout(() => whenRequireReady(cb, tries - 1), 100);
  }

  // charge à la demande un langage basic-languages (évite de dépendre de monaco.contribution)
  function ensureBasicLanguage(id) {
    return new Promise((resolve) => {
      const has = (monaco.languages.getLanguages?.() || []).some(l => l.id === id);
      if (has) return resolve(true);
      // eslint-disable-next-line no-undef
      require([`vs/basic-languages/${id}/${id}`], (mod) => {
        try {
          monaco.editor.setTheme(MONACO_THEME);
          monaco.languages.register({ id });
          monaco.languages.setMonarchTokensProvider(id, mod.language);
          resolve(true);
        } catch { resolve(false); }
      }, () => resolve(false));
    });
  }

  function initMonaco() {
    // ✅ CDN 0.52.0 : alias AMD sur /min/vs, base workers sur /min
    const CDN_MIN = "https://unpkg.com/monaco-editor@0.52.0/min";

    // eslint-disable-next-line no-undef
    require.config({ paths: { vs: CDN_MIN + "/vs" } });

    // Workers (ts/json/css/html + workerMain) résolus depuis /min/
    window.MonacoEnvironment = {
      getWorkerUrl() {
        const code = `
          self.MonacoEnvironment = { baseUrl: '${CDN_MIN}/' };
          importScripts('${CDN_MIN}/vs/base/worker/workerMain.js');`;
        return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      }
    };

    // Charge l'éditeur. (On n'inclut PAS monaco.contribution pour éviter les soucis de MIME.)
    // eslint-disable-next-line no-undef
    require(["vs/editor/editor.main"], function () {
      document.querySelectorAll(".answer-block").forEach(async (block) => {
        const ta = block.querySelector(".answer-area");
        if (!ta) return;

        const id = block.dataset.id || crypto.randomUUID();
        if (!block.dataset.id) block.dataset.id = id;

        const saved = localStorage.getItem("m347:answer:" + id);
        if (saved != null) ta.value = saved;

        // ✅ n'activer Monaco que si :lang: est présent
        const langAttr = (block.dataset.lang || "").trim();
        if (!langAttr) {
          // fallback "question ouverte" : garder la textarea + autosave
          ta.addEventListener("input", () => {
            localStorage.setItem("m182:answer:" + id, ta.value);
          });
          return; // ne remplace pas la textarea
        }

        // --- ÉDITEUR MONACO (si data-lang défini) ---
        const wanted = mapLang(langAttr);

        const mount = document.createElement("div");
        mount.className = "monaco-mount";
        mount.style.border = "2px solid #263238";
        mount.style.borderRadius = "8px";
        mount.style.minHeight = "9rem";
        mount.style.maxHeight = "40rem";
        mount.style.overflow = "hidden";
        ta.replaceWith(mount);

        const editor = monaco.editor.create(mount, {
          value: ta.value || "",
          language: "plaintext",              // démarre simple
          theme: "vs-dark",
          automaticLayout: true,
          wordWrap: "on",
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
        });

        editor.onDidChangeModelContent(() => {
          localStorage.setItem("m182:answer:" + id, editor.getValue());
        });

        // Charger le langage demandé si disponible, sinon rester en plaintext
        const ok = await ensureBasicLanguage(wanted);
        monaco.editor.setModelLanguage(editor.getModel(), ok ? wanted : "plaintext");

        // exposer à responses.js via MONACO_ANSWER (si ce n'est pas déjà fait)
        (window.MONACO_ANSWER ||= {
          getValue(blockEl) {
            const ed = editors.get(blockEl);
            return ed ? ed.getValue() : (blockEl.querySelector(".answer-area")?.value || "");
          }
        });
        editors.set(block, editor);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => whenRequireReady(initMonaco));
})();

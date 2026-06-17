#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import YAML from 'yaml';

const SRC_DIR = process.env.SRC_DIR || '../b-UnitesEnseignement';
const OUT_DIR = process.env.OUT_DIR || '../_build_local/tardis/manifests';
const ALLOWED_TYPES = new Set(['accroche', 'exo', 'activity', 'tp', 'slides', 'reading']);

const stripBOM = s => s.replace(/^﻿/, '');
const normalizeQuotes = s => s.replace(/[""]/g, '"').replace(/['']/g, "'");
const sanitize = s => normalizeQuotes(stripBOM(s))
  .replace(/\r\n/g, '\n')
  .replace(/\t/g, '  ')
  .replace(/ /g, ' ');
const extractFM = md => {
  const m = md.match(/^---\s*\n([\s\S]*?)\n(?:---|\.\.\.)/);
  return m ? m[1] : null;
};
const seqKey = seq => {
  const m = /^SEQ-(\d+)$/.exec((seq || '').trim());
  return m ? ['0', Number(m[1])] : ['1', (seq || '').toLowerCase()];
};

(async () => {
  try {
    await fs.mkdir(OUT_DIR, { recursive: true });

    const files = await glob(SRC_DIR + '/**/*.md', { nodir: true });
    const items = [];

    for (const f of files) {
      let raw = await fs.readFile(f, 'utf8');
      raw = sanitize(raw);

      const firstLine = (raw.split('\n')[0] || '').trim();
      if (firstLine !== '---') continue;

      let fm = extractFM(raw);
      if (!fm) continue;
      fm = sanitize(fm);
      const fmLines = String(fm).split('\n');
      const TYPE_RE = /^\s*type\s*:\s*["']?([A-Za-z0-9_-]+)["']?\s*(?:#.*)?$/;

      let type = null;
      for (const line of fmLines) {
        const m = TYPE_RE.exec(line);
        if (m) {
          type = m[1].toLowerCase();
          break;
        }
      }

      if (!type || !ALLOWED_TYPES.has(type)) continue;

      try {
        const data = YAML.parse(fm) || {};
        const entry = {
          source_path: f,
          type: data.type || type,
          id: data.id || null,
          title: data.title || null,
          seq: data.seq || null,
          order: Number.isFinite(Number(data.order)) ? Number(data.order) : 9999,
          method: data.method || null,
          align_ict: Array.isArray(data.align_ict) ? data.align_ict : [],
          goals: Array.isArray(data.goals) ? data.goals : []
        };

        if (entry.id && entry.title && entry.seq) {
          items.push(entry);
        }
      } catch (e) {
        console.error(`❌ Erreur YAML: ${f} -> ${e.message}`);
      }
    }

    if (items.length === 0) {
      console.warn('⚠️  Aucun item trouvé avec front matter complet');
      process.exit(0);
    }

    const bySeq = new Map();
    for (const it of items) {
      if (!bySeq.has(it.seq)) bySeq.set(it.seq, []);
      bySeq.get(it.seq).push(it);
    }

    const sequences = Array.from(bySeq.entries())
      .sort((a, b) => {
        const ka = seqKey(a[0]);
        const kb = seqKey(b[0]);
        return ka[0].localeCompare(kb[0]) || (ka[1] - kb[1]);
      })
      .map(([seq, arr]) => ({
        seq,
        count: arr.length,
        items: arr.sort((x, y) =>
          (x.order - y.order) ||
          String(x.title || '').toLowerCase().localeCompare(String(y.title || '').toLowerCase())
        )
      }));

    const by_type = {};
    for (const it of items) by_type[it.type] = (by_type[it.type] || 0) + 1;

    const manifest = {
      version: 1,
      generated_at: new Date().toISOString(),
      sequences,
      stats: {
        total_items: items.length,
        total_sequences: sequences.length,
        by_type
      }
    };

    await fs.writeFile(
      path.join(OUT_DIR, 'tardis.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
    await fs.writeFile(
      path.join(OUT_DIR, 'tardis.yml'),
      YAML.stringify(manifest),
      'utf8'
    );

    console.log(`✅ Manifest généré: ${items.length} items, ${sequences.length} séquences`);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  }
})();

/**
 * Parse MyST {card} directives from a markdown string.
 * Supports both backtick (```) and colon (:::) fences.
 */

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value) {
  if (!value) return null;
  const v = value.trim().replace(/^\\#/, '#').replace(/^#/, '');
  if (!HEX_RE.test('#' + v)) return null;
  return '#' + v;
}

export function parseCardsFromMarkdown(mdContent) {
  const cards = [];
  const fenceRe = /^(`{3,}|:{3,})\{card\}[^\n]*\n([\s\S]*?)\n\1[ \t]*$/gm;

  let match;
  while ((match = fenceRe.exec(mdContent)) !== null) {
    const body = match[2];
    const options = {};
    const lines = body.split('\n');
    const contentLines = [];
    let inOptions = true;

    for (const line of lines) {
      if (inOptions) {
        const optMatch = line.match(/^:([\w-]+):\s*(.*)/);
        if (optMatch) {
          options[optMatch[1]] = optMatch[2].trim();
        } else if (line.trim() === '') {
          inOptions = false;
        } else {
          inOptions = false;
          contentLines.push(line);
        }
      } else {
        contentLines.push(line);
      }
    }

    const bodyContent = contentLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
    const content = bodyContent || (options.content ? options.content.trim() : '');
    const extraClasses = options.class ? options.class.split(/\s+/).filter(Boolean) : [];
    const parseList = key => options[key]
      ? options[key].replace(/[\[\]\s]/g, '').split(',').filter(Boolean)
      : [];

    cards.push({
      title: options.title || '',
      bg: normalizeHex(options.bg),
      accent: normalizeHex(options.accent),
      classes: extraClasses,
      image: options.image || null,
      number: options.number || null,
      marginColor: normalizeHex(options['margin-color']),
      marginBorderColor: normalizeHex(options['margin-border-color']),
      textBg: options['text-bg'] ? options['text-bg'].trim().replace(/[^a-zA-Z0-9#%(),. ]/g, '') : null,
      accentText: options['accent-text'] || null,
      accentTextColor: normalizeHex(options['accent-text-color']),
      reveals: parseList('reveals'),
      type: options.type || null,
      combines: parseList('combines'),
      unlocks: options.unlocks || null,
      code: options.code || null,
      codeHint: options['code_hint'] || null,
      codeSources: parseList('code_sources'),
      redHerring: options['red_herring'] === 'true',
      content,
    });
  }

  return cards;
}

export function mdHasCards(mdContent) {
  return /^(`{3,}|:{3,})\{card\}/m.test(mdContent);
}

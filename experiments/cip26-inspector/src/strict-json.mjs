// Bounded JSON text only: preserves duplicate-key evidence and invokes no caller objects.
export function parseJson(text, maxBytes) {
  if (typeof text !== 'string' || text.length > maxBytes || !text.isWellFormed() || new TextEncoder().encode(text).length > maxBytes) throw new TypeError('Expected bounded well-formed JSON text');
  let i = 0, nodes = 0;
  const numeric = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  const fail = () => { throw new TypeError('Invalid or unsupported JSON structure'); };
  const ws = () => { while (i < text.length && /[\t\n\r ]/.test(text[i])) i++; };
  function string() {
    const start = i++;
    while (i < text.length) {
      const c = text.charCodeAt(i++);
      if (c === 34) {
        let value; try { value = JSON.parse(text.slice(start, i)); } catch { fail(); }
        if (!value.isWellFormed()) fail();
        return value;
      }
      if (c < 32) fail();
      if (c === 92) i++;
    }
    fail();
  }
  function read(depth) {
    if (depth > 10 || ++nodes > 2048) fail();
    ws(); const c = text[i];
    if (c === '"') return string();
    if (c === '{') {
      i++; ws(); const object = Object.create(null);
      if (text[i] === '}') { i++; return object; }
      while (true) {
        if (text[i] !== '"') fail();
        const key = string();
        if (['__proto__', 'prototype', 'constructor'].includes(key) || Object.hasOwn(object, key)) fail();
        ws(); if (text[i++] !== ':') fail(); object[key] = read(depth + 1); ws();
        const end = text[i++]; if (end === '}') return object; if (end !== ',') fail(); ws();
      }
    }
    if (c === '[') {
      i++; ws(); const array = [];
      if (text[i] === ']') { i++; return array; }
      while (true) { array.push(read(depth + 1)); ws(); const end = text[i++]; if (end === ']') return array; if (end !== ',') fail(); }
    }
    for (const [word, value] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(word, i)) { i += word.length; return value; }
    }
    numeric.lastIndex = i;
    const token = numeric.exec(text)?.[0];
    if (!token) fail();
    i += token.length;
    // Preserve ambiguity as an unsupported value marker instead of rounding it into an integer.
    if (/[.eE]/.test(token) || token === '-0' || !Number.isSafeInteger(Number(token))) return Object.freeze({ unsupportedNumberToken: token });
    return Number(token);
  }
  const result = read(0); ws(); if (i !== text.length) fail(); return result;
}

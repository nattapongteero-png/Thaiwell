/**
 * Export design tokens (TS = source of truth) → W3C Design Tokens (DTCG) JSON
 * ใช้ import เข้า Figma ผ่าน Tokens Studio / Figma Variables หรือแปลงด้วย Style Dictionary
 *
 *   npm run tokens   → design-tokens/tokens.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { palette, space, radius, borderWidth, opacity, duration } from '../src/design-system/tokens/primitives';
import { themes } from '../src/design-system/tokens/semantic';
import { typeScale } from '../src/design-system/tokens/typography';
import { grid, breakpoints, sizing } from '../src/design-system/tokens/layout';

type Leaf = { $type: string; $value: unknown };
type Tree = { [k: string]: Tree | Leaf };

function wrap(obj: Record<string, unknown>, type: string, unit = ''): Tree {
  const out: Tree = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v !== null && typeof v === 'object' ? wrap(v as Record<string, unknown>, type, unit) : { $type: type, $value: unit && typeof v === 'number' ? `${v}${unit}` : v };
  }
  return out;
}

const typography: Tree = {};
for (const [k, s] of Object.entries(typeScale)) {
  typography[k] = {
    $type: 'typography',
    $value: { fontFamily: 'IBM Plex Sans Thai', fontWeight: s.fontFamily.match(/_(\d+)/)?.[1], fontSize: `${s.fontSize}px`, lineHeight: `${s.lineHeight}px`, letterSpacing: `${s.letterSpacing}px` },
  };
}

const tokens = {
  primitive: {
    color: wrap(palette, 'color'),
    space: wrap(space, 'dimension', 'px'),
    radius: wrap(radius, 'dimension', 'px'),
    borderWidth: wrap(borderWidth, 'dimension', 'px'),
    opacity: wrap(opacity, 'number'),
    duration: wrap(duration, 'duration', 'ms'),
  },
  semantic: {
    wireframe: { color: wrap(themes.wireframe as unknown as Record<string, unknown>, 'color') },
    brand: { color: wrap(themes.brand as unknown as Record<string, unknown>, 'color') },
  },
  typography,
  layout: {
    breakpoint: wrap(breakpoints, 'dimension', 'px'),
    grid: Object.fromEntries(
      Object.entries(grid).map(([bp, g]) => [
        bp,
        { columns: { $type: 'number', $value: g.columns }, ...wrap({ margin: g.margin, gutter: g.gutter, maxContentWidth: g.maxContentWidth }, 'dimension', 'px') },
      ]),
    ) as Tree,
    sizing: wrap(sizing, 'dimension', 'px'),
  },
};

const dir = join(__dirname, '..', 'design-tokens');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'tokens.json'), JSON.stringify(tokens, null, 2));
console.log('✓ design-tokens/tokens.json');

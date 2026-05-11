// Color palette initialised from Art/vintage-voltage.hex
// Defaults match the file content so the game works before fetch completes.

const _defaults = ['191930', '263d6e', '2f729e', 'eba254', 'f5d689', 'fff5d9'];

function _hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function _rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}

function _mixChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export const Colors = {
  bg: '#' + _defaults[0],
  bgSecondary: '#' + _defaults[1],
  accent: '#' + _defaults[2],
  warn: '#' + _defaults[3],
  highlight: '#' + _defaults[4],
  text: '#' + _defaults[5],

  setFromHexes(hexes) {
    this.bg = '#' + hexes[0];
    this.bgSecondary = '#' + hexes[1];
    this.accent = '#' + hexes[2];
    this.warn = '#' + hexes[3];
    this.highlight = '#' + hexes[4];
    this.text = '#' + hexes[5];
    this._syncCSSProps();
  },

  _syncCSSProps() {
    const root = document.documentElement;
    root.style.setProperty('--color-bg', this.bg);
    root.style.setProperty('--color-bg-secondary', this.bgSecondary);
    root.style.setProperty('--color-accent', this.accent);
    root.style.setProperty('--color-warn', this.warn);
    root.style.setProperty('--color-highlight', this.highlight);
    root.style.setProperty('--color-text', this.text);
  },

  rgba(hex, alpha) {
    const { r, g, b } = _hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  brighten(hex, amount) {
    const rgb = _hexToRgb(hex);
    return _rgbToHex({
      r: _mixChannel(rgb.r, 255, amount),
      g: _mixChannel(rgb.g, 255, amount),
      b: _mixChannel(rgb.b, 255, amount),
    });
  },

  darken(hex, amount) {
    const rgb = _hexToRgb(hex);
    return _rgbToHex({
      r: _mixChannel(rgb.r, 0, amount),
      g: _mixChannel(rgb.g, 0, amount),
      b: _mixChannel(rgb.b, 0, amount),
    });
  },
};

export async function initColors() {
  try {
    const resp = await fetch('Art/vintage-voltage.hex');
    const text = await resp.text();
    const hexes = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (hexes.length >= 6) {
      Colors.setFromHexes(hexes);
    }
  } catch (_) {
    // Keep defaults if fetch fails
    Colors._syncCSSProps();
  }
}

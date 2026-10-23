import type { ThemeColors } from './types'

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
}

/**
 * Curated color themes. Each one is designed as a whole: the map colors and the
 * paper/text colors of the layout belong together.
 */
export const THEMES: readonly Theme[] = [
  {
    id: 'atelier',
    name: 'Atelier',
    colors: {
      land: '#f8f4ec',
      water: '#c6d9d8',
      roads: '#1f1c17',
      buildings: '#ebe3d4',
      parks: '#e2e5d1',
      paper: '#ede5d5',
      textBox: '#ede5d5',
      text: '#1f1c17',
      frame: '#1f1c17',
    },
  },
  {
    id: 'classic',
    name: 'Classic',
    colors: {
      land: '#ffffff',
      water: '#a8c5df',
      roads: '#111111',
      buildings: '#e4e4e4',
      parks: '#eef1ea',
      paper: '#ffffff',
      textBox: '#ffffff',
      text: '#111111',
      frame: '#111111',
    },
  },
  {
    id: 'ink',
    name: 'Ink',
    colors: {
      land: '#fbfaf7',
      water: '#dedcd6',
      roads: '#1a1a1a',
      buildings: '#ecebe6',
      parks: '#f2f1ec',
      paper: '#fbfaf7',
      textBox: '#fbfaf7',
      text: '#1a1a1a',
      frame: '#1a1a1a',
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    colors: {
      land: '#0f0f11',
      water: '#26282e',
      roads: '#f2f2f2',
      buildings: '#1c1d21',
      parks: '#15161a',
      paper: '#0f0f11',
      textBox: '#0f0f11',
      text: '#f2f2f2',
      frame: '#f2f2f2',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      land: '#1b2a41',
      water: '#101b2c',
      roads: '#e9eef5',
      buildings: '#243753',
      parks: '#1f3149',
      paper: '#1b2a41',
      textBox: '#1b2a41',
      text: '#e9eef5',
      frame: '#e9eef5',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      land: '#1f5f7a',
      water: '#154559',
      roads: '#ffffff',
      buildings: '#2a6c88',
      parks: '#22667f',
      paper: '#ffffff',
      textBox: '#ffffff',
      text: '#16465a',
      frame: '#16465a',
    },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    colors: {
      land: '#1d4e89',
      water: '#153c6a',
      roads: '#dce9f7',
      buildings: '#285a97',
      parks: '#205391',
      paper: '#1d4e89',
      textBox: '#1d4e89',
      text: '#dce9f7',
      frame: '#dce9f7',
    },
  },
  {
    id: 'arctic',
    name: 'Arctic',
    colors: {
      land: '#eaf1f4',
      water: '#8db6ca',
      roads: '#2c5a70',
      buildings: '#d5e4eb',
      parks: '#dbe9e4',
      paper: '#f5f8fa',
      textBox: '#f5f8fa',
      text: '#1e3a48',
      frame: '#2c5a70',
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    colors: {
      land: '#dfe6d8',
      water: '#9db6b2',
      roads: '#3c4c41',
      buildings: '#d0dac8',
      parks: '#ccdac0',
      paper: '#eff3eb',
      textBox: '#eff3eb',
      text: '#2d3a31',
      frame: '#3c4c41',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      land: '#2e7d4f',
      water: '#5d7fd6',
      roads: '#ffffff',
      buildings: '#3a8a5b',
      parks: '#276b43',
      paper: '#ffffff',
      textBox: '#ffffff',
      text: '#173d27',
      frame: '#173d27',
    },
  },
  {
    id: 'lime',
    name: 'Lime',
    colors: {
      land: '#96d83e',
      water: '#7fd4ea',
      roads: '#121212',
      buildings: '#a7e05c',
      parks: '#86c933',
      paper: '#a3acc8',
      textBox: '#a3acc8',
      text: '#121212',
      frame: '#121212',
    },
  },
  {
    id: 'sand',
    name: 'Sand',
    colors: {
      land: '#f3ece2',
      water: '#c7d7d4',
      roads: '#3b3530',
      buildings: '#e7dccd',
      parks: '#e3e5d2',
      paper: '#f3ece2',
      textBox: '#f3ece2',
      text: '#3b3530',
      frame: '#3b3530',
    },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    colors: {
      land: '#f1e6d6',
      water: '#bdd2d0',
      roads: '#b5402e',
      buildings: '#e7d7c1',
      parks: '#e2e1c6',
      paper: '#f1e6d6',
      textBox: '#f1e6d6',
      text: '#6d281d',
      frame: '#b5402e',
    },
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    colors: {
      land: '#ebcdb5',
      water: '#8ea8b4',
      roads: '#783a21',
      buildings: '#e2bea2',
      parks: '#dfc7a6',
      paper: '#f7e9dc',
      textBox: '#f7e9dc',
      text: '#5a2814',
      frame: '#783a21',
    },
  },
  {
    id: 'blush',
    name: 'Blush',
    colors: {
      land: '#fbe4e5',
      water: '#f2b5ba',
      roads: '#d4434d',
      buildings: '#f6d2d5',
      parks: '#f7dcdd',
      paper: '#fff6f6',
      textBox: '#fff6f6',
      text: '#9b2630',
      frame: '#d4434d',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    colors: {
      land: '#a89ce0',
      water: '#8576cf',
      roads: '#ffffff',
      buildings: '#b4a9e6',
      parks: '#9e91da',
      paper: '#f6f4fd',
      textBox: '#f6f4fd',
      text: '#3a2e78',
      frame: '#3a2e78',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson',
    colors: {
      land: '#c8323a',
      water: '#9b1e29',
      roads: '#ffffff',
      buildings: '#d24550',
      parks: '#be2d36',
      paper: '#ffffff',
      textBox: '#ffffff',
      text: '#8c1b24',
      frame: '#8c1b24',
    },
  },
  {
    id: 'saffron',
    name: 'Saffron',
    colors: {
      land: '#f3ad2b',
      water: '#df881d',
      roads: '#fff8ec',
      buildings: '#f6bc4b',
      parks: '#eaa425',
      paper: '#ffffff',
      textBox: '#ffffff',
      text: '#7a4906',
      frame: '#7a4906',
    },
  },
  {
    id: 'copper',
    name: 'Copper',
    colors: {
      land: '#131313',
      water: '#252525',
      roads: '#c8935a',
      buildings: '#1d1d1d',
      parks: '#181818',
      paper: '#131313',
      textBox: '#131313',
      text: '#d9a86f',
      frame: '#c8935a',
    },
  },
] as const

export const DEFAULT_THEME_ID = 'atelier'

export function getTheme(id: string): Theme | undefined {
  return THEMES.find(t => t.id === id)
}

export const COLOR_KEYS = [
  'land',
  'water',
  'roads',
  'buildings',
  'parks',
  'paper',
  'textBox',
  'text',
  'frame',
] as const satisfies readonly (keyof ThemeColors)[]

export const MAP_COLOR_KEYS = ['roads', 'buildings', 'water', 'land', 'parks'] as const
export const LAYOUT_COLOR_KEYS = ['paper', 'textBox', 'text', 'frame'] as const

/** Returns the id of the preset theme whose colors match exactly, or `custom`. */
export function matchTheme(colors: ThemeColors): string {
  const found = THEMES.find(t => COLOR_KEYS.every(k => t.colors[k] === colors[k]))
  return found ? found.id : 'custom'
}

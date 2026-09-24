import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

// Designers judge skin and hair tints on screen, so the chrome is a true neutral grey
// (no blue cast like Aura's slate) and the one accent is reserved for actions.
const NEUTRAL = {
  0: '#ffffff',
  50: '#f7f7f8',
  100: '#eeeff0',
  200: '#e4e5e7',
  300: '#c6c8cc',
  400: '#a3a6ab',
  500: '#6a6d72',
  600: '#54575c',
  700: '#2a2c2f',
  800: '#202224',
  900: '#17181a',
  950: '#0e0f10',
}

// Process cyan. Filled buttons use 600, because white text on 500 falls short of 4.5:1.
const CYAN = {
  50: '#e6f4fb',
  100: '#c2e4f5',
  200: '#8fcdec',
  300: '#55b2df',
  400: '#2399d2',
  500: '#0088c7',
  600: '#0074aa',
  700: '#005f8b',
  800: '#004b6e',
  900: '#003a55',
  950: '#00263a',
}

export const WORKSPACE_PRESET = definePreset(Aura, {
  primitive: {
    borderRadius: { none: '0', xs: '2px', sm: '3px', md: '4px', lg: '6px', xl: '8px' },
  },
  semantic: {
    primary: CYAN,
    focusRing: { width: '2px', style: 'solid', color: '{primary.500}', offset: '2px' },
    colorScheme: {
      light: {
        surface: NEUTRAL,
        primary: {
          color: '{primary.600}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.700}',
          activeColor: '{primary.800}',
        },
        // Selection stays neutral so it never reads as a colour choice next to a swatch.
        highlight: {
          background: '{surface.200}',
          focusBackground: '{surface.300}',
          color: '{surface.800}',
          focusColor: '{surface.900}',
        },
      },
    },
  },
})

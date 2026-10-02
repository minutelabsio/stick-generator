import { describe, expect, it } from 'vitest'
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_ROLES, PALETTE_IDS, SLOT_IDS, SLOTS } from './figure'

// The stick figure as v1 drew it. The draw order is pinned in src/lib/render-figure.test.ts.
describe('stick figure structure', () => {
  it('draws on a 710×943 canvas', () => {
    expect({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }).toEqual({ width: 710, height: 943 })
  })

  it('has these slots, in picker order', () => {
    expect(SLOT_IDS.map(slot => ({ id: slot, ...SLOTS[slot] }))).toEqual([
      { id: 'body', label: 'Body', colorRoles: [], required: true },
      { id: 'head', label: 'Head', colorRoles: ['skin'], required: true },
      { id: 'hair', label: 'Hair', colorRoles: ['hair'], required: false },
      { id: 'hat', label: 'Hat', colorRoles: ['hat'], required: false },
      { id: 'mustache', label: 'Mustache', colorRoles: ['facialHair'], required: false },
      { id: 'beard', label: 'Beard', colorRoles: ['facialHair'], required: false },
      { id: 'longbeard', label: 'Long beard', colorRoles: ['facialHair'], required: false },
      { id: 'glasses', label: 'Glasses', colorRoles: ['glassesFrame', 'glassesLens'], required: false },
      { id: 'accessory', label: 'Accessory', colorRoles: [], required: false },
    ])
  })

  it('has these colour roles, each picking from a palette', () => {
    expect(Object.entries(COLOR_ROLES).map(([id, role]) => ({ id, ...role }))).toEqual([
      { id: 'skin', label: 'Skin', palette: 'skin' },
      { id: 'hair', label: 'Hair colour', palette: 'hair' },
      { id: 'hat', label: 'Hat colour', palette: 'hat' },
      { id: 'facialHair', label: 'Facial hair colour', palette: 'hair' },
      { id: 'glassesFrame', label: 'Frame colour', palette: 'glasses' },
      { id: 'glassesLens', label: 'Lens colour', palette: 'glasses' },
    ])
  })

  it('has these palettes', () => {
    expect(PALETTE_IDS).toEqual(['skin', 'hair', 'hat', 'glasses'])
  })
})

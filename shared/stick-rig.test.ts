import { describe, expect, it } from 'vitest'
import { STICK_RIG } from './stick-rig'

// The stick figure as v1 drew it. The draw order is pinned in src/lib/render-figure.test.ts.
describe('STICK_RIG', () => {
  it('draws on a 710×943 canvas', () => {
    expect(STICK_RIG.canvas).toEqual({ width: 710, height: 943 })
  })

  it('has these slots, in picker order', () => {
    expect(STICK_RIG.slots.map(({ id, label, group, colorRoles, required }) => ({ id, label, group, colorRoles, required }))).toEqual([
      { id: 'body', label: 'Body', group: 'Figure', colorRoles: [], required: true },
      { id: 'head', label: 'Head', group: 'Figure', colorRoles: ['skin'], required: true },
      { id: 'hair', label: 'Hair', group: 'Figure', colorRoles: ['hair'], required: false },
      { id: 'hat', label: 'Hat', group: 'Figure', colorRoles: ['hat'], required: false },
      { id: 'mustache', label: 'Mustache', group: 'Facial hair', colorRoles: ['facialHair'], required: false },
      { id: 'beard', label: 'Beard', group: 'Facial hair', colorRoles: ['facialHair'], required: false },
      { id: 'longbeard', label: 'Long beard', group: 'Facial hair', colorRoles: ['facialHair'], required: false },
      { id: 'glasses', label: 'Glasses', group: 'Extras', colorRoles: ['glassesFrame', 'glassesLens'], required: false },
      { id: 'accessory', label: 'Accessory', group: 'Extras', colorRoles: [], required: false },
    ])
  })

  it('has these colour roles, each picking from a palette', () => {
    expect(STICK_RIG.colorRoles.map(({ id, label, palette }) => ({ id, label, palette }))).toEqual([
      { id: 'skin', label: 'Skin', palette: 'skin' },
      { id: 'hair', label: 'Hair colour', palette: 'hair' },
      { id: 'hat', label: 'Hat colour', palette: 'hat' },
      { id: 'facialHair', label: 'Facial hair colour', palette: 'hair' },
      { id: 'glassesFrame', label: 'Frame colour', palette: 'glasses' },
      { id: 'glassesLens', label: 'Lens colour', palette: 'glasses' },
    ])
  })

  it('has these palettes', () => {
    expect(STICK_RIG.palettes).toEqual(['skin', 'hair', 'hat', 'glasses'])
  })
})

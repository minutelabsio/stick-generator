import type { Rig } from './rig'

// The stick figure as v1 drew it: same canvas, slots, colours, and draw order.
export const STICK_RIG: Rig = {
  canvas: { width: 710, height: 943 },
  initialSlot: 'head',
  palettes: ['skin', 'hair', 'hat', 'glasses'],
  // Palette order is display order, and its first entries (white hair, pale blue
  // frames) make poor starting points, hence the defaults.
  colorRoles: [
    { id: 'skin', label: 'Skin', palette: 'skin' },
    { id: 'hair', label: 'Hair colour', palette: 'hair', defaultColor: '#63503C' },
    { id: 'hat', label: 'Hat colour', palette: 'hat' },
    { id: 'facialHair', label: 'Facial hair colour', palette: 'hair', followsRole: 'hair' },
    { id: 'glassesFrame', label: 'Frame colour', palette: 'glasses', defaultColor: '#1A1A1A' },
    { id: 'glassesLens', label: 'Lens colour', palette: 'glasses', defaultColor: '#FCF4F0' },
  ],
  // Most people don't wear a hat, hence the low random fill chances.
  slots: [
    { id: 'body', label: 'Body', group: 'Figure', required: true, colorRoles: [], randomFillChance: 1 },
    { id: 'head', label: 'Head', group: 'Figure', required: true, colorRoles: ['skin'], randomFillChance: 1 },
    { id: 'hair', label: 'Hair', group: 'Figure', required: false, colorRoles: ['hair'], randomFillChance: 0.8 },
    { id: 'hat', label: 'Hat', group: 'Figure', required: false, colorRoles: ['hat'], randomFillChance: 0.25 },
    { id: 'mustache', label: 'Mustache', group: 'Facial hair', required: false, colorRoles: ['facialHair'], randomFillChance: 0.2 },
    { id: 'beard', label: 'Beard', group: 'Facial hair', required: false, colorRoles: ['facialHair'], randomFillChance: 0.2 },
    { id: 'longbeard', label: 'Long beard', group: 'Facial hair', required: false, colorRoles: ['facialHair'], randomFillChance: 0.05 },
    { id: 'glasses', label: 'Glasses', group: 'Extras', required: false, colorRoles: ['glassesFrame', 'glassesLens'], randomFillChance: 0.35 },
    { id: 'accessory', label: 'Accessory', group: 'Extras', required: false, colorRoles: [], randomFillChance: 0.15 },
  ],
  layers: [
    { slot: 'hat', part: 'backMask', colorRole: 'hat' },
    { slot: 'hat', part: 'backLine' },
    { slot: 'hair', part: 'backMask', colorRole: 'hair' },
    { slot: 'hair', part: 'backLine' },
    { slot: 'body', part: 'line' },
    { slot: 'head', part: 'mask', colorRole: 'skin' },
    { slot: 'beard', part: 'line', colorRole: 'facialHair' },
    { slot: 'mustache', part: 'line', colorRole: 'facialHair' },
    { slot: 'head', part: 'line' },
    { slot: 'hair', part: 'mask', colorRole: 'hair' },
    { slot: 'hair', part: 'line' },
    { slot: 'glasses', part: 'mask', colorRole: 'glassesLens' },
    { slot: 'glasses', part: 'line', colorRole: 'glassesFrame' },
    { slot: 'accessory', part: 'line' },
    { slot: 'longbeard', part: 'mask', colorRole: 'facialHair' },
    { slot: 'longbeard', part: 'line' },
    { slot: 'hat', part: 'mask', colorRole: 'hat' },
    { slot: 'hat', part: 'line' },
  ],
}

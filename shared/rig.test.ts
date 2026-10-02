import { describe, expect, it } from 'vitest'
import { Rig } from './rig'
import type { Rig as RigType } from './rig'
import { STICK_RIG } from './stick-rig'

const issues = (rig: RigType) => Rig.safeParse(rig).error?.issues.map(issue => issue.message) ?? []

const withSlot = (slotId: string, changes: Partial<RigType['slots'][number]>): RigType => ({
  ...STICK_RIG,
  slots: STICK_RIG.slots.map(slot => (slot.id === slotId ? { ...slot, ...changes } : slot)),
})

const withRole = (roleId: string, changes: Partial<RigType['colorRoles'][number]>): RigType => ({
  ...STICK_RIG,
  colorRoles: STICK_RIG.colorRoles.map(role => (role.id === roleId ? { ...role, ...changes } : role)),
})

const withLayers = (layers: RigType['layers']): RigType => ({ ...STICK_RIG, layers: [...STICK_RIG.layers, ...layers] })

describe('Rig', () => {
  it('accepts the stick figure', () => {
    expect(issues(STICK_RIG)).toEqual([])
  })

  // A rig that breaks these would draw wrongly or strand existing figures, so each is refused.
  it.each([
    ['a layer for a missing slot', withLayers([{ slot: 'wings', part: 'line' }]), 'A layer uses slot "wings", which does not exist.'],
    ['a layer coloured by a missing role', withLayers([{ slot: 'accessory', part: 'mask', colorRole: 'gold' }]), 'A layer uses colour role "gold", which does not exist.'],
    ['the same part drawn twice', withLayers([{ slot: 'body', part: 'line' }]), 'Layer "body.line" is drawn twice.'],
    ['a slot with no line art', { ...STICK_RIG, layers: STICK_RIG.layers.filter(layer => layer.slot !== 'accessory') }, 'Slot "accessory" has no line layer, but every asset has line art.'],
    ['a slot offering a colour its layers never use', withSlot('accessory', { colorRoles: ['hat'] }), 'Slot "accessory" must list exactly the colour roles its layers use.'],
    ['a slot hiding a colour its layers use', withSlot('glasses', { colorRoles: ['glassesFrame'] }), 'Slot "glasses" must list exactly the colour roles its layers use.'],
    ['a required slot that randomising may skip', withSlot('body', { randomFillChance: 0.5 }), 'Slot "body" is required, so randomising must always fill it.'],
    ['a colour role with a missing palette', withRole('hat', { palette: 'shoes' }), 'Colour role "hat" uses palette "shoes", which does not exist.'],
    ['a colour role following a follower', withRole('hair', { followsRole: 'facialHair' }), 'Colour role "facialHair" must follow a role that follows nothing.'],
    ['a colour role no slot uses', { ...STICK_RIG, colorRoles: [...STICK_RIG.colorRoles, { id: 'shoes', label: 'Shoes', palette: 'hat' }] }, 'Colour role "shoes" is not used by any slot.'],
    ['two slots with one id', { ...STICK_RIG, slots: [...STICK_RIG.slots, ...STICK_RIG.slots.slice(0, 1)] }, 'Slot "body" is listed twice.'],
    ['an editor opening on a missing slot', { ...STICK_RIG, initialSlot: 'wings' }, 'The editor opens on slot "wings", which does not exist.'],
  ])('refuses %s', (_case, rig, message) => {
    expect(issues(rig)).toContain(message)
  })
})

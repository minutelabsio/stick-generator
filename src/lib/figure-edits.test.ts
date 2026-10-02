import { afterEach, describe, expect, it, vi } from 'vitest'
import { SLOT_IDS } from '@shared/figure'
import { STICK_RIG } from '@shared/stick-rig'
import type { Library, LibraryAsset } from '@shared/api-types'
import { initialFigure, randomFigure, selectAsset } from './figure-edits'

const asset = (slot: LibraryAsset['slot'], number: number): LibraryAsset =>
  ({ id: `${slot}-${number}`, slot, label: `${slot} ${number}`, partUrls: { line: `/${slot}-${number}.png` } })

const LIBRARY: Library = {
  assets: SLOT_IDS.flatMap(slot => [asset(slot, 1), asset(slot, 2)]),
  palettes: {
    skin: ['#000001', '#000002'],
    hair: ['#FFFFFF', '#000003', '#000008'],
    hat: ['#000004', '#000005'],
    glasses: ['#000006', '#000007'],
  },
  rig: STICK_RIG,
}

const stubRandom = (value: number) => vi.spyOn(Math, 'random').mockReturnValue(value)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('initialFigure', () => {
  it('starts with the first body and head, and a random skin', () => {
    stubRandom(0.5)

    expect(initialFigure(LIBRARY)).toEqual({
      assets: { body: 'body-1', head: 'head-1' },
      colors: { skin: '#000002' },
    })
  })
})

describe('selectAsset', () => {
  const pick = (slot: LibraryAsset['slot'], colors = {}) =>
    selectAsset({ assets: {}, colors }, slot, `${slot}-2`, LIBRARY)

  it('colours hair with the default brown rather than the palette\'s first swatch', () => {
    expect(pick('hair').colors).toEqual({ hair: '#63503C' })
  })

  it('colours a hat with the first swatch of its palette', () => {
    expect(pick('hat').colors).toEqual({ hat: '#000004' })
  })

  it('gives glasses default frame and lens colours', () => {
    expect(pick('glasses').colors).toEqual({ glassesFrame: '#1A1A1A', glassesLens: '#FCF4F0' })
  })

  it('colours facial hair to match the hair', () => {
    expect(pick('mustache', { hair: '#000003' }).colors).toEqual({ hair: '#000003', facialHair: '#000003' })
  })

  it('colours facial hair with the default hair brown when no hair colour is set', () => {
    expect(pick('beard').colors).toEqual({ facialHair: '#63503C' })
  })

  it('keeps a colour that is already chosen', () => {
    expect(pick('hat', { hat: '#000005' }).colors).toEqual({ hat: '#000005' })
  })

  it('clears a slot without touching colours', () => {
    const cleared = selectAsset({ assets: { hat: 'hat-1' }, colors: { hat: '#000005' } }, 'hat', undefined, LIBRARY)

    expect(cleared).toEqual({ assets: { hat: undefined }, colors: { hat: '#000005' } })
  })
})

describe('randomFigure', () => {
  it('fills every slot and colour when every roll succeeds', () => {
    stubRandom(0)

    expect(randomFigure(LIBRARY)).toEqual({
      assets: Object.fromEntries(SLOT_IDS.map(slot => [slot, `${slot}-1`])),
      colors: {
        skin: '#000001',
        hair: '#FFFFFF',
        hat: '#000004',
        facialHair: '#FFFFFF',
        glassesFrame: '#000006',
        glassesLens: '#000006',
      },
    })
  })

  it('always fills the body and head, and only those when every roll fails', () => {
    stubRandom(0.99)

    expect(Object.keys(randomFigure(LIBRARY).assets)).toEqual(['body', 'head'])
  })

  it('colours facial hair to match the hair, not with its own roll', () => {
    // Cycling rolls make neighbouring picks differ, so a separate facial hair roll would show.
    const rolls = [0, 0.6, 0.9]
    let calls = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      calls += 1
      return rolls[calls % rolls.length] ?? 0
    })

    const { colors } = randomFigure(LIBRARY)

    expect(colors.hair).toBeDefined()
    expect(colors.facialHair).toBe(colors.hair)
  })
})

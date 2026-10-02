import { describe, expect, it } from 'vitest'
import { SLOT_IDS } from '@shared/figure'
import type { FigureConfig } from '@shared/figure'
import type { LibraryAsset } from '@shared/api-types'
import { drawSteps } from './render-figure'

// Every slot gets an asset with every part, so each layer in the stack resolves.
const ASSETS_BY_ID = new Map(SLOT_IDS.map((slot): [string, LibraryAsset] => [slot, {
  id: slot,
  slot,
  label: slot,
  partUrls: { line: `${slot}/line`, mask: `${slot}/mask`, backLine: `${slot}/backLine`, backMask: `${slot}/backMask` },
}]))

const FULL_FIGURE: FigureConfig = {
  assets: Object.fromEntries(SLOT_IDS.map(slot => [slot, slot])),
  colors: {
    skin: '#000001',
    hair: '#000002',
    hat: '#000003',
    facialHair: '#000004',
    glassesFrame: '#000005',
    glassesLens: '#000006',
  },
}

describe('drawSteps', () => {
  it('draws the layers back to front in the v1 order, each with its colour', () => {
    expect(drawSteps({ figure: FULL_FIGURE, assetsById: ASSETS_BY_ID })).toEqual([
      { url: 'hat/backMask', color: '#000003' },
      { url: 'hat/backLine', color: undefined },
      { url: 'hair/backMask', color: '#000002' },
      { url: 'hair/backLine', color: undefined },
      { url: 'body/line', color: undefined },
      { url: 'head/mask', color: '#000001' },
      { url: 'beard/line', color: '#000004' },
      { url: 'mustache/line', color: '#000004' },
      { url: 'head/line', color: undefined },
      { url: 'hair/mask', color: '#000002' },
      { url: 'hair/line', color: undefined },
      { url: 'glasses/mask', color: '#000006' },
      { url: 'glasses/line', color: '#000005' },
      { url: 'accessory/line', color: undefined },
      { url: 'longbeard/mask', color: '#000004' },
      { url: 'longbeard/line', color: undefined },
      { url: 'hat/mask', color: '#000003' },
      { url: 'hat/line', color: undefined },
    ])
  })

  it('skips empty slots and parts an asset does not have, and leaves unchosen colours unset', () => {
    const hairWithoutBack: LibraryAsset = { id: 'short-hair', slot: 'hair', label: 'Short hair', partUrls: { line: 'short/line', mask: 'short/mask' } }
    const figure: FigureConfig = { assets: { head: 'head', hair: 'short-hair' }, colors: { skin: '#000001' } }

    expect(drawSteps({ figure, assetsById: new Map([...ASSETS_BY_ID, ['short-hair', hairWithoutBack]]) })).toEqual([
      { url: 'head/mask', color: '#000001' },
      { url: 'head/line', color: undefined },
      { url: 'short/mask', color: undefined },
      { url: 'short/line', color: undefined },
    ])
  })
})

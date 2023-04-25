import { base } from '$app/paths'
import { pipeline, parallelMap, consume } from 'streaming-iterables'
import { loadImage } from './canvas'

const fileList = (pfx, count = 1) => {
  return Array.from({ length: count }, (_, i) => {
    const n = (i + 1).toString().padStart(2, '0')
    return `${pfx}-${n}.png`
  })
}
const hairColors = [
  'white',
  '#292929',
  '#333333',
  '#4D4D4D',
  '#666666',
  '#A6A6A6',
  '#CCCCCC',
  '#63503C',
  '#775E46',
  '#99784A',
  '#BC975A',
  '#E1C175',
  '#EDD686',
  '#63403C',
  '#774F46',
  '#9C5D50',
  '#B86B4E',
  '#C87146',
  '#EDA386',
  '#692E59',
  '#813475',
  '#983F8A',
  '#B553A6',
  '#DC69CB',
  '#E883D9',
  '#473764',
  '#574082',
  '#7555B0',
  '#9169DC',
  '#2A4A75',
  '#5077AD',
  '#6999DC',
  '#4A8AAA',
  '#53A6C2',
  '#69D0DC',
  '#56C0A5',
  '#84DBBA',
  '#A2EFD1',
  '#7BC57D',
  '#A2EFA4',
  '#AEC973',
  '#D7EFA2',
  '#D2D066',
  '#F4F38C',
]
const skinColors = [
  '#F5DDCE',
  '#F0C4B8',
  '#D4AD9F',
  '#D4AA78',
  '#B7775D',
  '#895C4A',
  '#67493D',
  '#4F3B33',
  '#FFFFFF',
]
const facialHairColors = hairColors
const hatColors = [
  '#7CCDEB',
  '#287CED',
  '#E4A718',
  '#F37C21',
  '#DB403F',
  '#F8E15F',
  '#A2D57A',
  '#5A8847',
  '#726557',
  '#C0887F',
  '#F397D2',
  '#CF71E8',
  '#8C60D4',
  '#80807F',
  '#4D4D4C',
  '#E4E4E3',
]
const glassesColors = hatColors
const mockBase = `${base}/stick-assets`
const bodies = fileList(`${mockBase}/Bodies/body`)
const heads = fileList(`${mockBase}/Heads/head`)
const headMasks = fileList(`${mockBase}/Heads/maskhead`)
const hairStyles = fileList(`${mockBase}/Hairs/hair`)
const facialHairStyles = fileList(`${mockBase}/Facial Hairs/facialhair`)
const glasses = fileList(`${mockBase}/Glasses/glasses`, 2)
const accessories = fileList(`${mockBase}/Accessories/accessory`, 3)
const hats = fileList(`${mockBase}/Hats/hat`)
const hatMasks = fileList(`${mockBase}/Hats/maskhat`, 3)

const fetchList = async (base, category, prefix) => {
  const mock = import.meta.env.MODE === 'development'
  const fullpath = `${base}/${category}`
  const res = await fetch(fullpath)
  if (!res.ok){
    throw new Error(await res.text())
  }
  const list = await res.json()
  return list.filter(p => p.startsWith(prefix)).map(p => {
    return mock ? `${mockBase}/${category}/${p}` : `${fullpath}/${p}`
  })
}

const assets = {
  bodies,
  heads,
  headMasks,
  hairStyles,
  hairColors,
  skinColors,
  facialHairStyles,
  facialHairColors,
  glasses,
  accessories,
  hats,
  hatMasks,
  hatColors
}

const getHairId = path => {
  return path.match(/([^/.b]+)b?\.(png|jpe?g)$/)[1]
}

const isHairBack = path => {
  return /b\.(png|jpe?g)$/.test(path)
}

function hairFrontBack(list){
  const byId = {}
  for (const file of list){
    const id = getHairId(file)
    byId[id] = byId[id] || []
    if (isHairBack(file)){
      byId[id].push(file)
    } else {
      byId[id].unshift(file)
    }
  }
  return Object.values(byId).map((entry: any) => {
    if (entry.length === 1){
      return entry[0]
    }
    return entry
  })
}

type Loader = { refresh: () => void; value: Promise<any> }
const createLoader = (fn): Loader => {
  const loader = {
    value: Promise.resolve([]),
    refresh(){
      loader.value = Promise.resolve(fn())
    }
  }
  return loader
}

const isLoader = (asset): asset is Loader => ('refresh' in asset)
const basePath = `${base}/api/assets`
const Assets = {
  bodies: createLoader(() => fetchList(basePath, 'Bodies', 'body')),
  heads: createLoader(() => fetchList(basePath, 'Heads', 'head')),
  headMasks: createLoader(() => fetchList(basePath, 'Heads', 'maskhead')),
  hairStyles: createLoader(async () => hairFrontBack(await fetchList(basePath, 'Hairs', 'hair'))),
  hairColors: hairColors,
  skinColors: skinColors,
  beardStyles: createLoader(() => fetchList(basePath, 'Facial Hairs', 'beard')),
  mustacheStyles: createLoader(() => fetchList(basePath, 'Facial Hairs', 'mustache')),
  longbeardStyles: createLoader(() => fetchList(basePath, 'Facial Hairs', 'longbeard')),
  facialHairColors: facialHairColors,
  glasses: createLoader(() => fetchList(basePath, 'Glasses', 'glasses')),
  glassesMasks: createLoader(() => fetchList(basePath, 'Glasses', 'maskglasses')),
  glassesColors: glassesColors,
  accessories: createLoader(() => fetchList(basePath, 'Accessories', 'accessory')),
  hats: createLoader(() => fetchList(basePath, 'Hats', 'hat')),
  hatMasks: createLoader(() => fetchList(basePath, 'Hats', 'maskhat')),
  hatColors: hatColors,
  async getAll(): Promise<any> {
    const entries = await Promise.all(
      Object.entries(Assets)
        .filter(([key, asset]) => typeof asset !== 'function')
        .map(async ([key, asset]) => {
          if (isLoader(asset)){ return [key, await asset.value] }
          return [key, asset]
        })
    )
    return Object.fromEntries(entries)
  },
  async refreshAll(): Promise<void> {
    await Promise.allSettled(
      Object.values(Assets)
        .filter(isLoader)
        .map(asset => asset?.refresh())
    )
  }
}

export default Assets
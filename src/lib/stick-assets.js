import { base } from '$app/paths'

const fileList = (pfx, count = 1) => {
  return Array.from({ length: count }, (_, i) => {
    const n = (i + 1).toString().padStart(2, '0')
    return `${pfx}-${n}.png`
  })
}
const colors = [
  'red', 'green', 'blue'
]
const hairColors = [
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
const facialHairColors = [
  '#1778BA',
  '#333333',
  '#726557',
  '#7C3E99',
  '#808080',
  '#CB7844',
  '#DBD1B7',
  '#E4E4E4',
]
const hatColors = colors
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
    console.log(id)
    byId[id] = byId[id] || []
    if (isHairBack(file)){
      byId[id].push(file)
    } else {
      byId[id].unshift(file)
    }
  }
  return Object.values(byId).map(entry => {
    if (entry.length === 1){
      return entry[0]
    }
    return entry
  })
}

export default {
  async load(){
    const assets = {}
    const basePath = `${base}/api/assets`
    const [
      bodies,
      heads,
      headMasks,
      hairStyles,
      facialHairStyles,
      glasses,
      accessories,
      hats,
      hatMasks
    ] = await Promise.all([
      fetchList(basePath, 'Bodies', 'body'),
      fetchList(basePath, 'Heads', 'head'),
      fetchList(basePath, 'Heads', 'maskhead'),
      fetchList(basePath, 'Hairs', 'hair'),
      fetchList(basePath, 'Facial Hairs', 'facialhair'),
      fetchList(basePath, 'Glasses', 'glasses'),
      fetchList(basePath, 'Accessories', 'accessory'),
      fetchList(basePath, 'Hats', 'hat'),
      fetchList(basePath, 'Hats', 'maskhat'),
    ])
    assets.bodies = bodies
    assets.heads = heads
    assets.headMasks = headMasks
    assets.hairStyles = hairFrontBack(hairStyles)
    assets.hairColors = hairColors
    assets.skinColors = skinColors
    assets.facialHairStyles = facialHairStyles
    assets.facialHairColors = facialHairColors
    assets.glasses = glasses
    assets.accessories = accessories
    assets.hats = hats
    assets.hatMasks = hatMasks
    assets.hatColors = hatColors
    return assets
  }
}
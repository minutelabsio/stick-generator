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
  '#1778BA',
  '#333333',
  '#726557',
  '#7C3E99',
  '#808080',
  '#CB7844',
  '#DBD1B7',
  '#E4E4E4'
]
const skinColors = [
  '#000000',
  '#6C402E',
  '#895C4A',
  '#B7775D',
  '#D4AA78',
  '#D4AD9F',
  '#F0C4B8',
  '#F5DDCE',
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
const basePath = '/stick-assets'
const bodies = fileList(`${basePath}/Bodies/body`)
const heads = fileList(`${basePath}/Heads/head`)
const headMasks = fileList(`${basePath}/Heads/maskhead`)
const hairStyles = fileList(`${basePath}/Hairs/hair`)
const facialHairStyles = fileList(`${basePath}/Facial Hairs/facialhair`)
const glasses = fileList(`${basePath}/Glasses/glasses`, 2)
const accessories = fileList(`${basePath}/Accessories/accessory`, 3)
const hats = fileList(`${basePath}/Hats/hat`)
const hatMasks = fileList(`${basePath}/Hats/maskhat`, 3)

export default {
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
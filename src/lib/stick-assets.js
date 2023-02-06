const fileList = (pfx, count = 1) => {
  return Array.from({ length: count }, (_, i) => {
    const n = (i + 1).toString().padStart(2, '0')
    return `${pfx}-${n}.png`
  })
}
const colors = [
  'red', 'green', 'blue'
]
const basePath = '/stick-assets'
const bodies = fileList(`${basePath}/Bodies/body`)
const heads = fileList(`${basePath}/Heads/head`)
const headMasks = fileList(`${basePath}/Heads/maskhead`)
const hairStyles = fileList(`${basePath}/Hairs/hair`)
const hairColors = colors
const skinColors = colors
const facialHairStyles = []
const facialHairColors = colors
const glasses = []
const accessories = fileList(`${basePath}/Accessories/accessory`)

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
  accessories
}
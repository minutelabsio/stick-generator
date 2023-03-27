import {
  parse as parseCsv
} from 'csv-parse/browser/esm/sync'
import { v4 as uuidv4 } from 'uuid'
import { setCache } from '../cache'

const MOCK_ITEMS = [
  {
    'Timestamp': '3/14/2023 11:38:10',
    'Email Address': 'well.caffeinated@gmail.com',
    'Favorite thing': 'Option 2',
    'Likeness of you': 'https://drive.google.com/open?id=1CVb4vbdHWoXNToMBsj1y7DwAjUfu-5Lb',
    'Filename': 'download20210605003031 - Jasper Palfree.png',
    'stickProps': {
      'hat': '/stick-assets/Hats/hat-01.png',
      'hatColor': 'green',
      'hairStyle': null,
      'hairColor': null,
      'skinColor': null,
      'facialHairStyle': null,
      'facialHairColor': null,
      'glasses': null,
      'accessory': null,
      'customImage': null,
      'customImageLayerIndex': 0
    }
  },
  {
    'Timestamp': '3/14/2023 11:40:58',
    'Email Address': 'well.caffeinated@gmail.com',
    'Favorite thing': 'Option 3',
    'Likeness of you': 'https://drive.google.com/open?id=1B28M9cZzCNYrB-vddq-qYd7dXowkMtji',
    'Filename': 'Red-Wolf - Jasper Palfree.png'
  }
]

function csvToJson(text : string){
  const rows = parseCsv(text, { columns: true })
  return rows
}

async function getResponsesFromR2(bucket, filename){
  const obj = await bucket.get(`responses/${filename}`)
  if (!obj){
    return null
  }
  const rows = csvToJson(await obj.text())
  for (const row of rows){
    row.id = uuidv4()
  }
  return rows
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  if (env.mock) {
    return setCache(new Response(JSON.stringify(MOCK_ITEMS)))
  }
  try {
    const { response } = params
    const filename = decodeURIComponent(response as string)
    const bucket = env.STICK_FIGURES
    const kv = env.STICK_FIGURE_DATA
    const data = await kv.get(`${filename}`, 'text')
    if (data){
      return setCache(new Response(data))
    }
    const rows = await getResponsesFromR2(bucket, filename)
    if (!rows) {
      return setCache(new Response('Not found', { status: 404 }))
    }
    const text = JSON.stringify(rows)
    await kv.put(`${filename}`, text)
    return setCache(new Response(text, { headers: { 'Content-Type': 'text/json' }}))
  } catch (e) {
    return setCache(new Response(e.message, { status: 500 }))
  }
}

function applyUpdates(original, updates : Array<any>){
  const todo = updates.slice(0)
  return original.map(entry => {
    if (!todo.length){ return entry }
    const idx = todo.findIndex(o => o.id === entry.id)
    if (idx < 0){ return entry }
    const update = todo[idx]
    todo.splice(idx, 1)
    return Object.assign({}, entry, update)
  })
}

// save data
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const { response } = params
    const filename = decodeURIComponent(response as string)
    const kv = env.STICK_FIGURE_DATA
    const data = await kv.get(`${filename}`, 'json')
    if (data === null) {
      return setCache(new Response('Not found', { status: 404 }))
    }

    const updates = await request.json()
    if (!Array.isArray(updates)){
      return setCache(new Response('Bad Data from client', { status: 400 }))
    }

    const updatedData = applyUpdates(data, updates)

    const text = JSON.stringify(updatedData)
    await kv.put(`${filename}`, text)

    return setCache(new Response(text, { headers: { 'Content-Type': 'text/json' } }))
  } catch (e) {
    return setCache(new Response(e.message, { status: 500 }))
  }
}
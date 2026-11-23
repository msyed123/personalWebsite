// Exercise Nitro's production HTTP route with a fake TomTom vector tile.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import assert from 'node:assert/strict'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const fixture=resolve(root,'tests/fixtures/mock-tomtom-fetch.mjs')
const port=Number(process.env.SMOKE_PORT || 4547)
const child=spawn(process.execPath,['--import',fixture,resolve(root,'.output/server/index.mjs')],{
 env:{...process.env,NITRO_PORT:String(port),NITRO_HOST:'127.0.0.1',NUXT_TOMTOM_TRAFFIC_KEY:'ci-dummy-key'},
 cwd:root,stdio:['ignore','pipe','pipe']
})
let logs=''
child.stderr.on('data',data=>logs+=String(data).slice(0,15000))
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
try {
 let booted=false
 for(let attempt=0;attempt<60;attempt++){
   if(child.exitCode!==null)throw new Error('Server exited before responding: '+logs)
   try {
     const res=await fetch(`http://127.0.0.1:${port}/api/traffic/status`)
     if(res.ok){booted=true;break}
   }catch {}
   await delay(250)
 }
 assert.ok(booted,'Nuxt production server did not boot: '+logs)
 const res=await fetch(`http://127.0.0.1:${port}/api/traffic/roads/11/328/715`)
 const body=await res.json()
 assert.equal(res.status,200,'Traffic route must load and return normalized vector geometry; '+JSON.stringify(body))
 assert.equal(body.type,'FeatureCollection')
 assert.ok(body.features.length>0,'No road features decoded')
 assert.ok(body.features[0].geometry.type==='LineString','Wrong geometry')
 assert.equal(body.features[0].properties.condition,'slow')
 assert.equal(body.features[0].properties.source,'TomTom')
 console.log('PASS: production traffic endpoint decoded mocked TomTom vector tile successfully')
} finally {
 child.kill()
}

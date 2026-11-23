import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const fixture=resolve(root,'tests/fixtures/mock-terminal-providers.mjs')
const port=Number(process.env.SMOKE_PORT||4571)
const child=spawn(process.execPath,['--import',fixture,resolve(root,'.output/server/index.mjs')],{
  cwd:root,
  env:{...process.env,NITRO_PORT:String(port),NITRO_HOST:'127.0.0.1',
    NUXT_TOMTOM_TRAFFIC_KEY:'dummy-test-credential'},
  stdio:['ignore','pipe','pipe']
})
let log=''
child.stderr.on('data',chunk=>log+=String(chunk).slice(0,3000))
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const base=`http://127.0.0.1:${port}`
try {
  let ready=false
  for(let attempt=0;attempt<60;attempt++){
    try {
      const response=await fetch(base+'/api/traffic/status')
      if(response.ok){ready=true;break}
    }catch {}
    await delay(200)
  }
  assert.ok(ready,'Nitro did not start: '+log.slice(-500))
  const weather=await fetch(base+'/api/terminal-lookup?city=Seattle&mode=weather')
  const forecast=await weather.json()
  assert.equal(weather.status,200,JSON.stringify(forecast))
  assert.equal(forecast.location,'Seattle, Washington')
  assert.equal(forecast.temp,43)
  assert.equal(forecast.code,3)
  assert.equal(forecast.lat,47.60621)
  const traffic=await fetch(base+'/api/terminal-lookup?city=Seattle&mode=traffic')
  const map=await traffic.json()
  assert.equal(traffic.status,200)
  assert.equal(map.location,'Seattle, Washington')
  assert.equal(Object.hasOwn(map,'temp'),false,'Traffic mode must not fetch forecast')
  const missing=await fetch(base+'/api/terminal-lookup?city=NonexistentExampleCity&mode=weather')
  assert.equal(missing.status,404)
  const invalid=await fetch(base+'/api/terminal-lookup?city=Seattle&mode=invalid')
  assert.equal(invalid.status,400)
  const road=await fetch(base+'/api/traffic/roads/11/328/715')
  const error=await road.json()
  assert.equal(road.status,502,JSON.stringify(error))
  assert.ok(String(error.statusMessage).includes('AUTHORIZATION'),'TomTom failure category was not reported: '+JSON.stringify(error))
  console.log('PASS: production Nitro weather lookup, traffic-only geocode, timeouts/errors, and safe TomTom authorization status')
} finally {
  child.kill()
}

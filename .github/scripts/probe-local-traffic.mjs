import { spawn } from 'node:child_process'
const env={...process.env,NUXT_TOMTOM_TRAFFIC_KEY:'invalid-test-key',NUXT_WSDOT_ACCESS_CODE:'invalid-test-code',NITRO_PORT:'4466',NITRO_HOST:'127.0.0.1'}
const child=spawn(process.execPath,['.output/server/index.mjs'],{env,stdio:['ignore','pipe','pipe']})
let stderr='',stdout=''
child.stderr.on('data',d=>{stderr+=d.toString().slice(0,12000)})
child.stdout.on('data',d=>{stdout+=d.toString().slice(0,5000)})
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
for(let i=0;i<50;i++){
 try{const r=await fetch('http://127.0.0.1:4466/api/traffic/status');if(r.ok)break}catch{}
 await sleep(200)
}
for(const path of ['/api/traffic/status','/api/traffic/roads/11/328/715','/api/traffic/stations?bbox=-122.42,47.55,-122.25,47.68']){
 let result;
 try{const res=await fetch('http://127.0.0.1:4466'+path,{signal:AbortSignal.timeout(20000)});const txt=await res.text();result={status:res.status,body:txt.slice(0,550)}}
 catch(e){result={error:String(e)}}
 console.log('LOCAL_RESULT '+JSON.stringify({path,result}))
}
child.kill()
await sleep(200)
const scrub=(text)=>text.replaceAll('invalid-test-key','[FAKE-KEY]').replaceAll('invalid-test-code','[FAKE-CODE]')
console.log('SERVER_STDERR '+scrub(stderr).slice(-12000))
console.log('SERVER_STDOUT '+scrub(stdout).slice(-4000))

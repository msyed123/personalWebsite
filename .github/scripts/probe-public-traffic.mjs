// Read-only probe: request one road-flow tile and one WSDOT bbox from the public site.
// Never prints secrets or the raw station dataset.
const host = 'https://www.msyed.space'
const paths = [
  '/api/traffic/status',
  '/api/traffic/roads/11/328/715',
  '/api/traffic/roads/11/329/715',
  '/api/traffic/stations?bbox=-122.42%2C47.55%2C-122.25%2C47.68'
]
const report=[]
for(const path of paths){
  const start=Date.now()
  try {
    const r = await fetch(host+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)})
    const raw=await r.text()
    const item={endpoint:path.split('?')[0],status:r.status,contentType:r.headers.get('content-type'),milliseconds:Date.now()-start}
    try{
      const parsed=JSON.parse(raw)
      if(path.includes('status')) {
        item.capabilities={roads:parsed?.roads===true,stations:parsed?.stations===true}
      } else if(parsed?.type==='FeatureCollection' && Array.isArray(parsed.features)){
        const features=parsed.features
        item.featureCount=features.length
        item.geometryTypes=[...new Set(features.map(f=>f.geometry?.type))].slice(0,6)
        item.providers=[...new Set(features.map(f=>f.properties?.source))].slice(0,6)
        item.conditionCounts=Object.fromEntries([...new Set(features.map(f=>f.properties?.condition))].map(cond=>[String(cond),features.filter(f=>f.properties?.condition===cond).length]))
      } else {
        item.errorCode=parsed?.statusCode || parsed?.status || null
        item.errorMessage=String(parsed?.statusMessage || parsed?.message || '').slice(0,140)
      }
    }catch{
      item.bodyType=raw.startsWith('<')?'html':'non-json'
      item.bodyLength=raw.length
    }
    report.push(item)
  }catch(error){
    report.push({endpoint:path.split('?')[0],networkError:String(error?.name||'error'),milliseconds:Date.now()-start})
  }
}
console.log('PROBE_JSON '+JSON.stringify({host,report}))

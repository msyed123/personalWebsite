// Read-only probe: request one road-flow tile and one WSDOT bbox from the public site.
// Never prints secrets or the raw station dataset.
const host = 'https://www.msyed.space'
const paths = [
  '/api/traffic/status',
  '/api/traffic/roads/11/328/715',
  '/api/traffic/roads/11/329/715',
  '/api/traffic/roads/12/656/1430',
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

// Probe Open-Meteo independently from the runner, with a browser-like Origin
// and with no Origin. Never print credentials.
const forecastURL='https://api.open-meteo.com/v1/forecast?latitude=47.60621&longitude=-122.33207&current=temperature_2m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph'
const geoURL='https://geocoding-api.open-meteo.com/v1/search?name=Seattle&count=1&language=en&format=json'
for(const [name,url] of [['forecast',forecastURL],['geocoding',geoURL]]){
 for(const [label,headers] of [['server',{}],['browserOrigin',{Origin:'https://www.msyed.space'}]]){
  const start=Date.now()
  try{
   const response=await fetch(url,{headers,signal:AbortSignal.timeout(16000)})
   const body=await response.text()
   let current
   try{ const parsed=JSON.parse(body);current=name==='forecast'?{temperature:parsed.current?.temperature_2m,weather_code:parsed.current?.weather_code,error:parsed.error,reason:parsed.reason}:{count:parsed.results?.length,error:parsed.error} }catch{}
   report.push({endpoint:name,requestMode:label,status:response.status,allowOrigin:response.headers.get('access-control-allow-origin'),contentType:response.headers.get('content-type'),milliseconds:Date.now()-start,parsed:current})
  }catch(error){ report.push({endpoint:name,requestMode:label,errorName:error.name,errorCause:error.cause?.code || String(error.cause?.message||'').slice(0,100),milliseconds:Date.now()-start}) }
 }
}
console.log('PROBE_WEATHER_TRAFFIC '+JSON.stringify({host,report}))

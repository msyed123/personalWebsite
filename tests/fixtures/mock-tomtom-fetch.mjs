// Isolate the TomTom adapter from external credentials and quota during CI.
// Return a valid single-road Mapbox vector tile from in-memory PBF bytes.
function concat(parts) { return Uint8Array.from(parts.flatMap(x => Array.from(x))) }
function varint(value) {
  let n=BigInt(value); const out=[]
  while (n>=128n) { out.push(Number((n & 127n) | 128n)); n >>= 7n }
  out.push(Number(n))
  return Uint8Array.from(out)
}
function tag(field,wire) {return varint((field<<3)|wire)}
function fieldInt(field,value){return concat([tag(field,0),varint(value)])}
function fieldBytes(field,data){return concat([tag(field,2),varint(data.length),data])}
function fieldString(field,text){return fieldBytes(field,new TextEncoder().encode(text))}
function fieldDouble(field,value){
 const bytes=new Uint8Array(8);new DataView(bytes.buffer).setFloat64(0,value,true)
 return concat([tag(field,1),bytes])
}
// LineString from tile-coordinate (1000, 1000) to (2000, 2000).
// Geometry commands: MoveTo(1), positive zigzag deltas; LineTo(1), deltas.
const geometry=concat([varint(9),varint(2000),varint(2000),varint(10),varint(2000),varint(2000)])
const feature=concat([
 fieldBytes(2,concat([varint(0),varint(0)])),
 fieldInt(3,2),
 fieldBytes(4,geometry)
])
const layer=concat([
 fieldString(1,'Traffic flow'),
 fieldBytes(2,feature),
 fieldString(3,'relative_speed'),
 fieldBytes(4,fieldDouble(3,0.4)),
 fieldInt(5,4096),
 fieldInt(15,2)
])
const tile=fieldBytes(3,layer)
const realFetch=globalThis.fetch
globalThis.fetch=(input,init)=>{
 const url=typeof input==='string'?input:input?.url||''
 if(url.startsWith('https://api.tomtom.com/maps/orbis/traffic/flow/vector/tile/')){
   const requestHeaders = new Headers(init?.headers)
   const verified = requestHeaders.get('TomTom-Api-Key') === 'ci-dummy-key' &&
     requestHeaders.get('TomTom-Api-Version') === '2' &&
     requestHeaders.get('Accept') === 'application/vnd.mapbox-vector-tile' &&
     new URL(url).searchParams.get('apiVersion') === '2'
   if(!verified) {
     // Prevent the route smoke test from silently passing on an invalid request.
     return Promise.resolve(new Response('Invalid simulated Orbis v2 request', {status:400}))
   }
   return Promise.resolve(new Response(tile,{status:200,headers:{'Content-Type':'application/vnd.mapbox-vector-tile'}}))
 }
 return realFetch(input,init)
}

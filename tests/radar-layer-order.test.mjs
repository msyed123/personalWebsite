import test from 'node:test'
import assert from 'node:assert/strict'
import { createAsciiRadarLayer, radarBlendWeights } from '../utils/asciiRadarLayer.js'

function makeGL(roads = true, onSetTiles = () => {}) {
  const calls = [], layers = new Map(), sources = new Map()
  const paints = []
  const sourceListeners = new Set()
  const style = [
    {id:'background',type:'background'},
    {id:'water',type:'fill'},
    ...(roads ? [
      {id:'water_name',type:'symbol'},
      {id:'traffic-road-casing',type:'line',source:'traffic-roads'},
      {id:'traffic-road-lines',type:'line',source:'traffic-roads'},
      {id:'highway_minor',type:'line'},
      {id:'highway_major',type:'line'},
      {id:'shield',type:'symbol','source-layer':'transportation_name'},
      {id:'boundary_state',type:'line','source-layer':'boundary'}
    ] : []),
    {id:'place_name',type:'symbol'}
  ]
  const gl = {
    calls,layers,sources,paints,
    getStyle:()=>({layers:style}),
    addSource:(id,source) => sources.set(id,{
      ...source,
      setTiles(tiles){ this.tiles=tiles; onSetTiles(id,tiles,gl) }
    }),
    addLayer:(layer,beforeId)=>{layers.set(layer.id,layer);calls.push({id:layer.id,beforeId})},
    getLayer:id=>layers.get(id),
    getSource:id=>sources.get(id),
    setPaintProperty:(id,property,value)=>{
      layers.get(id).paint[property]=value
      paints.push({
        id, property, value,
        a:layers.get('ascii-radar-a')?.paint['raster-opacity'],
        b:layers.get('ascii-radar-b')?.paint['raster-opacity']
      })
    },
    removeLayer:id=>layers.delete(id),
    removeSource:id=>sources.delete(id),
    isSourceLoaded:()=>true,
    on:(_,fn)=>sourceListeners.add(fn),
    off:(_,fn)=>sourceListeners.delete(fn),
    emit:sourceId=>{for(const fn of sourceListeners)fn({sourceId})}
  }
  return gl
}

test('crossfade weights interpolate all cell values smoothly, including frame wrap', () => {
  assert.deepEqual(radarBlendWeights(0,0.55),{previous:0.55,next:0})
  assert.deepEqual(radarBlendWeights(0.5,0.55),{previous:0.275,next:0.275})
  assert.deepEqual(radarBlendWeights(1,0.55),{previous:0,next:0.55})
  assert.deepEqual(radarBlendWeights(-10,0.7),{previous:0.7,next:0})
  assert.deepEqual(radarBlendWeights(10,0.7),{previous:0,next:0.7})
})

test('both weather layers cover roads and shields, preserve place labels and crossfade', async () => {
  const gl=makeGL()
  let protocolName,registered=false
  const radar=createAsciiRadarLayer({
    gl,transitionMs:90,
    addProtocol:(name,handler)=>{protocolName=name;registered=typeof handler==='function'},
    removeProtocol:name=>{assert.equal(name,protocolName);registered=false}
  })
  assert.equal(radar.initialize(['/v2/radar/old','/v2/radar/middle','/v2/radar/new'],0.55),true)
  assert.equal(registered,true)
  assert.deepEqual(gl.calls.map(c=>c.beforeId),['boundary_state','boundary_state'])
  assert.equal(gl.layers.get(radar.layerIds[0]).paint['raster-opacity'],0.55)
  assert.equal(gl.layers.get(radar.layerIds[1]).paint['raster-opacity'],0)
  assert.deepEqual(gl.layers.get(radar.layerIds[0]).paint['raster-opacity-transition'],
    { duration:0, delay:0 })
  assert.deepEqual(gl.layers.get(radar.layerIds[1]).paint['raster-opacity-transition'],
    { duration:0, delay:0 })

  await radar.showFrame(1,0.55)
  assert.equal(gl.layers.get(radar.layerIds[0]).paint['raster-opacity'],0)
  assert.equal(gl.layers.get(radar.layerIds[1]).paint['raster-opacity'],0.55)
  assert.ok(gl.sources.get(radar.sourceIds[1]).tiles[0].includes('frame=1'))
  // Both cells must be present during the blend; no instantaneous source swap.
  assert.ok(gl.paints.some(p=>p.a>0.01 && p.b>0.01 && p.a<0.55 && p.b<0.55),
    'Expected intermediate crossfade where both old and new precipitation are visible')

  await radar.showFrame(2,0.55)
  assert.ok(gl.sources.get(radar.sourceIds[0]).tiles[0].includes('frame=2'))
  // Crucially last -> first uses the same interpolation, never a hard reset.
  const paintsBeforeWrap=gl.paints.length
  await radar.showFrame(0,0.55)
  assert.ok(gl.paints.slice(paintsBeforeWrap).some(p=>p.a>0.01 && p.b>0.01),
    'Expected a smooth blend on timeline wrap')
  assert.ok(gl.sources.get(radar.sourceIds[1]).tiles[0].includes('frame=0'))
  radar.setOpacity(0.95)
  assert.equal(gl.layers.get(radar.layerIds[1]).paint['raster-opacity'],0.95)

  radar.destroy()
  assert.equal(registered,false)
  assert.equal(gl.sources.size,0)
  assert.equal(gl.layers.size,0)
})

test('a newer timeline seek replaces an obsolete tile wait', async () => {
  let ready=true
  const gl=makeGL(true,(_id,tiles,instance)=>{
    if(tiles[0].includes('frame=1')) ready=false
    if(tiles[0].includes('frame=2')) ready=true
  })
  gl.isSourceLoaded=()=>ready
  const radar=createAsciiRadarLayer({
    gl,transitionMs:30,addProtocol:()=>{},removeProtocol:()=>{}
  })
  assert.equal(radar.initialize(['/v2/radar/old','/v2/radar/obsolete','/v2/radar/new']),true)
  const first=radar.showFrame(1)
  const replacement=radar.showFrame(2)
  await Promise.all([first,replacement])
  assert.ok(gl.sources.get(radar.sourceIds[1]).tiles[0].includes('frame=2'),
    'The latest seek must replace an unready frame')
  assert.equal(gl.layers.get(radar.layerIds[1]).paint['raster-opacity'],0.7)
  radar.destroy()
})

test('radar falls back beneath first text label if there are no road layers', () => {
  const gl=makeGL(false)
  const radar=createAsciiRadarLayer({gl,addProtocol:()=>{},removeProtocol:()=>{}})
  assert.equal(radar.initialize(['/v2/radar/one']),true)
  assert.deepEqual(gl.calls.map(c=>c.beforeId),['place_name','place_name'])
  radar.destroy()
})

test('forecast uses the same road ordering as radar', () => {
  const gl = makeGL()
  const forecast = createAsciiRadarLayer({
    gl, providerTile: () => '/forecast.png', keepProviderColors: true,
    addProtocol: () => {}, removeProtocol: () => {}
  })
  assert.equal(forecast.initialize([{ time: 100 }]), true)
  assert.deepEqual(gl.calls.map(call => call.beforeId), ['boundary_state', 'boundary_state'])
  forecast.destroy()
})

test('weather appends above roads when they end the style', () => {
  const gl = makeGL()
  gl.getStyle = () => ({ layers: [{id:'land',type:'fill'}, {id:'road',type:'line','source-layer':'transportation'}] })
  const radar = createAsciiRadarLayer({gl,addProtocol:()=>{},removeProtocol:()=>{}})
  assert.equal(radar.initialize(['/one']), true)
  assert.deepEqual(gl.calls.map(call => call.beforeId), [undefined, undefined])
  radar.destroy()
})

test('rolling a timeline retains tile IDs for the overlapping frames', async () => {
  const gl = makeGL()
  const radar = createAsciiRadarLayer({
    gl, transitionMs: 20, addProtocol: () => {}, removeProtocol: () => {}
  })
  assert.equal(radar.initialize(['/old','/middle','/new'], 0.55, 2), true)
  assert.match(gl.sources.get(radar.sourceIds[0]).tiles[0], /frame=2$/)
  radar.setFrames(['/middle','/new','/newest'])
  await radar.showFrame(1)
  assert.equal(gl.layers.get(radar.layerIds[0]).paint['raster-opacity'], 0.55)
  await radar.showFrame(2)
  assert.match(gl.sources.get(radar.sourceIds[1]).tiles[0], /frame=3$/)
  await radar.showFrame(0)
  assert.match(gl.sources.get(radar.sourceIds[0]).tiles[0], /frame=1$/)
  assert.equal(gl.sources.size, 2)
  radar.destroy()
})

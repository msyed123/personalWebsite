import test from 'node:test'
import assert from 'node:assert/strict'
import { createAsciiRadarLayer } from '../utils/asciiRadarLayer.js'

test('ASCII radar is inserted below geographic roads and labels', () => {
  const calls=[]
  const sources=new Map()
  const layers=new Map()
  const gl={
    getStyle:()=>({layers:[
      { id:'background', type:'background' },
      { id:'water', type:'fill' },
      { id:'highway_minor', type:'line' },
      { id:'highway_major', type:'line' },
      { id:'place_name', type:'symbol' }
    ]}),
    addSource:(id,source)=>{sources.set(id,{...source,setTiles(tiles){this.tiles=tiles}})},
    addLayer:(layer,beforeId)=>{layers.set(layer.id,layer);calls.push({id:layer.id,beforeId})},
    getLayer:id=>layers.get(id),
    getSource:id=>sources.get(id),
    setPaintProperty:(id,property,value)=>{layers.get(id).paint[property]=value},
    removeLayer:id=>{layers.delete(id)},
    removeSource:id=>{sources.delete(id)}
  }
  let protocolName=null,registered=false
  const radar=createAsciiRadarLayer({
    gl,
    addProtocol:(name,handler)=>{protocolName=name;registered=typeof handler==='function'},
    removeProtocol:(name)=>{assert.equal(name,protocolName);registered=false}
  })
  assert.equal(radar.initialize(['/v2/radar/test'],0.55),true)
  assert.equal(registered,true)
  assert.equal(calls[0].id,radar.layerId)
  assert.equal(calls[0].beforeId,'highway_minor')
  assert.equal(layers.get(radar.layerId).paint['raster-opacity'],0.55)
  radar.setOpacity(0.95)
  assert.equal(layers.get(radar.layerId).paint['raster-opacity'],0.95)
  radar.showFrame(0,0.7)
  assert.equal(layers.get(radar.layerId).paint['raster-opacity'],0.7)
  assert.ok(sources.get('ascii-radar-tiles').tiles[0].startsWith(protocolName+'://'))
  radar.destroy()
  assert.equal(registered,false)
  assert.equal(sources.size,0)
  assert.equal(layers.size,0)
})

test('ASCII radar never draws above the first basemap label when road layers are absent', () => {
  let before
  const gl={
    getStyle:()=>({layers:[{id:'background',type:'background'},{id:'land',type:'fill'},{id:'place_label',type:'symbol'}]}),
    addSource:()=>{},
    addLayer:(_,id)=>{before=id},
    getLayer:()=>null,
    getSource:()=>null
  }
  const radar=createAsciiRadarLayer({gl,addProtocol:()=>{},removeProtocol:()=>{}})
  radar.initialize(['/v2/radar/test'],0.7)
  assert.equal(before,'place_label')
})

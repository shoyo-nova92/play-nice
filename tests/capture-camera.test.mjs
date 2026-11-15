import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
const source=readFileSync(new URL('../src/scene.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('  function applyCapture(state) {'),source.indexOf('  function resize(',source.indexOf('  function applyCapture(state) {')));
test('capture keeps grin on screen through upside-down zoom at room corners and resets no state',()=>{
 for(const [x,z] of [[0,0],[-7.5,-5.5],[7.5,5.5],[-7.5,5.5],[7.5,-5.5],[0,-9],[-2.5,-10],[2.5,-7]])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const t of [0,.7,2,3,4,5.2,5.85,6.5,7.2,8]){
 const camera=new THREE.PerspectiveCamera(70,1366/768,.05,60),bunny=new THREE.Group(),bunnyTorso=new THREE.Group(),bunnyHead=new THREE.Group();bunny.add(bunnyTorso);bunnyTorso.add(bunnyHead);bunnyHead.position.set(0,2.05,.03);
 const quietMouth=new THREE.Group(),grin=new THREE.Group();bunnyHead.add(grin);const captureBlood=new THREE.Group();for(let i=0;i<16;i++)captureBlood.add(new THREE.Group());const captureScreen=new THREE.Group(),redVeilMat={},crackMat={},flashlight={};
 const state={capture:{player:{x,z,yaw,pitch:0},enemy:{x:x-Math.sin(yaw)*.5,z:z-Math.cos(yaw)*.5}}},before=JSON.stringify(state);
 const run=new Function('THREE','captureTime','smooth','bunny','bunnyTorso','bunnyHead','limbs','camera','FOV','quietMouth','grin','captureBlood','captureScreen','redVeilMat','crackMat','flashlight',body+';return applyCapture;')(THREE,t,v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)},bunny,bunnyTorso,bunnyHead,[],camera,70,quietMouth,grin,captureBlood,captureScreen,redVeilMat,crackMat,flashlight);
 run(state);camera.updateMatrixWorld();bunny.updateMatrixWorld(true);assert.equal(JSON.stringify(state),before);assert.ok(camera.position.toArray().every(Number.isFinite));if(z < -6)assert.ok(camera.position.z < -6.3 && bunny.position.z < -6.3, 'archive capture must stay inside archive');
 if(t>=5.85){for(const point of [[0,-.22,.343],[-.22,-.215,.386],[.22,-.215,.386]]){const p=grin.localToWorld(new THREE.Vector3(...point)).project(camera);assert.ok(Math.abs(p.x)<.9&&Math.abs(p.y)<.9&&p.z<1,`offscreen t=${t} start=${x},${z} yaw=${yaw}: ${p.toArray()}`)}}
 }
});


test('compressed capture still reaches drop, drag, lift and break before 6.2 seconds',()=>{
 const expression=source.match(/const captureTimelineTime = elapsed => ([^;]+);/)[1];
 const timeline=new Function('THREE','elapsed',`return ${expression}`);
 assert.equal(timeline(THREE,0),0);assert.equal(timeline(THREE,6.2),8);
 assert.ok(timeline(THREE,5.04)>=6.5);assert.ok(timeline(THREE,.55)>.7);
 assert.equal(timeline(THREE,100),8);
});

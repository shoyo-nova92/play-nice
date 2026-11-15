import test from 'node:test';import assert from 'node:assert/strict';
import{createWorld,advanceSecret,movePlayer,selectTarget,interact,isCaptured,updateEnemy,hasLineOfSight,findPath}from'../src/levels.js';import{createGame}from'../src/game.js';
test('solid journal table blocks a swept actor and supports sliding',()=>{const w=createWorld(1);Object.assign(w.player,{x:-3,z:4});movePlayer(w,{x:0,z:-1},2);assert.ok(w.player.z>=2+.43+.35-1e-6);movePlayer(w,{x:1,z:-1},.2);assert.ok(w.player.x>-3);});
test('all hiding places enter, conceal, peek, and exit without moving while hidden',()=>{for(const spotId of ['hide-box-1','hide-box-2','hide-closet']){const g=createGame();g.state.phase='LEVEL_2';const w=g.state.world=createWorld(2),s=w.hidingSpots.find(x=>x.id===spotId);Object.assign(w.player,{x:s.x,z:s.z+.15,facing:{x:0,z:-1}});g.update(0,{interact:true});assert.equal(w.player.hiddenIn,s.id);const before=[w.player.x,w.player.z];g.update(.05,{movement:{x:1,z:1},peek:true,look:{x:5000,y:5000}});assert.deepEqual([w.player.x,w.player.z],before);assert.equal(w.player.peeking,true);assert.ok(Math.abs(w.player.yaw-s.entryYaw)<=.601);g.update(.05,{interact:true});assert.equal(w.player.hiddenIn,null);}});
test('unwitnessed hiding prevents capture but witnessed entry does not',()=>{const w=createWorld(2);w.player.hiddenIn=w.hidingSpots[0].id;Object.assign(w.player,{x:0,z:0});Object.assign(w.enemy,{active:true,x:.3,z:0});assert.equal(isCaptured(w),false);w.enemy.sawHide=true;assert.equal(isCaptured(w),true);});
test('sneaking is slower and quieter; sight is blocked by furniture',()=>{const a=createWorld(2),b=createWorld(2);b.player.sneaking=true;movePlayer(a,{x:1,z:0},.1);movePlayer(b,{x:1,z:0},.1);assert.ok(a.player.distanceWalked>b.player.distanceWalked);assert.equal(hasLineOfSight(a,{x:-3,z:3},{x:-3,z:1}),false);Object.assign(a.enemy,{active:true,x:4,z:0,heading:Math.PI/2});Object.assign(a.player,{x:0,z:0,moving:true,sneaking:false});updateEnemy(a,0);assert.equal(a.enemy.noiseLevel,1);a.player.sneaking=true;updateEnemy(a,0);assert.equal(a.enemy.noiseLevel,0);});
test('patrol continues while the player is concealed and visits different locations',()=>{const w=createWorld(2);w.player.hiddenIn=w.hidingSpots[0].id;w.enemy.active=true;const points=new Set();for(let i=0;i<200;i++){updateEnemy(w,.05);points.add(`${w.enemy.x.toFixed(1)},${w.enemy.z.toFixed(1)}`);}assert.ok(points.size>10);assert.equal(w.enemy.mode,'patrol');});
test('behind-contact enters the faster capture and freezes time',()=>{const g=createGame();g.state.phase='LEVEL_2';const w=g.state.world=createWorld(2);Object.assign(w.player,{x:0,z:0});Object.assign(w.enemy,{active:true,x:0,z:.3});g.update(0,{});assert.equal(g.state.phase,'CAPTURE');assert.equal(g.state.capture.fromBehind,true);let time=g.state.timeLeft;for(let i=0;i<124;i++)g.update(.05,{});assert.equal(g.state.phase,'LOSE');assert.equal(g.state.timeLeft,time);});
test('behind contact catches even when a sight ray is occluded',()=>{const w=createWorld(2);Object.assign(w.player,{x:0,z:0,facing:{x:0,z:-1}});Object.assign(w.enemy,{active:true,x:0,z:.3});w.colliders.push({id:'thin-occluder',x:0,z:.15,width:.5,depth:.04});assert.equal(hasLineOfSight(w,w.enemy,w.player),false);assert.equal(isCaptured(w),true);});
test('solid layout leaves paths to archive control and exit',()=>{const w=createWorld(2);Object.assign(w.secret,{open:true,slide:1});assert.ok(findPath(w,{x:0,z:-7},w.switches[2],.35).length);assert.ok(findPath(w,{x:0,z:-5},w.exit,.35).length);});


test('every hiding exit leaves room to walk away',()=>{
 for(const index of [0,1,2]){const w=createWorld(2),spot=w.hidingSpots[index];Object.assign(w.player,{x:spot.x,z:spot.z,facing:{x:0,z:-1}});interact(w,selectTarget(w));assert.equal(w.player.hiddenIn,spot.id);interact(w,selectTarget(w));const z=w.player.z;movePlayer(w,{x:0,z:1},.1);assert.ok(w.player.z>z+.1,spot.id+' exit must be free');}
});

test('sliding case pauses before enclosing the player and resumes after they clear it',()=>{
 const w=createWorld(1);Object.assign(w.secret,{open:true,slide:0});Object.assign(w.player,{x:2,z:-5.2});
 for(let i=0;i<14;i++)advanceSecret(w,.05);assert.ok(w.secret.slide<1);
 const stopped=w.secret.slide;advanceSecret(w,.05);assert.equal(w.secret.slide,stopped);
 Object.assign(w.player,{x:0,z:0});for(let i=0;i<14;i++)advanceSecret(w,.05);assert.equal(w.secret.slide,1);
});


test('patrol hearing state is cleared on focus pause and hidden controls do not leak across reset',()=>{
 const g=createGame();g.state.phase='LEVEL_2';g.state.world=createWorld(2);const w=g.state.world;
 const s=w.hidingSpots[0];Object.assign(w.player,{x:s.x,z:s.z+.1,facing:{x:0,z:-1}});g.update(0,{interact:true});g.update(.05,{peek:true,sneak:true});g.setPaused(true);
 const before=structuredClone(w);g.update(.05,{movement:{x:1,z:1},interact:true,peek:false});assert.deepEqual(w,before);
 g.state.phase='LOSE';g.dispatch('restart');assert.equal(g.state.world.player.hiddenIn,null);assert.equal(g.state.world.player.peeking,false);assert.equal(g.state.world.player.sneaking,false);
});

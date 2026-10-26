const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const logic=require('../countdown-logic.js');
const code=fs.readFileSync(path.join(__dirname,'../MMM-EventCountdown.js'),'utf8');
function element(tag){return {tag,children:[],style:{},appendChild(child){this.children.push(child);return child;},set textContent(s){this.value=String(s);},get textContent(){return (this.value||'')+this.children.map(c=>c.textContent).join(' ');}};}
function frontend(options={}){
 let def;const timers=[],cleared=[];
 vm.runInNewContext(code,{Module:{register:(name,value)=>{assert.equal(name,'MMM-EventCountdown');def=value;}},CountdownLogic:logic,Date,Intl,document:{createElement:element},setInterval:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearInterval:id=>cleared.push(id)});
 return Object.assign(def,{config:{...def.defaults,...options},identifier:'one',updates:0,updateDom(){this.updates++;},sendSocketNotification(n,p){this.sent={n,p};},timers,cleared});
}

test('range includes final day and disappears the following day',()=>{
 const data={events:[{name:'Trip',start:'2030-06-01',end:'2030-06-03'}]};
 const first=logic.build(data,'2030-06-01')[0];assert.equal(first.dayNumber,1);assert.equal(first.totalDays,3);
 const last=logic.build(data,'2030-06-03')[0];assert.equal(last.lastDay,true);assert.equal(last.status,'ongoing');
 assert.equal(logic.build(data,'2030-06-04').length,0);
});
test('day arithmetic handles leap days, DST dates, and year boundaries',()=>{
 assert.equal(logic.diffDays('2032-02-28','2032-03-01'),2);
 assert.equal(logic.diffDays('2030-03-09','2030-03-11'),2);
 assert.equal(logic.diffDays('2030-12-31','2031-01-01'),1);
});
test('holidays roll forward and movable dates match known dates',()=>{
 assert.equal(logic.build({holidays:['halloween']},'2030-11-01')[0].start,'2031-10-31');
 assert.equal(logic.easter(2030),'2030-04-21');assert.equal(logic.nth(2030,11,4,4),'2030-11-28');
});
test('invalid schemas, impossible dates and reversed ranges are rejected',()=>{
 for(const date of ['2030-02-30','2030-13-01','2030-01-00',' 2030-06-01 ','bad'])assert.throws(()=>logic.ts(date));
 assert.throws(()=>logic.build({events:'bad'},'2030-01-01'),/array/);
 assert.throws(()=>logic.build({holidays:['constructor']},'2030-01-01'),/unknown holiday/);
 assert.throws(()=>logic.build({events:[{name:'Bad',start:'2030-06-03',end:'2030-06-01'}]},'2030-01-01'),/before/);
});
test('ordering favors ongoing then earliest future entries, breaking ties by name',()=>{
 const events=[{name:'Zulu',date:'2030-06-05'},{name:'Alpha',date:'2030-06-05'},{name:'Running',start:'2030-06-01',end:'2030-06-03'}];
 assert.deepEqual(logic.build({events},'2030-06-02').map(x=>x.name),['Running','Alpha','Zulu']);
});
test('frontend rejects other instance responses and accepts its own updates/errors',()=>{
 const m=frontend();m.start();assert.equal(m.sent.p.instanceId,'one');
 m.socketNotificationReceived('EVENTCOUNTDOWN_DATA',{instanceId:'two',data:{events:[]}});assert.equal(m.countData,null);
 m.socketNotificationReceived('EVENTCOUNTDOWN_DATA',{instanceId:'one',data:{events:[]}});assert.equal(m.countData.events.length,0);
 m.socketNotificationReceived('EVENTCOUNTDOWN_ERROR',{instanceId:'one',error:'Synthetic error'});assert.match(m.getDom().textContent,/Synthetic error/);
});
test('preview needs no file and renders independently; emoji can be disabled',()=>{
 const m=frontend({preview:true,debugDate:'2030-06-01',showEmoji:false});m.start();assert.equal(m.sent,undefined);
 const text=m.getDom().textContent;assert.match(text,/Sample trip/);assert.doesNotMatch(text,/✈️/);
 m.suspend();assert.equal(m.cleared.length,2);m.resume();assert.equal(m.timers.length,4);
});
test('frontend renders empty, today, final-day and invalid data states',()=>{
 const m=frontend({debugDate:'2030-06-03'});m.countData={};assert.match(m.getDom().textContent,/Nothing coming up/);
 m.countData={events:[{name:'One',date:'2030-06-03'},{name:'Trip',start:'2030-06-01',end:'2030-06-03'}]};
 let text=m.getDom().textContent;assert.match(text,/Today!/);assert.match(text,/Last day/);
 m.countData={events:[{name:'Broken',date:'invalid'}]};assert.match(m.getDom().textContent,/data problem/);
});
test('timezone chooses the calendar date independently of host timezone',()=>{
 const fixed=Date.parse('2030-01-01T02:00:00Z');const RealDate=Date;
 class FixedDate extends RealDate {constructor(...args){super(...(args.length?args:[fixed]));}}
 let def;vm.runInNewContext(code,{Module:{register:(n,d)=>def=d},Date:FixedDate,Intl});
 def.config={...def.defaults,timezone:'America/New_York'};assert.equal(def.today(),'2029-12-31');
 def.config.timezone='Asia/Tokyo';assert.equal(def.today(),'2030-01-01');
});
test('helper resolves config before module files, routes responses and confines filenames',()=>{
 const files=new Map([['/mirror/config/a.json','{"events":[]}'],['/module/a.json','{"events":[{"name":"ignored"}]}'],['/module/b.json','{}'],['/mirror/config/bad.json','{invalid']]);
 let def;const sandbox={module:{exports:{}},global:{root_path:'/mirror'},__dirname:'/module',require:name=>name==='node_helper'?{create:x=>x}:name==='node:fs'?{existsSync:p=>files.has(p),readFileSync:p=>files.get(p)}:require(name)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../node_helper.js'),'utf8'),sandbox);def=sandbox.module.exports;
 let result;def.sendSocketNotification=(n,p)=>result={n,p};
 def.socketNotificationReceived('EVENTCOUNTDOWN_LOAD',{instanceId:'one',dataFile:'../../a.json'});assert.equal(result.p.instanceId,'one');assert.equal(result.p.data.events.length,0);
 def.socketNotificationReceived('EVENTCOUNTDOWN_LOAD',{instanceId:'two',dataFile:'b.json'});assert.equal(result.p.instanceId,'two');assert.equal(result.n,'EVENTCOUNTDOWN_DATA');
 for(const file of ['missing.json','bad.json']){def.socketNotificationReceived('EVENTCOUNTDOWN_LOAD',{instanceId:'two',dataFile:file});assert.equal(result.n,'EVENTCOUNTDOWN_ERROR');assert.equal(result.p.instanceId,'two');}
});

test('day polling redraws at date rollover and ignores unchanged JSON responses',()=>{
 const m=frontend({debugDate:'2030-06-03'});m.start();
 m.socketNotificationReceived('EVENTCOUNTDOWN_DATA',{instanceId:'one',data:{events:[]}});
 m.getDom();const updates=m.updates;
 m.socketNotificationReceived('EVENTCOUNTDOWN_DATA',{instanceId:'one',data:{events:[]}});assert.equal(m.updates,updates);
 m.config.debugDate='2030-06-04';m.timers.find(t=>t.ms===30000).fn();assert.equal(m.updates,updates+1);
});

import assert from "node:assert/strict";
import {readFile}from"node:fs/promises";
import{stripTypeScriptTypes}from"node:module";
import{timingSafeEqual}from"node:crypto";
import vm from"node:vm";
// Node 24: node --experimental-vm-modules scripts/test-negotiation-history.mjs
const routes=new Map(),router={get(path,handler){routes.set(path,handler);return this}};
let owned=true,linked=true,calls=[],rows=[];
const pool={query:async(sql,values)=>{calls.push({sql,values});if(sql.includes("FROM praca_negotiation_links l JOIN"))return{rows:linked?[{id:"master-1",master_nsu:"NSU-10",movement_nsu:"MOV-11"}]:[]};if(sql.includes("FROM praca_negotiation_events"))return{rows};return{rows:owned?[{id:"order-1"}]:[]}}};
const mod=new vm.SourceTextModule(stripTypeScriptTypes(await readFile(new URL("../artifacts/api-server/src/routes/negotiationHistory.ts",import.meta.url),"utf8"),{mode:"transform"}));
const stubs={express:{Router:()=>router},"node:crypto":{timingSafeEqual},"@workspace/db":{pool}};
await mod.link(async name=>{const v=stubs[name];return new vm.SyntheticModule(Object.keys(v),function(){for(const[k,x]of Object.entries(v))this.setExport(k,x)})});await mod.evaluate();
const old=process.env.PRACA_NSU_AUDIT_ENABLED,oldToken=process.env.PRACA_ROUNDS_VENDOR_TOKEN;
const id="11111111-1111-4111-8111-111111111111";
async function call({consumer=7,type="round",after="0",internal=false,token="a".repeat(40)}={}){
 let status=200,body;calls=[];
 const req={session:{consumerId:consumer},params:{type,id},query:{after,tenantId:"signed-vendor"},header:()=>token};
 const res={status(v){status=v;return this},json(v){body=v;return this},set(){return this}};
 await routes.get(internal?"/internal/vendor-orders/:type/:id/history":"/negotiations/:type/:id/history")(req,res);return{status,body};
}
try{
 process.env.PRACA_NSU_AUDIT_ENABLED="true";process.env.PRACA_ROUNDS_VENDOR_TOKEN="a".repeat(40);
 assert.equal((await call({consumer:null})).status,401);assert.equal(calls.length,0);
 assert.equal((await call({after:"-1"})).status,422);assert.equal(calls.length,0);
 owned=false;assert.equal((await call()).status,404);assert.equal(calls.length,1);
 owned=true;linked=false;assert.equal((await call()).status,404);linked=true;
 rows=Array.from({length:101},(_,i)=>({sequence:String(900+i),operation:"UPDATE",entity_type:"buying_round_orders",occurred_at:"2026-10-19T00:00:00Z",status:"paid"}));
 const result=await call({after:"9007199254740993"});assert.equal(result.status,200);assert.equal(result.body.masterNsu,"NSU-10");assert.equal(result.body.events.length,100);assert.equal(result.body.nextCursor,"999");
 const scope=calls.at(-1).values;assert.deepEqual(scope.slice(0,4),["master-1","round",id,"9007199254740993"]);
 assert.ok(!JSON.stringify(result.body).includes("vendor_id"));
 assert.equal((await call({internal:true,token:""})).status,401);assert.equal(calls.length,0);
 owned=false;assert.equal((await call({internal:true})).status,404);owned=true;
 assert.equal((await call({internal:true})).status,200);assert.equal(calls.at(-1).values[4],"signed-vendor");
 process.env.PRACA_NSU_AUDIT_ENABLED="false";assert.equal((await call()).status,503);assert.equal(calls.length,0);
 console.log("PASS: sessão/token, titularidade antes do histórico, escopo do pedido, cursor bigint sem perda, paginação, filtro de loja e chave de ativação; banco simulado.");
}finally{for(const[k,v]of[["PRACA_NSU_AUDIT_ENABLED",old],["PRACA_ROUNDS_VENDOR_TOKEN",oldToken]])if(v===undefined)delete process.env[k];else process.env[k]=v}

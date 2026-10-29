import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {stripTypeScriptTypes} from "node:module";
import {timingSafeEqual} from "node:crypto";
import vm from "node:vm";
// Node 24: node --experimental-vm-modules scripts/test-delivery-evidence.mjs
const handlers=new Map();let state,snapshot;
const query=async(sql,v=[])=>{
 if(sql==="BEGIN"){snapshot=structuredClone(state);return {rows:[]}}
 if(sql==="ROLLBACK"){state=snapshot;return {rows:[]}}
 if(sql==="COMMIT")return {rows:[]};
 if(sql.includes("SELECT q.id,q.status")||sql.includes("SELECT o.id,o.status")){
   const owner=v[1],ok=typeof owner==="number"?owner===7:owner==="vendor-1";
   return {rows:ok?[{id:v[0],status:state.status,vendor_id:"vendor-1",consumer_id:7}]:[]};
 }
 if(sql.includes("SELECT 1 FROM praca_order_disputes"))return {rows:state.blocked?[{one:1}]:[]};
 if(sql.includes("FROM praca_marketplace_fulfillments"))return {rows:state.f?[state.f]:[]};
 if(sql.startsWith("UPDATE praca_marketplace_fulfillments")){
   state.f.delivery_reported_at="2026-10-19T00:00:00Z";state.f.delivery_received_by=v[3];state.f.delivery_photo=v[4];state.f.delivery_photo_mime=v[5];return {rows:[]};
 }
 if(sql.startsWith("UPDATE quote_requests")||sql.startsWith("UPDATE buying_round_orders")){state.status="delivered";return {rows:[]}}
 if(sql.includes("INSERT INTO praca_delivery_acceptances")){state.acceptances++;return {rows:[]}}
 if(sql.includes("INSERT INTO praca_marketplace_fulfillment_events")){state.events++;return {rows:[]}}
 throw Error("SQL inesperado: "+sql);
};
const router=new Proxy({},{get:(_t,method)=>(path,handler)=>{handlers.set(method.toUpperCase()+" "+path,handler);return router}});
const stubs={express:{Router:()=>router},"node:crypto":{timingSafeEqual},"@workspace/db":{pool:{query,connect:async()=>({query,release(){}})}}};
const source=await readFile(new URL("../artifacts/api-server/src/routes/deliveryEvidence.ts",import.meta.url),"utf8");
const mod=new vm.SourceTextModule(stripTypeScriptTypes(source,{mode:"transform"}));
await mod.link(async name=>{const values=stubs[name];assert.ok(values);return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v)})});await mod.evaluate();
const id="11111111-1111-4111-8111-111111111111",token="a".repeat(40);
const image="data:image/jpeg;base64,"+Buffer.from([255,216,255,...Array(30).fill(0)]).toString("base64");
const previous=process.env.PRACA_ROUNDS_VENDOR_TOKEN;process.env.PRACA_ROUNDS_VENDOR_TOKEN=token;
const reset=()=>{state={status:"paid",blocked:false,f:{status:"shipped",delivery_mode:"own_delivery",delivery_reported_at:null},acceptances:0,events:0}};
async function call(method,path,{type="quote",body={},consumer=7,supplied=token}={}){
 let status=200,data;const res={status(v){status=v;return this},json(v){data=v;return this},set(){return this},type(){return this},send(v){data=v;return this},end(){return this}};
 await handlers.get(method+" "+path)({params:{type,id},body,session:{consumerId:consumer},header:()=>supplied},res);return {status,data};
}
const report=(type,extra={})=>call("POST","/internal/vendor-orders/:type/:id/delivery-report",{type,body:{tenantId:"vendor-1",receivedBy:"Pessoa recebedora",photo:image,allItemsDelivered:true,...extra}});
const confirm=(type,extra={})=>call("POST",type==="quote"?"/quotes/:id/confirm-delivery":"/round-orders/:id/confirm-delivery",{type,body:{allItemsReceived:true},...extra});
try{
 for(const type of ["quote","round"]){
   reset();assert.equal((await call("POST","/internal/vendor-orders/:type/:id/delivery-report",{type,supplied:""})).status,401);
   assert.equal((await report(type,{tenantId:"other-vendor"})).status,404);
   assert.equal((await report(type,{photo:"data:image/svg+xml;base64,AAAA"})).status,422);
   assert.equal((await report(type,{allItemsDelivered:false})).status,422);
   assert.equal((await confirm(type)).status,409);
   state.f.status="preparing";assert.equal((await report(type)).status,409);state.f.status="shipped";
   state.blocked=true;assert.equal((await report(type)).status,409);state.blocked=false;
   assert.equal((await report(type)).status,201);assert.equal(state.status,"paid");assert.equal(state.acceptances,0);assert.equal(state.events,1);
   assert.equal((await report(type)).status,409);
   assert.equal((await call("GET","/marketplace-orders/:type/:id/delivery-evidence",{type,consumer:8})).status,404);
   assert.equal((await call("GET","/marketplace-orders/:type/:id/delivery-evidence",{type,consumer:null})).status,401);
   const evidence=await call("GET","/marketplace-orders/:type/:id/delivery-evidence",{type});assert.equal(evidence.status,200);assert.ok(Buffer.isBuffer(evidence.data));
   assert.equal((await confirm(type,{consumer:8})).status,404);
   assert.equal((await confirm(type,{body:{}})).status,422);
   state.blocked=true;assert.equal((await confirm(type)).status,409);state.blocked=false;
   const accepted=await confirm(type);assert.equal(accepted.status,200);assert.equal(accepted.data.payoutStatus,"blocked_provider");assert.equal(state.acceptances,1);
   assert.equal((await confirm(type)).data.duplicate,true);assert.equal(state.acceptances,1);
 }

 const fulfillmentHandlers=new Map(),fulfillmentRouter=new Proxy({},{get:(_t,method)=>(path,handler)=>{fulfillmentHandlers.set(method.toUpperCase()+" "+path,handler);return fulfillmentRouter}});
 const fulfillmentSource=await readFile(new URL("../artifacts/api-server/src/routes/fulfillment.ts",import.meta.url),"utf8");
 const fulfillmentModule=new vm.SourceTextModule(stripTypeScriptTypes(fulfillmentSource,{mode:"transform"}));
 const fulfillmentStubs={express:{Router:()=>fulfillmentRouter},"node:crypto":{timingSafeEqual},"@workspace/db":{pool:{query:async sql=>({rows:sql.includes("FROM quote_requests q")?[{id,paid_at:"2026-10-19T00:00:00Z",fulfillment_status:"shipped",delivery_mode:"own_delivery",delivery_reported_at:"2026-10-19T00:00:00Z"}]:[]})}}};
 await fulfillmentModule.link(async name=>{const values=fulfillmentStubs[name];return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v)})});await fulfillmentModule.evaluate();
 let orders;
 await fulfillmentHandlers.get("GET /internal/vendor-orders")({query:{tenantId:"vendor-1"},header:()=>token},{set(){return this},json(v){orders=v;return this},status(){return this}});
 assert.equal(orders[0].fulfillment.status,"shipped");assert.equal(orders[0].fulfillment.delivery_mode,"own_delivery");assert.ok(orders[0].delivery_reported_at);

 console.log("PASS: cotação/rodada; tenant e comprador; foto obrigatória/privada; disputa/cancelamento; lojista não confirma aceite; aceite explícito único; repasse bloqueado sem provedor. Banco simulado.");
}finally{if(previous===undefined)delete process.env.PRACA_ROUNDS_VENDOR_TOKEN;else process.env.PRACA_ROUNDS_VENDOR_TOKEN=previous}

import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stripTypeScriptTypes} from "node:module";
import vm from "node:vm";
const read=p=>readFileSync(p,"utf8");
const compile=s=>stripTypeScriptTypes(s,{mode:"transform"}).replace(/^import .*;\n/gm,"").replace(/export default router;?/g,"").replace(/export /g,"");
const m={};vm.createContext(m);vm.runInContext(compile(read("artifacts/api-server/src/lib/suborderAmounts.ts")),m);
assert.deepEqual(Array.from(m.allocateCents(1,[1,1,1])),[1,0,0]);
for(let n=0;n<500;n++){const out=m.allocateCents(n*7+1,[n+1,13,37]);assert.equal(out.reduce((a,b)=>a+b,0),n*7+1);assert(out.every(Number.isSafeInteger))}
const groups=m.splitOrder([{id:1,vendorId:"b",quantity:3,price:"0.01"},{id:2,vendorId:"a",quantity:2,price:"100"}],[{vendorId:"a",freight:9.99},{vendorId:"b",freight:0.01}],17.03);
assert.equal(groups.reduce((s,g)=>s+g.totalCents,0),19300);
for(const g of groups)assert.equal(g.items.reduce((s,l)=>s+l.netCents,0)+g.freightNetCents,g.totalCents);
assert.equal(m.acceptedValue(101,3,0,1)+m.acceptedValue(101,3,1,1)+m.acceptedValue(101,3,2,1),101);
assert.throws(()=>m.acceptedValue(101,3,2,2),/Quantidade/);
assert.throws(()=>m.splitOrder([{id:1,vendorId:"",quantity:1,price:"10"}],[],0));
assert.throws(()=>m.splitOrder([{id:1,vendorId:"a",quantity:1,price:"10"}],[{vendorId:"b",freight:0}],0));
let on=true,paid=true,owner=true,accepted=0,receiptStatus="reported",lastAmount=0,writes=0;
const routes=new Map(),id="11111111-1111-4111-8111-111111111111",rid="22222222-2222-4222-8222-222222222222",item="33333333-3333-4333-8333-333333333333";
const query=async(sql,args=[])=>{
 if(["BEGIN","COMMIT","ROLLBACK"].includes(sql))return {rows:[]};
 if(sql.startsWith("SELECT o.id,o.payment_status"))return {rows:owner?[{id:10,payment_status:paid?"paid":"pending",status:"confirmed",consumer_id:9}]:[]};
 if(sql.startsWith("SELECT * FROM praca_suborders"))return {rows:[{id,order_id:10,status:"shipped",freight_net_cents:"30"}]};
 if(sql.startsWith("SELECT 1 FROM disputes"))return {rows:[]};
 if(sql.startsWith("SELECT status FROM praca_suborder_receipts"))return {rows:[{status:receiptStatus}]};
 if(sql.startsWith("SELECT i.id"))return {rows:[{id:item,quantity:3,net_cents:"101",accepted,reserved:3}]};
 if(sql.startsWith("SELECT suborder_item_id,quantity"))return {rows:[{suborder_item_id:item,quantity:accepted===0?1:2}]};
 if(sql.startsWith("UPDATE praca_suborder_receipts")){writes++;receiptStatus=args[2];lastAmount=args[5];return {rows:[]}};
 if(sql.startsWith("UPDATE praca_suborders")||sql.startsWith("INSERT INTO praca_suborder_events"))return {rows:[]};
 throw Error("Unexpected SQL: "+sql);
};
const c={query,release(){}};
const ctx={Router:()=>({get:(p,f)=>routes.set("GET "+p,f),post:(p,f)=>routes.set("POST "+p,f)}),pool:{connect:async()=>c,query},subordersEnabled:()=>on,acceptedValue:m.acceptedValue,Buffer,process:{env:{}},timingSafeEqual:()=>false};
vm.createContext(ctx);vm.runInContext(compile(read("artifacts/api-server/src/routes/suborders.ts")),ctx);
function res(){return {code:200,body:null,status(n){this.code=n;return this},json(b){this.body=b;return this},set(){return this},end(){return this}}}
const handler=routes.get("POST /suborders/:id/receipts/:receiptId/answer");
const request=()=>({params:{id,receiptId:rid},session:{consumerId:9},body:{accept:true,quantitiesChecked:true}});
let response=res();await handler(request(),response);assert.equal(response.code,200);assert.equal(lastAmount,33);assert.equal(response.body.releaseStatus,"blocked_provider");assert.equal(writes,1);
response=res();await handler(request(),response);assert.equal(response.body.duplicate,true);assert.equal(writes,1);
accepted=1;receiptStatus="reported";response=res();await handler(request(),response);assert.equal(lastAmount,98);assert.equal(response.body.amount,0.98);
paid=false;receiptStatus="reported";response=res();await handler(request(),response);assert.equal(response.code,409);assert.equal(writes,2);
paid=true;owner=false;response=res();await handler(request(),response);assert.equal(response.code,404);assert.equal(writes,2);
owner=true;const bad=request();bad.body.quantitiesChecked=false;response=res();await handler(bad,response);assert.equal(response.code,422);
const anon=request();anon.session={};response=res();await handler(anon,response);assert.equal(response.code,401);
on=false;response=res();await handler(request(),response);assert.equal(response.code,404);

let commits=0,rollbacks=0,snapshots=0,mismatch=false;
const storage={query:async(sql,args)=>{
 if(sql==="BEGIN")return {rows:[]};
 if(sql==="COMMIT"){commits++;return {rows:[]}}
 if(sql==="ROLLBACK"){rollbacks++;return {rows:[]}}
 if(sql.startsWith("SELECT total FROM orders"))return {rows:[{total:mismatch?"192.99":"193.00"}]};
 if(sql.startsWith("SELECT id FROM praca_suborders"))return {rows:[]};
 if(sql.startsWith("SELECT id,vendor_id,quantity,price_at_purchase"))return {rows:[{id:1,vendor_id:"b",quantity:3,price_at_purchase:"0.01"},{id:2,vendor_id:"a",quantity:2,price_at_purchase:"100"}]};
 if(sql.startsWith("INSERT INTO praca_suborders")){snapshots++;return {rows:[{id:"s"+snapshots}]}};
 if(sql.startsWith("INSERT INTO praca_suborder_items")||sql.startsWith("INSERT INTO praca_suborder_events"))return {rows:[]};
 throw Error(sql);
},release(){}};
const library={pool:{connect:async()=>storage},splitOrder:m.splitOrder,process:{env:{PRACA_SUBORDERS_ENABLED:"true"}}};
vm.createContext(library);vm.runInContext(compile(read("artifacts/api-server/src/lib/suborders.ts")),library);
await library.createSuborders(10,[{vendorId:"a",freight:9.99},{vendorId:"b",freight:0.01}],17.03);
assert.equal(commits,1);assert.equal(snapshots,2);
mismatch=true;await assert.rejects(()=>library.createSuborders(10,[{vendorId:"a",freight:9.99},{vendorId:"b",freight:0.01}],17.03),/divergentes/);
assert.equal(commits,1);assert.equal(rollbacks,1);assert.equal(snapshots,2);
library.process.env.PRACA_SUBORDERS_ENABLED="false";
await library.createSuborders(10,[],0);assert.equal(snapshots,2);
const orders=read("artifacts/api-server/src/routes/orders.ts");assert.equal((orders.match(/router.post\("\/orders"/g)??[]).length,1);assert(!orders.includes("getProductById"));
for(const p of ["artifacts/api-server/src/routes/orders.ts","artifacts/api-server/src/routes/suborders.ts","artifacts/api-server/src/lib/suborders.ts","artifacts/api-server/src/lib/negotiationAudit.ts","artifacts/api-server/src/routes/deliveries.ts","artifacts/api-server/src/routes/rounds.ts","vendor/artifacts/api-server/src/routes/praca_rounds.ts"])stripTypeScriptTypes(read(p),{mode:"transform"});
console.log("PASS: rateio exato, 500 combinações, entrega parcial, saldo, frete final, aceite idempotente, autenticação, titularidade, pagamento e flag");

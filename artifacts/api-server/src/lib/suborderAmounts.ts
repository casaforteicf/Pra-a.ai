export type SuborderLine = { id: number; vendorId: string; quantity: number; price: string | number };
export function cents(value: string | number): number {
 const n=Number(value), c=Math.round(n*100);
 if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(c))throw new Error("Valor monetário inválido.");
 return c;
}
// Maior resto, com desempate estável: soma exata em centavos.
export function allocateCents(total:number,weights:number[]):number[]{
 if(!Number.isSafeInteger(total)||total<0||weights.some(w=>!Number.isSafeInteger(w)||w<0))throw new Error("Rateio inválido.");
 const sum=weights.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(sum)||(!sum&&total))throw new Error("Base de rateio inválida.");
 if(!sum)return weights.map(()=>0);
 const denom=BigInt(sum), numerators=weights.map(w=>BigInt(total)*BigInt(w));
 const result=numerators.map(n=>Number(n/denom));
 let remaining=total-result.reduce((a,b)=>a+b,0);
 const ranked=numerators.map((n,i)=>({i,remainder:n%denom})).sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1);
 for(let i=0;i<remaining;i++)result[ranked[i].i]++;
 return result;
}
export function splitOrder(lines:SuborderLine[],freight:{vendorId:string;freight:number}[],discount:number){
 if(!lines.length||lines.some(l=>!l.vendorId||!Number.isSafeInteger(l.quantity)||l.quantity<=0||!Number.isSafeInteger(l.id)))throw new Error("Itens inválidos.");
 const ids=new Set(lines.map(l=>l.id));if(ids.size!==lines.length)throw new Error("Itens duplicados.");
 const vendors=[...new Set(lines.map(l=>l.vendorId))].sort();
 if(freight.length!==vendors.length||new Set(freight.map(f=>f.vendorId)).size!==freight.length||freight.some(f=>!vendors.includes(f.vendorId)))throw new Error("Frete por vendedor inválido.");
 const groups=vendors.map(vendorId=>{
  const items=lines.filter(l=>l.vendorId===vendorId).map(l=>({...l,subtotalCents:cents(l.price)*l.quantity}));
  const subtotalCents=items.reduce((s,l)=>s+l.subtotalCents,0),freightCents=cents(freight.find(f=>f.vendorId===vendorId)!.freight);
  if(!Number.isSafeInteger(subtotalCents+freightCents))throw new Error("Total inválido.");
  return {vendorId,items,subtotalCents,freightCents};
 });
 const gross=groups.map(g=>g.subtotalCents+g.freightCents),discountCents=cents(discount);
 if(discountCents>gross.reduce((a,b)=>a+b,0))throw new Error("Desconto maior que o pedido.");
 const shares=allocateCents(discountCents,gross);
 return groups.map((g,i)=>{
  const parts=allocateCents(shares[i],[...g.items.map(l=>l.subtotalCents),g.freightCents]);
  return {...g,discountCents:shares[i],totalCents:g.subtotalCents+g.freightCents-shares[i],freightNetCents:g.freightCents-parts[parts.length-1],
   items:g.items.map((l,j)=>({...l,netCents:l.subtotalCents-parts[j]}))};
 });
}
// O centavo residual acompanha a última parcela, sem somas aproximadas.
export function acceptedValue(netCents:number,ordered:number,before:number,received:number):number{
 if(![netCents,ordered,before,received].every(Number.isSafeInteger)||netCents<0||ordered<=0||before<0||received<=0||before+received>ordered)throw new Error("Quantidade inválida.");
 return Number(BigInt(netCents)*BigInt(before+received)/BigInt(ordered)-BigInt(netCents)*BigInt(before)/BigInt(ordered));
}

import * as React from "react";
type Report={reportedAt:string|null;receivedBy:string|null;blocked:boolean;orderStatus:string};
export default function MarketplaceDeliveryProof({orderType,orderId,onSaved}:{orderType:"quote"|"round";orderId:string;onSaved:()=>void}){
 const [report,setReport]=React.useState<Report|null>(null),[accepted,setAccepted]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(""),[refresh,setRefresh]=React.useState(0);
 const base="/api/marketplace-orders/"+orderType+"/"+encodeURIComponent(orderId);
 React.useEffect(()=>{setReport(null);setAccepted(false);const controller=new AbortController();void fetch(base+"/delivery-report",{credentials:"include",cache:"no-store",signal:controller.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error??"Falha ao carregar comprovante.");setReport(b)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[base,refresh]);
 async function confirm(){setBusy(true);setError("");try{const path=orderType==="quote"?"/api/quotes/":"/api/round-orders/";const r=await fetch(path+encodeURIComponent(orderId)+"/confirm-delivery",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({allItemsReceived:accepted})});const b=await r.json();if(!r.ok)throw Error(b.error??"Falha ao confirmar.");setReport(v=>v?{...v,orderStatus:"delivered"}:v);onSaved()}catch(e){setError(e instanceof Error?e.message:"Falha ao confirmar.")}finally{setBusy(false)}}
 return <section className="mt-4 rounded-xl border bg-white p-4 text-sm">
 <h3 className="font-bold">Comprovante e confirmação da entrega</h3><button type="button" disabled={busy} onClick={()=>setRefresh(v=>v+1)} className="mt-2 text-xs font-bold underline">Atualizar comprovante</button>
 {error&&<p role="alert" className="mt-2 text-red-700">{error}</p>}
 {!report?.reportedAt?<p className="mt-2">Aguarde a loja registrar a entrega ou retirada com foto. Confirme somente depois de receber todos os itens.</p>:<>
 <p className="mt-2">Entrega informada em {new Date(report.reportedAt).toLocaleString("pt-BR")}. Recebido por: {report.receivedBy}.</p>
 <img src={base+"/delivery-evidence"} alt="Comprovante de entrega enviado pela loja" className="mt-3 max-h-80 w-full rounded-lg object-contain"/>
 {report.orderStatus==="paid"?<>
 <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} disabled={busy||report.blocked}/><span>Recebi todos os itens corretamente e autorizo a liberação do valor correspondente à loja.</span></label>
 {report.blocked?<p role="status" className="mt-2 text-amber-800">A confirmação está suspensa enquanto o atendimento estiver em análise.</p>:<button type="button" onClick={()=>void confirm()} disabled={!accepted||busy} className="mt-3 rounded-lg bg-[#10BFA9] px-4 py-3 font-bold disabled:opacity-50">{busy?"Confirmando…":"Recebi tudo corretamente"}</button>}
 <p className="mt-2 text-xs">Se houver falta, avaria ou outro problema, use a opção de disputa do pedido.</p>
 </>:<p className="mt-3 font-bold">{report.orderStatus==="released"?"Recebimento e liberação financeira confirmados.":"Recebimento confirmado. Liberação financeira aguardando integração do provedor."}</p>}
 </>}
 </section>
}

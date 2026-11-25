import React from "react";
import type { ResponsiveTypeScale } from "../../services/hostinger/hostingerStorefrontService";

type Device = "desktop" | "tablet" | "mobile";
type Role = "h1" | "h2" | "h3" | "h4" | "body" | "small" | "button";
const roles: Array<{key:Role;label:string;hint:string}> = [
  {key:"h1",label:"H1 · Main heading",hint:"Page and hero titles"},
  {key:"h2",label:"H2 · Section heading",hint:"Homepage and page sections"},
  {key:"h3",label:"H3 · Subheading",hint:"Cards and content groups"},
  {key:"h4",label:"H4 · Small heading",hint:"Product and supporting headings"},
  {key:"body",label:"Body text",hint:"Paragraphs and descriptions"},
  {key:"small",label:"Small text",hint:"Captions, helper text and metadata"},
  {key:"button",label:"Button text",hint:"Primary and secondary actions"}
];
export const ResponsiveTypographyControls: React.FC<{value:ResponsiveTypeScale;onChange:(value:ResponsiveTypeScale)=>void}> = ({value,onChange}) => {
  const update=(device:Device,role:Role,next:number)=>onChange({...value,[device]:{...value[device],[role]:Math.min(96,Math.max(10,next))}});
  const renderDevice=(device:Device,title:string,description:string,enabled?:boolean,onToggle?:()=>void)=><section className="rounded-xl border border-[#E7DCEB] bg-white p-3 sm:p-4" key={device}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-semibold text-[#302438]">{title}</h4><p className="mt-0.5 text-xs text-[#806F89]">{description}</p></div>{onToggle&&<label className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-[#563568]"><input type="checkbox" checked={!!enabled} onChange={onToggle} className="h-4 w-4 accent-[#563568]"/>Enable manual override</label>}</div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{roles.map(role=><label key={role.key} className="flex items-center justify-between gap-3 rounded-lg bg-[#FBF9FC] px-3 py-2"><span className="min-w-0"><span className="block text-xs font-medium text-[#302438]">{role.label}</span><span className="block text-[10px] text-[#806F89]">{role.hint}</span></span><span className="flex shrink-0 items-center gap-1"><input type="number" min={10} max={96} step={1} value={value[device][role.key]} onChange={e=>update(device,role.key,Number(e.target.value)||10)} disabled={onToggle&&!enabled} className="min-h-10 w-16 rounded-md border border-[#E7DCEB] bg-white px-2 text-right text-sm text-[#302438] disabled:cursor-not-allowed disabled:opacity-50" aria-label={title+" "+role.label+" size in pixels"}/><span className="text-xs text-[#806F89]">px</span></span></label>)}</div>
    {onToggle&&!enabled&&<p className="mt-2 text-[11px] text-[#806F89]">Automatic responsive sizing is active. Values are saved and ready if you enable manual override.</p>}
  </section>;
  return <details className="group overflow-hidden rounded-xl border border-[#E7DCEB] bg-white">
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#FBF9FC] [&::-webkit-details-marker]:hidden"><span><span className="block text-sm font-semibold text-[#302438]">Responsive typography</span><span className="mt-0.5 block text-xs text-[#806F89]">Set H1–H4, body, small and button sizes independently for each screen.</span></span><span aria-hidden="true" className="shrink-0 text-lg text-[#806F89] transition-transform group-open:rotate-180">⌄</span></summary>
    <div className="space-y-3 border-t border-[#EFE8F2] p-3 sm:p-4">
      {renderDevice("desktop","Desktop","Default sizes for wide screens")}
      {renderDevice("tablet","Tablet","Automatic sizing by default",value.tabletOverride,()=>onChange({...value,tabletOverride:!value.tabletOverride}))}
      {renderDevice("mobile","Mobile","Automatic sizing by default",value.mobileOverride,()=>onChange({...value,mobileOverride:!value.mobileOverride}))}
      <p className="text-[11px] text-[#806F89]">Sizes are in CSS pixels. Manual overrides affect only the selected breakpoint; all other screen sizes retain automatic responsive behaviour.</p>
    </div>
  </details>;
};

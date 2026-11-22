import React, { useEffect, useMemo, useState } from "react";
import { Check, Monitor, RotateCcw, Save, Smartphone, Tablet, Upload } from "lucide-react";
import {
  DEFAULT_GLOBAL_DESIGN, hostingerStorefrontService,
  type DesignFontFamily, type DesignFontRole, type GlobalDesignSettings
} from "../../services/hostinger/hostingerStorefrontService";

type PreviewMode = "desktop" | "tablet" | "mobile";
type Field = { id: string; label: string; help: string; section: keyof GlobalDesignSettings["elements"] | "colors"; key: string; legacy?: boolean };
type Pair = { fg: string; bg: string; label: string };
type Role = keyof GlobalDesignSettings["fonts"];
const HEX = /^#[0-9A-Fa-f]{6}$/;
const FONTS: DesignFontFamily[] = ["Cormorant Garamond","Plus Jakarta Sans","Playfair Display","DM Sans","Lato","Montserrat","Poppins","Inter","Roboto","Georgia","Arial"];

const fields: Field[] = [
  ...[
    ["heading","Heading text","Headings and prominent text"],["body","Body text","Paragraphs and supporting copy"],["goldText","Gold label text","Eyebrows and premium labels"],["muted","Muted text","Secondary and helper text"],["link","Links","Standard text links"],["linkHover","Link hover","Hovered and focused links"]
  ].map(([id,label,help])=>({id,label,help,section:"text" as const,key:id})),
  ...[
    ["primaryBackground","Primary button background","Main call-to-action background"],["primaryText","Primary button text","Text on primary buttons"],["primaryHoverBackground","Primary button hover","Hover background"],["primaryPressedBackground","Primary button pressed","Pressed/active background"],["secondaryBorder","Secondary button border","Outline for secondary actions"],["secondaryText","Secondary button text","Text on secondary actions"]
  ].map(([id,label,help])=>({id,label,help,section:"buttons" as const,key:id})),
  ...[
    ["alternateSection","Alternate section","Alternate storefront section background"],["card","Card background","Product and content cards"],["border","Surface border","Card and panel borders"],["pill","Pill background","Chips, tags and pill labels"]
  ].map(([id,label,help])=>({id,label,help,section:"surfaces" as const,key:id})),
  ...[
    ["saleBadgeBackground","Sale badge background","Sale and offer badge"],["saleBadgeText","Sale badge text","Text inside sale badges"],["sellingPrice","Selling price","Current product price"],["oldPrice","Old price","Original product price"],["starRating","Star rating","Review stars"],["categoryLabel","Category label","Product category text"]
  ].map(([id,label,help])=>({id,label,help,section:"productCards" as const,key:id})),
  ...[
    ["announcementBackground","Announcement background","Top announcement strip","background"],["announcementText","Announcement text","Text in the announcement strip","text"],["announcementSeparator","Announcement separator","Separator/divider accent","separator"]
  ].map(([id,label,help,key])=>({id,label,help,section:"announcement" as const,key})),
  ...[
    ["heroCaption","Hero caption","Small eyebrow/caption over hero artwork","caption"],["heroHeading","Hero heading","Main banner heading","heading"],["heroParagraph","Hero paragraph","Supporting banner copy","paragraph"]
  ].map(([id,label,help,key])=>({id,label,help,section:"hero" as const,key})),
  ...[
    ["countdownBackground","Countdown background","Countdown bar background","background"],["countdownBorder","Countdown border","Countdown bar outline","border"],["countdownText","Countdown text and timer","Countdown labels and digits","text"]
  ].map(([id,label,help,key])=>({id,label,help,section:"countdown" as const,key})),
  ...[
    ["footerBg","Footer background","Footer base colour","background"],["footerHeadings","Footer headings","Footer section headings","headings"],["footerLinks","Footer links","Footer link text","links"],["footerLinkHover","Footer link hover","Hovered footer links","linkHover"],["footerDivider","Footer divider","Footer separator lines","divider"],["footerBottomText","Footer bottom text","Copyright and bottom-row text","bottomText"]
  ].map(([id,label,help,key])=>({id,label,help,section:"footer" as const,key})),
  ...[
    ["legacyPrimary","Legacy primary","Existing primary brand colour","primary"],["legacyAccent","Legacy accent","Existing accent brand colour","accent"],["legacySurface","Legacy surface","Existing shared surface field","surface"],["legacyPageBackground","Legacy page background","Existing page background field","pageBackground"],["legacyText","Legacy primary text","Existing primary text field","text"],["legacyHeaderBackground","Legacy header background","Existing header surface field","headerBackground"],["legacyFooterBackground","Legacy footer background","Existing footer surface field","footerBackground"],["legacyFooterText","Legacy footer text","Existing footer text field","footerText"]
  ].map(([id,label,help,key])=>({id,label,help,section:"colors" as const,key,legacy:true}))
];

const sections: Array<{title:string;description:string;ids:string[]}> = [
  {title:"Text colours",description:"Headings, body copy, labels, helper text and links.",ids:["heading","body","goldText","muted","link","linkHover","legacyText"]},
  {title:"Buttons",description:"Primary and secondary button states.",ids:["primaryBackground","primaryText","primaryHoverBackground","primaryPressedBackground","secondaryBorder","secondaryText"]},
  {title:"Surfaces",description:"Sections, cards, borders, pills and the original global colour fields.",ids:["alternateSection","card","border","pill","legacyPrimary","legacyAccent","legacySurface","legacyPageBackground"]},
  {title:"Product cards",description:"Sale badges, prices, ratings and category labels.",ids:["saleBadgeBackground","saleBadgeText","sellingPrice","oldPrice","starRating","categoryLabel"]},
  {title:"Announcement bar",description:"The top announcement strip and its separator.",ids:["announcementBackground","announcementText","announcementSeparator"]},
  {title:"Hero and banner text",description:"Caption, heading and paragraph colours for banners.",ids:["heroCaption","heroHeading","heroParagraph"]},
  {title:"Countdown bar",description:"Countdown background, outline and timer text.",ids:["countdownBackground","countdownBorder","countdownText"]},
  {title:"Footer",description:"Footer colours and the original header/footer settings.",ids:["footerBg","footerHeadings","footerLinks","footerLinkHover","footerDivider","footerBottomText","legacyHeaderBackground","legacyFooterBackground","legacyFooterText"]},
  {title:"Fonts",description:"Independent family, size scale and weight for each typography role.",ids:[]}
];

const pairs: Pair[] = [
  {fg:"heading",bg:"legacyPageBackground",label:"Heading / page background"},
  {fg:"body",bg:"legacyPageBackground",label:"Body / page background"},
  {fg:"goldText",bg:"alternateSection",label:"Gold label / alternate section"},
  {fg:"muted",bg:"card",label:"Muted text / card"},
  {fg:"link",bg:"legacyPageBackground",label:"Link / page background"},
  {fg:"primaryText",bg:"primaryBackground",label:"Primary button text / background"},
  {fg:"secondaryText",bg:"card",label:"Secondary button text / card"},
  {fg:"saleBadgeText",bg:"saleBadgeBackground",label:"Sale badge text / background"},
  {fg:"sellingPrice",bg:"card",label:"Selling price / card"},
  {fg:"categoryLabel",bg:"card",label:"Category label / card"},
  {fg:"announcementText",bg:"announcementBackground",label:"Announcement text / background"},
  {fg:"countdownText",bg:"countdownBackground",label:"Countdown text / background"},
  {fg:"footerHeadings",bg:"footerBg",label:"Footer headings / background"},
  {fg:"footerLinks",bg:"footerBg",label:"Footer links / background"},
  {fg:"footerBottomText",bg:"footerBg",label:"Footer bottom text / background"},
  {fg:"legacyFooterText",bg:"legacyFooterBackground",label:"Legacy footer text / background"}
];

const clone = (value: GlobalDesignSettings) => JSON.parse(JSON.stringify(value)) as GlobalDesignSettings;
const getValue = (design: GlobalDesignSettings, field: Field): string => {
  if (field.section === "colors") return design.colors[field.key as keyof GlobalDesignSettings["colors"]];
  const group = design.elements[field.section] as unknown as Record<string,string>;
  return group[field.key] || "";
};
const setValue = (design: GlobalDesignSettings, field: Field, value: string): GlobalDesignSettings => {
  const next = clone(design);
  if (field.section === "colors") next.colors[field.key as keyof GlobalDesignSettings["colors"]] = value;
  else (next.elements[field.section] as unknown as Record<string,string>)[field.key] = value;
  return next;
};
const linear = (n:number) => { const v=n/255; return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4); };
const contrast = (fg:string,bg:string):number|null => {
  if(!HEX.test(fg)||!HEX.test(bg)) return null;
  const lum=(hex:string)=>{const c=[1,3,5].map(i=>linear(parseInt(hex.slice(i,i+2),16)));return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
};

export const GlobalDesignStudio: React.FC = () => {
  const [design,setDesign]=useState<GlobalDesignSettings>(()=>clone(DEFAULT_GLOBAL_DESIGN));
  const [savedDesign,setSavedDesign]=useState<GlobalDesignSettings>(()=>clone(DEFAULT_GLOBAL_DESIGN));
  const [publishedDesign,setPublishedDesign]=useState<GlobalDesignSettings>(()=>clone(DEFAULT_GLOBAL_DESIGN));
  const [previewMode,setPreviewMode]=useState<PreviewMode>("desktop");
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[publishing,setPublishing]=useState(false);
  const [confirmRestore,setConfirmRestore]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const dirty=useMemo(()=>JSON.stringify(design)!==JSON.stringify(savedDesign),[design,savedDesign]);
  const invalid=fields.filter(f=>!HEX.test(getValue(design,f)));
  const values=useMemo(()=>Object.fromEntries(fields.map(f=>[f.id,getValue(design,f)])) as Record<string,string>,[design]);
  const canSave=invalid.length===0&&!loading&&!saving&&!publishing;

  useEffect(()=>{
    let active=true;
    hostingerStorefrontService.getGlobalDesign().then(result=>{
      if(!active)return;
      const next=result.draft||clone(DEFAULT_GLOBAL_DESIGN);
      setDesign(clone(next));setSavedDesign(clone(next));setPublishedDesign(clone(result.published||DEFAULT_GLOBAL_DESIGN));
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load design settings.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);

  const updateColor=(field:Field,value:string)=>{
    setDesign(current=>setValue(current,field,value));setError("");setMessage("");
  };
  const updateRole=(role:Role,key:keyof DesignFontRole,value:DesignFontRole[keyof DesignFontRole])=>{
    setDesign(current=>({...current,fonts:{...current.fonts,[role]:{...current.fonts[role],[key]:value}}}));
  };
  const updateTypography=<K extends keyof GlobalDesignSettings["typography"]>(key:K,value:GlobalDesignSettings["typography"][K])=>
    setDesign(current=>({...current,typography:{...current.typography,[key]:value}}));
  const updateLayout=<K extends keyof GlobalDesignSettings["layout"]>(key:K,value:GlobalDesignSettings["layout"][K])=>
    setDesign(current=>({...current,layout:{...current.layout,[key]:value}}));

  const saveDraft=async()=>{
    if(invalid.length){setError("Correct the highlighted colour values before saving.");return;}
    setSaving(true);setError("");setMessage("");
    try{const result=await hostingerStorefrontService.saveGlobalDesign(design);setDesign(clone(result.draft));setSavedDesign(clone(result.draft));setMessage("Design draft saved. The live storefront is unchanged until you publish.");}
    catch(e){setError(e instanceof Error?e.message:"Design draft could not be saved.");}
    finally{setSaving(false);}
  };
  const publish=async()=>{
    if(invalid.length){setError("Correct the highlighted colour values before publishing.");return;}
    if(!window.confirm("Publish these global design changes to the live SARINE storefront?"))return;
    setPublishing(true);setError("");setMessage("");
    try{const saved=await hostingerStorefrontService.saveGlobalDesign(design);setSavedDesign(clone(saved.draft));const result=await hostingerStorefrontService.publishGlobalDesign();setPublishedDesign(clone(result.published));setMessage("Your global design is published. Refresh the storefront to see the new styling.");}
    catch(e){setError(e instanceof Error?e.message:"Design could not be published.");}
    finally{setPublishing(false);}
  };
  const restoreDefaults=()=>{
    setDesign(clone(DEFAULT_GLOBAL_DESIGN));setConfirmRestore(false);
    setMessage("SARINE plum, gold and ivory defaults are loaded in this draft only. Save and publish when ready.");setError("");
  };

  const renderColor=(field:Field)=>{
    const value=getValue(design,field),valid=HEX.test(value);
    const warnings=pairs.filter(p=>p.fg===field.id||p.bg===field.id).map(p=>{
      const ratio=contrast(values[p.fg],values[p.bg]);
      return ratio!==null&&ratio<4.5?p.label+": "+ratio.toFixed(2)+":1 (below 4.5:1)":null;
    }).filter((v):v is string=>v!==null);
    return <div key={field.id} className="min-w-0 rounded-xl border border-[#EDE5F0] bg-white p-3">
      <div className="flex items-start gap-3">
        <input type="color" value={valid?value:"#FFFFFF"} onChange={e=>updateColor(field,e.target.value.toUpperCase())} className="mt-0.5 h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-[#E7DCEB] bg-white p-1" aria-label={field.label+" colour picker"}/>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><label htmlFor={"design-"+field.id} className="text-sm font-semibold text-[#302438]">{field.label}</label>{field.legacy&&<span className="rounded-full bg-[#F5F0F7] px-2 py-0.5 text-[10px] text-[#705E7B]">Existing field</span>}</div>
          <p className="mt-0.5 text-[11px] leading-4 text-[#806F89]">{field.help}</p>
          <input id={"design-"+field.id} value={value} onChange={e=>updateColor(field,e.target.value)} maxLength={7} spellCheck={false} placeholder="#RRGGBB" aria-invalid={!valid} aria-describedby={!valid?"error-"+field.id:undefined} className={"mt-2 min-h-10 w-full max-w-36 rounded-md border px-2.5 py-2 font-mono text-xs uppercase outline-none focus:ring-2 focus:ring-[#B69ACF] "+(valid?"border-[#E7DCEB]":"border-red-500 bg-red-50")}/>
          {!valid&&<p id={"error-"+field.id} role="alert" className="mt-1 text-xs text-red-700">Enter a solid hex colour in #RRGGBB format.</p>}
          {warnings.length>0&&<div className="mt-2 space-y-1" aria-live="polite">{warnings.map(w=><p key={w} className="text-xs text-amber-800">Contrast warning: {w}</p>)}</div>}
        </div>
      </div>
    </div>;
  };

  const roleLabels:Record<Role,string>={logo:"Logo",heading:"Heading",body:"Body",buttonLabel:"Button and label"};
  const previewWidth=previewMode==="desktop"?"100%":previewMode==="tablet"?"620px":"375px";
  const previewStyle:React.CSSProperties={width:previewWidth,maxWidth:previewMode==="desktop"?design.layout.contentWidth+"px":"100%",marginInline:"auto",background:design.colors.pageBackground,color:design.elements.text.body,fontFamily:design.fonts.body.family,borderRadius:design.layout.cornerRadius+"px",border:"1px solid "+design.elements.surfaces.border,overflow:"hidden"};

  return <section className="space-y-6 rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-6" aria-labelledby="global-design-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8B70A0]">Brand-wide appearance</p><h2 id="global-design-title" className="mt-1 font-serif text-2xl text-[#563568] sm:text-3xl">Global Design Studio</h2><p className="mt-1 max-w-2xl text-sm text-[#705E7B]">Fine-tune each storefront colour and font role while keeping saved draft and published design separate.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F0FA] px-3 py-2 text-xs font-medium text-[#563568]"><span className="h-2 w-2 rounded-full bg-[#B69ACF]"/>{dirty?"Unsaved changes":"Draft saved"}</span></div>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {message&&<div role="status" aria-live="polite" className="rounded-lg border border-[#DCCBE7] bg-[#F7F0FA] p-3 text-sm text-[#563568]">{message}</div>}
    {invalid.length>0&&!loading&&<p role="alert" className="text-xs text-red-700">{invalid.length} colour value{invalid.length===1?" needs":"s need"} correction before saving or publishing.</p>}
    {loading?<p role="status" className="text-sm text-[#705E7B]">Loading your saved brand settings…</p>:<>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
        <div className="min-w-0 space-y-3">
          {sections.map((section,index)=><details key={section.title} open={index===0} className="group overflow-hidden rounded-xl border border-[#E7DCEB] bg-white">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#FBF9FC] [&::-webkit-details-marker]:hidden"><span><span className="block text-sm font-semibold text-[#302438]">{section.title}</span><span className="mt-0.5 block text-xs text-[#806F89]">{section.description}</span></span><span aria-hidden="true" className="shrink-0 text-lg text-[#806F89] transition-transform group-open:rotate-180">⌄</span></summary>
            <div className="space-y-3 border-t border-[#EFE8F2] p-3 sm:p-4">
              {section.title==="Fonts"?<>
                <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(roleLabels) as Role[]).map(role=>{const font=design.fonts[role];return <div key={role} className="space-y-3 rounded-xl border border-[#EDE5F0] p-3">
                  <h4 className="text-sm font-semibold text-[#302438]">{roleLabels[role]}</h4>
                  <label className="block space-y-1 text-xs font-medium text-[#563568]">Font family<select value={font.family} onChange={e=>updateRole(role,"family",e.target.value as DesignFontFamily)} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm text-[#302438]">{FONTS.map(f=><option key={f} value={f}>{f}</option>)}</select></label>
                  <label className="block space-y-1 text-xs font-medium text-[#563568]">Size scale · {font.sizeScale}%<input type="range" min={70} max={150} step={5} value={font.sizeScale} onChange={e=>updateRole(role,"sizeScale",Number(e.target.value))} className="w-full accent-[#563568]"/><span className="flex justify-between text-[10px] font-normal text-[#806F89]"><span>70%</span><span>150%</span></span></label>
                  <label className="block space-y-1 text-xs font-medium text-[#563568]">Font weight<select value={font.weight} onChange={e=>updateRole(role,"weight",Number(e.target.value) as DesignFontRole["weight"])} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm text-[#302438]">{[300,400,500,600,700].map(w=><option key={w} value={w}>{w}</option>)}</select></label>
                </div>;})}</div>
                <div className="rounded-xl border border-dashed border-[#DCCBE7] p-3"><h4 className="text-sm font-semibold text-[#302438]">Existing typography settings</h4><p className="mb-3 mt-1 text-xs text-[#806F89]">Original settings remain available for compatibility with saved designs.</p><div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-[#563568]">Legacy heading font<select value={design.typography.headingFont} onChange={e=>updateTypography("headingFont",e.target.value as GlobalDesignSettings["typography"]["headingFont"])} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm text-[#302438]">{(["Cormorant Garamond","Playfair Display","Georgia"] as const).map(f=><option key={f} value={f}>{f}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-medium text-[#563568]">Legacy body font<select value={design.typography.bodyFont} onChange={e=>updateTypography("bodyFont",e.target.value as GlobalDesignSettings["typography"]["bodyFont"])} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm text-[#302438]">{(["Plus Jakarta Sans","DM Sans","Arial"] as const).map(f=><option key={f} value={f}>{f}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-medium text-[#563568]">Legacy heading scale · {design.typography.headingScale}%<input type="range" min={90} max={120} step={5} value={design.typography.headingScale} onChange={e=>updateTypography("headingScale",Number(e.target.value))} className="w-full accent-[#563568]"/></label>
                  <label className="space-y-1 text-xs font-medium text-[#563568]">Legacy body scale · {design.typography.bodyScale}%<input type="range" min={90} max={110} step={5} value={design.typography.bodyScale} onChange={e=>updateTypography("bodyScale",Number(e.target.value))} className="w-full accent-[#563568]"/></label>
                </div></div>
              </>:<div className="grid gap-3 sm:grid-cols-2">{section.ids.map(id=>{const field=fields.find(f=>f.id===id);return field?renderColor(field):null;})}</div>}
              {section.title==="Hero and banner text"&&<p className="rounded-lg bg-[#FFF9E9] p-3 text-xs leading-5 text-[#75551A]">Image contrast note: text contrast over hero/banner images depends on the image, crop, overlay and position. A colour-only check cannot calculate contrast against the final artwork; review each banner image before publishing.</p>}
              {section.title==="Surfaces"&&<div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-[#563568]">Content width<select value={design.layout.contentWidth} onChange={e=>updateLayout("contentWidth",Number(e.target.value) as GlobalDesignSettings["layout"]["contentWidth"])} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm text-[#302438]">{[1120,1200,1280,1360].map(w=><option key={w} value={w}>{w}px</option>)}</select></label>
                <label className="space-y-1 text-xs font-medium text-[#563568]">Corner radius<select value={design.layout.cornerRadius} onChange={e=>updateLayout("cornerRadius",Number(e.target.value) as GlobalDesignSettings["layout"]["cornerRadius"])} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm text-[#302438]">{[0,4,8,16].map(v=><option key={v} value={v}>{v}px</option>)}</select></label>
                <label className="space-y-1 text-xs font-medium text-[#563568]">Button treatment<select value={design.components.buttonStyle} onChange={e=>setDesign(c=>({...c,components:{buttonStyle:e.target.value as "solid"|"outline"}}))} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-2.5 text-sm text-[#302438]"><option value="solid">Solid primary</option><option value="outline">Outlined primary</option></select></label>
              </div>}
            </div>
          </details>)}
        </div>
        <aside className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-[#302438]">Live design preview</h3><p className="text-xs text-[#806F89]">Updates as you edit the controls.</p></div><div className="flex rounded-lg border border-[#E7DCEB] p-1" aria-label="Preview device size">
            <button type="button" onClick={()=>setPreviewMode("desktop")} aria-pressed={previewMode==="desktop"} className={"min-h-10 min-w-10 rounded-md p-2 "+(previewMode==="desktop"?"bg-[#563568] text-white":"text-[#705E7B]")} aria-label="Desktop preview"><Monitor size={17}/></button>
            <button type="button" onClick={()=>setPreviewMode("tablet")} aria-pressed={previewMode==="tablet"} className={"min-h-10 min-w-10 rounded-md p-2 "+(previewMode==="tablet"?"bg-[#563568] text-white":"text-[#705E7B]")} aria-label="Tablet preview"><Tablet size={17}/></button>
            <button type="button" onClick={()=>setPreviewMode("mobile")} aria-pressed={previewMode==="mobile"} className={"min-h-10 min-w-10 rounded-md p-2 "+(previewMode==="mobile"?"bg-[#563568] text-white":"text-[#705E7B]")} aria-label="Mobile preview"><Smartphone size={17}/></button>
          </div></div>
          <div className="rounded-xl border border-dashed border-[#D8C8E1] bg-[#F8F5FA] p-3 sm:p-4"><div style={previewStyle}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs" style={{background:design.elements.announcement.background,color:design.elements.announcement.text,borderBottom:"1px solid "+design.elements.announcement.separator}}><span>✦ SARINE ATELIER ✦</span><span>Complimentary delivery</span></div>
            <div className="flex items-center justify-between border-b px-4 py-4" style={{background:design.colors.headerBackground,borderColor:design.elements.surfaces.border}}><span className="text-xl tracking-[0.2em]" style={{color:design.elements.text.heading,fontFamily:design.fonts.logo.family,fontSize:"calc(1.25rem * "+design.fonts.logo.sizeScale/100+")",fontWeight:design.fonts.logo.weight}}>SARINE</span><span className="text-[10px] tracking-wider" style={{color:design.elements.text.body}}>COLLECTIONS　 ABOUT</span></div>
            <div className="px-4 py-8 text-center sm:px-6 sm:py-10" style={{background:design.elements.surfaces.alternateSection}}>
              <p className="text-[10px] uppercase tracking-[0.2em]" style={{color:design.elements.hero.caption,fontFamily:design.fonts.buttonLabel.family,fontWeight:design.fonts.buttonLabel.weight}}>THE SARINE EDIT</p>
              <h4 className="mt-3 leading-tight" style={{fontFamily:design.fonts.heading.family,fontSize:"calc(1.75rem * "+design.fonts.heading.sizeScale/100+")",fontWeight:design.fonts.heading.weight,color:design.elements.text.heading}}>Elegance in every detail</h4>
              <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed" style={{fontFamily:design.fonts.body.family,fontSize:"calc(.75rem * "+design.fonts.body.sizeScale/100+")",fontWeight:design.fonts.body.weight,color:design.elements.text.body}}>Thoughtfully chosen pieces for everyday moments and unforgettable celebrations.</p>
              <button type="button" className="mt-5 min-h-11 px-5 py-3 text-xs font-semibold" style={{background:design.components.buttonStyle==="solid"?design.elements.buttons.primaryBackground:"transparent",color:design.components.buttonStyle==="solid"?design.elements.buttons.primaryText:design.elements.buttons.secondaryText,border:"1px solid "+design.elements.buttons.secondaryBorder,borderRadius:design.layout.cornerRadius+"px",fontFamily:design.fonts.buttonLabel.family,fontWeight:design.fonts.buttonLabel.weight}}>Discover the collection</button>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px]" style={{background:design.elements.countdown.background,borderColor:design.elements.countdown.border,color:design.elements.countdown.text}}>LIMITED TIME　 02 : 14 : 36</div>
            </div>
            <div className="px-4 py-4 text-center text-[10px]" style={{background:design.elements.footer.background,color:design.elements.footer.bottomText,borderTop:"1px solid "+design.elements.footer.divider}}>SARINE · Timeless jewellery for every you</div>
          </div><p className="mt-2 text-center text-[11px] text-[#806F89]">{previewMode==="desktop"?"Desktop · Full content width":previewMode==="tablet"?"Tablet · 620px canvas":"Mobile · 375px canvas"}</p></div>
          <div className="space-y-2 rounded-xl border border-[#E7DCEB] p-4"><h4 className="text-sm font-semibold text-[#563568]">Currently published</h4><div className="flex flex-wrap gap-2">
            <span className="rounded-full px-2.5 py-1 text-[11px]" style={{background:publishedDesign.elements.buttons.primaryBackground,color:publishedDesign.elements.buttons.primaryText}}>Primary button</span>
            <span className="rounded-full px-2.5 py-1 text-[11px]" style={{background:publishedDesign.elements.surfaces.pill,color:publishedDesign.elements.text.heading}}>Surface</span>
            <span className="rounded-full px-2.5 py-1 text-[11px]" style={{background:publishedDesign.elements.footer.background,color:publishedDesign.elements.footer.bottomText}}>Footer</span>
          </div><p className="text-xs text-[#806F89]">Your published storefront stays unchanged while you edit this draft.</p></div>
        </aside>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[#EFE8F2] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">{!confirmRestore?<button type="button" onClick={()=>setConfirmRestore(true)} disabled={saving||publishing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DCCBE7] px-4 py-2.5 text-sm text-[#563568] hover:bg-[#F7F0FA] disabled:opacity-50"><RotateCcw size={16}/>Restore brand defaults</button>:<div className="rounded-lg border border-[#DCCBE7] bg-[#FBF8FC] p-3"><p className="text-sm font-medium text-[#302438]">Restore SARINE's plum, gold and ivory defaults?</p><p className="mt-1 text-xs text-[#806F89]">This replaces editor values in the draft only. It does not save or publish.</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={restoreDefaults} className="min-h-10 rounded-lg bg-[#4A1D5C] px-3 py-2 text-xs font-semibold text-white">Confirm restore</button><button type="button" onClick={()=>setConfirmRestore(false)} className="min-h-10 rounded-lg border border-[#DCCBE7] px-3 py-2 text-xs text-[#563568]">Cancel</button></div></div>}</div>
        <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={()=>void saveDraft()} disabled={!canSave||!dirty} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#563568] px-5 py-2.5 text-sm font-medium text-[#563568] hover:bg-[#F7F0FA] disabled:opacity-50"><Save size={16}/>{saving?"Saving…":"Save draft"}</button><button type="button" onClick={()=>void publish()} disabled={!canSave} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#563568] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#442753] disabled:opacity-50">{publishing?<Upload size={16} className="animate-pulse"/>:<Check size={16}/ >}{publishing?"Publishing…":"Publish design"}</button></div>
      </div>
      <p className="text-[11px] text-[#806F89]">Saving a draft never changes the public site. Publishing applies selected global styling; product data, orders, checkout, navigation destinations and existing page content are not modified.</p>
    </>}
  </section>;
};

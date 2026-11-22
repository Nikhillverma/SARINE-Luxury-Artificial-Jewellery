const API_BASE = (import.meta.env.VITE_HOSTINGER_API_BASE_URL || (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")).replace(/\/+$/, "");
export type CmsBlock = {type:"heading";text:string}|{type:"paragraph";text:string}|{type:"image";src:string;alt:string}|{type:"button";text:string;href:string};
export interface CmsPageDraft {title:string;slug:string;seoTitle:string;seoDescription:string;blocks:CmsBlock[];}
export interface CmsPage {id:string;slug:string;draft:CmsPageDraft;published?:CmsPage["draft"]|null;isPublished:boolean;updatedAt?:string;}
export interface CmsReusableSection {id:string;title:string;blocks:CmsBlock[];updatedAt?:string;}
async function call<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(API_BASE+path,{...init,credentials:"include",headers:{Accept:"application/json","Content-Type":"application/json",...init.headers}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(typeof body.error==="string"?body.error:`Request failed (${response.status})`);return body as T;}
export const cmsPagesService={
 list:()=>call<{pages:CmsPage[]}>("/admin/pages"),
 create:(page:CmsPageDraft)=>call("/admin/pages",{method:"POST",body:JSON.stringify(page)}),
 save:(id:string,page:CmsPageDraft)=>call("/admin/pages/"+encodeURIComponent(id)+"/draft",{method:"PUT",body:JSON.stringify(page)}),
 publish:(id:string)=>call("/admin/pages/"+encodeURIComponent(id)+"/publish",{method:"POST"}),
 unpublish:(id:string)=>call("/admin/pages/"+encodeURIComponent(id)+"/unpublish",{method:"POST"}),
 getPublic:(slug:string)=>call<{page:CmsPage["draft"]}>("/pages/"+encodeURIComponent(slug)),
 listSections:()=>call<{sections:CmsReusableSection[]}>("/admin/pages/sections"),
 saveSection:(title:string,blocks:CmsBlock[])=>call<{success:boolean;section:CmsReusableSection}>("/admin/pages/sections",{method:"POST",body:JSON.stringify({title,blocks})}),
 deleteSection:(id:string)=>call<{success:boolean}>("/admin/pages/sections/"+encodeURIComponent(id),{method:"DELETE"})
};

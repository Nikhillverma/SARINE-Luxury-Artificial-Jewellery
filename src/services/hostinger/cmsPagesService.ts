const API_BASE = (import.meta.env.VITE_HOSTINGER_API_BASE_URL || (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")).replace(/\\/+$/, "");
export type CmsBlock = {type:"heading"|"paragraph";text:string}|{type:"image";src:string;alt:string}|{type:"button";text:string;href:string};
export interface CmsPage {id:string;slug:string;draft:{title:string;slug:string;seoTitle:string;seoDescription:string;blocks:CmsBlock[]};published?:CmsPage["draft"]|null;isPublished:boolean;updatedAt?:string;}
async function call<T>(path:string,init:RequestInit={}):Promise<T>{const response=await fetch(API_BASE+path,{...init,credentials:"include",headers:{Accept:"application/json","Content-Type":"application/json",...init.headers}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(typeof body.error==="string"?body.error:`Request failed (${response.status})`);return body as T;}
export const cmsPagesService={
 list:()=>call<{pages:CmsPage[]}>("/admin/pages"),
 create:(page:Omit<CmsPage,"id"|"isPublished"|"updatedAt"|"published">)=>call("/admin/pages",{method:"POST",body:JSON.stringify(page)}),
 save:(id:string,page:Omit<CmsPage,"id"|"isPublished"|"updatedAt"|"published">)=>call("/admin/pages/"+encodeURIComponent(id)+"/draft",{method:"PUT",body:JSON.stringify(page)}),
 publish:(id:string)=>call("/admin/pages/"+encodeURIComponent(id)+"/publish",{method:"POST"}),
 unpublish:(id:string)=>call("/admin/pages/"+encodeURIComponent(id)+"/unpublish",{method:"POST"}),
 getPublic:(slug:string)=>call<{page:CmsPage["draft"]}>("/pages/"+encodeURIComponent(slug))
};

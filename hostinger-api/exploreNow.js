import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { mapPublicProduct } from "./publicProductMapper.js";
import { ensureProductCollectionSchema } from "./productCollectionSchema.js";
import {
  EMPTY_EXPLORE_NOW,
  MAX_EXPLORE_PRODUCTS,
  validateExploreNow
} from "./exploreNowPolicy.js";

const admin = Router();
const publicRouter = Router();
const adminOnly = Router();
adminOnly.use(requireAdminAuth);

let schemaReady;
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.execute(`CREATE TABLE IF NOT EXISTS storefront_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

async function readSetting(key) {
 await ensureSchema(); const [rows]=await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1",[key]);
 if(!rows.length)return {found:false,value:null}; try{return {found:true,value:JSON.parse(rows[0].setting_value)};}catch{return {found:true,value:null};}
}
async function readSchedule(key){const row=await readSetting(key);return normalizeEditorialSchedule(row.value);}
async function writeSchedule(key,schedule){await ensureSchema();if(!schedule){await pool.execute("DELETE FROM storefront_settings WHERE setting_key=?",[key]);return;}await pool.execute("INSERT INTO storefront_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[key,JSON.stringify(schedule)]);}
async function readExploreNow(key) {
  await ensureSchema();
  const [rows] = await pool.execute(
    "SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1",
    [key]
  );
  if (!rows.length) return EMPTY_EXPLORE_NOW;
  try {
    return validateExploreNow(JSON.parse(rows[0].setting_value));
  } catch {
    return EMPTY_EXPLORE_NOW;
  }
}

async function writeExploreNow(key, config) {
  await ensureSchema();
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [key, JSON.stringify(config)]
  );
}

function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

function collectionFrom(value) { const v = String(value || "").trim().toLowerCase(); if (!v) return null; if (v !== "artificial" && v !== "demi-fine") throw new Error("Product collection must be artificial or demi-fine."); return v; }
function collectionKey(base, collection) { return collection ? base + "_" + collection : base; }
export async function validateCollectionProductIds(productIds, collection) {
  if (!collection || !productIds.length) return null;
  await ensureProductCollectionSchema();
  const placeholders = productIds.map(() => "?").join(",");
  const [rows] = await pool.execute(
    `SELECT id FROM products WHERE id IN (${placeholders}) AND product_collection = ?`,
    [...productIds, collection]
  );
  return rows.length === productIds.length ? null : "Every selected product must belong to the chosen homepage range.";
}

adminOnly.get("/", async (req,res,next)=>{
 try{
 const collection=collectionFrom(req.query.productCollection),dk=collectionKey("explore_now_draft",collection),pk=collectionKey("explore_now_published",collection);
 const [dr,pr]=await Promise.all([readSetting(dk),readSetting(pk)]);const inheritedFrom=collection&&!dr.found&&!pr.found?"shared":null;
 const [draft,published]=inheritedFrom?await Promise.all([readExploreNow("explore_now_draft"),readExploreNow("explore_now_published")]):await Promise.all([readExploreNow(dk),readExploreNow(pk)]);
 let schedule=await readSchedule(collectionKey("explore_now_schedule",collection)),scheduleCollection=schedule?(collection||"shared"):null;
 if(!schedule&&collection&&inheritedFrom){schedule=await readSchedule("explore_now_schedule");if(schedule)scheduleCollection="shared";}
 res.set("Cache-Control","no-store").json({draft,published,maxProducts:MAX_EXPLORE_PRODUCTS,schedule,scheduleStatus:getEditorialScheduleStatus(schedule),scheduleCollection,inheritedFrom});
 }catch(error){next(error);}
});
adminOnly.put("/draft", async (req, res, next) => {
  try {
    const draft = validateExploreNow(req.body);
    const collection = collectionFrom(req.body?.productCollection);
    const collectionError = await validateCollectionProductIds(draft.productIds, collection);
    if (collectionError) return res.status(400).json({ error: collectionError });
    await writeExploreNow(collectionKey("explore_now_draft", collection), draft);
    res.set("Cache-Control", "no-store").json({ success: true, draft });
  } catch (error) {
    if (error instanceof Error && /explore now|product|choose|valid|added|count/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

adminOnly.post("/schedule",async(req,res)=>{
 try{const collection=collectionFrom(req.body?.productCollection),dr=await readSetting(collectionKey("explore_now_draft",collection)),pr=await readSetting(collectionKey("explore_now_published",collection));
 if(collection&&!dr.found&&!pr.found)return res.status(409).json({error:"Manage the inherited Shared schedule from Shared, or save this collection first."});
 const draft=await readExploreNow(collectionKey("explore_now_draft",collection)),published=await readExploreNow(collectionKey("explore_now_published",collection));
 const collectionError=await validateCollectionProductIds(draft.productIds,collection);if(collectionError)return res.status(400).json({error:collectionError});
 const schedule=createEditorialSchedule(req.body,draft,published);await writeSchedule(collectionKey("explore_now_schedule",collection),schedule);
 res.set("Cache-Control","no-store").json({schedule,scheduleStatus:getEditorialScheduleStatus(schedule),scheduleCollection:collection||"shared"});
 }catch(error){res.status(error.status||400).json({error:error.message||"Invalid schedule."});}
});
adminOnly.post("/schedule/cancel",async(req,res,next)=>{
 try{const collection=collectionFrom(req.body?.productCollection),key=collectionKey("explore_now_schedule",collection);let schedule=await readSchedule(key);
 if(!schedule&&collection)schedule=await readSchedule("explore_now_schedule");
 if(schedule)await writeSchedule(schedule===await readSchedule("explore_now_schedule")&&collection?"explore_now_schedule":key,null);
 res.set("Cache-Control","no-store").json({schedule:null,scheduleStatus:"none",scheduleCollection:null});
 }catch(error){next(error);}
});
adminOnly.post("/publish", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const draft = await readExploreNow(collectionKey("explore_now_draft", collection));
    await writeExploreNow(collectionKey("explore_now_published", collection), draft);
    res.set("Cache-Control", "no-store").json({ success: true, published: draft });
  } catch (error) { next(error); }
});

publicRouter.get("/",async(req,res,next)=>{
 try{await ensureProductCollectionSchema();const collection=collectionFrom(req.query.productCollection);
 const own=await readSetting(collectionKey("explore_now_published",collection)),inherited=Boolean(collection&&!own.found);
 let config=inherited?await readExploreNow("explore_now_published"):await readExploreNow(collectionKey("explore_now_published",collection));
 let schedule=await readSchedule(collectionKey("explore_now_schedule",collection));if(!schedule&&inherited)schedule=await readSchedule("explore_now_schedule");
 if(schedule)config=getEffectiveEditorial({schedule,published:config});
 if(!config.configured||!config.productIds.length)return res.set("Cache-Control","no-store").json({products:[],displayCount:config.displayCount,configured:false});
 const ids=config.productIds.slice(0,MAX_EXPLORE_PRODUCTS),placeholders=ids.map(()=>"?").join(","),condition=collection?" AND product_collection = ?":"";
 const [rows]=await pool.execute(`SELECT * FROM products WHERE id IN (${placeholders}) AND status='active' AND stock > 0${condition}`,collection?[...ids,collection]:ids);
 const products=shuffleInPlace(rows.map(mapPublicProduct));res.set("Cache-Control","no-store").json({products,displayCount:Math.min(config.displayCount,products.length),configured:products.length>0});
 }catch(error){next(error);}
});
admin.use("/", adminOnly);
export { publicRouter as publicExploreNowRouter };
export default admin;

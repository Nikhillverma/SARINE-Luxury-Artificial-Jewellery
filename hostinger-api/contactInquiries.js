import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { normalizeInquiryStatus, validateContactInquiry } from "./contactInquiryPolicy.js";
import { ensureContactInquiriesSchema } from "./contactInquirySchema.js";

export const publicContactInquiriesRouter = Router();
export const adminContactInquiriesRouter = Router();
const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false,
  message: { error: "Too many enquiries were submitted. Please try again later." }
});
adminContactInquiriesRouter.use(requireAdminAuth);

publicContactInquiriesRouter.post("/inquiries", inquiryLimiter, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    if (String(req.body?.website || "").trim()) return res.status(202).json({ success: true });
    const inquiry = validateContactInquiry(req.body);
    await ensureContactInquiriesSchema();
    const [result] = await pool.execute(
      "INSERT INTO contact_inquiries (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)",
      [inquiry.name, inquiry.email, inquiry.phone, inquiry.subject, inquiry.message]
    );
    return res.status(201).json({ success: true, inquiryId: Number(result.insertId) });
  } catch (error) {
    if (error instanceof Error && /Enter your|valid|Please enter/i.test(error.message)) return res.status(400).json({ error: error.message });
    return next(error);
  }
});

adminContactInquiriesRouter.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    await ensureContactInquiriesSchema();
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50));
    const status = String(req.query.status || "all").trim().toLowerCase();
    const search = String(req.query.search || "").trim().slice(0, 120);
    const conditions = [];
    const values = [];
    if (status !== "all") {
      if (!normalizeInquiryStatus(status)) return res.status(400).json({ error: "Choose a valid enquiry status." });
      conditions.push("status = ?"); values.push(status);
    }
    if (search) {
      const term = "%" + search.replace(/[!%_]/g, "!$&") + "%";
      conditions.push("(name LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR subject LIKE ? ESCAPE '!' OR message LIKE ? ESCAPE '!')");
      values.push(term, term, term, term);
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const [rows] = await pool.execute(
      "SELECT id, name, email, phone, subject, message, status, admin_note, created_at, updated_at FROM contact_inquiries " +
      where + " ORDER BY created_at DESC, id DESC LIMIT ?", [...values, limit]
    );
    const [countRows] = await pool.execute("SELECT status, COUNT(*) AS count FROM contact_inquiries GROUP BY status");
    return res.json({
      inquiries: rows.map((row) => ({
        id: Number(row.id), name: row.name, email: row.email, phone: row.phone || "",
        subject: row.subject || "", message: row.message, status: row.status, adminNote: row.admin_note || "",
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
      })),
      counts: Object.fromEntries(countRows.map((row) => [row.status, Number(row.count)]))
    });
  } catch (error) { return next(error); }
});

adminContactInquiriesRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const status = normalizeInquiryStatus(req.body?.status);
    const adminNote = String(req.body?.adminNote ?? "").trim();
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid enquiry ID." });
    if (!status) return res.status(400).json({ error: "Choose a valid enquiry status." });
    if (adminNote.length > 1000) return res.status(400).json({ error: "Internal note must be 1,000 characters or fewer." });
    await ensureContactInquiriesSchema();
    const [result] = await pool.execute("UPDATE contact_inquiries SET status = ?, admin_note = ? WHERE id = ?", [status, adminNote || null, id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Enquiry not found." });
    return res.json({ success: true, id, status, adminNote });
  } catch (error) { return next(error); }
});

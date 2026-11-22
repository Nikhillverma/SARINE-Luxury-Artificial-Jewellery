import React, { useEffect, useMemo, useState } from "react";
import { Check, Monitor, RotateCcw, Save, Smartphone, Tablet, Upload } from "lucide-react";
import {
  DEFAULT_GLOBAL_DESIGN,
  hostingerStorefrontService,
  type GlobalDesignSettings
} from "../../services/hostinger/hostingerStorefrontService";

type ColorKey = keyof GlobalDesignSettings["colors"];
type PreviewMode = "desktop" | "tablet" | "mobile";

const colorFields: Array<{ key: ColorKey; label: string; help: string }> = [
  { key: "primary", label: "Deep Plum · Primary", help: "Brand identity, primary actions and announcement strip" },
  { key: "accent", label: "Soft Lavender · Accent", help: "Highlights, accents and secondary emphasis" },
  { key: "surface", label: "Pale Lavender · Surface", help: "Cards, panels and soft section surfaces" },
  { key: "pageBackground", label: "Page background", help: "Main storefront canvas" },
  { key: "text", label: "Primary text", help: "Main body copy and readable foreground text" },
  { key: "headerBackground", label: "Header background", help: "Main navigation surface" },
  { key: "footerBackground", label: "Footer background", help: "Footer base surface" },
  { key: "footerText", label: "Footer text", help: "Text and links inside the footer" }
];

const clone = (value: GlobalDesignSettings): GlobalDesignSettings => JSON.parse(JSON.stringify(value)) as GlobalDesignSettings;

export const GlobalDesignStudio: React.FC = () => {
  const [design, setDesign] = useState<GlobalDesignSettings>(() => clone(DEFAULT_GLOBAL_DESIGN));
  const [savedDesign, setSavedDesign] = useState<GlobalDesignSettings>(() => clone(DEFAULT_GLOBAL_DESIGN));
  const [publishedDesign, setPublishedDesign] = useState<GlobalDesignSettings>(() => clone(DEFAULT_GLOBAL_DESIGN));
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const dirty = useMemo(() => JSON.stringify(design) !== JSON.stringify(savedDesign), [design, savedDesign]);
  const invalidColors = colorFields.filter(field => !/^#[0-9A-Fa-f]{6}$/.test(design.colors[field.key]));
  const canSave = invalidColors.length === 0 && !loading && !saving && !publishing;

  useEffect(() => {
    let active = true;
    hostingerStorefrontService.getGlobalDesign()
      .then(result => {
        if (!active) return;
        const next = result.draft || clone(DEFAULT_GLOBAL_DESIGN);
        setDesign(clone(next));
        setSavedDesign(clone(next));
        setPublishedDesign(clone(result.published || DEFAULT_GLOBAL_DESIGN));
      })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load design settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateColor = (key: ColorKey, value: string) => {
    setDesign(current => ({ ...current, colors: { ...current.colors, [key]: value } }));
  };
  const updateTypography = <K extends keyof GlobalDesignSettings["typography"]>(key: K, value: GlobalDesignSettings["typography"][K]) => {
    setDesign(current => ({ ...current, typography: { ...current.typography, [key]: value } }));
  };
  const updateLayout = <K extends keyof GlobalDesignSettings["layout"]>(key: K, value: GlobalDesignSettings["layout"][K]) => {
    setDesign(current => ({ ...current, layout: { ...current.layout, [key]: value } }));
  };

  const saveDraft = async () => {
    if (invalidColors.length) { setError("Correct the highlighted colour values before saving."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await hostingerStorefrontService.saveGlobalDesign(design);
      setDesign(clone(result.draft));
      setSavedDesign(clone(result.draft));
      setMessage("Design draft saved. The live storefront is unchanged until you publish.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Design draft could not be saved.");
    } finally { setSaving(false); }
  };

  const publish = async () => {
    if (invalidColors.length) { setError("Correct the highlighted colour values before publishing."); return; }
    if (!window.confirm("Publish these global design changes to the live SARINE storefront?")) return;
    setPublishing(true); setError(""); setMessage("");
    try {
      const saved = await hostingerStorefrontService.saveGlobalDesign(design);
      setSavedDesign(clone(saved.draft));
      const result = await hostingerStorefrontService.publishGlobalDesign();
      setPublishedDesign(clone(result.published));
      setMessage("Your global design is published. Refresh the storefront to see the new styling.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Design could not be published.");
    } finally { setPublishing(false); }
  };

  const restoreDefaults = () => {
    setDesign(clone(DEFAULT_GLOBAL_DESIGN));
    setMessage("Brand defaults loaded into this editor. Save and publish only when you are ready.");
    setError("");
  };

  const previewWidth = previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "620px" : "375px";
  const previewStyle: React.CSSProperties = {
    width: previewWidth,
    maxWidth: "100%",
    marginInline: "auto",
    background: design.colors.pageBackground,
    color: design.colors.text,
    fontFamily: design.typography.bodyFont,
    borderRadius: design.layout.cornerRadius + "px",
    border: "1px solid #E8DFEC",
    overflow: "hidden"
  };

  return (
    <section className="rounded-2xl border border-[#E7DCEB] bg-white p-4 sm:p-6 space-y-6" aria-labelledby="global-design-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#8B70A0]">Brand-wide appearance</p>
          <h2 id="global-design-title" className="mt-1 font-serif text-2xl sm:text-3xl text-[#563568]">Global Design Studio</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#705E7B]">Control the storefront palette, typography, content width, buttons and header/footer surfaces from one place.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F0FA] px-3 py-2 text-xs font-medium text-[#563568]">
          <span className="h-2 w-2 rounded-full bg-[#B69ACF]" /> {dirty ? "Unsaved changes" : "Draft saved"}
        </span>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" aria-live="polite" className="rounded-lg border border-[#DCCBE7] bg-[#F7F0FA] p-3 text-sm text-[#563568]">{message}</div>}
      {invalidColors.length > 0 && <p role="alert" className="text-xs text-red-700">Enter a valid six-digit hex colour for: {invalidColors.map(field => field.label).join(", ")}.</p>}
      {loading ? <p className="text-sm text-[#705E7B]" role="status">Loading your saved brand settings…</p> : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
            <div className="space-y-6 min-w-0">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-[#302438]">Brand colours</h3>
                  <p className="text-xs text-[#806F89]">Change each colour with a picker or enter a precise hex value.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {colorFields.map(field => (
                    <label key={field.key} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#EDE5F0] p-3">
                      <input
                        type="color"
                        value={design.colors[field.key]}
                        onChange={event => updateColor(field.key, event.target.value.toUpperCase())}
                        className="h-12 w-12 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                        aria-label={field.label + " colour"}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-[#302438]">{field.label}</span>
                        <span className="block text-[11px] text-[#806F89]">{field.help}</span>
                        <input
                          value={design.colors[field.key]}
                          onChange={event => updateColor(field.key, event.target.value)}
                          maxLength={7}
                          pattern="^#[0-9A-Fa-f]{6}$"
                          aria-label={field.label + " hex code"}
                          aria-invalid={!/^#[0-9A-Fa-f]{6}$/.test(design.colors[field.key])}
                          className={"mt-1 w-full max-w-32 rounded-md border px-2 py-1.5 font-mono text-xs uppercase " + (/^#[0-9A-Fa-f]{6}$/.test(design.colors[field.key]) ? "border-[#E7DCEB]" : "border-red-500 bg-red-50")}
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#EFE8F2] pt-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-[#302438]">Typography</h3>
                  <p className="text-xs text-[#806F89]">Choose the brand heading and body fonts, then fine-tune their scale.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-[#563568]">Heading font
                    <select value={design.typography.headingFont} onChange={e => updateTypography("headingFont", e.target.value as GlobalDesignSettings["typography"]["headingFont"])} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-3 text-sm text-[#302438]">
                      <option value="Cormorant Garamond">Cormorant Garamond</option>
                      <option value="Playfair Display">Playfair Display</option>
                      <option value="Georgia">Georgia</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-[#563568]">Body font
                    <select value={design.typography.bodyFont} onChange={e => updateTypography("bodyFont", e.target.value as GlobalDesignSettings["typography"]["bodyFont"])} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-3 text-sm text-[#302438]">
                      <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                      <option value="DM Sans">DM Sans</option>
                      <option value="Arial">Arial</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-xs font-medium text-[#563568]">Heading scale · {design.typography.headingScale}%
                    <input type="range" min={90} max={120} step={5} value={design.typography.headingScale} onChange={e => updateTypography("headingScale", Number(e.target.value))} className="w-full accent-[#563568]" />
                  </label>
                  <label className="space-y-2 text-xs font-medium text-[#563568]">Body scale · {design.typography.bodyScale}%
                    <input type="range" min={90} max={110} step={5} value={design.typography.bodyScale} onChange={e => updateTypography("bodyScale", Number(e.target.value))} className="w-full accent-[#563568]" />
                  </label>
                </div>
              </div>

              <div className="border-t border-[#EFE8F2] pt-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-[#302438]">Layout & components</h3>
                  <p className="text-xs text-[#806F89]">Set the maximum content width and the storefront's shared corner treatment.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-xs font-medium text-[#563568]">Content width
                    <select value={design.layout.contentWidth} onChange={e => updateLayout("contentWidth", Number(e.target.value) as GlobalDesignSettings["layout"]["contentWidth"])} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-3 text-sm text-[#302438]">
                      <option value={1120}>Compact · 1120px</option>
                      <option value={1200}>Balanced · 1200px</option>
                      <option value={1280}>Wide · 1280px</option>
                      <option value={1360}>Extra wide · 1360px</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-[#563568]">Corner radius
                    <select value={design.layout.cornerRadius} onChange={e => updateLayout("cornerRadius", Number(e.target.value) as GlobalDesignSettings["layout"]["cornerRadius"])} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-3 text-sm text-[#302438]">
                      <option value={0}>Sharp · 0px</option>
                      <option value={4}>Refined · 4px</option>
                      <option value={8}>Soft · 8px</option>
                      <option value={16}>Rounded · 16px</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-[#563568]">Button treatment
                    <select value={design.components.buttonStyle} onChange={e => setDesign(current => ({ ...current, components: { buttonStyle: e.target.value as "solid" | "outline" } }))} className="min-h-11 w-full rounded-lg border border-[#E7DCEB] bg-white p-3 text-sm text-[#302438]">
                      <option value="solid">Solid primary</option>
                      <option value="outline">Outlined primary</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="border-t border-[#EFE8F2] pt-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-[#302438]">Header & footer surfaces</h3>
                  <p className="text-xs text-[#806F89]">These controls change the existing header and footer styling without replacing navigation links or store information.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["headerBackground", "footerBackground", "footerText"] as ColorKey[]).map(key => (
                    <label key={key} className="flex min-h-12 items-center gap-3 rounded-lg border border-[#EDE5F0] p-3 text-sm text-[#302438]">
                      <input type="color" value={design.colors[key]} onChange={e => updateColor(key, e.target.value.toUpperCase())} className="h-9 w-9 cursor-pointer" />
                      <span>{key === "headerBackground" ? "Header background" : key === "footerBackground" ? "Footer background" : "Footer text"}</span>
                      <span className="ml-auto font-mono text-[11px]">{design.colors[key]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <aside className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-[#302438]">Responsive design preview</h3>
                  <p className="text-xs text-[#806F89]">Preview the style at common screen widths.</p>
                </div>
                <div className="flex rounded-lg border border-[#E7DCEB] p-1" aria-label="Preview device size">
                  <button type="button" onClick={() => setPreviewMode("desktop")} aria-pressed={previewMode === "desktop"} className={"min-h-10 min-w-10 rounded-md p-2 " + (previewMode === "desktop" ? "bg-[#563568] text-white" : "text-[#705E7B]")} aria-label="Desktop preview"><Monitor size={17} /></button>
                  <button type="button" onClick={() => setPreviewMode("tablet")} aria-pressed={previewMode === "tablet"} className={"min-h-10 min-w-10 rounded-md p-2 " + (previewMode === "tablet" ? "bg-[#563568] text-white" : "text-[#705E7B]")} aria-label="Tablet preview"><Tablet size={17} /></button>
                  <button type="button" onClick={() => setPreviewMode("mobile")} aria-pressed={previewMode === "mobile"} className={"min-h-10 min-w-10 rounded-md p-2 " + (previewMode === "mobile" ? "bg-[#563568] text-white" : "text-[#705E7B]")} aria-label="Mobile preview"><Smartphone size={17} /></button>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-[#D8C8E1] bg-[#F8F5FA] p-3 sm:p-4">
                <div style={previewStyle}>
                  <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs" style={{ background: design.colors.primary, color: design.colors.surface }}>
                    <span>✦ SARINE ATELIER ✦</span><span>Complimentary delivery</span>
                  </div>
                  <div className="flex items-center justify-between border-b px-4 py-4" style={{ background: design.colors.headerBackground, borderColor: design.colors.accent }}>
                    <span className="text-xl tracking-[0.2em]" style={{ color: design.colors.primary, fontFamily: design.typography.headingFont }}>SARINE</span>
                    <span className="text-[10px] tracking-wider">COLLECTIONS　 ABOUT</span>
                  </div>
                  <div className="px-4 py-8 sm:px-6 sm:py-10 text-center" style={{ background: design.colors.surface }}>
                    <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: design.colors.primary }}>THE SARINE EDIT</p>
                    <h4 className="mt-3 leading-tight" style={{ fontFamily: design.typography.headingFont, fontSize: "calc(1.75rem * " + design.typography.headingScale / 100 + ")", color: design.colors.primary }}>Elegance in every detail</h4>
                    <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed" style={{ fontSize: "calc(.75rem * " + design.typography.bodyScale / 100 + ")" }}>Thoughtfully chosen pieces for everyday moments and unforgettable celebrations.</p>
                    <button type="button" className="mt-5 min-h-11 px-5 py-3 text-xs font-semibold" style={{ background: design.components.buttonStyle === "solid" ? design.colors.primary : "transparent", color: design.components.buttonStyle === "solid" ? design.colors.surface : design.colors.primary, border: "1px solid " + design.colors.primary, borderRadius: design.layout.cornerRadius + "px" }}>Discover the collection</button>
                  </div>
                  <div className="px-4 py-4 text-center text-[10px]" style={{ background: design.colors.footerBackground, color: design.colors.footerText }}>SARINE · Timeless jewellery for every you</div>
                </div>
                <p className="mt-2 text-center text-[11px] text-[#806F89]">{previewMode === "desktop" ? "Desktop · Full content width" : previewMode === "tablet" ? "Tablet · 620px canvas" : "Mobile · 375px canvas"}</p>
              </div>
              <div className="rounded-xl border border-[#E7DCEB] p-4 space-y-2">
                <h4 className="text-sm font-semibold text-[#563568]">Currently published</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: publishedDesign.colors.primary, color: publishedDesign.colors.surface }}>Primary</span>
                  <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: publishedDesign.colors.accent, color: publishedDesign.colors.text }}>Accent</span>
                  <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: publishedDesign.colors.surface, color: publishedDesign.colors.text }}>Surface</span>
                </div>
                <p className="text-xs text-[#806F89]">Your published storefront stays unchanged while you edit this draft.</p>
              </div>
            </aside>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#EFE8F2] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={restoreDefaults} disabled={saving || publishing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DCCBE7] px-4 py-2.5 text-sm text-[#563568] hover:bg-[#F7F0FA] disabled:opacity-50">
              <RotateCcw size={16} /> Restore brand defaults
            </button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void saveDraft()} disabled={!canSave || !dirty} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#563568] px-5 py-2.5 text-sm font-medium text-[#563568] hover:bg-[#F7F0FA] disabled:opacity-50">
                <Save size={16} /> {saving ? "Saving…" : "Save draft"}
              </button>
              <button type="button" onClick={() => void publish()} disabled={!canSave} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#563568] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#442753] disabled:opacity-50">
                {publishing ? <Upload size={16} className="animate-pulse" /> : <Check size={16} />} {publishing ? "Publishing…" : "Publish design"}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[#806F89]">Saving a draft never changes the public site. Publishing applies the selected global styling; product data, orders, checkout, navigation destinations and existing page content are not modified.</p>
        </>
      )}
    </section>
  );
};

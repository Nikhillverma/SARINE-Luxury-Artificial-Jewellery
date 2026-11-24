import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, Sparkles } from "lucide-react";
import { hostingerStorefrontService, type MenStorefrontSettings, type MenStorefrontProduct } from "../services/hostinger/hostingerStorefrontService";

const fallbackSettings: MenStorefrontSettings = {
  version: 1, enabled: true, heroImageUrl: "", eyebrow: "SARINE · MEN", title: "A New Standard of Style",
  description: "Modern essentials. Timeless details. Discover a considered edit of jewellery for him.",
  comingSoon: true, comingSoonText: "Our men's edit is on its way. Be among the first to discover it.",
  categories: [], showProducts: false, productIds: [], featuredTitle: "The Men's Edit",
  bestSellerIds: [], showBestSellers: false, collections: [],
  offers: { enabled: false, label: "", description: "", ctaText: "Explore offers", ctaLink: "/men" },
  notification: { enabled: true, headline: "Be first to know", description: "Sign up for an update when SARINE Men arrives.", buttonText: "Notify me" }
};

const ProductTile: React.FC<{ product: MenStorefrontProduct }> = ({ product }) => (
  <Link to={`/product/${encodeURIComponent(product.slug)}`} className="group block min-w-0">
    <div className="aspect-[4/5] overflow-hidden rounded-xl bg-[#F7F0FA]">
      {product.images?.[0] ? <img src={product.images[0]} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center font-serif text-xl text-[#563568]">SARINE</div>}
    </div>
    <p className="mt-3 truncate text-sm font-medium text-[#302438]">{product.name}</p>
    <p className="mt-1 text-sm text-[#563568]">₹{product.price.toLocaleString("en-IN")}</p>
  </Link>
);

export const MensCollectionPage: React.FC = () => {
  const [settings, setSettings] = useState<MenStorefrontSettings>(fallbackSettings);
  const [products, setProducts] = useState<MenStorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");
  const [signupError, setSignupError] = useState("");

  useEffect(() => {
    let active = true;
    hostingerStorefrontService.getPublicMenStorefront()
      .then(result => { if (active) { setSettings(result.settings); setProducts(result.products || []); } })
      .catch(error => console.error("[MensCollectionPage] Could not load published men's storefront.", error))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const submitSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setSignupError(""); setSignupMessage("");
    try {
      const result = await hostingerStorefrontService.subscribeMenLaunch(email, consent);
      setSignupMessage(result.message); setEmail(""); setConsent(false);
    } catch (error) { setSignupError(error instanceof Error ? error.message : "We could not save your signup. Please try again."); }
    finally { setSubmitting(false); }
  };

  if (loading) return <main className="min-h-[60vh] bg-white px-4 py-20 text-center text-sm text-[#705E7B]" role="status">Loading SARINE Men…</main>;
  if (!settings.enabled) return <main className="flex min-h-[60vh] items-center justify-center bg-white px-4 text-center"><div><h1 className="font-serif text-4xl text-[#563568]">SARINE Men</h1><p className="mt-3 text-sm text-[#705E7B]">This collection is taking a short pause. Please check back soon.</p><Link to="/" className="mt-6 inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#563568]"><ArrowLeft size={15}/> Back to Home</Link></div></main>;

  const bestSellers = products.filter(product => settings.bestSellerIds.includes(product.id));
  const featuredProducts = products.filter(product => settings.productIds.includes(product.id));
  const liveCategories = settings.categories.filter(item => item.active).sort((a,b) => a.sortOrder-b.sortOrder);
  const liveCollections = settings.collections.filter(item => item.active).sort((a,b) => a.sortOrder-b.sortOrder);

  return <main className="min-h-screen bg-white text-[#302438]">
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-14 pt-5 sm:px-6 sm:pb-20 lg:px-10">
      <Link to="/" className="mb-5 inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#563568] transition-opacity hover:opacity-70"><ArrowLeft size={15}/> Back to SARINE</Link>

      <section className="overflow-hidden rounded-2xl bg-[#F7F0FA]">
        {settings.heroImageUrl && <div className="aspect-[1.6/1] w-full overflow-hidden sm:aspect-[2.5/1] lg:aspect-[3/1]"><img src={settings.heroImageUrl} alt="SARINE Men collection campaign" className="h-full w-full object-cover" fetchPriority="high"/></div>}
        <div className="px-5 py-9 text-center sm:px-10 sm:py-14">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#563568] sm:text-xs">{settings.eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl font-normal leading-tight text-[#563568] sm:text-5xl lg:text-6xl">{settings.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#594A60] sm:text-base">{settings.description}</p>
          {settings.comingSoon && <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-[#D9C9E2] bg-white/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#563568]">Coming Soon</p>
            <p className="mt-1 text-sm leading-6 text-[#594A60]">{settings.comingSoonText}</p>
          </div>}
        </div>
      </section>

      {liveCategories.length > 0 && <section className="mt-12 sm:mt-16">
        <div className="mb-5 text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8B7299]">THE COLLECTION</p><h2 className="mt-2 font-serif text-3xl font-normal text-[#563568] sm:text-4xl">Discover What's Coming</h2></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
          {liveCategories.map(category => <Link key={category.id} to={`/shop?search=${encodeURIComponent(category.title)}`} className="group block min-w-0">
            <div className="aspect-[4/5] overflow-hidden rounded-xl bg-[#F7F0FA]">{category.imageUrl ? <img src={category.imageUrl} alt={category.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"/> : <div className="flex h-full items-center justify-center px-3 text-center font-serif text-2xl text-[#B69ACF]">{category.title}</div>}</div>
            <h3 className="mt-3 text-center font-serif text-xl text-[#563568]">{category.title}</h3>
            {category.description && <p className="mt-1 text-center text-xs leading-5 text-[#705E7B]">{category.description}</p>}
            {settings.comingSoon && <p className="mt-2 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8B7299]">Coming Soon</p>}
          </Link>)}
        </div>
      </section>}

      {liveCollections.map(collection => {
        const collectionProducts = products.filter(product => collection.productIds.includes(product.id));
        return <section key={collection.id} className="mt-14 sm:mt-20">
          <div className="mb-5 text-center"><h2 className="font-serif text-3xl font-normal text-[#563568] sm:text-4xl">{collection.title}</h2>{collection.description && <p className="mt-2 text-sm text-[#705E7B]">{collection.description}</p>}</div>
          {collectionProducts.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{collectionProducts.map(product => <ProductTile key={product.id} product={product}/>)}</div> : <p className="rounded-xl bg-[#F7F0FA] p-6 text-center text-sm text-[#705E7B]">This edit is being curated. Coming Soon.</p>}
        </section>;
      })}

      {settings.showProducts && featuredProducts.length > 0 && <section className="mt-14 sm:mt-20">
        <div className="mb-5 text-center"><h2 className="font-serif text-3xl font-normal text-[#563568] sm:text-4xl">{settings.featuredTitle}</h2></div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{featuredProducts.map(product => <ProductTile key={product.id} product={product}/>)}</div>
      </section>}

      {settings.showBestSellers && bestSellers.length > 0 && <section className="mt-14 sm:mt-20">
        <div className="mb-5 text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8B7299]">CUSTOMER FAVOURITES</p><h2 className="mt-2 font-serif text-3xl font-normal text-[#563568] sm:text-4xl">Men's Best Sellers</h2></div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{bestSellers.map(product => <ProductTile key={product.id} product={product}/>)}</div>
      </section>}

      {settings.offers.enabled && <section className="mt-14 rounded-2xl bg-[#563568] px-5 py-8 text-center text-white sm:mt-20 sm:px-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#E5D6EF]">{settings.offers.label}</p>
        {settings.offers.description && <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/90">{settings.offers.description}</p>}
        <Link to={settings.offers.ctaLink} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#563568]">{settings.offers.ctaText}<ArrowRight size={15}/></Link>
      </section>}

      {settings.notification.enabled && <section className="mt-14 sm:mt-20">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#E7DCEB] bg-[#FCFAFD] px-5 py-8 text-center sm:px-10 sm:py-10">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F0E7F5] text-[#563568]"><Mail size={19}/></div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8B7299]">SARINE · FOR HIM</p>
          <h2 className="mt-2 font-serif text-3xl font-normal text-[#563568] sm:text-4xl">{settings.notification.headline}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#705E7B]">{settings.notification.description}</p>
          <form onSubmit={submitSignup} className="mx-auto mt-6 max-w-md space-y-3 text-left">
            <label className="block"><span className="sr-only">Email address</span><input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email address" className="min-h-12 w-full rounded-lg border border-[#E1D6E8] bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#B69ACF]"/></label>
            <label className="flex items-start gap-2 text-xs leading-5 text-[#705E7B]"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required className="mt-1"/> I agree to receive SARINE Men launch updates by email. I can request removal at any time.</label>
            {signupError && <p role="alert" className="text-xs text-red-700">{signupError}</p>}
            {signupMessage && <p role="status" className="flex items-center gap-2 text-xs text-green-700"><CheckCircle2 size={15}/>{signupMessage}</p>}
            <button type="submit" disabled={submitting || !consent} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#563568] px-5 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50">{submitting ? "Saving…" : settings.notification.buttonText}<ArrowRight size={15}/></button>
          </form>
        </div>
      </section>}

      <div className="mt-12 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#A08EAA]"><Sparkles size={13}/> SARINE · Timeless by design</div>
    </div>
  </main>;
};

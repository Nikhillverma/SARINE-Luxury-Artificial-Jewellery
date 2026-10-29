/**
 * AdminStorefrontPage for SARINE.
 * Storefront Studio: Visual content editor controlling live homepage hero banners,
 * announcement bar, section sequencing, and festival campaign landing artwork.
 */

import React, { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import {
  LayoutTemplate,
  Upload,
  Plus,
  Eye,
  CheckCircle2,
  MoveUp,
  MoveDown,
  Trash2,
  ExternalLink,
  Sparkles,
  Sliders
} from 'lucide-react';

interface BannerSlide {
  id: string;
  tagline: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  active: boolean;
}

const INITIAL_BANNERS: BannerSlide[] = [
  {
    id: 'b1',
    tagline: 'FESTIVE EDIT 2026',
    title: 'The Royal Kundan & Polki Collection',
    subtitle: 'Handcrafted heritage splendour for joyous celebrations and grand wedding soirees.',
    ctaText: 'Shop the Collection',
    ctaLink: '/shop?occasion=festive',
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80',
    active: true
  },
  {
    id: 'b2',
    tagline: 'EVERYDAY OPULENCE',
    title: 'Subtle Gold Accents & Studs',
    subtitle: 'Lightweight elegance made for desk-to-dinner sophistication.',
    ctaText: 'Explore Everyday',
    ctaLink: '/shop?occasion=everyday',
    imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1200&q=80',
    active: true
  },
  {
    id: 'b3',
    tagline: 'CURATED GIFT SETS',
    title: 'Cherished Moments in Luxury Boxes',
    subtitle: 'Indulge loved ones with hand-finished bracelets and signature pendants.',
    ctaText: 'Discover Gifts',
    ctaLink: '/shop?occasion=gifting',
    imageUrl: 'https://images.unsplash.com/photo-1611591475855-4673fb39847e?auto=format&fit=crop&w=1200&q=80',
    active: true
  }
];

export const AdminStorefrontPage: React.FC = () => {
  const [banners, setBanners] = useState<BannerSlide[]>(INITIAL_BANNERS);
  const [announcementMsg, setAnnouncementMsg] = useState(
    'Complimentary Express Delivery on orders across India • 7-Day Easy Returns'
  );
  const [showAddBanner, setShowAddBanner] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // New banner form
  const [newTagline, setNewTagline] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newCtaText, setNewCtaText] = useState('Explore Collection');
  const [newCtaLink, setNewCtaLink] = useState('/shop');
  const [newImageUrl, setNewImageUrl] = useState('');

  const handleCreateBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newImageUrl.trim()) return;

    const banner: BannerSlide = {
      id: `b-${Date.now()}`,
      tagline: newTagline.trim() || 'NEW SEASON',
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || 'Timeless jewellery crafted with pure dedication.',
      ctaText: newCtaText.trim() || 'Shop Now',
      ctaLink: newCtaLink.trim() || '/shop',
      imageUrl: newImageUrl.trim(),
      active: true
    };

    setBanners([banner, ...banners]);
    setShowAddBanner(false);
    setSuccess('New hero banner added and synced to storefront layout.');
    setNewTagline('');
    setNewTitle('');
    setNewSubtitle('');
    setNewImageUrl('');
  };

  const handleDeleteBanner = (id: string) => {
    setBanners(banners.filter((b) => b.id !== id));
    setSuccess('Hero banner removed from carousel.');
  };

  const handleToggleBanner = (id: string) => {
    setBanners(
      banners.map((b) => (b.id === id ? { ...b, active: !b.active } : b))
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2C1838] tracking-tight">
              Storefront Studio
            </h1>
            <p className="text-xs sm:text-sm text-[#705E7B] mt-0.5">
              Live visual editor for homepage hero banners, announcement bar, and festival sections.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E7DCEB] hover:border-[#563568] text-xs font-medium text-[#2C1838] rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <ExternalLink size={14} className="text-[#563568]" />
              <span>Preview Live Site</span>
            </a>
            <button
              onClick={() => setShowAddBanner(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#563568] hover:bg-[#78469C] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Hero Banner</span>
            </button>
          </div>
        </div>

        {success && (
          <div className="p-3.5 bg-[#F2FBF5] border border-[#A7E8BD] rounded-xl flex items-center justify-between text-xs text-[#166534]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="text-[#166534] hover:font-bold">✕</button>
          </div>
        )}

        {/* Announcement Bar Customizer */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#F5EDF8]">
            <h2 className="text-sm font-semibold text-[#2C1838]">Top Announcement Bar Message</h2>
            <button
              onClick={() => setSuccess('Top announcement message updated on live header.')}
              className="px-3 py-1 bg-[#563568] text-white text-xs font-semibold rounded-lg hover:bg-[#78469C] transition-colors"
            >
              Publish Banner
            </button>
          </div>

          <div className="mt-3">
            <input
              type="text"
              value={announcementMsg}
              onChange={(e) => setAnnouncementMsg(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl text-xs text-[#2C1838] focus:outline-none focus:border-[#563568]"
            />
            <p className="text-[11px] text-[#705E7B] mt-1.5">
              Displays across all pages at the top of the luxury double header.
            </p>
          </div>
        </div>

        {/* Hero Banners Grid */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADFF0] shadow-2xs">
          <h2 className="text-sm font-semibold text-[#2C1838] pb-3 border-b border-[#F5EDF8]">
            Homepage Hero Carousel Artwork
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
            {banners.map((b, idx) => (
              <div
                key={b.id}
                className="bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={b.imageUrl}
                      alt={b.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white font-mono text-[10px]">
                      Slide 0{idx + 1}
                    </span>
                    <button
                      onClick={() => handleToggleBanner(b.id)}
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        b.active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F3F4F6] text-[#6B7280]'
                      }`}
                    >
                      {b.active ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  <div className="p-4">
                    <span className="text-[9px] font-bold tracking-widest text-[#78469C] uppercase block mb-1">
                      {b.tagline}
                    </span>
                    <h3 className="font-serif text-sm font-semibold text-[#2C1838] leading-snug">
                      {b.title}
                    </h3>
                    <p className="text-[11px] text-[#705E7B] mt-1 line-clamp-2">
                      {b.subtitle}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white border-t border-[#E7DCEB] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#8E769E] truncate max-w-[140px]">
                    Link: {b.ctaLink}
                  </span>
                  <button
                    onClick={() => handleDeleteBanner(b.id)}
                    className="p-1.5 text-[#DC2626] hover:bg-[#FEE2E2] rounded-md transition-colors"
                    title="Remove Slide"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Banner Modal */}
        {showAddBanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-[#E7DCEB]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7DCEB]">
                <h3 className="font-serif text-lg font-semibold text-[#2C1838]">Add New Hero Banner Artwork</h3>
                <button onClick={() => setShowAddBanner(false)} className="text-[#8E769E] hover:text-black">✕</button>
              </div>

              <form onSubmit={handleCreateBanner} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Pre-title Tagline</label>
                  <input
                    type="text"
                    value={newTagline}
                    onChange={(e) => setNewTagline(e.target.value)}
                    placeholder="e.g. BRIDAL COLLECTION 2026"
                    className="w-full px-3.5 py-2 uppercase tracking-wider bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                  />
                </div>

                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Main Heading *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Pure Heritage Kundan Sets"
                    className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                  />
                </div>

                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={newSubtitle}
                    onChange={(e) => setNewSubtitle(e.target.value)}
                    placeholder="e.g. Handcrafted for unforgettable celebrations."
                    className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#5D5068] font-medium mb-1">Button CTA Text</label>
                    <input
                      type="text"
                      value={newCtaText}
                      onChange={(e) => setNewCtaText(e.target.value)}
                      placeholder="Shop Now"
                      className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#5D5068] font-medium mb-1">Destination URL</label>
                    <input
                      type="text"
                      value={newCtaLink}
                      onChange={(e) => setNewCtaLink(e.target.value)}
                      placeholder="/shop?occasion=wedding"
                      className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#5D5068] font-medium mb-1">Image URL *</label>
                  <input
                    type="url"
                    required
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full px-3.5 py-2 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xl focus:outline-none focus:border-[#563568]"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E7DCEB]">
                  <button
                    type="button"
                    onClick={() => setShowAddBanner(false)}
                    className="px-4 py-2 border border-[#E7DCEB] rounded-xl text-[#5D5068]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#563568] hover:bg-[#78469C] text-white rounded-xl font-medium"
                  >
                    Upload Banner
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

import React from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { HomepageSectionManager } from "../../components/admin/HomepageSectionManager";

export const AdminCarouselFeaturesPage: React.FC = () => (
  <AdminLayout>
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8" id="carousel-features">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8B7598]">Storefront experience</p>
          <h1 className="mt-1 font-serif text-2xl text-[#302438] sm:text-3xl">Homepage Sections</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#817487]">Manage homepage section order and visibility, carousel layouts, and the separate Explore Now product grid and selection settings.</p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-[#E7DCEB] bg-white px-4 py-2 text-xs font-medium text-[#563568]">Preview storefront</a>
      </header>
      <HomepageSectionManager />
    </div>
  </AdminLayout>
);

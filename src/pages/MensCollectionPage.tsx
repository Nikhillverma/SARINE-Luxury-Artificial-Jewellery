import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { hostingerStorefrontService } from '../services/hostinger/hostingerStorefrontService';

export const MensCollectionPage: React.FC = () => {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let active = true;
    hostingerStorefrontService.getPublicShopByGender()
      .then(({ settings }) => {
        if (active) setImageUrl(settings.forHimImageUrl || '');
      })
      .catch(error => {
        console.warn('[MensCollectionPage] For Him image unavailable.', error);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-[65vh] bg-[var(--page-background)]">
      <section className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
        <Link
          to="/"
          className="mb-6 inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--plum)] transition-opacity hover:opacity-70"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to Home
        </Link>

        {imageUrl ? (
          <div className="mb-8 aspect-[1.6/1] w-full overflow-hidden rounded-xl bg-[var(--pill)] sm:aspect-[2.5/1] lg:aspect-[3/1]">
            <img
              src={imageUrl}
              alt="SARINE For Him collection preview"
              className="h-full w-full object-cover"
              decoding="async"
            />
          </div>
        ) : (
          <div className="mb-8 flex aspect-[1.6/1] w-full items-center justify-center rounded-xl bg-[var(--pill)] sm:aspect-[2.5/1] lg:aspect-[3/1]">
            <span className="font-serif text-2xl text-[var(--plum)] sm:text-4xl">SARINE</span>
          </div>
        )}

        <div className="mx-auto max-w-2xl py-4 text-center sm:py-8">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--plum)] sm:text-xs">
            SARINE · FOR HIM
          </p>
          <h1 className="mt-4 font-serif text-4xl font-normal text-[var(--heading)] sm:text-5xl lg:text-6xl">
            Coming Soon
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[var(--body)] sm:text-base">
            A new collection, thoughtfully curated for him. Our men’s edit is on its way.
          </p>
        </div>
      </section>
    </main>
  );
};

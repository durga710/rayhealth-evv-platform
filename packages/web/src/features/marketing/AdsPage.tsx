import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingShell } from './MarketingShell.js';

/**
 * /ads — showcase of the RayHealthEVV™ ad creative in every delivered
 * aspect ratio (square, vertical, landscape) so the team can preview,
 * grab a direct link, or download for a given placement.
 *
 * Videos live in packages/web/public/ads/ and are served at /ads/*.mp4.
 * Note: vercel.json excludes `ads` from the SPA rewrite so these resolve
 * to the real files instead of index.html.
 */

interface AdVariant {
  label: string;
  ratioHint: string;
  src: string;
  /** CSS aspect-ratio value */
  aspect: string;
  /** max width so portrait clips don't dominate the row */
  maxWidth: string;
}

interface AdCampaign {
  name: string;
  blurb: string;
  variants: AdVariant[];
}

const campaigns: AdCampaign[] = [
  {
    name: 'Spot 1 — Care, on the same page',
    blurb: 'The flagship 30-second spot. Square for in-feed (Instagram, Facebook), vertical for Stories / Reels / TikTok.',
    variants: [
      {
        label: 'Square',
        ratioHint: '1:1 · feed',
        src: '/ads/RayHealthEVV_ad_square.mp4',
        aspect: '1 / 1',
        maxWidth: '420px'
      },
      {
        label: 'Vertical',
        ratioHint: '9:16 · stories / reels',
        src: '/ads/RayHealthEVV_ad_vertical.mp4',
        aspect: '9 / 16',
        maxWidth: '300px'
      }
    ]
  },
  {
    name: 'Spot 2 — Built for the field',
    blurb: 'Second campaign cut. Landscape for YouTube / web pre-roll, vertical for mobile-first placements.',
    variants: [
      {
        label: 'Landscape',
        ratioHint: '16:9 · youtube / web',
        src: '/ads/RayHealthEVV_ad2_landscape.mp4',
        aspect: '16 / 9',
        maxWidth: '640px'
      },
      {
        label: 'Vertical',
        ratioHint: '9:16 · stories / reels',
        src: '/ads/RayHealthEVV_ad2_vertical.mp4',
        aspect: '9 / 16',
        maxWidth: '300px'
      }
    ]
  }
];

const sectionHeading: React.CSSProperties = {
  color: 'var(--color-primary-dark)',
  fontSize: '1.5rem',
  margin: '0 0 0.35rem'
};

const lead: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  lineHeight: 1.7,
  fontSize: '1.05rem'
};

const cardLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.5rem',
  marginBottom: '0.6rem'
};

function VideoCard({ variant }: { variant: AdVariant }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 14px rgba(15,61,114,0.06)',
        padding: '1rem',
        width: '100%',
        maxWidth: variant.maxWidth
      }}
    >
      <div style={cardLabel}>
        <span style={{ fontWeight: 800, color: 'var(--color-primary-dark)', fontSize: '0.95rem' }}>
          {variant.label}
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)'
          }}
        >
          {variant.ratioHint}
        </span>
      </div>
      <video
        controls
        preload="metadata"
        playsInline
        style={{
          width: '100%',
          aspectRatio: variant.aspect,
          borderRadius: '10px',
          background: '#0F172A',
          display: 'block'
        }}
      >
        <source src={variant.src} type="video/mp4" />
        Your browser does not support the video tag.{' '}
        <a href={variant.src}>Download the video</a> instead.
      </video>
      <div style={{ marginTop: '0.6rem', textAlign: 'right' }}>
        <a
          href={variant.src}
          download
          style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary-light)', textDecoration: 'none' }}
        >
          Download ↓
        </a>
      </div>
    </div>
  );
}

export function AdsPage() {
  return (
    <MarketingShell
      eyebrow="Ad creative"
      title="RayHealthEVV™ ads — every format, ready to ship"
    >
      <article style={{ maxWidth: '900px', margin: '2rem auto 0' }}>
        <p style={{ ...lead, textAlign: 'center' }}>
          Preview the current ad creative in each delivered aspect ratio. Use the square and landscape cuts for
          feeds and web pre-roll, the vertical cuts for Stories, Reels, and TikTok. Each clip can be played here
          or downloaded for upload to an ad platform.
        </p>

        {campaigns.map((campaign) => (
          <section key={campaign.name} style={{ marginTop: '3rem' }}>
            <h2 style={sectionHeading}>{campaign.name}</h2>
            <p style={{ ...lead, marginTop: 0 }}>{campaign.blurb}</p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.5rem',
                alignItems: 'flex-start',
                marginTop: '1.25rem'
              }}
            >
              {campaign.variants.map((variant) => (
                <VideoCard key={variant.src} variant={variant} />
              ))}
            </div>
          </section>
        ))}

        <div
          style={{
            marginTop: '3.5rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}
        >
          <Link
            to="/contact"
            style={{
              background: 'linear-gradient(135deg, #1a5fa8 0%, #0f3d72 100%)',
              color: 'white',
              textDecoration: 'none',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(15,61,114,0.3)'
            }}
          >
            Book an agency demo
          </Link>
          <Link
            to="/launch"
            style={{
              background: '#fff',
              border: '1.5px solid #C9D8E8',
              color: '#1a3a5c',
              textDecoration: 'none',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontWeight: 700
            }}
          >
            What's new
          </Link>
        </div>
      </article>
    </MarketingShell>
  );
}

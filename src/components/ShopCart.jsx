"use client";
import React from "react";
import Link from 'next/link';
export default function ShopCart({ products }) {

  return (
    <div>
      <div className="shop-grid">
        {products.map((p) => (
          <article key={p.id} className="shop-card">
            <div className="shop-card-image">
              <Link href={`/shop/${p.handle}`}>
                {p.images[0] ? (
                  <img
                    src={p.images[0].url}
                    alt={p.images[0].altText || p.title}
                    className="shop-card-img"
                  />
                ) : null}
              </Link>
            </div>

            <div className="shop-card-content">
              <h3>
                <Link href={`/shop/${p.handle}`}>{p.title}</Link>
              </h3>
              <div className="shop-card-desc" dangerouslySetInnerHTML={{ __html: p.descriptionHtml || "" }} />
            </div>

            <div className="shop-card-actions">
              {/* Show primary price below title; click item to view details and select variants */}
              {p.variants && p.variants.length > 0 ? (
                <div style={{ fontSize: '0.9rem', fontFamily: 'var(--font-monument)', fontWeight: 700 }}>
                  {p.variants[0].price ? `$${Number(p.variants[0].price.amount).toFixed(2)}` : ''}
                  {!p.variants[0].availableForSale && ' (SOLD OUT)'}
                </div>
              ) : (
                <div style={{ color: '#888', fontSize: '0.9rem', fontFamily: 'var(--font-monument)', fontWeight: 700 }}>Price unavailable</div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

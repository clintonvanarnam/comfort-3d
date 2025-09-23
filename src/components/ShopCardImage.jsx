"use client";
import React, { useState, useEffect, useRef } from 'react';

export default function ShopCardImage({ images, title }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Only autoplay when hovered/focused and there are multiple images
    if (!images || images.length <= 1) return;
    if (!hovered) return;

    intervalRef.current = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [images, hovered]);

  useEffect(() => {
    // reset to first image when images change
    setCurrentImageIndex(0);
  }, [images]);

  if (!images || images.length === 0) return null;

  return (
    <div
      className="shop-card-img-wrap"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setCurrentImageIndex(0);
      }}
      onFocus={() => setHovered(true)}
      onBlur={() => {
        setHovered(false);
        setCurrentImageIndex(0);
      }}
      tabIndex={0}
      style={{ display: 'block' }}
    >
      <img
        src={images[currentImageIndex].url}
        alt={images[currentImageIndex].altText || title}
        className="shop-card-img"
      />
    </div>
  );
}
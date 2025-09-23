"use client";
import React, { useState, useEffect } from 'react';

export default function ShopCardImage({ images, title }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (images && images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [images]);

  if (!images || images.length === 0) return null;

  return (
    <img
      src={images[currentImageIndex].url}
      alt={images[currentImageIndex].altText || title}
      className="shop-card-img"
    />
  );
}
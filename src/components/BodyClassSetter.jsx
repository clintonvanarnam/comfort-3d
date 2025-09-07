"use client";

import { useEffect } from 'react';

export default function BodyClassSetter({ classes = '' }) {
  useEffect(() => {
    if (!classes) return;
    const list = classes.split(/\s+/).filter(Boolean);
    list.forEach((c) => document.body.classList.add(c));
    return () => {
      list.forEach((c) => document.body.classList.remove(c));
    };
  }, [classes]);

  return null;
}

"use client";

import { useEffect, useMemo, useState } from "react";

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

export function useItemsPerView() {
  const [width, setWidth] = useState<number>(1200);

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);
    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  return useMemo(() => {
    if (width <= MOBILE_MAX) return 1;
    if (width <= TABLET_MAX) return 2;
    return 4;
  }, [width]);
}

export function useCarousel(length: number, perView: number, intervalMs = 5000) {
  const [index, setIndex] = useState(0);

  const maxStartIndex = Math.max(0, length - perView);
  const safeIndex = Math.min(index, maxStartIndex);

  useEffect(() => {
    if (length <= perView || length <= 1) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current >= maxStartIndex ? 0 : current + 1));
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs, length, maxStartIndex, perView]);

  const next = () => setIndex((current) => (current >= maxStartIndex ? 0 : current + 1));
  const prev = () => setIndex((current) => (current <= 0 ? maxStartIndex : current - 1));

  return {
    index: safeIndex,
    setIndex,
    next,
    prev,
    maxStartIndex,
  };
}

export function truncateWords(text: string, wordCount: number) {
  const words = text.trim().split(/\s+/);
  if (words.length <= wordCount) return text;
  return `${words.slice(0, wordCount).join(" ")}...`;
}

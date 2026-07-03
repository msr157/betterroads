"use client";

/**
 * Single place to import GSAP + plugins so registration happens exactly once.
 * As of GSAP 3.13+ every plugin (incl. DrawSVG / MotionPath / SplitText) ships
 * free inside the public `gsap` package.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);
  // Don't run a full (expensive) refresh every time the mobile URL bar
  // collapses/expands — a classic scroll-stutter source on phones.
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger, DrawSVGPlugin, MotionPathPlugin, useGSAP };

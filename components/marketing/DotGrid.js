"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative dot field behind the hero and closing sections: a slow current,
 * a push away from a fine pointer and a ripple on click. Skips animation
 * for coarse pointers, reduced motion, hidden tabs and offscreen sections.
 * Port of the standalone site's dot-grid.js.
 */
export default function DotGrid() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const host = canvas && canvas.parentElement;
    if (!canvas || !host) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    let width = 0, height = 0, dots = [], frame = 0, previous = 0, elapsed = 0;
    let visible = false;
    let pointer = { x: -1000, y: -1000, active: false };
    let ripples = [];
    const canMove = () => !reducedMotion.matches && finePointer.matches;
    const canRun = () => canMove() && visible && !document.hidden;

    function render(delta) {
      const moving = canMove();
      elapsed += delta;
      context.clearRect(0, 0, width, height);
      const ease = moving ? 1 - Math.exp(-delta / 85) : 1;
      ripples = ripples.filter((r) => elapsed - r.born < 1500);
      for (const dot of dots) {
        let dx = 0, dy = 0, proximity = 0, wave = 0;
        if (moving) {
          dx = Math.sin(dot.homeY * 0.017 + elapsed * 0.00045) * 1.6;
          dy = Math.sin(dot.homeX * 0.015 + elapsed * 0.00035) * 1.6;
          if (pointer.active) {
            const px = dot.homeX - pointer.x, py = dot.homeY - pointer.y;
            const distance = Math.hypot(px, py);
            proximity = Math.max(0, 1 - distance / 170);
            if (distance > 0.01 && proximity > 0) {
              const push = proximity * proximity * 24;
              dx += (px / distance) * push;
              dy += (py / distance) * push;
            }
          }
          for (const ripple of ripples) {
            const age = elapsed - ripple.born;
            const rx = dot.homeX - ripple.x, ry = dot.homeY - ripple.y;
            const distance = Math.hypot(rx, ry);
            const band = Math.exp(-Math.pow((distance - age * 0.32) / 34, 2));
            const strength = band * (1 - age / 1500);
            wave = Math.max(wave, strength);
            if (distance > 0.01) {
              dx += (rx / distance) * strength * 10;
              dy += (ry / distance) * strength * 10;
            }
          }
        }
        dot.x += (dot.homeX + dx - dot.x) * ease;
        dot.y += (dot.homeY + dy - dot.y) * ease;
        context.fillStyle = `rgba(27,25,66,${0.16 + proximity * 0.29 + wave * 0.14})`;
        context.beginPath();
        context.arc(dot.x, dot.y, 0.8 + proximity * 0.65 + wave * 0.3, 0, Math.PI * 2);
        context.fill();
      }
    }

    function resize() {
      width = host.clientWidth;
      height = host.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const spacing = width < 600 ? 22 : 18;
      dots = [];
      for (let y = 10; y < height; y += spacing) {
        for (let x = 10; x < width; x += spacing) dots.push({ homeX: x, homeY: y, x, y });
      }
      render(0);
    }

    function animate(now) {
      frame = 0;
      if (!canRun()) return;
      const delta = now - previous;
      if (delta >= 32) {
        render(Math.min(delta, 64));
        previous = now;
      }
      frame = requestAnimationFrame(animate);
    }
    function updateActivity() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previous = performance.now();
      if (canRun()) frame = requestAnimationFrame(animate);
      else if (!canMove()) {
        pointer.active = false;
        ripples = [];
        render(0);
      }
    }
    const onMove = (event) => {
      if (!canMove() || event.pointerType === "touch") return;
      const rect = host.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top, active: true };
    };
    const onLeave = () => { pointer.active = false; };
    const onDown = (event) => {
      if (!canMove() || event.pointerType === "touch") return;
      const rect = host.getBoundingClientRect();
      ripples.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, born: elapsed });
      if (ripples.length > 3) ripples.shift();
    };
    const onScroll = () => { pointer.active = false; };
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
    host.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", updateActivity);
    reducedMotion.addEventListener("change", updateActivity);
    finePointer.addEventListener("change", updateActivity);
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      updateActivity();
    }, { threshold: 0 });
    io.observe(host);
    resize();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", updateActivity);
      reducedMotion.removeEventListener("change", updateActivity);
      finePointer.removeEventListener("change", updateActivity);
      ro.disconnect();
      io.disconnect();
    };
  }, []);
  return <canvas ref={ref} className="mk-interactive-dot-grid" aria-hidden="true" />;
}

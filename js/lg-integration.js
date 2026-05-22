/**
 * lg-integration.js — Liquid Glass theme integration for iPOCKET
 * Wires up the liquid-glass-js library to UI elements when theme-liquid is active.
 * Also handles theme switch events to init/teardown the glass effects.
 */

(function() {
  'use strict';

  /* ── State ─────────────────────────────────────────────────────── */
  let taskbarGlassContainer = null;
  let glassInitialized = false;
  let glassEnabled = false;

  /* ── Helpers ────────────────────────────────────────────────────── */
  function isLiquidTheme() {
    return document.body.classList.contains('theme-liquid');
  }

  function destroyGlass() {
    if (taskbarGlassContainer) {
      try {
        taskbarGlassContainer.destroy && taskbarGlassContainer.destroy();
      } catch(e) {}
      // Remove the wrapper div
      const wrapper = document.getElementById('taskbar-lg-wrapper');
      if (wrapper) wrapper.remove();
      taskbarGlassContainer = null;
    }
    // Clean up Container statics so re-init works
    if (window.Container) {
      Container.instances = [];
      Container.pageSnapshot = null;
      Container.isCapturing = false;
      Container.waitingForSnapshot = [];
    }
    glassInitialized = false;
    glassEnabled = false;
  }

  /* ── Taskbar Glass ──────────────────────────────────────────────── */
  function initTaskbarGlass() {
    if (!isLiquidTheme()) return;
    if (glassInitialized) return;
    if (!window.Container) return;

    const taskbar = document.getElementById('taskbar');
    if (!taskbar) return;

    // Ensure taskbar has relative positioning for the wrapper
    taskbar.style.position = 'relative';

    // Create a wrapper div that sits behind taskbar content
    const wrapper = document.createElement('div');
    wrapper.id = 'taskbar-lg-wrapper';
    taskbar.insertBefore(wrapper, taskbar.firstChild);

    // Create glass container sized to the taskbar
    try {
      const container = new Container({
        borderRadius: 0,
        type: 'rounded',
        tintOpacity: 0.18,
      });

      // Mount the glass element into the wrapper
      wrapper.appendChild(container.element);

      // Force size to match taskbar
      const rect = taskbar.getBoundingClientRect();
      container.element.style.cssText = `
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none !important;
      `;
      container.canvas.width  = Math.ceil(rect.width)  || window.innerWidth;
      container.canvas.height = Math.ceil(rect.height) || 56;
      container.canvas.style.cssText = `
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        border-radius: 0 !important;
      `;
      container.width  = container.canvas.width;
      container.height = container.canvas.height;
      container.borderRadius = 0;

      taskbarGlassContainer = container;
      glassInitialized = true;
      glassEnabled = true;
    } catch(e) {
      console.warn('LG Integration: taskbar glass init failed', e);
      const wrapper = document.getElementById('taskbar-lg-wrapper');
      if (wrapper) wrapper.remove();
    }
  }

  /* ── Wait for desktop to be shown, then init ────────────────────── */
  function waitForDesktop() {
    const desktop = document.getElementById('desktop');
    if (!desktop) {
      setTimeout(waitForDesktop, 200);
      return;
    }

    // Watch for display:none → display:flex transition on desktop
    const obs = new MutationObserver(() => {
      if (desktop.style.display !== 'none' && isLiquidTheme()) {
        obs.disconnect();
        // Small delay for DOM to fully layout after boot
        setTimeout(initTaskbarGlass, 600);
      }
    });
    obs.observe(desktop, { attributes: true, attributeFilter: ['style'] });

    // Also check right now in case desktop is already visible
    if (desktop.style.display !== 'none' && isLiquidTheme()) {
      setTimeout(initTaskbarGlass, 600);
    }
  }

  /* ── Watch for theme changes ────────────────────────────────────── */
  function watchThemeChanges() {
    const obs = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        if (m.attributeName === 'class') {
          if (isLiquidTheme() && !glassEnabled) {
            // Switched TO liquid
            setTimeout(initTaskbarGlass, 1600); // After switch animation
          } else if (!isLiquidTheme() && glassEnabled) {
            // Switched AWAY from liquid
            setTimeout(destroyGlass, 100);
          }
        }
      });
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── Text readability enforcement ──────────────────────────────── */
  // Ensures all text inside liquid theme UI is white for readability.
  // The CSS already covers most cases; this handles any dynamically-inserted
  // content that might inherit wrong colors.
  function enforceTextReadability() {
    if (!isLiquidTheme()) return;

    // Re-run periodically while liquid theme is active
    const colorFix = setInterval(() => {
      if (!isLiquidTheme()) {
        clearInterval(colorFix);
        return;
      }
      // Fix any elements with dark text colors inside liquid UI
      const winBodies = document.querySelectorAll('.theme-liquid .win-body');
      winBodies.forEach(body => {
        const els = body.querySelectorAll('*');
        els.forEach(el => {
          const computed = window.getComputedStyle(el);
          const color = computed.color;
          // If text color is very dark (close to black), override it
          if (color && color.includes('rgb(')) {
            const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
              const [, r, g, b] = match.map(Number);
              const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
              if (luminance < 80 && !el.classList.contains('lg-numpad-btn')) {
                el.style.color = 'rgba(255,255,255,0.88)';
              }
            }
          }
        });
      });
    }, 2000);
  }

  /* ── Boot ───────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    waitForDesktop();
    watchThemeChanges();
    enforceTextReadability();
  });

})();

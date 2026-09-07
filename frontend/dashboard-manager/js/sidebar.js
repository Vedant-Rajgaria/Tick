/**
 * TICK Platform - Modern UI Micro-Interactions & Sidebar Controller
 * Pure Vanilla ES6 - Zero Dependencies
 * Strictly non-interfering with existing data-binding controllers.
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initChartDefaults();
  });

  function initSidebar() {
    const container = document.querySelector('.app-container');
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('.sidebar-header');

    if (!container || !sidebar) return;

    // Check saved collapse state
    const isCollapsed = localStorage.getItem('tick_sidebar_collapsed') === 'true';
    if (isCollapsed) {
      container.classList.add('sidebar-collapsed');
    }

    // Check if toggle button already exists, else insert it
    let toggleBtn = document.getElementById('sidebarToggleBtn');
    if (!toggleBtn && header) {
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.id = 'sidebarToggleBtn';
      toggleBtn.className = 'sidebar-toggle-btn';
      toggleBtn.setAttribute('title', 'Toggle sidebar (Ctrl+B)');
      toggleBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      `;
      header.appendChild(toggleBtn);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        container.classList.toggle('sidebar-collapsed');
        const state = container.classList.contains('sidebar-collapsed');
        localStorage.setItem('tick_sidebar_collapsed', state);
      });
    }

    // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        container.classList.toggle('sidebar-collapsed');
        const state = container.classList.contains('sidebar-collapsed');
        localStorage.setItem('tick_sidebar_collapsed', state);
      }
    });
  }

  function initChartDefaults() {
    if (typeof window.Chart !== 'undefined') {
      window.Chart.defaults.color = '#94A3B8';
      window.Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';
      if (window.Chart.defaults.scale && window.Chart.defaults.scale.grid) {
        window.Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.06)';
      }
    }
  }
})();

/**
 * TIC Manager Notifications Controller
 * Manages manager alert bell, dropdown, and unread notifications count.
 */

(function(window) {
  'use strict';

  function init() {
    setupBellToggle();
    renderNotifications();
  }

  function setupBellToggle() {
    const bellBtn = document.getElementById('mgrNotifBellBtn');
    const notifMenu = document.getElementById('mgrNotifDropdown');
    const markAllBtn = document.getElementById('mgrMarkAllReadBtn');

    if (bellBtn && notifMenu) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifMenu.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (!notifMenu.contains(e.target) && !bellBtn.contains(e.target)) {
          notifMenu.classList.remove('active');
        }
      });
    }

    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => {
        markAllAsRead();
      });
    }
  }

  function renderNotifications() {
    const state = window.TIC_API.getState();
    const notifs = state.managerNotifications || [];

    const unreadCount = notifs.filter(n => !n.read).length;
    const badgeEl = document.getElementById('mgrNotifCounterBadge');
    if (badgeEl) {
      badgeEl.textContent = unreadCount;
      badgeEl.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    const dropdownList = document.getElementById('mgrNotifDropdownList');
    if (dropdownList) {
      dropdownList.innerHTML = notifs.length === 0 
        ? `<div class="text-muted text-center" style="padding: 1.5rem;">No alerts.</div>`
        : notifs.map(n => renderNotificationHtml(n)).join('');
    }

    const fullList = document.getElementById('mgrFullNotifListContainer');
    if (fullList) {
      fullList.innerHTML = notifs.length === 0 
        ? `<div class="card text-muted text-center" style="padding: 2rem;">No alerts.</div>`
        : notifs.map(n => renderNotificationHtml(n, true)).join('');
    }

    document.querySelectorAll('.notification-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.getAttribute('data-notif-id'), 10);
        markOneAsRead(id);
      });
    });
  }

  function renderNotificationHtml(n, isCard = false) {
    const iconMap = {
      'high-workload': '⚠',
      'overload': '🚨',
      'task': '＋',
      'success': '✓'
    };
    const iconChar = iconMap[n.iconType] || '●';

    return `
      <div class="notification-item ${n.read ? '' : 'unread'} ${isCard ? 'card' : ''}" data-notif-id="${n.id}">
        <div class="notification-icon ${n.iconType}">
          <span style="font-weight: 700; font-size: 1rem;">${iconChar}</span>
        </div>
        <div class="notification-content">
          <div class="notification-title">${n.title}</div>
          <div class="notification-text">${n.message}</div>
          <div class="notification-time">${n.time}</div>
        </div>
      </div>
    `;
  }

  function markOneAsRead(id) {
    const state = window.TIC_API.getState();
    const notif = state.managerNotifications.find(n => n.id === id);
    if (notif && !notif.read) {
      notif.read = true;
      window.TIC_API.saveState(state);
      renderNotifications();
    }
  }

  function markAllAsRead() {
    const state = window.TIC_API.getState();
    state.managerNotifications.forEach(n => n.read = true);
    window.TIC_API.saveState(state);
    renderNotifications();
    if (window.TIC_ManagerApp) window.TIC_ManagerApp.showToast("All notifications marked as read", "info");
  }

  window.TIC_ManagerNotifications = {
    init,
    renderNotifications
  };

})(window);

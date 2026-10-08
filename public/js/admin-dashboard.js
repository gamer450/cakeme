/* ============================================================
   АДМИН: ДАШБОРД v2 — с Chart.js, трендами, аналитикой
   ============================================================ */

const dashboardState = {
  charts: {},
  data: null
};

// ============================================================
// 1. Главный рендер
// ============================================================
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="admin-loading" style="min-height:300px">
      <div class="admin-loading__spinner"></div>
      <span>Считаем цифры...</span>
    </div>
  `;

  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    const stats = await res.json();

    dashboardState.data = stats;

    renderDashboardContent(container, stats);
    initCharts(stats);
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="admin-placeholder">
        <h2 class="admin-placeholder__title">Не удалось загрузить статистику</h2>
        <p class="admin-placeholder__text">Обновите страницу или попробуйте позже</p>
      </div>
    `;
  }
}

// ============================================================
// 2. Рендер HTML
// ============================================================
function renderDashboardContent(container, s) {
  container.innerHTML = `
    <!-- ГЛАВНЫЕ КАРТОЧКИ -->
    <div class="stats-grid">
    ${renderStatCard({
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><rect x="3" y="6" width="18" height="14" /><path d="M3 6l9-3 9 3M12 10v4" /></svg>`,
        type: 'orders',
        label: 'Всего заказов',
        value: s.totalOrders,
        hint: 'за всё время',
        trend: s.trends.orders,
        trendLabel: 'к прошлой неделе'
      })}
    ${renderStatCard({
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><path d="M6 17V10a6 6 0 1 1 12 0v7" /><path d="M3 17h18M10 20h4" /></svg>`,
        type: 'new',
        label: 'Новых заказов',
        value: s.newOrders,
        hint: 'требуют обработки',
        badge: s.newOrders > 0
      })}
    ${renderStatCard({
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><rect x="3" y="6" width="18" height="12" /><rect x="10" y="9" width="4" height="6" /><path d="M6 12h1M17 12h1" /></svg>`,
         type: 'revenue',
        label: 'Выручка',
        value: formatMoneyShort(s.totalRevenue) + ' ₽',
        hint: 'без отменённых',
        trend: s.trends.revenue,
        trendLabel: 'к прошлой неделе'
      })}
    ${renderStatCard({
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><rect x="3" y="9" width="6" height="6" /><rect x="15" y="9" width="6" height="6" /><path d="M9 12h6M6 15v3h12v-3" /></svg>`,
        type: 'users',
        label: 'Покупателей',
        value: s.totalUsers,
        hint: 'в базе',
        trend: s.trends.newUsers,
        trendLabel: '+ новых за неделю'
      })}
    </div>

    <!-- ВТОРОЙ РЯД: МИНИ-МЕТРИКИ -->
    <div class="mini-metrics">
      <div class="mini-metric">
        <div class="mini-metric__label">Средний чек</div>
        <div class="mini-metric__value">${formatMoney(s.avgCheck)} ₽</div>
      </div>
      <div class="mini-metric">
        <div class="mini-metric__label">Товаров на сайте</div>
        <div class="mini-metric__value">${s.totalProducts}</div>
      </div>
      <div class="mini-metric">
        <div class="mini-metric__label">Отзывов на модерации</div>
        <div class="mini-metric__value ${s.pendingReviews > 0 ? 'is-warning' : ''}">
          ${s.pendingReviews}
          ${s.pendingReviews > 0 ? '<span class="mini-metric__badge">требуют внимания</span>' : ''}
        </div>
      </div>
      <div class="mini-metric">
        <div class="mini-metric__label">Товаров мало на складе</div>
        <div class="mini-metric__value ${s.lowStockProducts.length > 0 ? 'is-warning' : ''}">
          ${s.lowStockProducts.length}
          ${s.lowStockProducts.length > 0 ? '<span class="mini-metric__badge">пополнить</span>' : ''}
        </div>
      </div>
    </div>

    <!-- ГРАФИК ПРОДАЖ (30 дней) -->
    <div class="dashboard-panel">
      <div class="dashboard-panel__header">
        <h3 class="dashboard-panel__title">Продажи за 30 дней</h3>
        <div class="dashboard-panel__legend">
          <span class="legend-dot" style="background:#E8A87C"></span>
          Выручка
        </div>
      </div>
      <div class="chart-container" style="height:300px;">
        <canvas id="chart-sales"></canvas>
      </div>
    </div>

    <!-- ДВЕ КОЛОНКИ: Статусы + Категории -->
    <div class="dashboard-row-2">
      <div class="dashboard-panel">
        <div class="dashboard-panel__header">
          <h3 class="dashboard-panel__title">Заказы по статусам</h3>
        </div>
        <div class="chart-container" style="height:280px;">
          <canvas id="chart-status"></canvas>
        </div>
      </div>

      <div class="dashboard-panel">
        <div class="dashboard-panel__header">
          <h3 class="dashboard-panel__title">Продажи по категориям</h3>
        </div>
        <div class="chart-container" style="height:280px;">
          <canvas id="chart-categories"></canvas>
        </div>
      </div>
    </div>

    <!-- ТОП ТОВАРОВ + НИЗКИЙ ОСТАТОК -->
    <div class="dashboard-row-2">
      <div class="dashboard-panel">
        <div class="dashboard-panel__header">
          <h3 class="dashboard-panel__title">Топ товаров</h3>
        </div>
        ${renderTopProducts(s.topProducts)}
      </div>

      <div class="dashboard-panel">
        <div class="dashboard-panel__header">
          <h3 class="dashboard-panel__title">Мало на складе</h3>
        </div>
        ${renderLowStock(s.lowStockProducts)}
      </div>
    </div>

    <!-- ПОСЛЕДНИЕ ЗАКАЗЫ -->
    <div class="dashboard-panel">
      <div class="dashboard-panel__header">
        <h3 class="dashboard-panel__title">Последние заказы</h3>
        <a href="#" class="dashboard-panel__link" id="go-orders">Все заказы →</a>
      </div>
      ${renderRecentOrders(s.recentOrders)}
    </div>
  `;

  // Клик на ссылку «Все заказы»
  document.getElementById('go-orders')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('orders');
  });

  // Клик на строки заказа
  document.querySelectorAll('.recent-order').forEach(el => {
    el.addEventListener('click', () => navigate('orders'));
  });
}

// ============================================================
// 3. Карточка статистики
// ============================================================
function renderStatCard({ icon, type, label, value, hint, trend, trendLabel, badge }) {
  let trendHtml = '';
  if (trend !== undefined && trend !== null) {
    const isUp = trend > 0;
    const isDown = trend < 0;
    const cls = isUp ? 'is-up' : (isDown ? 'is-down' : 'is-flat');
    const arrow = isUp ? '↑' : (isDown ? '↓' : '→');
    const sign = isUp ? '+' : '';
    trendHtml = `
      <div class="stat-trend ${cls}">
        <span>${arrow} ${sign}${trend}%</span>
        <span class="stat-trend__label">${trendLabel || ''}</span>
      </div>
    `;
  }

  return `
    <div class="stat-card ${badge ? 'stat-card--accent' : ''}">
      <div class="stat-card__icon stat-card__icon--${type}">${icon}</div>
      <div class="stat-card__label">${label}</div>
      <div class="stat-card__value">${value}</div>
      ${trendHtml}
      ${hint && !trendHtml ? `<div class="stat-card__hint">${hint}</div>` : ''}
    </div>
  `;
}

// ============================================================
// 4. Топ товаров
// ============================================================
function renderTopProducts(products) {
  if (!products || products.length === 0) {
    return `<div class="top-list__empty">Пока нет продаж</div>`;
  }

  return `
    <div class="top-list">
      ${products.map((p, i) => `
        <div class="top-item">
          <div class="top-item__rank">${i + 1}</div>
          <div class="top-item__info">
            <div class="top-item__name">${p.product_name}</div>
            <div class="top-item__meta">Продано: ${p.sold} шт</div>
          </div>
          <div class="top-item__revenue">${formatMoney(p.revenue)} ₽</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// 5. Товары с низким остатком
// ============================================================
function renderLowStock(products) {
  if (!products || products.length === 0) {
    return `<div class="top-list__empty">Все товары в наличии 👍</div>`;
  }

  return `
    <div class="low-stock-list">
      ${products.map(p => `
        <div class="low-stock-item">
          <div class="low-stock-item__name">${p.name}</div>
          <div class="low-stock-item__stock">
            <strong>${p.stock}</strong> из ${p.low_stock_threshold}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// 6. Последние заказы
// ============================================================
function renderRecentOrders(orders) {
  if (!orders || orders.length === 0) {
    return `<div class="recent-orders__empty">Заказов пока нет 📭</div>`;
  }

  const statusLabels = {
    new: 'Новый',
    confirmed: 'Подтверждён',
    baking: 'Готовится',
    delivering: 'В доставке',
    done: 'Выполнен',
    cancelled: 'Отменён'
  };

  return `
    <div class="recent-orders">
      ${orders.map(o => `
        <div class="recent-order">
          <div class="recent-order__id">№${o.id}</div>
          <div>
            <div class="recent-order__customer">${o.customer_name}</div>
            <div class="recent-order__phone">${o.phone || ''}</div>
          </div>
          <span class="order-badge order-badge--${o.status}">${statusLabels[o.status] || o.status}</span>
          <div class="recent-order__total">${formatMoney(o.total)} ₽</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// 7. Графики Chart.js
// ============================================================
function initCharts(stats) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js не загружен');
    return;
  }

  // Общие настройки шрифта
  Chart.defaults.color = '#A89888';
  Chart.defaults.font.family = "'Inter Tight', 'Manrope', sans-serif";
  Chart.defaults.font.size = 12;

  initSalesChart(stats.salesByDay);
  initStatusChart(stats.ordersByStatus);
  initCategoriesChart(stats.salesByCategory);
}

// Продажи за 30 дней — линия
function initSalesChart(salesByDay) {
  const ctx = document.getElementById('chart-sales');
  if (!ctx) return;

  // Заполняем пустые дни
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const found = salesByDay.find(s => s.day === key);
    days.push({
      day: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      revenue: found ? found.revenue : 0,
      orders: found ? found.orders : 0
    });
  }

  // Уничтожаем предыдущий
  dashboardState.charts.sales?.destroy();

  dashboardState.charts.sales = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days.map(d => d.day),
      datasets: [{
        label: 'Выручка, ₽',
        data: days.map(d => d.revenue),
        borderColor: '#E8A87C',
        backgroundColor: 'rgba(232, 168, 124, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#E8A87C',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1310',
          borderColor: 'rgba(201, 169, 97, 0.3)',
          borderWidth: 1,
          titleColor: '#F5EDE4',
          bodyColor: '#E5C57A',
          padding: 12,
          displayColors: false,
          callbacks: {
            label: (context) => {
              const idx = context.dataIndex;
              return [
                `Выручка: ${formatMoney(context.parsed.y)} ₽`,
                `Заказов: ${days[idx].orders}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(245, 237, 228, 0.05)' },
          ticks: {
            callback: (v) => formatMoneyShort(v)
          }
        }
      }
    }
  });
}

// Статусы заказов — doughnut
function initStatusChart(ordersByStatus) {
  const ctx = document.getElementById('chart-status');
  if (!ctx) return;

  const labels = {
    new: 'Новые',
    confirmed: 'Подтверждённые',
    baking: 'Готовятся',
    delivering: 'В доставке',
    done: 'Выполненные',
    cancelled: 'Отменённые'
  };

  const colors = {
    new: '#E0B878',
    confirmed: '#78A8D8',
    baking: '#E8A87C',
    delivering: '#78D8D8',
    done: '#6BBF87',
    cancelled: '#E07878'
  };

  const validData = ordersByStatus.filter(s => s.count > 0);

  if (validData.length === 0) {
    ctx.parentElement.innerHTML = '<div class="chart-empty">Пока нет заказов</div>';
    return;
  }

  dashboardState.charts.status?.destroy();

  dashboardState.charts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: validData.map(s => labels[s.status] || s.status),
      datasets: [{
        data: validData.map(s => s.count),
        backgroundColor: validData.map(s => colors[s.status] || '#A89888'),
        borderColor: '#1A1310',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 14,
            usePointStyle: true,
            pointStyle: 'circle',
            color: '#F5EDE4',
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#1A1310',
          borderColor: 'rgba(201, 169, 97, 0.3)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = Math.round((context.parsed / total) * 100);
              return `${context.label}: ${context.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// Категории — pie
function initCategoriesChart(salesByCategory) {
  const ctx = document.getElementById('chart-categories');
  if (!ctx) return;

  if (!salesByCategory || salesByCategory.length === 0) {
    ctx.parentElement.innerHTML = '<div class="chart-empty">Пока нет продаж</div>';
    return;
  }

  const palette = ['#E8A87C', '#C9A961', '#78A8D8', '#6BBF87', '#E0B878', '#E07878'];

  dashboardState.charts.categories?.destroy();

  dashboardState.charts.categories = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: salesByCategory.map(c => c.category),
      datasets: [{
        data: salesByCategory.map(c => c.revenue),
        backgroundColor: palette.slice(0, salesByCategory.length),
        borderColor: '#1A1310',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            color: '#F5EDE4',
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#1A1310',
          borderColor: 'rgba(201, 169, 97, 0.3)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => {
              const item = salesByCategory[context.dataIndex];
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = Math.round((context.parsed / total) * 100);
              return [
                `${context.label}: ${formatMoney(context.parsed)} ₽`,
                `${item.count} позиций (${pct}%)`
              ];
            }
          }
        }
      }
    }
  });
}

// ============================================================
// 8. Утилиты
// ============================================================
function formatMoney(n) {
  return Math.round(n).toLocaleString('ru-RU');
}

function formatMoneyShort(n) {
  n = Math.round(n);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'М';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'к';
  return n.toString();
}
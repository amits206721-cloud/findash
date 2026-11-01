import { store } from './store.js';
import { calculateSummary, getBudgetProgress, getCurrentMonthTransactions, getMonthlyTrends, spendingByCategory } from './finance.js';
import { renderCashFlowChart } from './charts.js';
import { isValidFinanceData } from './data-validation.js';

const app = document.querySelector('#app');
const desktop = globalThis.finDashDesktop;
const navItems = [
  ['dashboard', 'Overview', 'dashboard'],
  ['transactions', 'Transactions', 'transactions'],
  ['income', 'Income', 'income'],
  ['expenses', 'Expenses', 'expenses'],
  ['budget', 'Budget', 'budget'],
  ['analytics', 'Analytics', 'analytics'],
  ['reports', 'Reports', 'reports'],
  ['categories', 'Categories', 'categories'],
  ['goals', 'Financial goals', 'goals'],
  ['accounts', 'Accounts', 'accounts'],
  ['settings', 'Settings', 'settings']
];
const pageDetails = {
  dashboard: ['Overview', 'Your financial picture, at a glance.'],
  transactions: ['Transactions', 'Review and manage your complete ledger.'],
  income: ['Income', 'Track the money coming into your accounts.'],
  expenses: ['Expenses', 'Understand where your money is going.'],
  budget: ['Budget', 'Set monthly limits and stay in control.'],
  analytics: ['Analytics', 'Explore trends and category-level activity.'],
  reports: ['Reports', 'Review and export your local financial activity.'],
  categories: ['Categories', 'Organize how transactions are classified.'],
  goals: ['Financial goals', 'Build a plan for what matters to you.'],
  accounts: ['Accounts', 'Keep your account balances organized locally.'],
  settings: ['Settings', 'Personalize your FinDash experience.']
};
const pageFromPath = () => {
  const file = location.pathname.split('/').pop()?.toLowerCase();
  if (file === 'transactions.html') return 'transactions';
  if (file === 'cards.html') return 'accounts';
  if (file === 'settings.html') return 'settings';
  return 'dashboard';
};
const validPages = new Set(navItems.map(([page]) => page));
const initialRoute = location.hash.slice(1).split('?')[0];
let route = validPages.has(initialRoute) ? initialRoute : pageFromPath();
let sidebarOpen = false;
let dashboardCustomizationOpen = false;
let pendingConfirm = null;
let toastTimer;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const getSettings = () => store.getState().settings;
const currency = (value) => {
  const settings = getSettings();
  try {
    return new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
  } catch (error) {
    console.error('Unable to format the selected currency.', error);
    return `${settings.currency} ${(Number(value) || 0).toFixed(2)}`;
  }
};
const dateFormat = (value) => {
  if (!value) return '—';
  const settings = getSettings();
  const styles = { short: { month: 'numeric', day: 'numeric', year: '2-digit' }, medium: { month: 'short', day: 'numeric', year: 'numeric' }, long: { month: 'long', day: 'numeric', year: 'numeric' } };
  return new Intl.DateTimeFormat(settings.locale, styles[settings.dateFormat] || styles.medium).format(new Date(`${value}T12:00:00`));
};
const today = () => new Date().toISOString().slice(0, 10);
const transactionSignedAmount = (transaction) => `${transaction.type === 'income' ? '+' : '−'}${currency(transaction.amount)}`;
const categoryName = (categoryId) => store.getState().categories.find((category) => category.id === categoryId)?.name || 'Uncategorized';
const categoryOptions = (type, selected = '') => store.getState().categories
  .filter((category) => category.type === type)
  .map((category) => `<option value="${escapeHtml(category.id)}" ${category.id === selected ? 'selected' : ''}>${escapeHtml(category.name)}</option>`)
  .join('');
const navIcon = (name) => `<span class="nav-glyph" aria-hidden="true">${icon(name)}</span>`;
const icon = (name) => {
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    transactions: '<path d="M7 7h13m0 0-3-3m3 3-3 3M17 17H4m0 0 3-3m-3 3 3 3"/>',
    income: '<path d="M7 17 17 7M7 7h10v10"/>',
    expenses: '<path d="m7 7 10 10M17 7v10H7"/>',
    budget: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    analytics: '<path d="M4 19V5m0 14h17M7 15l4-4 3 2 6-7"/>',
    reports: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7m-7 4h7"/>',
    categories: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="16" r="3"/><path d="m15 5 4 4M5 15l4 4"/>',
    goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    accounts: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 2Z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    plus: '<path d="M12 5v14m-7-7h14"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/>',
    minus: '<path d="M5 12h14"/>',
    maximize: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
    restore: '<rect x="8" y="5" width="11" height="11" rx="1"/><path d="M16 19H5V8"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};

function showToast(message, isError = false) {
  const region = document.querySelector('#toast-region');
  if (!region) return;
  region.replaceChildren();
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' error' : ''}`;
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.textContent = message;
  region.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 3400);
}

function setupDesktopTitlebar() {
  if (!desktop) return;
  document.body.classList.add('desktop-app');
  const titlebar = document.createElement('header');
  titlebar.className = 'desktop-titlebar';
  titlebar.innerHTML = `<span class="desktop-titlebar__brand"><span class="desktop-titlebar__mark">F</span>FinDash</span>
    <div class="desktop-titlebar__controls">
      <button type="button" class="window-control" data-window-action="minimize" aria-label="Minimize">${icon('minus')}</button>
      <button type="button" class="window-control" data-window-action="maximize" aria-label="Maximize" id="window-maximize">${icon('maximize')}</button>
      <button type="button" class="window-control window-control--close" data-window-action="close" aria-label="Close">${icon('close')}</button>
    </div>`;
  document.body.insertBefore(titlebar, app);
  titlebar.addEventListener('click', (event) => {
    const control = event.target.closest('[data-window-action]');
    if (!control) return;
    const actions = {
      minimize: desktop.window.minimize,
      maximize: desktop.window.toggleMaximize,
      close: desktop.window.close
    };
    Promise.resolve(actions[control.dataset.windowAction]()).catch((error) => {
      console.error('Unable to control the application window.', error);
      showToast(error.message || 'The window action failed.', true);
    });
  });
  desktop.window.onMaximizedChanged((isMaximized) => {
    const maximizeButton = titlebar.querySelector('#window-maximize');
    if (!maximizeButton) return;
    maximizeButton.setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
    maximizeButton.innerHTML = icon(isMaximized ? 'restore' : 'maximize');
  });
}

function routeTo(nextRoute) {
  if (!validPages.has(nextRoute)) return;
  if (nextRoute !== 'dashboard') dashboardCustomizationOpen = false;
  route = nextRoute;
  if (location.hash !== `#${nextRoute}`) history.pushState(null, '', `./index.html#${nextRoute}`);
  closeSidebar();
  render();
}

function closeSidebar() {
  sidebarOpen = false;
  document.body.classList.remove('sidebar-open');
  const sidebar = document.querySelector('#sidebar');
  const backdrop = document.querySelector('#sidebar-backdrop');
  sidebar?.classList.remove('is-open');
  backdrop?.classList.remove('is-visible');
  document.querySelector('#menu-toggle')?.setAttribute('aria-expanded', 'false');
  document.querySelector('#menu-toggle')?.setAttribute('aria-label', 'Open navigation');
  sidebar?.setAttribute('aria-hidden', 'true');
  if (sidebar) sidebar.inert = true;
  if (backdrop) backdrop.tabIndex = -1;
}

function toggleSidebar() {
  if (sidebarOpen) {
    closeSidebar();
    return;
  }
  sidebarOpen = true;
  document.body.classList.add('sidebar-open');
  const sidebar = document.querySelector('#sidebar');
  const backdrop = document.querySelector('#sidebar-backdrop');
  sidebar?.classList.add('is-open');
  backdrop?.classList.add('is-visible');
  document.querySelector('#menu-toggle')?.setAttribute('aria-expanded', 'true');
  document.querySelector('#menu-toggle')?.setAttribute('aria-label', 'Close navigation');
  sidebar?.setAttribute('aria-hidden', 'false');
  if (sidebar) sidebar.inert = false;
  if (backdrop) backdrop.tabIndex = 0;
}

function metricCard(label, value, note, glyph, modifier = '') {
  return `<article class="metric-card"><div class="metric-top"><span class="metric-label">${label}</span><span class="metric-icon">${glyph}</span></div><strong class="metric-value ${modifier}">${value}</strong><span class="metric-foot">${note}</span></article>`;
}

function transactionTable(transactions, { showActions = true, compact = false } = {}) {
  if (!transactions.length) return `<tr><td class="empty-state" colspan="${compact ? 4 : showActions ? 6 : 5}">No transactions match these filters.</td></tr>`;
  return transactions.map((transaction) => {
    const category = store.getState().categories.find((item) => item.id === transaction.categoryId);
    const statusClass = transaction.status === 'completed' ? 'badge--success' : transaction.status === 'pending' ? 'badge--warning' : 'badge--danger';
    const actions = showActions ? `<td><div class="row-actions"><button class="icon-button" data-action="edit-transaction" data-id="${escapeHtml(transaction.id)}" aria-label="Edit transaction">${icon('edit')}</button><button class="icon-button" data-action="delete-transaction" data-id="${escapeHtml(transaction.id)}" aria-label="Delete transaction">${icon('trash')}</button></div></td>` : '';
    return `<tr>
      ${compact ? '' : `<td><span class="secondary-text">${escapeHtml(transaction.id)}</span></td>`}
      <td><div class="merchant-cell"><span class="merchant-icon">${escapeHtml(transaction.merchant.trim().charAt(0).toUpperCase() || '?')}</span><span class="merchant-name">${escapeHtml(transaction.merchant)}<span class="secondary-text">${escapeHtml(category?.name || 'Uncategorized')}</span></span></div></td>
      <td>${dateFormat(transaction.date)}</td><td><span class="badge ${statusClass}">${escapeHtml(transaction.status)}</span></td>
      <td class="align-right tx-amount ${transaction.type === 'income' ? 'positive' : ''}">${transactionSignedAmount(transaction)}</td>${actions}
    </tr>`;
  }).join('');
}

function transactionWidget(transactions, { showActions = true, compact = false, title = 'Transactions', id = 'transactions-table' } = {}) {
  const columns = compact ? ['Description', 'Date', 'Status', 'Amount'] : ['Reference', 'Description', 'Date', 'Status', 'Amount', ...(showActions ? [''] : [])];
  return `<section class="card"><div class="widget-header"><h2>${title}</h2><span class="text-muted" id="transaction-count">${transactions.length} ${transactions.length === 1 ? 'record' : 'records'}</span></div><div class="table-responsive"><table class="data-table"><thead><tr>${columns.map((column, index) => `<th class="${index === (compact ? 3 : 4) ? 'align-right' : ''}">${column}</th>`).join('')}</tr></thead><tbody id="${id}">${transactionTable(transactions, { showActions, compact })}</tbody></table></div></section>`;
}

function filterTransactions(transactions, filters = {}) {
  const search = (filters.search || '').trim().toLowerCase();
  const from = filters.from || '';
  const to = filters.to || '';
  return transactions.filter((transaction) => {
    const category = categoryName(transaction.categoryId).toLowerCase();
    const matchSearch = !search || [transaction.merchant, transaction.id, category, transaction.note].some((value) => String(value || '').toLowerCase().includes(search));
    return matchSearch
      && (!filters.type || filters.type === 'all' || transaction.type === filters.type)
      && (!filters.status || filters.status === 'all' || transaction.status === filters.status)
      && (!filters.category || filters.category === 'all' || transaction.categoryId === filters.category)
      && (!from || transaction.date >= from)
      && (!to || transaction.date <= to);
  }).sort((a, b) => {
    if (filters.sort === 'oldest') return a.date.localeCompare(b.date);
    if (filters.sort === 'highest') return b.amount - a.amount;
    if (filters.sort === 'lowest') return a.amount - b.amount;
    return b.date.localeCompare(a.date);
  });
}

function dashboardPage() {
  const state = store.getState();
  const summary = calculateSummary(state);
  const spendCategories = spendingByCategory(state).slice(0, 5);
  const recent = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const budgets = getBudgetProgress(state).slice(0, 4);
  const goals = state.goals.slice(0, 2);
  const totalSpend = spendCategories.reduce((sum, item) => sum + item.amount, 0);
  const savings = summary.totalIncome ? Math.round((summary.net / summary.totalIncome) * 100) : 0;
  const monthLabel = new Intl.DateTimeFormat(getSettings().locale, { month: 'long', year: 'numeric' }).format(new Date());
  const widgets = {
    cashFlow: getSettings().dashboardWidgets?.cashFlow !== false,
    spending: getSettings().dashboardWidgets?.spending !== false,
    budgets: getSettings().dashboardWidgets?.budgets !== false,
    goals: getSettings().dashboardWidgets?.goals !== false,
    activity: getSettings().dashboardWidgets?.activity !== false
  };
  const overviewPanels = [
    widgets.cashFlow ? `<article class="card"><div class="widget-header"><div><h2>Cash flow</h2><span class="secondary-text">${monthLabel} · Income compared with expenses</span></div><div class="chart-legend"><span class="legend-item"><i class="legend-dot"></i>Income</span><span class="legend-item"><i class="legend-dot expense"></i>Expenses</span></div></div><div class="chart-wrap" id="cash-flow-chart"></div></article>` : '',
    widgets.spending ? `<article class="card"><div class="widget-header"><h2>Spending breakdown</h2><a class="link" href="./index.html#expenses" data-route="expenses">View details</a></div><div class="widget-body">${spendCategories.length ? spendCategories.map((item) => `<div class="budget-item"><div class="budget-line"><span class="budget-title"><i class="category-mark" style="background:${escapeHtml(item.color)}"></i>${escapeHtml(item.name)}</span><strong>${currency(item.amount)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, totalSpend ? (item.amount / totalSpend) * 100 : 0)}%;background:${escapeHtml(item.color)}"></div></div></div>`).join('') : '<p class="empty-state">Your spending categories will appear here.</p>'}</div></article>` : ''
  ].filter(Boolean);
  const supportPanels = [
    widgets.budgets ? `<article class="card"><div class="widget-header"><div><h2>Budget progress</h2><span class="secondary-text">This month’s category limits</span></div><a class="link" href="./index.html#budget" data-route="budget">Manage</a></div><div class="widget-body">${budgets.length ? budgets.map((budget) => {
      const percent = Math.round(budget.utilization * 100);
      const stateClass = percent >= 100 ? 'danger' : percent >= 80 ? 'warning' : '';
      return `<div class="budget-item"><div class="budget-line"><span class="budget-title"><i class="category-mark" style="background:${escapeHtml(budget.category?.color || '#9aa1b5')}"></i>${escapeHtml(budget.category?.name || 'Deleted category')}</span><span class="budget-meta">${currency(budget.spent)} / ${currency(budget.limit)}</span></div><div class="progress-track"><div class="progress-fill ${stateClass}" style="width:${Math.min(100, percent)}%"></div></div></div>`;
    }).join('') : '<p class="empty-state">Create a monthly budget to keep spending on track.</p>'}</div></article>` : '',
    widgets.goals ? `<article class="card"><div class="widget-header"><div><h2>Savings goals</h2><span class="secondary-text">Keep moving toward what matters</span></div><a class="link" href="./index.html#goals" data-route="goals">View all</a></div><div class="widget-body">${goals.length ? goals.map((goal) => {
      const percent = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
      return `<div class="goal-preview"><div class="budget-line"><span class="budget-title">${escapeHtml(goal.name)}</span><span class="budget-meta">${percent}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><div class="budget-line budget-meta"><span>${currency(goal.saved)} saved</span><span>${currency(goal.target)} target</span></div></div>`;
    }).join('') : '<p class="empty-state">Add a savings goal to start tracking progress.</p>'}</div></article>` : ''
  ].filter(Boolean);
  return `<section class="overview-hero">
    <div class="overview-hero__content"><span class="eyebrow">TOTAL BALANCE</span><strong class="overview-hero__balance">${currency(summary.balance)}</strong><span class="overview-hero__note"><span class="status-pulse"></span> Across ${state.accounts.length} local ${state.accounts.length === 1 ? 'account' : 'accounts'}</span><div class="overview-hero__actions"><button class="btn btn--light" data-action="new-transaction" data-type="expense">${icon('plus')} Add expense</button><a class="hero-link" href="./index.html#reports" data-route="reports">View reports <span aria-hidden="true">↗</span></a></div></div>
    <div class="overview-hero__side"><span class="eyebrow">SAVINGS RATE</span><strong>${savings}%</strong><span class="overview-hero__note">${monthLabel}</span><div class="hero-sparkline" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
  </section>
  <div class="dashboard-toolbar"><span class="text-muted">Your overview, your way</span><button class="btn btn--secondary" data-action="toggle-dashboard-customizer" aria-expanded="${dashboardCustomizationOpen}" aria-controls="dashboard-customizer">${icon('settings')} Customize</button><div class="dashboard-customizer ${dashboardCustomizationOpen ? 'is-open' : ''}" id="dashboard-customizer" ${dashboardCustomizationOpen ? '' : 'hidden'}><p class="search-section-label">Show on overview</p>${[['cashFlow', 'Cash flow'], ['spending', 'Spending breakdown'], ['budgets', 'Budget progress'], ['goals', 'Savings goals'], ['activity', 'Recent activity']].map(([key, label]) => `<label><input type="checkbox" data-dashboard-widget="${key}" ${widgets[key] ? 'checked' : ''}>${label}</label>`).join('')}</div></div>
  <section class="metrics-row">
    ${metricCard('Income this month', currency(summary.totalIncome), 'Completed income transactions', icon('plus'), 'positive')}
    ${metricCard('Expenses this month', currency(summary.totalExpenses), 'Completed spending transactions', icon('close'))}
    ${metricCard('Net cash flow', currency(summary.net), `${savings}% savings rate this month`, icon('download'), summary.net >= 0 ? 'positive' : 'negative')}
  </section>
  ${overviewPanels.length ? `<section class="content-row ${overviewPanels.length === 1 ? 'content-row--single' : ''}">${overviewPanels.join('')}</section>` : ''}
  ${supportPanels.length ? `<section class="split-row dashboard-support ${supportPanels.length === 1 ? 'split-row--single' : ''}">${supportPanels.join('')}</section>` : ''}
  ${widgets.activity ? transactionWidget(recent, { compact: true, showActions: false, title: 'Recent activity', id: 'recent-activity' }) : ''}`;
}

function transactionsPage() {
  const state = store.getState();
  const rows = filterTransactions(state.transactions, { sort: 'newest' });
  return `<section class="card"><div class="filter-bar">
    <input id="tx-search" class="text-input" type="search" placeholder="Search merchant, category or ID" aria-label="Search transactions">
    <select id="tx-type" class="select-input" aria-label="Filter by transaction type"><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select>
    <select id="tx-status" class="select-input" aria-label="Filter by status"><option value="all">All statuses</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option></select>
    <select id="tx-category" class="select-input" aria-label="Filter by category"><option value="all">All categories</option>${state.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('')}</select>
    <input id="tx-from" class="text-input" type="date" aria-label="From date">
    <input id="tx-to" class="text-input" type="date" aria-label="To date">
    <select id="tx-sort" class="select-input" aria-label="Sort transactions"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Amount: high to low</option><option value="lowest">Amount: low to high</option></select>
  </div></section>
  <div class="toolbar"><span class="text-muted" id="transaction-results">${rows.length} transactions</span><button class="btn" data-action="new-transaction">${icon('plus')} Add transaction</button></div>
  ${transactionWidget(rows, { title: 'All transactions', id: 'transactions-table' })}`;
}

function filteredLedgerPage(type) {
  const state = store.getState();
  const selected = state.transactions.filter((transaction) => transaction.type === type).sort((a, b) => b.date.localeCompare(a.date));
  const currentMonth = getCurrentMonthTransactions(state.transactions).filter((tx) => tx.type === type && tx.status !== 'failed').reduce((sum, tx) => sum + tx.amount, 0);
  const categories = type === 'income'
    ? state.categories.filter((category) => category.type === 'income').map((category) => ({
      ...category,
      amount: selected.filter((tx) => tx.categoryId === category.id && tx.status !== 'failed').reduce((sum, tx) => sum + tx.amount, 0)
    })).filter((category) => category.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 8)
    : spendingByCategory(state, selected).slice(0, 8);
  return `<section class="metrics-row">${metricCard(type === 'income' ? 'Income this month' : 'Expenses this month', currency(currentMonth), `${selected.length} total records`, icon(type === 'income' ? 'plus' : 'close'), type === 'income' ? 'positive' : '')}</section>
    <section class="split-row"><article class="card"><div class="widget-header"><h2>${type === 'income' ? 'Income sources' : 'Spending categories'}</h2></div><div class="widget-body">${categories.length ? categories.map((item) => `<div class="budget-item"><div class="budget-line"><span class="budget-title"><i class="category-mark" style="background:${escapeHtml(item.color)}"></i>${escapeHtml(item.name)}</span><strong>${currency(item.amount)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, (item.amount / Math.max(...categories.map((row) => row.amount))) * 100)}%;background:${escapeHtml(item.color)}"></div></div></div>`).join('') : '<p class="empty-state">Add transactions to see a breakdown here.</p>'}</div></article><article class="card"><div class="widget-header"><h2>Quick insight</h2></div><div class="widget-body"><div class="summary-callout">${type === 'income' ? 'Income totals are calculated from completed transactions dated in the current month.' : 'Expense totals exclude failed transactions and use your current month activity.'} Your records are stored only on this device.</div><p class="text-muted" style="margin-top:1rem;font-size:.8rem">Current month total: <strong>${currency(currentMonth)}</strong></p><button class="btn" style="margin-top:1rem" data-action="new-transaction" data-type="${type}">${icon('plus')} Add ${type}</button></div></article></section>
    ${transactionWidget(selected, { title: type === 'income' ? 'Income transactions' : 'Expense transactions', id: `${type}-table` })}`;
}

function budgetPage() {
  const budgets = getBudgetProgress(store.getState());
  const reachedCount = budgets.filter((budget) => budget.utilization >= 1).length;
  return `<div class="toolbar"><p class="text-muted">Monthly spending limits based on your completed transactions.</p><button class="btn" data-action="new-budget">${icon('plus')} Create budget</button></div>
    <section class="split-row"><article class="card"><div class="widget-header"><h2>Your monthly budgets</h2><span class="text-muted">${budgets.length} budgets</span></div><div class="widget-body">${budgets.length ? budgets.map((budget) => {
      const percent = budget.limit ? Math.round(budget.utilization * 100) : 0;
      const stateClass = percent >= 100 ? 'danger' : percent >= 80 ? 'warning' : '';
      const warning = percent >= 100 ? 'Limit reached' : percent >= 80 ? 'Approaching limit' : `${currency(budget.remaining)} remaining`;
      const sliderMax = Math.max(5000, Math.ceil(budget.limit * 2 / 100) * 100);
      return `<div class="budget-item"><div class="budget-line"><span class="budget-title"><i class="category-mark" style="background:${escapeHtml(budget.category?.color || '#9aa1b5')}"></i>${escapeHtml(budget.category?.name || 'Deleted category')}</span><span class="row-actions"><button class="icon-button" data-action="edit-budget" data-id="${escapeHtml(budget.id)}" aria-label="Edit budget">${icon('edit')}</button><button class="icon-button" data-action="delete-budget" data-id="${escapeHtml(budget.id)}" aria-label="Delete budget">${icon('trash')}</button></span></div><div class="budget-line budget-meta"><span>${currency(budget.spent)} of <output data-slider-output="budget-${escapeHtml(budget.id)}">${currency(budget.limit)}</output></span><span class="${stateClass === 'danger' ? 'negative' : stateClass === 'warning' ? '' : ''}">${percent}% · ${warning}</span></div><div class="progress-track"><div class="progress-fill ${stateClass}" style="width:${Math.min(100, percent)}%"></div></div><label class="range-control"><span class="sr-only">Monthly ${escapeHtml(budget.category?.name || 'category')} budget limit</span><input type="range" min="50" max="${sliderMax}" step="25" value="${budget.limit}" data-finance-slider="budget" data-id="${escapeHtml(budget.id)}" data-spent="${budget.spent}" aria-label="${escapeHtml(budget.category?.name || 'Category')} monthly budget limit" title="Drag to adjust monthly limit"><span class="range-scale"><span>${currency(50)}</span><span>${currency(sliderMax)}</span></span></label></div>`;
    }).join('') : '<div class="empty-state">No budgets yet. Create one to set your first monthly limit.</div>'}</div></article>
    <article class="card"><div class="widget-header"><h2>Budget overview</h2></div><div class="widget-body"><p class="text-muted" style="font-size:.82rem">Budget utilization compares this month’s completed category expenses against each limit. Pending and failed transactions are excluded.</p>${budgets.length ? `<div class="summary-callout" style="margin-top:1rem">${reachedCount ? `${reachedCount} budget${reachedCount === 1 ? '' : 's'} at or above the limit.` : 'All tracked categories are currently within their limits.'}</div>` : ''}</div></article></section>`;
}

function rangeTransactions(transactions, range) {
  if (range === 'all') return transactions;
  const days = Number(range);
  if (!days) return transactions;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days + 1);
  return transactions.filter((transaction) => new Date(`${transaction.date}T12:00:00`) >= cutoff);
}

function analyticsPage() {
  const state = store.getState();
  const period = new URLSearchParams(location.hash.split('?')[1] || '').get('range') || '180';
  const txs = rangeTransactions(state.transactions, period);
  const series = getMonthlyTrends({ ...state, transactions: txs }, period === 'all' ? 12 : Math.min(12, Math.max(1, Math.ceil(Number(period) / 30))));
  const categories = spendingByCategory(state, txs).slice(0, 8);
  const income = txs.filter((tx) => tx.type === 'income' && tx.status !== 'failed').reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = txs.filter((tx) => tx.type === 'expense' && tx.status !== 'failed').reduce((sum, tx) => sum + tx.amount, 0);
  return `<div class="toolbar"><p class="text-muted">Activity based on your saved transaction history.</p><div class="analytics-range"><label for="analytics-range">Look back <output id="analytics-range-value">${period === 'all' ? 'All activity' : `${period} days`}</output></label><input id="analytics-range" type="range" min="30" max="360" step="30" value="${period === 'all' ? 360 : Math.min(360, Number(period))}" aria-label="Analytics date range"></div></div>
    <section class="metrics-row">${metricCard('Income in range', currency(income), 'Completed income', icon('plus'), 'positive')}${metricCard('Expenses in range', currency(expenses), 'Completed expenses', icon('close'))}${metricCard('Net cash flow', currency(income - expenses), 'Income minus expenses', icon('download'), income >= expenses ? 'positive' : 'negative')}</section>
    <section class="content-row"><article class="card"><div class="widget-header"><div><h2>Monthly cash flow</h2><span class="secondary-text">Income and expenses over time</span></div><div class="chart-legend"><span class="legend-item"><i class="legend-dot"></i>Income</span><span class="legend-item"><i class="legend-dot expense"></i>Expenses</span></div></div><div class="chart-wrap" id="analytics-chart"></div></article><article class="card"><div class="widget-header"><h2>Category comparison</h2></div><div class="widget-body">${categories.length ? categories.map((item) => `<div class="budget-item"><div class="budget-line"><span class="budget-title"><i class="category-mark" style="background:${escapeHtml(item.color)}"></i>${escapeHtml(item.name)}</span><strong>${currency(item.amount)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, item.amount / Math.max(...categories.map((row) => row.amount)) * 100)}%;background:${escapeHtml(item.color)}"></div></div></div>`).join('') : '<p class="empty-state">No expenses in this date range.</p>'}</div></article></section>`;
}

function reportPage() {
  const state = store.getState();
  const transactions = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date));
  const summary = calculateSummary(state);
  const income = transactions.filter((tx) => tx.type === 'income' && tx.status !== 'failed').reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = transactions.filter((tx) => tx.type === 'expense' && tx.status !== 'failed').reduce((sum, tx) => sum + tx.amount, 0);
  return `<section class="metrics-row">${metricCard('All-time income', currency(income), 'Completed records', icon('plus'), 'positive')}${metricCard('All-time expenses', currency(expenses), 'Completed records', icon('close'))}${metricCard('Current balance', currency(summary.balance), 'Across local accounts', icon('sun'))}</section>
    <section class="card"><div class="widget-header"><div><h2>Export your activity</h2><span class="secondary-text">Save a CSV or PDF report containing your local transaction records.</span></div><div class="toolbar-actions"><button class="btn btn--secondary" data-action="export-pdf">${icon('download')} Export PDF</button><button class="btn" data-action="export-csv">${icon('download')} Export CSV</button></div></div><div class="widget-body"><p class="text-muted" style="font-size:.83rem">Reports are created locally and are not sent to a server.</p></div></section>
    ${transactionWidget(transactions.slice(0, 10), { title: 'Latest activity', showActions: false, id: 'report-transactions' })}`;
}

function categoriesPage() {
  const state = store.getState();
  const usage = new Map(state.transactions.map((transaction) => [transaction.categoryId, (state.transactions.filter((item) => item.categoryId === transaction.categoryId).length)]));
  return `<div class="toolbar"><p class="text-muted">Categories are shared across transactions, budgets, and analytics.</p><button class="btn" data-action="new-category">${icon('plus')} Add category</button></div><section class="card"><div class="widget-header"><h2>All categories</h2><span class="text-muted">${state.categories.length} categories</span></div><div class="widget-body"><div class="category-list">${state.categories.map((category) => `<article class="category-card"><div><div class="category-name"><i class="category-mark" style="background:${escapeHtml(category.color)}"></i>${escapeHtml(category.name)}</div><span class="secondary-text">${category.type === 'income' ? 'Income' : 'Expense'} · ${usage.get(category.id) || 0} transactions</span></div><button class="icon-button" data-action="delete-category" data-id="${escapeHtml(category.id)}" aria-label="Delete ${escapeHtml(category.name)} category">${icon('trash')}</button></article>`).join('')}</div></div></section>`;
}

function goalsPage() {
  const goals = store.getState().goals;
  return `<div class="toolbar"><p class="text-muted">Track progress toward personal savings targets.</p><button class="btn" data-action="new-goal">${icon('plus')} Add a goal</button></div><section class="split-row">${goals.length ? goals.map((goal) => {
    const percent = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
    const sliderMax = Math.max(goal.target * 1.5, goal.saved, 1);
    return `<article class="goal-card"><div class="budget-line"><div><h2>${escapeHtml(goal.name)}</h2><span class="secondary-text">Target date ${dateFormat(goal.targetDate)}</span></div><div class="row-actions"><button class="icon-button" data-action="edit-goal" data-id="${escapeHtml(goal.id)}" aria-label="Edit ${escapeHtml(goal.name)}">${icon('edit')}</button><button class="icon-button" data-action="delete-goal" data-id="${escapeHtml(goal.id)}" aria-label="Delete ${escapeHtml(goal.name)}">${icon('trash')}</button></div></div><div class="budget-line goal-amount-line"><strong><output data-slider-output="goal-${escapeHtml(goal.id)}">${currency(goal.saved)}</output> saved</strong><span class="text-muted">${currency(goal.target)} goal</span></div><label class="range-control"><span class="sr-only">Amount saved toward ${escapeHtml(goal.name)}</span><input type="range" min="0" max="${sliderMax}" step="${Math.max(.01, Math.round(sliderMax / 200 * 100) / 100)}" value="${goal.saved}" data-finance-slider="goal" data-id="${escapeHtml(goal.id)}" data-target="${goal.target}" aria-label="Saved amount for ${escapeHtml(goal.name)}" title="Drag to update savings"><span class="range-scale"><span>${currency(0)}</span><span>${currency(sliderMax)}</span></span></label><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><span class="secondary-text goal-progress-note">${percent}% complete · ${currency(Math.max(0, goal.target - goal.saved))} to go</span></article>`;
  }).join('') : '<article class="card empty-state">Create a savings goal to start tracking your progress.</article>'}</section>`;
}

function accountsPage() {
  const state = store.getState();
  const summary = calculateSummary(state);
  const accounts = state.accounts.map((account) => {
    const relevant = state.transactions.filter((tx) => tx.accountId === account.id || (!tx.accountId && account.id === state.accounts[0]?.id));
    const balance = account.openingBalance + relevant.reduce((sum, tx) => tx.status === 'failed' ? sum : sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
    return { ...account, balance };
  });
  return `<div class="toolbar"><p class="text-muted">Local account tracking only — no bank connection or card services.</p><button class="btn" data-action="new-account">${icon('plus')} Add account</button></div>
    <section class="metrics-row">${metricCard('Total account balance', currency(summary.balance), 'Calculated from opening balances and transactions', icon('sun'))}</section>
    <section class="split-row">${accounts.map((account) => `<article class="account-card"><div class="budget-line"><span class="badge badge--neutral">${escapeHtml(account.type)}</span><button class="icon-button" data-action="delete-account" data-id="${escapeHtml(account.id)}" aria-label="Remove ${escapeHtml(account.name)}">${icon('trash')}</button></div><h3>${escapeHtml(account.name)}</h3><strong class="metric-value">${currency(account.balance)}</strong><span class="secondary-text">Balance is calculated from your transaction ledger.</span></article>`).join('')}</section>`;
}

function settingsPage() {
  const settings = getSettings();
  return `<section class="card"><div class="widget-header"><div><h2>Preferences</h2><span class="secondary-text">These settings are saved on this device.</span></div></div><div class="widget-body settings-list">
    <div class="settings-row"><div><h3>Appearance</h3><p>Choose the visual theme for this application.</p></div><select class="select-input" data-setting="theme"><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option></select></div>
    <div class="settings-row"><div><h3>Currency</h3><p>Used to display balances and transaction amounts.</p></div><select class="select-input" data-setting="currency"><option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD — US Dollar</option><option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR — Euro</option><option value="GBP" ${settings.currency === 'GBP' ? 'selected' : ''}>GBP — British Pound</option><option value="INR" ${settings.currency === 'INR' ? 'selected' : ''}>INR — Indian Rupee</option><option value="CAD" ${settings.currency === 'CAD' ? 'selected' : ''}>CAD — Canadian Dollar</option></select></div>
    <div class="settings-row"><div><h3>Number and date locale</h3><p>Controls number grouping and localized dates.</p></div><select class="select-input" data-setting="locale"><option value="en-US" ${settings.locale === 'en-US' ? 'selected' : ''}>English (United States)</option><option value="en-GB" ${settings.locale === 'en-GB' ? 'selected' : ''}>English (United Kingdom)</option><option value="en-IN" ${settings.locale === 'en-IN' ? 'selected' : ''}>English (India)</option></select></div>
    <div class="settings-row"><div><h3>Date format</h3><p>Pick a compact or more descriptive date format.</p></div><select class="select-input" data-setting="dateFormat"><option value="short" ${settings.dateFormat === 'short' ? 'selected' : ''}>Short</option><option value="medium" ${settings.dateFormat === 'medium' ? 'selected' : ''}>Medium</option><option value="long" ${settings.dateFormat === 'long' ? 'selected' : ''}>Long</option></select></div>
  </div></section>
  <section class="card"><div class="widget-header"><div><h2>Local data</h2><span class="secondary-text">Your financial information is stored on this device, not in the cloud.</span></div></div><div class="widget-body"><p class="text-muted">Create a backup or restore a previous backup. Backup files contain your financial records; keep them somewhere private.</p><div class="toolbar-actions" style="margin-top:1rem"><button class="btn btn--secondary" data-action="export-backup">${icon('download')} Back up data</button><button class="btn btn--secondary" data-action="import-backup">Restore from backup</button><button class="btn btn--danger" data-action="reset-data">Restore sample data</button></div></div></section>`;
}

function renderPageContent() {
  switch (route) {
    case 'transactions': return transactionsPage();
    case 'income': return filteredLedgerPage('income');
    case 'expenses': return filteredLedgerPage('expense');
    case 'budget': return budgetPage();
    case 'analytics': return analyticsPage();
    case 'reports': return reportPage();
    case 'categories': return categoriesPage();
    case 'goals': return goalsPage();
    case 'accounts': return accountsPage();
    case 'settings': return settingsPage();
    default: return dashboardPage();
  }
}

function render() {
  if (!app) return;
  const [title, subtitle] = pageDetails[route] || pageDetails.dashboard;
  const theme = getSettings().theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.title = `${title} — FinDash`;
  app.innerHTML = `<div class="app-layout">
    <button class="sidebar-backdrop ${sidebarOpen ? 'is-visible' : ''}" id="sidebar-backdrop" aria-label="Close navigation" tabindex="${sidebarOpen ? '0' : '-1'}"></button>
    <aside class="sidebar ${sidebarOpen ? 'is-open' : ''}" id="sidebar" aria-hidden="${!sidebarOpen}" ${sidebarOpen ? '' : 'inert'}>
      <a class="sidebar__brand" href="./index.html#dashboard" data-route="dashboard"><span class="brand-logo">${icon('sun')}</span><h2>FinDash</h2></a>
      <nav class="sidebar__nav" aria-label="Main navigation"><p class="nav-label">Workspace</p>${navItems.slice(0, 6).map(([key, label, glyph]) => `<a class="nav-item ${key === route ? 'active' : ''}" href="./index.html#${key}" data-route="${key}">${navIcon(glyph)}<span>${label}</span></a>`).join('')}<p class="nav-label">Manage</p>${navItems.slice(6).map(([key, label, glyph]) => `<a class="nav-item ${key === route ? 'active' : ''}" href="./index.html#${key}" data-route="${key}">${navIcon(glyph)}<span>${label}</span></a>`).join('')}</nav>
      <div class="nav-spacer"></div><p class="sidebar__footer">Private by design · Data stays on this device</p>
    </aside>
    <main class="main-content">
      <header class="top-header"><div class="header__left"><button class="btn btn--icon menu-toggle" id="menu-toggle" aria-label="${sidebarOpen ? 'Close navigation' : 'Open navigation'}" aria-expanded="${sidebarOpen}" aria-controls="sidebar">${icon('menu')}</button><div><h1 class="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p></div></div>
        <div class="header__right"><label class="global-search-wrap"><span class="global-search-icon">${icon('search')}</span><input id="global-search" class="global-search" type="search" placeholder="Search or jump to…" aria-label="Search transactions or pages" autocomplete="off"><kbd>Ctrl K</kbd><div class="global-search-results" id="global-search-results" role="listbox" aria-label="Search results"></div></label><button class="btn btn--icon" id="theme-toggle" aria-label="Toggle color theme">${icon(theme === 'dark' ? 'sun' : 'moon')}</button>${['dashboard', 'transactions', 'income', 'expenses'].includes(route) ? `<button class="btn" data-action="new-transaction">${icon('plus')}<span class="desktop-label">Add transaction</span></button>` : ''}</div>
      </header><div class="dashboard-grid" id="page-content">${renderPageContent()}</div>
    </main>
  </div><div id="modal-root"></div><div class="toast-region" id="toast-region" aria-live="polite"></div>`;
  if (route === 'dashboard') renderCashFlowChart(document.querySelector('#cash-flow-chart'), getMonthlyTrends(store.getState()), currency);
  if (route === 'analytics') {
    const period = new URLSearchParams(location.hash.split('?')[1] || '').get('range') || '180';
    const txs = rangeTransactions(store.getState().transactions, period);
    renderCashFlowChart(document.querySelector('#analytics-chart'), getMonthlyTrends({ ...store.getState(), transactions: txs }, period === 'all' ? 12 : Math.min(12, Math.max(1, Math.ceil(Number(period) / 30)))), currency);
  }
  document.querySelectorAll('input[type="range"]').forEach(updateRangeAppearance);
}

function renderGlobalSearch(query) {
  const panel = document.querySelector('#global-search-results');
  if (!panel) return;
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    panel.replaceChildren();
    panel.classList.remove('is-open');
    return;
  }
  const pageMatches = navItems.filter(([key, label]) => `${label} ${key}`.toLowerCase().includes(normalized)).slice(0, 4);
  const transactionMatches = store.getState().transactions.filter((transaction) => {
    const category = categoryName(transaction.categoryId);
    return [transaction.merchant, transaction.id, category, transaction.note].some((value) => String(value || '').toLowerCase().includes(normalized));
  }).slice(0, 5);
  const pageResults = pageMatches.map(([key, label, glyph]) => `<button class="search-result" type="button" role="option" data-route="${key}">${navIcon(glyph)}<span>${escapeHtml(label)}</span><kbd>Page</kbd></button>`).join('');
  const transactionResults = transactionMatches.map((transaction) => `<button class="search-result" type="button" role="option" data-action="search-transaction" data-id="${escapeHtml(transaction.id)}"><span class="merchant-icon">${escapeHtml(transaction.merchant.trim().charAt(0).toUpperCase() || '?')}</span><span class="search-result__detail">${escapeHtml(transaction.merchant)}<small>${escapeHtml(categoryName(transaction.categoryId))} · ${dateFormat(transaction.date)}</small></span><strong>${transactionSignedAmount(transaction)}</strong></button>`).join('');
  panel.innerHTML = pageResults || transactionResults
    ? `${pageResults ? `<span class="search-section-label">Pages</span>${pageResults}` : ''}${transactionResults ? `<span class="search-section-label">Transactions</span>${transactionResults}` : ''}`
    : '<p class="search-empty">No matches found</p>';
  panel.classList.add('is-open');
}

function updateRangeAppearance(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value) || 0;
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
  input.style.setProperty('--range-progress', `${progress}%`);
}

function updateFinanceSlider(input) {
  const kind = input.dataset.financeSlider;
  const value = Number(input.value);
  const output = document.querySelector(`[data-slider-output="${kind}-${CSS.escape(input.dataset.id)}"]`);
  if (output) output.textContent = currency(value);
  updateRangeAppearance(input);
  if (kind === 'budget') {
    const item = input.closest('.budget-item');
    const spent = Number(input.dataset.spent);
    const percent = value > 0 ? Math.round((spent / value) * 100) : 0;
    const fill = item?.querySelector('.progress-fill');
    if (fill) {
      fill.style.width = `${Math.min(100, percent)}%`;
      fill.classList.toggle('danger', percent >= 100);
      fill.classList.toggle('warning', percent >= 80 && percent < 100);
    }
    const status = item?.querySelector('.budget-meta span:last-child');
    if (status) status.textContent = `${percent}% · ${percent >= 100 ? 'Limit reached' : percent >= 80 ? 'Approaching limit' : `${currency(Math.max(0, value - spent))} remaining`}`;
  } else if (kind === 'goal') {
    const card = input.closest('.goal-card');
    const target = Number(input.dataset.target);
    const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
    const fill = card?.querySelector('.progress-fill');
    if (fill) fill.style.width = `${percent}%`;
    const note = card?.querySelector('.goal-progress-note');
    if (note) note.textContent = `${percent}% complete · ${currency(Math.max(0, target - value))} to go`;
  }
}

function openModal(title, bodyHtml) {
  document.body.classList.add('modal-open');
  const root = document.querySelector('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></header>${bodyHtml}</section></div>`;
  root.querySelector('.modal-backdrop')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector('input,select,button')?.focus();
}

function closeModal() {
  pendingConfirm = null;
  document.body.classList.remove('modal-open');
  const root = document.querySelector('#modal-root');
  if (root) root.replaceChildren();
}

function transactionModal(transaction = null, defaultType = 'expense') {
  const editing = Boolean(transaction);
  const type = transaction?.type || defaultType;
  const accounts = store.getState().accounts;
  const categoryId = transaction?.categoryId || store.getState().categories.find((category) => category.type === type)?.id || '';
  const html = `<form class="modal-body" id="transaction-form">
    <input type="hidden" name="id" value="${escapeHtml(transaction?.id || '')}">
    <div class="form-grid">
      <label class="input-label">Type<select class="select-input" name="type" id="transaction-type"><option value="expense" ${type === 'expense' ? 'selected' : ''}>Expense</option><option value="income" ${type === 'income' ? 'selected' : ''}>Income</option></select></label>
      <label class="input-label">Amount<input class="text-input" name="amount" type="number" min="0.01" step="0.01" required value="${escapeHtml(transaction?.amount ?? '')}" placeholder="0.00"></label>
      <label class="input-label span-2">Description<input class="text-input" name="merchant" maxlength="80" required value="${escapeHtml(transaction?.merchant || '')}" placeholder="e.g. Grocery store"></label>
      <label class="input-label">Category<select class="select-input" name="categoryId" id="transaction-category" required>${categoryOptions(type, categoryId)}</select></label>
      <label class="input-label">Date<input class="text-input" name="date" type="date" required value="${escapeHtml(transaction?.date || today())}"></label>
      <label class="input-label">Account<select class="select-input" name="accountId" required>${accounts.map((account) => `<option value="${escapeHtml(account.id)}" ${account.id === (transaction?.accountId || accounts[0]?.id) ? 'selected' : ''}>${escapeHtml(account.name)}</option>`).join('')}</select></label>
      <label class="input-label">Status<select class="select-input" name="status"><option value="completed" ${transaction?.status === 'completed' || !transaction ? 'selected' : ''}>Completed</option><option value="pending" ${transaction?.status === 'pending' ? 'selected' : ''}>Pending</option><option value="failed" ${transaction?.status === 'failed' ? 'selected' : ''}>Failed</option></select></label>
      <label class="input-label span-2">Note (optional)<input class="text-input" name="note" maxlength="160" value="${escapeHtml(transaction?.note || '')}" placeholder="Add a note"></label>
    </div><div class="form-actions"><button class="btn btn--secondary" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit" data-action="submit-form">${editing ? 'Save changes' : 'Add transaction'}</button></div>
  </form>`;
  openModal(editing ? 'Edit transaction' : 'Add transaction', html);
}

function budgetModal(budget = null) {
  const expenses = store.getState().categories.filter((category) => category.type === 'expense');
  if (!expenses.length) return showToast('Add an expense category before creating a budget.', true);
  const html = `<form class="modal-body" id="budget-form"><input type="hidden" name="id" value="${escapeHtml(budget?.id || '')}"><label class="input-label">Category<select class="select-input" name="categoryId" required>${expenses.map((category) => `<option value="${escapeHtml(category.id)}" ${category.id === budget?.categoryId ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select></label><label class="input-label">Monthly limit<input class="text-input" name="limit" type="number" min="0.01" step="0.01" required value="${escapeHtml(budget?.limit ?? '')}" placeholder="0.00"></label><div class="form-actions"><button class="btn btn--secondary" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit" data-action="submit-form">${budget ? 'Save budget' : 'Create budget'}</button></div></form>`;
  openModal(budget ? 'Edit budget' : 'Create monthly budget', html);
}

function categoryModal() {
  const html = `<form class="modal-body" id="category-form"><div class="form-grid"><label class="input-label span-2">Category name<input class="text-input" name="name" maxlength="35" required placeholder="e.g. Pet care"></label><label class="input-label">Type<select class="select-input" name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label><label class="input-label">Color<select class="select-input" name="color"><option value="#7567e8">Violet</option><option value="#8a9cf6">Blue</option><option value="#54ae8a">Green</option><option value="#f0a36f">Orange</option><option value="#df7b9b">Rose</option></select></label></div><div class="form-actions"><button class="btn btn--secondary" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit" data-action="submit-form">Add category</button></div></form>`;
  openModal('Add category', html);
}

function goalModal(goal = null) {
  const html = `<form class="modal-body" id="goal-form"><input type="hidden" name="id" value="${escapeHtml(goal?.id || '')}"><div class="form-grid"><label class="input-label span-2">Goal name<input class="text-input" name="name" maxlength="50" required value="${escapeHtml(goal?.name || '')}" placeholder="e.g. New laptop"></label><label class="input-label">Target amount<input class="text-input" name="target" type="number" min="0.01" step="0.01" required value="${escapeHtml(goal?.target ?? '')}"></label><label class="input-label">Saved so far<input class="text-input" name="saved" type="number" min="0" step="0.01" required value="${escapeHtml(goal?.saved ?? 0)}"></label><label class="input-label span-2">Target date<input class="text-input" name="targetDate" type="date" required value="${escapeHtml(goal?.targetDate || '')}"></label></div><div class="form-actions"><button class="btn btn--secondary" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit" data-action="submit-form">${goal ? 'Save goal' : 'Create goal'}</button></div></form>`;
  openModal(goal ? 'Edit financial goal' : 'Create financial goal', html);
}

function accountModal() {
  const html = `<form class="modal-body" id="account-form"><div class="form-grid"><label class="input-label span-2">Account name<input class="text-input" name="name" maxlength="45" required placeholder="e.g. Savings account"></label><label class="input-label">Account type<select class="select-input" name="type"><option>Checking</option><option>Savings</option><option>Cash</option><option>Investment</option></select></label><label class="input-label">Opening balance<input class="text-input" name="openingBalance" type="number" step="0.01" required value="0"></label></div><div class="form-actions"><button class="btn btn--secondary" type="button" data-action="close-modal">Cancel</button><button class="btn" type="submit" data-action="submit-form">Add account</button></div></form>`;
  openModal('Add local account', html);
}

function confirmAction(message, callback) {
  pendingConfirm = callback;
  openModal('Please confirm', `<div class="modal-body"><p>${escapeHtml(message)}</p><div class="form-actions"><button class="btn btn--secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn--danger" type="button" data-action="confirm-action">Confirm</button></div></div>`);
}

function updateTransactionRows() {
  const tbody = document.querySelector('#transactions-table');
  if (!tbody) return;
  const filters = {
    search: document.querySelector('#tx-search')?.value,
    type: document.querySelector('#tx-type')?.value,
    status: document.querySelector('#tx-status')?.value,
    category: document.querySelector('#tx-category')?.value,
    from: document.querySelector('#tx-from')?.value,
    to: document.querySelector('#tx-to')?.value,
    sort: document.querySelector('#tx-sort')?.value
  };
  const transactions = filterTransactions(store.getState().transactions, filters);
  tbody.innerHTML = transactionTable(transactions);
  const count = document.querySelector('#transaction-count');
  const results = document.querySelector('#transaction-results');
  if (count) count.textContent = `${transactions.length} ${transactions.length === 1 ? 'record' : 'records'}`;
  if (results) results.textContent = `${transactions.length} transactions`;
}

async function exportCsv() {
  const { transactions, categories } = store.getState();
  const header = ['id', 'date', 'description', 'type', 'category', 'status', 'amount', 'note'];
  const csv = [header, ...transactions.map((transaction) => [
    transaction.id, transaction.date, transaction.merchant, transaction.type,
    categories.find((category) => category.id === transaction.categoryId)?.name || 'Uncategorized',
    transaction.status, transaction.amount, transaction.note || ''
  ])].map((row) => row.map((value) => {
    const text = String(value ?? '');
    const safeText = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  if (desktop) {
    const result = await desktop.data.saveCsv(csv);
    if (!result.canceled) showToast('Your CSV export is ready.');
    return;
  }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'findash-transactions.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Your CSV export is ready.');
}

async function exportBackup() {
  const data = store.getState();
  if (desktop) {
    const result = await desktop.data.exportBackup(data);
    if (!result.canceled) showToast('Your backup file has been saved.');
    return;
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'findash-backup.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Your backup file has been saved.');
}

async function importBackup() {
  if (desktop) {
    const data = await desktop.data.importBackup();
    if (data) confirmAction('Replace all local financial data and preferences with this backup?', () => store.replaceData(data));
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const [file] = input.files || [];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('The selected backup exceeds the 10 MB limit.');
      const data = JSON.parse(await file.text());
      if (!isValidFinanceData(data)) throw new Error('The selected file is not a valid FinDash backup.');
      confirmAction('Replace all local financial data and preferences with this backup?', () => store.replaceData(data));
    } catch (error) {
      console.error('Unable to restore the selected backup.', error);
      showToast(error.message || 'The selected backup could not be restored.', true);
    }
  }, { once: true });
  input.click();
}

async function exportPdf() {
  if (!desktop) {
    window.print();
    return;
  }
  const result = await desktop.reports.exportPdf();
  if (!result.canceled) showToast('Your PDF report has been saved.');
}

async function handleMenuAction(action) {
  try {
    switch (action) {
      case 'new-expense': transactionModal(null, 'expense'); break;
      case 'export-csv': await exportCsv(); break;
      case 'export-backup': await exportBackup(); break;
      case 'import-backup': await importBackup(); break;
      case 'export-pdf': await exportPdf(); break;
      case 'navigate-settings': routeTo('settings'); break;
      default: return;
    }
  } catch (error) {
    console.error('Unable to complete the application menu action.', error);
    showToast(error.message || 'The requested action could not be completed.', true);
  }
}

async function handleAction(action, target) {
  const id = target.dataset.id;
  const state = store.getState();
  try {
    switch (action) {
      case 'submit-form': {
        const form = target.form;
        if (form?.reportValidity()) form.requestSubmit();
        break;
      }
      case 'new-transaction': transactionModal(null, target.dataset.type || 'expense'); break;
      case 'toggle-dashboard-customizer':
        dashboardCustomizationOpen = !dashboardCustomizationOpen;
        render();
        break;
      case 'edit-transaction': {
        const transaction = state.transactions.find((item) => item.id === id);
        if (transaction) transactionModal(transaction);
        break;
      }
      case 'search-transaction': {
        const transaction = state.transactions.find((item) => item.id === id);
        if (transaction) {
          routeTo('transactions');
          const search = document.querySelector('#tx-search');
          if (search) {
            search.value = transaction.merchant;
            updateTransactionRows();
          }
        }
        break;
      }
      case 'delete-transaction': {
        const transaction = state.transactions.find((item) => item.id === id);
        if (transaction) confirmAction(`Delete “${transaction.merchant}” from your local transaction history?`, () => store.deleteTransaction(id));
        break;
      }
      case 'new-budget': budgetModal(); break;
      case 'edit-budget': {
        const budget = state.budgets.find((item) => item.id === id);
        if (budget) budgetModal(budget);
        break;
      }
      case 'delete-budget': confirmAction('Delete this monthly budget?', () => store.deleteBudget(id)); break;
      case 'new-category': categoryModal(); break;
      case 'delete-category': confirmAction('Delete this category? Categories used by transactions cannot be removed.', () => store.deleteCategory(id)); break;
      case 'new-goal': goalModal(); break;
      case 'edit-goal': {
        const goal = state.goals.find((item) => item.id === id);
        if (goal) goalModal(goal);
        break;
      }
      case 'delete-goal': confirmAction('Delete this financial goal?', () => store.deleteGoal(id)); break;
      case 'new-account': accountModal(); break;
      case 'delete-account': confirmAction('Remove this account? Transaction history stays in the ledger.', () => store.deleteAccount(id)); break;
      case 'reset-data': confirmAction('Restore the original sample data? This replaces transactions, budgets, categories, goals, accounts, and preferences currently saved on this device.', () => store.resetToSampleData()); break;
      case 'export-csv': await exportCsv(); break;
      case 'export-pdf': await exportPdf(); break;
      case 'export-backup': await exportBackup(); break;
      case 'import-backup': await importBackup(); break;
      case 'close-modal': closeModal(); break;
      case 'confirm-action': {
        const actionToRun = pendingConfirm;
        closeModal();
        if (actionToRun) {
          await actionToRun();
          showToast('Your changes have been saved.');
        }
        break;
      }
      default: break;
    }
  } catch (error) {
    console.error('Unable to complete the requested action.', error);
    showToast(error.message || 'This action could not be completed.', true);
  }
}

async function handleFormSubmit(event) {
  const form = event.target;
  if (!form || form.tagName !== 'FORM') return;
  const formType = form.getAttribute('id');
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    if (formType === 'transaction-form') {
      const amount = Number(values.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.');
      await store.saveTransaction({
        id: values.id || undefined,
        merchant: values.merchant.trim(),
        amount,
        type: values.type,
        date: values.date,
        categoryId: values.categoryId,
        accountId: values.accountId,
        status: values.status,
        note: values.note.trim()
      });
    } else if (formType === 'budget-form') {
      const limit = Number(values.limit);
      if (!Number.isFinite(limit) || limit <= 0) throw new Error('Enter a budget limit greater than zero.');
      await store.saveBudget({ id: values.id || undefined, categoryId: values.categoryId, limit });
    } else if (formType === 'category-form') {
      const name = values.name.trim();
      if (!name) throw new Error('Enter a category name.');
      if (store.getState().categories.some((category) => category.name.toLowerCase() === name.toLowerCase() && category.type === values.type)) {
        throw new Error('A category with this name already exists.');
      }
      await store.saveCategory({ name, type: values.type, color: values.color });
    } else if (formType === 'goal-form') {
      const target = Number(values.target);
      const saved = Number(values.saved);
      if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(saved) || saved < 0) throw new Error('Enter valid goal amounts.');
      await store.saveGoal({ id: values.id || undefined, name: values.name.trim(), target, saved, targetDate: values.targetDate });
    } else if (formType === 'account-form') {
      const openingBalance = Number(values.openingBalance);
      if (!Number.isFinite(openingBalance)) throw new Error('Enter a valid opening balance.');
      await store.saveAccount({ name: values.name.trim(), type: values.type, openingBalance });
    } else return;
    closeModal();
    showToast('Your changes have been saved.');
  } catch (error) {
    console.error('Unable to save form data.', error);
    showToast(error.message || 'Your changes could not be saved.', true);
  }
}

app.addEventListener('submit', (event) => {
  event.preventDefault();
  void handleFormSubmit(event);
}, true);
app.addEventListener('click', (event) => {
  if (!event.target.closest('.global-search-wrap')) {
    document.querySelector('#global-search-results')?.classList.remove('is-open');
  }
  if (dashboardCustomizationOpen && !event.target.closest('.dashboard-toolbar')) {
    dashboardCustomizationOpen = false;
    const customizer = document.querySelector('#dashboard-customizer');
    if (customizer) customizer.hidden = true;
    document.querySelector('[data-action="toggle-dashboard-customizer"]')?.setAttribute('aria-expanded', 'false');
  }
  const routeLink = event.target.closest('[data-route]');
  if (routeLink) {
    event.preventDefault();
    routeTo(routeLink.dataset.route);
    return;
  }
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'submit-form') event.preventDefault();
    if (action.dataset.action === 'dismiss-modal') return closeModal();
    void handleAction(action.dataset.action, action);
    return;
  }
  if (event.target.closest('#menu-toggle')) return toggleSidebar();
  if (event.target.closest('#sidebar-backdrop')) return closeSidebar();
  if (event.target.closest('#theme-toggle')) {
    const next = getSettings().theme === 'dark' ? 'light' : 'dark';
    try {
      void store.updateSettings({ theme: next }).then(() => {
        showToast(`${next === 'dark' ? 'Dark' : 'Light'} theme enabled.`);
      }).catch((error) => {
      console.error('Unable to save theme preference.', error);
      showToast(error.message, true);
      });
    } catch (error) {
      console.error('Unable to save theme preference.', error);
      showToast(error.message, true);
    }
  }
});

app.addEventListener('input', (event) => {
  if (event.target.matches('#tx-search')) updateTransactionRows();
  if (event.target.matches('#global-search')) renderGlobalSearch(event.target.value);
  if (event.target.matches('[data-finance-slider]')) updateFinanceSlider(event.target);
  if (event.target.matches('#analytics-range')) {
    updateRangeAppearance(event.target);
    const output = document.querySelector('#analytics-range-value');
    if (output) output.textContent = `${event.target.value} days`;
  }
});
app.addEventListener('change', (event) => {
  if (event.target.matches('#tx-type, #tx-status, #tx-category, #tx-from, #tx-to, #tx-sort')) updateTransactionRows();
  if (event.target.matches('#transaction-type')) {
    const categorySelect = document.querySelector('#transaction-category');
    categorySelect.innerHTML = categoryOptions(event.target.value);
  }
  if (event.target.matches('#analytics-range')) {
    const hash = `#analytics?range=${encodeURIComponent(event.target.value)}`;
    history.pushState(null, '', `./index.html${hash}`);
    render();
  }
  if (event.target.matches('[data-finance-slider]')) {
    const slider = event.target;
    const id = slider.dataset.id;
    const value = Number(slider.value);
    const update = slider.dataset.financeSlider === 'budget'
      ? (() => {
        const budget = store.getState().budgets.find((item) => item.id === id);
        return budget ? store.saveBudget({ ...budget, limit: value }) : Promise.reject(new Error('This budget is no longer available.'));
      })()
      : (() => {
        const goal = store.getState().goals.find((item) => item.id === id);
        return goal ? store.saveGoal({ ...goal, saved: value }) : Promise.reject(new Error('This savings goal is no longer available.'));
      })();
    void update.then(() => showToast('Your target has been updated.')).catch((error) => {
      console.error('Unable to update the financial target.', error);
      showToast(error.message || 'The financial target could not be updated.', true);
    });
  }
  if (event.target.matches('[data-setting]')) {
    void store.updateSettings({ [event.target.dataset.setting]: event.target.value }).then(() => {
      showToast('Preference updated.');
    }).catch((error) => {
      console.error('Unable to save preference.', error);
      showToast(error.message, true);
    });
  }
  if (event.target.matches('[data-dashboard-widget]')) {
    const current = getSettings().dashboardWidgets || {};
    void store.updateSettings({
      dashboardWidgets: {
        cashFlow: current.cashFlow !== false,
        spending: current.spending !== false,
        budgets: current.budgets !== false,
        goals: current.goals !== false,
        activity: current.activity !== false,
        [event.target.dataset.dashboardWidget]: event.target.checked
      }
    }).catch((error) => {
      console.error('Unable to save dashboard preferences.', error);
      showToast(error.message || 'Dashboard preferences could not be saved.', true);
    });
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (document.querySelector('#modal-root .modal')) closeModal();
    else {
      closeSidebar();
      const search = document.querySelector('#global-search');
      if (search) {
        search.value = '';
        renderGlobalSearch('');
      }
    }
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#global-search')?.focus();
  } else if (event.key === '/' && !event.metaKey && !event.ctrlKey
    && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    document.querySelector('#global-search')?.focus();
  }
});
window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1).split('?')[0];
  if (validPages.has(next)) {
    route = next;
    closeSidebar();
    render();
  }
});
window.addEventListener('popstate', () => {
  const next = location.hash.slice(1).split('?')[0];
  route = validPages.has(next) ? next : pageFromPath();
  closeSidebar();
  render();
});
setupDesktopTitlebar();
if (desktop) desktop.onMenuAction((action) => {
  void handleMenuAction(action);
});
store.subscribe(() => render());
store.ready.then(render).catch((error) => {
  console.error('Unable to load local financial data.', error);
  app.innerHTML = '<section class="storage-error" role="alert"><h1>FinDash could not open your local data</h1><p>Your financial data has not been changed. Close other FinDash windows and restart the app. If the problem persists, check that local application storage is available for this Windows account.</p></section>';
});

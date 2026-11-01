import seedData from '../data/mockData.json';
import { loadFromStorage, removeCorruptBackup, saveToStorage } from './storage.js';

const categoryDefaults = [
  { id: 'food', name: 'Food & dining', type: 'expense', color: '#f0a36f' },
  { id: 'transport', name: 'Transport', type: 'expense', color: '#8a9cf6' },
  { id: 'shopping', name: 'Shopping', type: 'expense', color: '#df7b9b' },
  { id: 'subscriptions', name: 'Subscriptions', type: 'expense', color: '#a184e8' },
  { id: 'housing', name: 'Housing', type: 'expense', color: '#68b7ad' },
  { id: 'health', name: 'Health', type: 'expense', color: '#e18a79' },
  { id: 'other', name: 'Other', type: 'expense', color: '#9aa1b5' },
  { id: 'salary', name: 'Salary', type: 'income', color: '#54ae8a' },
  { id: 'freelance', name: 'Freelance', type: 'income', color: '#6f9be8' },
  { id: 'investment', name: 'Investment', type: 'income', color: '#a184e8' }
];

const categoryFor = (merchant, type) => {
  if (type === 'income') return /salary/i.test(merchant) ? 'salary' : 'freelance';
  if (/apple|amazon/i.test(merchant)) return 'shopping';
  if (/uber|lyft|taxi/i.test(merchant)) return 'transport';
  if (/starbucks|restaurant|food|cafe/i.test(merchant)) return 'food';
  if (/netflix|subscription|cloud/i.test(merchant)) return 'subscriptions';
  return 'other';
};

const transactions = seedData.transactions.map((transaction) => {
  const type = transaction.type === 'credit' ? 'income' : 'expense';
  return {
    id: transaction.id,
    merchant: transaction.merchant,
    accountId: 'account-main',
    date: transaction.date.slice(0, 10),
    status: transaction.status.toLowerCase(),
    amount: Math.abs(Number(transaction.amount)),
    type,
    categoryId: categoryFor(transaction.merchant, type),
    note: ''
  };
});

const netTransactions = transactions
  .filter((tx) => tx.status !== 'failed')
  .reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);

export function createSampleData() {
  return {
    version: 1,
    transactions: transactions.map((tx) => ({ ...tx })),
    categories: categoryDefaults.map((category) => ({ ...category })),
    budgets: [
      { id: 'budget-food', categoryId: 'food', limit: 650 },
      { id: 'budget-transport', categoryId: 'transport', limit: 300 },
      { id: 'budget-shopping', categoryId: 'shopping', limit: 900 },
      { id: 'budget-subscriptions', categoryId: 'subscriptions', limit: 120 },
      { id: 'budget-housing', categoryId: 'housing', limit: 1800 }
    ],
    goals: [
      { id: 'goal-travel', name: 'Summer trip', target: 3000, saved: 1240, targetDate: '2027-06-01' },
      { id: 'goal-buffer', name: 'Emergency fund', target: 10000, saved: 6200, targetDate: '2027-12-31' }
    ],
    accounts: [
      { id: 'account-main', name: 'Everyday account', type: 'Checking', openingBalance: 14250.75 - netTransactions }
    ],
    settings: { currency: 'USD', locale: 'en-US', dateFormat: 'medium', theme: 'light' }
  };
}

let state = createSampleData();
let writeQueue = Promise.resolve();
const listeners = new Set();

async function commit(update) {
  const operation = writeQueue.then(async () => {
    const nextState = update(state);
    await saveToStorage(nextState);
    state = nextState;
    listeners.forEach((listener) => listener(state));
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

export const store = {
  ready: loadFromStorage(createSampleData()).then((saved) => {
    state = saved;
  }),
  getState: () => state,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  saveTransaction(transaction) {
    return commit((current) => {
      const exists = current.transactions.some((item) => item.id === transaction.id);
      const next = exists
        ? current.transactions.map((item) => item.id === transaction.id ? { ...item, ...transaction } : item)
        : [{ ...transaction, id: transaction.id || id('tx'), status: transaction.status || 'completed' }, ...current.transactions];
      return { ...current, transactions: next };
    });
  },
  deleteTransaction(transactionId) {
    return commit((current) => ({ ...current, transactions: current.transactions.filter((item) => item.id !== transactionId) }));
  },
  saveBudget(budget) {
    return commit((current) => {
      const exists = current.budgets.some((item) => item.id === budget.id);
      const next = exists
        ? current.budgets.map((item) => item.id === budget.id ? { ...item, ...budget } : item)
        : [...current.budgets, { ...budget, id: id('budget') }];
      return { ...current, budgets: next };
    });
  },
  deleteBudget(budgetId) {
    return commit((current) => ({ ...current, budgets: current.budgets.filter((item) => item.id !== budgetId) }));
  },
  saveCategory(category) {
    return commit((current) => {
      const exists = current.categories.some((item) => item.id === category.id);
      const next = exists
        ? current.categories.map((item) => item.id === category.id ? { ...item, ...category } : item)
        : [...current.categories, { ...category, id: id('category') }];
      return { ...current, categories: next };
    });
  },
  deleteCategory(categoryId) {
    return commit((current) => {
      if (current.transactions.some((transaction) => transaction.categoryId === categoryId)) {
        throw new Error('This category is used by a transaction. Reassign those transactions first.');
      }
      return {
        ...current,
        categories: current.categories.filter((category) => category.id !== categoryId),
        budgets: current.budgets.filter((budget) => budget.categoryId !== categoryId)
      };
    });
  },
  saveGoal(goal) {
    return commit((current) => {
      const exists = current.goals.some((item) => item.id === goal.id);
      const next = exists
        ? current.goals.map((item) => item.id === goal.id ? { ...item, ...goal } : item)
        : [...current.goals, { ...goal, id: id('goal') }];
      return { ...current, goals: next };
    });
  },
  deleteGoal(goalId) {
    return commit((current) => ({ ...current, goals: current.goals.filter((goal) => goal.id !== goalId) }));
  },
  saveAccount(account) {
    return commit((current) => ({ ...current, accounts: [...current.accounts, { ...account, id: id('account') }] }));
  },
  deleteAccount(accountId) {
    return commit((current) => {
      if (current.accounts.length < 2) throw new Error('Keep at least one account in your workspace.');
      const removed = current.accounts.find((account) => account.id === accountId);
      if (!removed) return current;
      const accounts = current.accounts.filter((account) => account.id !== accountId);
      const destination = accounts[0];
      return {
        ...current,
        accounts: accounts.map((account) => account.id === destination.id
          ? { ...account, openingBalance: account.openingBalance + removed.openingBalance }
          : account),
        transactions: current.transactions.map((transaction) => transaction.accountId === accountId
          ? { ...transaction, accountId: destination.id }
          : transaction)
      };
    });
  },
  updateSettings(settings) {
    return commit((current) => ({ ...current, settings: { ...current.settings, ...settings } }));
  },
  replaceData(data) {
    return commit(() => data);
  },
  async resetToSampleData() {
    const sample = createSampleData();
    await commit(() => sample);
    removeCorruptBackup();
  }
};

export { categoryDefaults };

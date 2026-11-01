const monthKey = (date) => {
  const value = new Date(`${date}T12:00:00`);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
};

export function getCurrentMonthTransactions(transactions, now = new Date()) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return transactions.filter((transaction) => monthKey(transaction.date) === month);
}

export function calculateSummary(state, now = new Date()) {
  const currentMonthTransactions = getCurrentMonthTransactions(state.transactions, now);
  const totalIncome = currentMonthTransactions
    .filter((tx) => tx.type === 'income' && tx.status !== 'failed')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpenses = currentMonthTransactions
    .filter((tx) => tx.type === 'expense' && tx.status !== 'failed')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const balance = state.accounts.reduce((total, account) => {
    const accountTransactions = state.transactions.filter((tx) => tx.accountId === account.id || (!tx.accountId && account.id === state.accounts[0]?.id));
    return total + account.openingBalance + accountTransactions.reduce((sum, tx) => {
      if (tx.status === 'failed') return sum;
      return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
    }, 0);
  }, 0);
  return { balance, totalIncome, totalExpenses, net: totalIncome - totalExpenses, currentMonthTransactions };
}

export function spendingByCategory(state, transactions = getCurrentMonthTransactions(state.transactions)) {
  const totals = new Map();
  transactions.filter((tx) => tx.type === 'expense' && tx.status !== 'failed').forEach((tx) => {
    totals.set(tx.categoryId, (totals.get(tx.categoryId) || 0) + tx.amount);
  });
  return state.categories
    .filter((category) => category.type === 'expense')
    .map((category) => ({ ...category, amount: totals.get(category.id) || 0 }))
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function getBudgetProgress(state) {
  return state.budgets.map((budget) => {
    const category = state.categories.find((item) => item.id === budget.categoryId);
    const spent = getCurrentMonthTransactions(state.transactions)
      .filter((tx) => tx.type === 'expense' && tx.status !== 'failed' && tx.categoryId === budget.categoryId)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const utilization = budget.limit > 0 ? spent / budget.limit : 0;
    return { ...budget, category, spent, utilization, remaining: Math.max(0, budget.limit - spent) };
  });
}

export function getMonthlyTrends(state, count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    const txs = state.transactions.filter((tx) => monthKey(tx.date) === key && tx.status !== 'failed');
    return {
      key,
      label: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(monthDate),
      income: txs.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0),
      expense: txs.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
    };
  });
}

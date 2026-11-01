const currencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD'];
const locales = ['en-US', 'en-GB', 'en-IN'];
const themes = ['light', 'dark'];
const dateFormats = ['short', 'medium', 'long'];

const isDate = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(new Date(`${value}T12:00:00`).getTime());

export function isValidFinanceData(data) {
  if (!data || typeof data !== 'object' || data.version !== 1) return false;
  const collections = ['transactions', 'categories', 'budgets', 'goals', 'accounts'];
  if (collections.some((key) => !Array.isArray(data[key]) || data[key].length > 100000)
    || data.accounts.length === 0 || !data.settings || typeof data.settings !== 'object') return false;

  const invalidTransaction = data.transactions.some((item) => !item || typeof item.id !== 'string'
    || typeof item.merchant !== 'string' || item.merchant.length > 200 || !isDate(item.date)
    || !Number.isFinite(Number(item.amount)) || Number(item.amount) < 0
    || !['income', 'expense'].includes(item.type)
    || !['completed', 'pending', 'failed'].includes(item.status));
  const invalidCategory = data.categories.some((item) => !item || typeof item.id !== 'string'
    || typeof item.name !== 'string' || item.name.length > 200
    || !['income', 'expense'].includes(item.type) || !/^#[\da-f]{6}$/i.test(item.color));
  const invalidAccount = data.accounts.some((item) => !item || typeof item.id !== 'string'
    || typeof item.name !== 'string' || item.name.length > 200
    || !Number.isFinite(Number(item.openingBalance)));
  const invalidBudget = data.budgets.some((item) => !item || typeof item.id !== 'string'
    || typeof item.categoryId !== 'string' || !Number.isFinite(Number(item.limit)) || Number(item.limit) <= 0);
  const invalidGoal = data.goals.some((item) => !item || typeof item.id !== 'string'
    || typeof item.name !== 'string' || item.name.length > 200
    || !Number.isFinite(Number(item.target)) || Number(item.target) <= 0
    || !Number.isFinite(Number(item.saved)) || Number(item.saved) < 0 || !isDate(item.targetDate));
  const invalidSettings = !currencies.includes(data.settings.currency)
    || !locales.includes(data.settings.locale) || !themes.includes(data.settings.theme)
    || !dateFormats.includes(data.settings.dateFormat);

  return !(invalidTransaction || invalidCategory || invalidAccount || invalidBudget || invalidGoal || invalidSettings);
}

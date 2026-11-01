const svgElement = (name, attributes = {}) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
};

export function renderCashFlowChart(container, series, formatCurrency) {
  if (!container) return;
  const width = 720;
  const height = 245;
  const left = 44;
  const right = 12;
  const top = 14;
  const bottom = 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = Math.max(1, ...series.flatMap((point) => [point.income, point.expense])) * 1.15;
  const x = (index) => left + (series.length <= 1 ? chartWidth / 2 : (index * chartWidth) / (series.length - 1));
  const y = (value) => top + chartHeight - (value / max) * chartHeight;
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Income and expenses over recent months' });
  const grid = svgElement('g', { fill: 'none', stroke: 'var(--border-color)', 'stroke-width': '1' });
  for (let index = 0; index < 4; index += 1) {
    const lineY = top + (chartHeight * index) / 3;
    grid.appendChild(svgElement('line', { x1: left, y1: lineY, x2: width - right, y2: lineY }));
  }
  svg.appendChild(grid);

  const appendSeries = (key, color) => {
    const points = series.map((point, index) => `${x(index)},${y(point[key])}`).join(' ');
    const area = `${left},${top + chartHeight} ${points} ${width - right},${top + chartHeight}`;
    svg.appendChild(svgElement('polygon', { points: area, fill: color, opacity: '.07' }));
    svg.appendChild(svgElement('polyline', {
      points,
      fill: 'none',
      stroke: color,
      'stroke-width': '3',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));
    series.forEach((point, index) => {
      const circle = svgElement('circle', { cx: x(index), cy: y(point[key]), r: '4', fill: color, stroke: 'var(--bg-surface-solid)', 'stroke-width': '2' });
      const title = svgElement('title');
      title.textContent = `${point.label}: ${key === 'income' ? 'Income' : 'Expenses'} ${formatCurrency(point[key])}`;
      circle.appendChild(title);
      svg.appendChild(circle);
    });
  };
  appendSeries('income', 'var(--color-primary)');
  appendSeries('expense', 'var(--color-secondary)');
  series.forEach((point, index) => {
    const label = svgElement('text', { x: x(index), y: height - 8, fill: 'var(--text-muted)', 'font-size': '11', 'text-anchor': 'middle' });
    label.textContent = point.label;
    svg.appendChild(label);
  });
  container.replaceChildren(svg);
}
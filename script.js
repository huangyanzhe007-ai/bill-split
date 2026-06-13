const STORAGE_KEY = 'billSplitterMobileState';
const SCENES = ['外卖', '餐饮', '奶茶', '交通', '住宿', '门票', '团购', '购物', '其他'];
const DEFAULT_PARTICIPANTS = ['H女士', 'Daisy'];
const MAX_PARTICIPANTS = 4;
const MONEY_TEXT = '(?:\\d+(?:\\.\\d+)?|[零〇一二两俩三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟萬]+(?:[块元圆](?:[零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]+(?:[角毛](?:[零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]+分?)?)?)?)?(?:[零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]+分)?|[零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]+[角毛][零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]*分?)';

const state = {
  trips: [],
  currentTripId: null,
  expenses: [],
};

const $ = (id) => document.getElementById(id);

const els = {
  tripScreen: $('trip-screen'),
  detailScreen: $('detail-screen'),
  newTripName: $('new-trip-name'),
  createTripButton: $('create-trip-button'),
  tripRoleInputs: ['trip-role-1', 'trip-role-2', 'trip-role-3', 'trip-role-4'].map($),
  tripList: $('trip-list'),
  tripCount: $('trip-count'),
  backToTrips: $('back-to-trips'),
  currentTripTitle: $('current-trip-title'),
  shareTripButton: $('share-trip-button'),
  settlementTitle: $('settlement-title'),
  settlementSubtitle: $('settlement-subtitle'),
  balanceStrip: $('balance-strip'),
  tripTotal: $('trip-total'),
  totalRow: $('total-row'),
  sentenceInput: $('sentence-input'),
  parseSentenceButton: $('parse-sentence-button'),
  ocrImageInput: $('ocr-image-input'),
  ocrPreview: $('ocr-preview'),
  ocrExtractButton: $('ocr-extract-button'),
  ocrStatus: $('ocr-status'),
  ocrTextOutput: $('ocr-text-output'),
  analyzeOcrTextButton: $('analyze-ocr-text-button'),
  extractedChips: $('extracted-chips'),
  expenseForm: $('expense-form'),
  entryDate: $('entry-date'),
  entryScene: $('entry-scene'),
  entryDescription: $('entry-description'),
  entryAmount: $('entry-amount'),
  entryPayer: $('entry-payer'),
  shareFields: $('share-fields'),
  entryNote: $('entry-note'),
  entrySource: $('entry-source'),
  formMessage: $('form-message'),
  copyAnalysisButton: $('copy-analysis-button'),
  analysisOutput: $('analysis-output'),
  expenseList: $('expense-list'),
  expenseCount: $('expense-count'),
};

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseMoneyValue(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  const arabic = text.match(/\d+(?:\.\d+)?/);
  if (arabic) return Number(arabic[0]);
  const chinese = parseChineseMoney(text);
  return chinese === null ? null : chinese;
}

function parseChineseMoney(text) {
  const cleaned = text
    .replace(/[人民币¥￥\s,，]/g, '')
    .replace(/圆/g, '元')
    .replace(/块钱/g, '块')
    .replace(/整$/g, '');

  if (!cleaned) return null;

  const yuanMatch = cleaned.match(/^(.+?)(?:元|块)/);
  const informalCentMatch = cleaned.match(/(?:元|块)?([^元块角毛分]+)(?:角|毛)([^元块角毛分]+)?分?$/);
  const looseDecimalMatch = cleaned.match(/^(.+?)(?:元|块)([^元块角毛分]+)$/);
  const maoMatch = informalCentMatch || cleaned.match(/(?:元|块)?([^元块角毛分]+)(?:角|毛)/);
  const fenMatch = informalCentMatch?.[2] ? null : cleaned.match(/(?:角|毛)?([^元块角毛分]+)分/);
  const onlyFen = cleaned.match(/^([^元块角毛分]+)分$/);

  if (!yuanMatch && !looseDecimalMatch && !maoMatch && !fenMatch && !onlyFen) {
    return chineseIntegerToNumber(cleaned);
  }

  const yuan = yuanMatch ? chineseIntegerToNumber(yuanMatch[1]) : 0;
  const mao = looseDecimalMatch && !informalCentMatch
    ? chineseIntegerToNumber(looseDecimalMatch[2])
    : maoMatch
      ? chineseIntegerToNumber(maoMatch[1])
      : 0;
  const fen = informalCentMatch?.[2]
    ? chineseIntegerToNumber(informalCentMatch[2])
    : fenMatch
      ? chineseIntegerToNumber(fenMatch[1])
      : onlyFen
        ? chineseIntegerToNumber(onlyFen[1])
        : 0;

  if ([yuan, mao, fen].some((part) => part === null)) return null;
  return yuan + mao / 10 + fen / 100;
}

function chineseIntegerToNumber(text) {
  const digits = {
    零: 0,
    '〇': 0,
    一: 1,
    二: 2,
    两: 2,
    俩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    壹: 1,
    贰: 2,
    叁: 3,
    肆: 4,
    伍: 5,
    陆: 6,
    柒: 7,
    捌: 8,
    玖: 9,
  };
  const units = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000 };
  let normalized = text.replace(/萬/g, '万');
  if (!normalized) return null;

  function parseSection(section) {
    let total = 0;
    let current = 0;
    for (const char of section) {
      if (digits[char] !== undefined) {
        current = digits[char];
      } else if (units[char]) {
        total += (current || 1) * units[char];
        current = 0;
      } else {
        return null;
      }
    }
    return total + current;
  }

  const parts = normalized.split('万');
  if (parts.length > 2) return null;
  if (parts.length === 2) {
    const high = parseSection(parts[0]);
    const low = parts[1] ? parseSection(parts[1]) : 0;
    if (high === null || low === null) return null;
    return high * 10000 + low;
  }

  return parseSection(normalized);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.trips = Array.isArray(saved.trips) ? saved.trips : [];
    state.expenses = Array.isArray(saved.expenses) ? saved.expenses : [];
    state.currentTripId = saved.currentTripId || null;
  } catch (error) {
    state.trips = [];
    state.expenses = [];
    state.currentTripId = null;
  }

  state.trips = state.trips.map((trip) => ({
    ...trip,
    participants: normalizeParticipants(trip.participants),
  }));

  if (state.trips.length === 0) {
    const sampleId = uid('trip');
    state.trips.push({
      id: sampleId,
      name: '6月8日周末游玩',
      participants: DEFAULT_PARTICIPANTS,
      createdAt: new Date().toISOString(),
    });
    state.currentTripId = sampleId;
    saveState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentTrip() {
  return state.trips.find((trip) => trip.id === state.currentTripId) || null;
}

function normalizeParticipants(participants) {
  const names = (Array.isArray(participants) ? participants : DEFAULT_PARTICIPANTS)
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const unique = [];
  names.forEach((name) => {
    if (!unique.includes(name) && unique.length < MAX_PARTICIPANTS) unique.push(name);
  });
  return unique.length ? unique : DEFAULT_PARTICIPANTS;
}

function getTripParticipants(tripId = state.currentTripId) {
  const trip = state.trips.find((item) => item.id === tripId);
  return normalizeParticipants(trip?.participants);
}

function getNewTripParticipants() {
  return normalizeParticipants(els.tripRoleInputs.map((input) => input.value));
}

function getExpenseShares(expense, participants = getTripParticipants(expense.tripId)) {
  if (expense.shares && typeof expense.shares === 'object') {
    return participants.reduce((shares, name) => {
      shares[name] = toNumber(expense.shares[name]);
      return shares;
    }, {});
  }

  return participants.reduce((shares, name) => {
    if (name === 'H女士') shares[name] = toNumber(expense.shareH);
    else if (name === 'Daisy') shares[name] = toNumber(expense.shareDaisy);
    else shares[name] = 0;
    return shares;
  }, {});
}

function summarize(tripId = state.currentTripId) {
  const participants = getTripParticipants(tripId);
  const expenses = state.expenses.filter((expense) => expense.tripId === tripId);
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const people = participants.map((name) => {
    const paid = expenses.reduce((sum, item) => sum + (item.payer === name ? item.amount : 0), 0);
    const share = expenses.reduce((sum, item) => sum + getExpenseShares(item, participants)[name], 0);
    return { name, paid, share, net: paid - share };
  });

  return { expenses, total, people, participants };
}

function settlementText(summary) {
  if (summary.expenses.length === 0) return '还没有账单';
  const transfers = settlementTransfers(summary.people);
  if (transfers.length === 0) return '已平账';
  const first = transfers[0];
  return `${first.from}需转 ${first.to} ¥${formatMoney(first.amount)}`;
}

function settlementTransfers(people) {
  const debtors = people
    .filter((person) => person.net < -0.01)
    .map((person) => ({ name: person.name, amount: -person.net }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = people
    .filter((person) => person.net > 0.01)
    .map((person) => ({ name: person.name, amount: person.net }))
    .sort((a, b) => b.amount - a.amount);
  const transfers = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0.01) transfers.push({ from: debtors[d].name, to: creditors[c].name, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount <= 0.01) d += 1;
    if (creditors[c].amount <= 0.01) c += 1;
  }

  return transfers;
}

function renderTrips() {
  els.tripList.innerHTML = '';
  els.tripCount.textContent = `${state.trips.length} 个`;

  state.trips.forEach((trip) => {
    const summary = summarize(trip.id);
    const item = document.createElement('article');
    item.className = 'trip-item';
    item.innerHTML = `
      <div class="trip-top">
        <span class="trip-name">${escapeHtml(trip.name)}</span>
        <span class="money">${formatMoney(summary.total)} 元</span>
      </div>
      <div class="trip-top">
        <span class="muted">${settlementText(summary)}</span>
        <button class="ghost-button" type="button" data-open-trip="${trip.id}">进入</button>
      </div>
    `;
    els.tripList.appendChild(item);
  });

  els.tripList.querySelectorAll('[data-open-trip]').forEach((button) => {
    button.addEventListener('click', () => openTrip(button.dataset.openTrip));
  });
}

function openTrip(tripId) {
  state.currentTripId = tripId;
  saveState();
  els.tripScreen.classList.add('hidden');
  els.detailScreen.classList.remove('hidden');
  resetForm(false);
  renderDetail();
}

function showTrips() {
  els.detailScreen.classList.add('hidden');
  els.tripScreen.classList.remove('hidden');
  renderTrips();
}

function renderDetail() {
  const trip = currentTrip();
  if (!trip) {
    showTrips();
    return;
  }

  const summary = summarize();
  els.currentTripTitle.textContent = trip.name;
  els.settlementTitle.textContent = settlementText(summary);
  els.settlementSubtitle.textContent = summary.expenses.length
    ? `${summary.expenses.length} 笔账单，已自动汇总这个行程`
    : '先用一句话或 OCR 记一笔。';

  renderParticipantControls(summary.participants);
  renderBalance(summary);
  els.tripTotal.textContent = `${formatMoney(summary.total)} 元`;
  els.analysisOutput.textContent = buildAnalysisText();
  renderExpenses(summary.expenses);
}

function renderParticipantControls(participants = getTripParticipants()) {
  const currentPayer = els.entryPayer.value;
  els.entryPayer.innerHTML = participants
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join('');
  els.entryPayer.value = participants.includes(currentPayer) ? currentPayer : participants[0];

  const currentShares = readShareInputs();
  els.shareFields.innerHTML = participants.map((name) => `
    <label>${escapeHtml(name)}分摊
      <input class="entry-share" data-share-name="${escapeHtml(name)}" type="number" step="0.01" min="0" placeholder="默认均分" value="${currentShares[name] || ''}" />
    </label>
  `).join('');
  els.shareFields.querySelectorAll('.entry-share').forEach((input) => input.addEventListener('input', renderChips));
}

function renderBalance(summary) {
  els.balanceStrip.innerHTML = summary.people.map((person) => `
    <div>
      <span>${escapeHtml(person.name)}</span>
      <strong>${formatMoney(person.net)}</strong>
      <small>已付 ${formatMoney(person.paid)} / 分摊 ${formatMoney(person.share)}</small>
    </div>
  `).join('');

  const totalCells = [
    `<div><span>行程总金额</span><strong id="trip-total">${formatMoney(summary.total)} 元</strong></div>`,
    ...summary.people.map((person) => (
      `<div><span>${escapeHtml(person.name)}合计</span><strong>${formatMoney(person.share)} 元</strong></div>`
    )),
  ];
  els.totalRow.innerHTML = totalCells.join('');
  els.tripTotal = $('trip-total');
}

function renderExpenses(expenses) {
  els.expenseList.innerHTML = '';
  els.expenseCount.textContent = `${expenses.length} 笔`;

  if (expenses.length === 0) {
    els.expenseList.innerHTML = '<p class="muted">还没有账单。可以先上传截图，或直接一句话记账。</p>';
    return;
  }

  expenses
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .forEach((expense) => {
      const item = document.createElement('article');
      item.className = 'expense-item';
      item.innerHTML = `
        <div class="expense-top">
          <div>
            <span class="tag">${escapeHtml(expense.scene || '其他')}</span>
            <span class="expense-name">${escapeHtml(expense.description || '未命名账单')}</span>
          </div>
          <span class="money">${formatMoney(expense.amount)} 元</span>
        </div>
        <p class="expense-meta">${escapeHtml(expense.date || '')} · ${escapeHtml(expense.payer)}付款 · ${formatShareLine(expense)}</p>
        ${expense.note ? `<p class="expense-meta">${escapeHtml(expense.note)}</p>` : ''}
        <div class="expense-actions">
          <span class="muted">${escapeHtml(sourceLabel(expense.source))}</span>
          <button class="danger-button" type="button" data-delete-expense="${expense.id}">删除</button>
        </div>
      `;
      els.expenseList.appendChild(item);
    });

  els.expenseList.querySelectorAll('[data-delete-expense]').forEach((button) => {
    button.addEventListener('click', () => {
      state.expenses = state.expenses.filter((expense) => expense.id !== button.dataset.deleteExpense);
      saveState();
      renderDetail();
    });
  });
}

function formatShareLine(expense) {
  const participants = getTripParticipants(expense.tripId);
  const shares = getExpenseShares(expense, participants);
  return participants
    .map((name) => `${name} ${formatMoney(shares[name])}`)
    .join(' / ');
}

function sourceLabel(source) {
  return {
    manual: '手动',
    sentence: '一句话',
    ocr: 'OCR',
    'ocr+sentence': 'OCR+一句话',
  }[source] || '手动';
}

function normalizeSentence(text) {
  return text
    .replace(/，/g, ',')
    .replace(/。/g, '.')
    .replace(/；/g, ';')
    .replace(/：/g, ':')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(text) {
  const full = text.match(/(\d{4})[年\-\/.](\d{1,2})[月\-\/.](\d{1,2})日?/);
  if (full) return `${full[1]}-${String(full[2]).padStart(2, '0')}-${String(full[3]).padStart(2, '0')}`;
  const md = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (md) return `${new Date().getFullYear()}-${String(md[1]).padStart(2, '0')}-${String(md[2]).padStart(2, '0')}`;
  return null;
}

function parseScene(text) {
  if (/美团|饿了么|外卖|配送/.test(text)) return '外卖';
  if (/酒店|民宿|住宿/.test(text)) return '住宿';
  if (/打车|滴滴|地铁|高铁|交通|车票/.test(text)) return '交通';
  if (/门票|景区|乐园/.test(text)) return '门票';
  if (/团购|套餐|大众点评/.test(text)) return '团购';
  if (/奶茶|咖啡|茶饮/.test(text)) return '奶茶';
  if (/购物|超市|便利店|衣服|服装|鞋|包/.test(text)) return '购物';
  if (/餐饮|晚餐|午餐|早餐|火锅|烤肉|饭|餐/.test(text)) return '餐饮';
  return null;
}

function parseAmount(text) {
  const arithmetic = parseArithmeticAmount(text);
  if (arithmetic !== null) return arithmetic;

  const patterns = [
    new RegExp(`(?:一共付款|总共付款|共付款|一共支付|总共支付|一共付了?|总共付了?)[^\\d零〇一二两俩三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟萬]*(${MONEY_TEXT})`, 'i'),
    new RegExp(`(?:券后付款|叠加券后付款|优惠后付款|满减后付款|实付|实际付款|支付金额|付款金额|总金额|合计|共计|总计|订单金额|金额)[^\\d零〇一二两俩三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟萬]*(${MONEY_TEXT})`, 'i'),
    /¥\s*(\d+(?:\.\d+)?)/,
    new RegExp(`(${MONEY_TEXT})\\s*(?:元|块|圆)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseMoneyValue(match[1]);
  }
  return null;
}

function parseArithmeticAmount(text) {
  const expression = findArithmeticExpression(text);
  return expression ? calculateArithmeticExpression(expression) : null;
}

function findArithmeticExpression(text) {
  const normalized = text
    .replace(/＋/g, '+')
    .replace(/－/g, '-')
    .replace(/—/g, '-')
    .replace(/加上/g, '+')
    .replace(/价/g, '+')
    .replace(/加/g, '+')
    .replace(/减去/g, '-')
    .replace(/减/g, '-');
  const prefixPattern = new RegExp(`(?:一共|总共|总金额|合计|共计|总计|花费|花了|消费|金额|实付|实际付款|支付金额|付款金额)[^\\d零〇一二两俩三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟萬]*(${MONEY_TEXT}(?:\\s*[+\\-]\\s*${MONEY_TEXT})+)`, 'i');
  const prefixed = normalized.match(prefixPattern);
  if (prefixed) return prefixed[1];

  const loose = normalized.match(new RegExp(`(${MONEY_TEXT}(?:\\s*[+\\-]\\s*${MONEY_TEXT})+)`, 'i'));
  if (loose && isPromotionRangeExpression(loose[1], normalized)) return null;
  return loose ? loose[1] : null;
}

function isPromotionRangeExpression(expression, text) {
  const compact = expression.replace(/\s+/g, '');
  const moneyUnit = '[零〇一二两俩三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟萬\\d.块元圆角毛分]+';
  const rangePattern = new RegExp(`^${moneyUnit}-${moneyUnit}$`, 'i');
  return rangePattern.test(compact) && /(?:凑|满|活动|门槛|档|券|优惠|满减)/.test(text);
}

function calculateArithmeticExpression(expression) {
  const compact = expression.replace(/\s+/g, '');
  const tokens = compact.match(new RegExp(`[+\\-]?${MONEY_TEXT}`, 'gi'));
  if (!tokens || tokens.length < 2) return null;

  return tokens.reduce((sum, token) => {
    const sign = token.startsWith('-') ? -1 : 1;
    const rawValue = token.replace(/^[+\-]/, '');
    const value = parseMoneyValue(rawValue);
    return value === null ? sum : sum + sign * value;
  }, 0);
}

function parseRawTotal(text) {
  const patterns = [
    new RegExp(`(?:实际价格|原价|券前|优惠前|未优惠|应付原价|商品总价)[^\\d零〇一二两俩三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟萬]*(${MONEY_TEXT})`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseMoneyValue(match[1]);
  }
  return null;
}

function parseDiscountAmount(text) {
  const patterns = [
    new RegExp(`(?:满减|立减|优惠|券|红包|抵扣|抵|减)[^\\d零〇一二两俩三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟萬]*(${MONEY_TEXT})`, 'i'),
    new RegExp(`满\\s*${MONEY_TEXT}\\s*(?:减|抵)\\s*(${MONEY_TEXT})`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseMoneyValue(match[1]);
  }
  return null;
}

function moneyValuesInSegment(segment) {
  const withoutDates = segment
    .replace(/\d{4}[年\-\/.]\d{1,2}[月\-\/.]\d{1,2}日?/g, ' ')
    .replace(/\d{1,2}月\d{1,2}日/g, ' ');
  const moneyLike = `(?:\\d+(?:\\.\\d+)?|[零〇一二两俩三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟萬]+(?:[块元圆])(?:[零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]+[角毛](?:[零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]+分?)?)?(?:[零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]+分)?|[零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]+[角毛][零〇一二两俩三四五六七八九十壹贰叁肆伍陆柒捌玖]*分?)`;
  const matches = [...withoutDates.matchAll(new RegExp(moneyLike, 'gi'))];
  return matches
    .map((match) => parseMoneyValue(match[0]))
    .filter((value) => value !== null);
}

function sumPersonAmounts(text, person, options = {}) {
  const aliases = person === 'H女士'
    ? ['H女士', 'h女士', '我']
    : ['Daisy', 'daisy', 'Daisy女士', 'daisy女士'];
  const segments = text.split(/[,，;；。]/).map((item) => item.trim()).filter(Boolean);
  const totalKeywords = /(?:总金额|合计|共计|总计|订单金额|实际付款|实付|支付金额|付款金额|券后付款|优惠后付款|满减后付款)/;
  const personalKeywords = /(?:应收|分摊|吃|点|买|买了|花|消费|凑|凑单|原价|一件|商品|饮料|奶茶|小食|门票|车票|房费|酒店)/;
  const paymentOnly = /(?:付款|支付|付|买单|下单|垫付)/;
  const totalPayment = /(?:(?:一共|总共|共|合计|总计).{0,6}(?:付款|支付|付)|(?:实际付款|实付|券后付款|优惠后付款|满减后付款))/;
  let sum = 0;

  for (const segment of segments) {
    if (!aliases.some((alias) => segment.includes(alias))) continue;
    if (totalPayment.test(segment)) continue;
    if (totalKeywords.test(segment) && !personalKeywords.test(segment)) continue;
    if (paymentOnly.test(segment) && !personalKeywords.test(segment) && !options.treatPaymentAsPersonal) continue;

    const values = moneyValuesInSegment(segment);
    if (values.length > 0) {
      sum += values.reduce((part, value) => part + value, 0);
    }
  }

  return sum > 0 ? sum : null;
}

function parseSemanticSplit(text) {
  const discountContext = /(?:凑单|满减|叠加券|优惠|券后|红包|抵扣|抵|减|实际价格|原价|券前|优惠前)/.test(text);
  const hWeight = sumPersonAmounts(text, 'H女士', { treatPaymentAsPersonal: discountContext });
  const daisyWeight = sumPersonAmounts(text, 'Daisy', { treatPaymentAsPersonal: discountContext });
  const rawTotal = parseRawTotal(text) || (hWeight !== null && daisyWeight !== null ? hWeight + daisyWeight : null);
  const discount = parseDiscountAmount(text);
  let paidAmount = parseAmount(text);

  if ((paidAmount === null || paidAmount === rawTotal) && rawTotal !== null && discount !== null) {
    paidAmount = Math.max(0, rawTotal - discount);
  } else if (paidAmount === null && rawTotal !== null) {
    paidAmount = rawTotal;
  }

  if (hWeight === null || daisyWeight === null || paidAmount === null) {
    return null;
  }

  const shouldProrate = discountContext || Math.abs(hWeight + daisyWeight - paidAmount) > 0.01;
  if (!shouldProrate) {
    return { amount: paidAmount, shareH: hWeight, shareDaisy: daisyWeight };
  }

  const weightTotal = hWeight + daisyWeight;
  if (weightTotal <= 0) return null;
  return {
    amount: paidAmount,
    shareH: (paidAmount * hWeight) / weightTotal,
    shareDaisy: (paidAmount * daisyWeight) / weightTotal,
  };
}

function parsePersonAmount(text, person) {
  const names = person === 'H女士' ? '(?:H女士|h女士|我)' : '(?:Daisy|daisy)';
  const direct = new RegExp(`${names}\\s*(?:女士)?\\s*(?:应收|分摊|吃|花|消费|付款|支付|付了?|垫付|凑了?一?件?|凑单|原价|买了?|占)?\\s*(${MONEY_TEXT})`, 'i');
  const directMatch = text.match(direct);
  return directMatch ? parseMoneyValue(directMatch[1]) : null;
}

function parsePayer(text) {
  if (/(?:Daisy|daisy)\s*(?:女士)?[^,，;；。]{0,8}(?:付款|支付|付|买单|下单)/i.test(text)) return 'Daisy';
  if (/(?:H女士|h女士|我)\s*[^,，;；。]{0,8}(?:付款|支付|付|买单|下单)/i.test(text)) return 'H女士';
  return null;
}

function regexEscape(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasesForParticipant(name) {
  const aliases = [name];
  if (name === 'H女士') aliases.push('h女士', '我');
  if (/^daisy$/i.test(name)) aliases.push('Daisy女士', 'daisy女士');
  return [...new Set(aliases.filter(Boolean))];
}

function parsePayerForParticipants(text, participants) {
  for (const name of participants) {
    const aliases = aliasesForParticipant(name).map(regexEscape).join('|');
    const pattern = new RegExp(`(?:${aliases})\\s*(?:女士)?[^,，;；。]{0,8}(?:付款|支付|付|买单|下单)`, 'i');
    if (pattern.test(text)) return name;
  }
  return parsePayer(text);
}

function parsePersonAmountForParticipant(text, participant) {
  const aliases = aliasesForParticipant(participant).map(regexEscape).join('|');
  const direct = new RegExp(`(?:${aliases})\\s*(?:女士)?\\s*(?:应收|分摊|吃|花|消费|付款|支付|付了?|垫付|凑了?一?件?|凑单|原价|买了?|占)?\\s*(${MONEY_TEXT})`, 'i');
  const directMatch = text.match(direct);
  return directMatch ? parseMoneyValue(directMatch[1]) : null;
}

function sumParticipantAmounts(text, participant, options = {}) {
  const aliases = aliasesForParticipant(participant);
  const segments = text.split(/[,，;；。]/).map((item) => item.trim()).filter(Boolean);
  const totalKeywords = /(?:总金额|合计|共计|总计|订单金额|实际付款|实付|支付金额|付款金额|券后付款|优惠后付款|满减后付款)/;
  const personalKeywords = /(?:应收|分摊|吃|点|买|买了|花|消费|凑|凑单|原价|一件|商品|饮料|奶茶|小食|门票|车票|房费|酒店)/;
  const paymentOnly = /(?:付款|支付|付|买单|下单|垫付)/;
  const totalPayment = /(?:(?:一共|总共|共|合计|总计).{0,6}(?:付款|支付|付)|(?:实际付款|实付|券后付款|优惠后付款|满减后付款))/;
  let sum = 0;

  for (const segment of segments) {
    if (!aliases.some((alias) => segment.toLowerCase().includes(alias.toLowerCase()))) continue;
    if (totalPayment.test(segment)) continue;
    if (totalKeywords.test(segment) && !personalKeywords.test(segment)) continue;
    if (paymentOnly.test(segment) && !personalKeywords.test(segment) && !options.treatPaymentAsPersonal) continue;

    const values = moneyValuesInSegment(segment);
    if (values.length > 0) sum += values.reduce((part, value) => part + value, 0);
  }

  return sum > 0 ? sum : null;
}

function parseSemanticSplitForParticipants(text, participants) {
  const discountContext = /(?:凑单|满减|叠加券|优惠|券后|红包|抵扣|抵|减|实际价格|原价|券前|优惠前)/.test(text);
  const weights = {};
  participants.forEach((name) => {
    const value = sumParticipantAmounts(text, name, { treatPaymentAsPersonal: discountContext });
    if (value !== null) weights[name] = value;
  });
  const weightEntries = Object.entries(weights);
  if (weightEntries.length < 2) return null;

  const rawTotal = parseRawTotal(text) || weightEntries.reduce((sum, [, value]) => sum + value, 0);
  const discount = parseDiscountAmount(text);
  let paidAmount = parseAmount(text);

  if ((paidAmount === null || paidAmount === rawTotal) && rawTotal !== null && discount !== null) {
    paidAmount = Math.max(0, rawTotal - discount);
  } else if (paidAmount === null && rawTotal !== null) {
    paidAmount = rawTotal;
  }

  if (paidAmount === null) return null;

  const weightTotal = weightEntries.reduce((sum, [, value]) => sum + value, 0);
  const shouldProrate = discountContext || Math.abs(weightTotal - paidAmount) > 0.01;
  const shares = {};
  weightEntries.forEach(([name, value]) => {
    shares[name] = shouldProrate ? (paidAmount * value) / weightTotal : value;
  });

  return { amount: paidAmount, shares };
}

function parseNote(text) {
  const match = text.match(/(?:备注|说明|交易备注)[:： ]*([^;；。]+)/i);
  if (match) return match[1].trim();
  return parseActivityNote(text);
}

function parseDescription(text, scene) {
  const note = parseNote(text);
  const item = parsePurchasedItem(text);
  if (item) return item;

  let description = text;
  if (note) description = description.replace(note, '');
  description = description
    .replace(/(?:\d{4}[年\-\/.]\d{1,2}[月\-\/.]\d{1,2}日?|\d{1,2}月\d{1,2}日)/g, ' ')
    .replace(/(?:实付|实际付款|支付金额|付款金额|总金额|合计|共计|总计|订单金额|金额|备注|说明|交易备注|付款人)[^,，;；。]*/gi, ' ')
    .replace(/(?:Daisy|daisy|H女士|h女士|我)\s*(?:应收|分摊|吃|花|消费|付款|支付|付|买单|下单)?\s*\d*(?:\.\d+)?/gi, ' ')
    .replace(/(?:凑|满)\s*\d+(?:\.\d+)?\s*[-到至~－—]\s*\d+(?:\.\d+)?(?:活动)?/g, ' ')
    .replace(/活动/g, ' ')
    .replace(/[¥￥\d.,，。;；:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (scene && description === scene) return '';
  return description.slice(0, 24);
}

function parseActivityNote(text) {
  const firstSegment = text.split(/[,，;；。]/).map((item) => item.trim()).find(Boolean) || '';
  const activity = firstSegment.match(/((?:凑|满)[^,，;；。]{0,30}活动)/);
  return activity ? activity[1].trim() : null;
}

function parsePurchasedItem(text) {
  const activity = parseActivityNote(text);
  const source = activity || text;
  const patterns = [
    /(?:买|购买|购入|买了)([^,，;；。]*?)(?:活动|券|优惠|满减|$)/,
    /(?:点|点了|吃|吃了)([^,，;；。]*?)(?:活动|券|优惠|满减|$)/,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const item = cleanPurchasedItem(match[1]);
    if (item) return item;
  }

  return null;
}

function cleanPurchasedItem(text) {
  return text
    .replace(/(?:凑|满)\s*\d+(?:\.\d+)?\s*[-到至~－—]\s*\d+(?:\.\d+)?/g, ' ')
    .replace(/(?:活动|优惠|券|满减|凑单|一共|总共|实际|实付|付款|支付|金额)/g, ' ')
    .replace(/(?:Daisy|daisy|H女士|h女士|女士|我)/g, ' ')
    .replace(/[¥￥\d.,，。;；:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

function parseSentence(text, participants = getTripParticipants()) {
  const normalized = normalizeSentence(text);
  const semantic = parseSemanticSplitForParticipants(normalized, participants) || parseSemanticSplit(normalized);
  const date = parseDate(normalized);
  const scene = parseScene(normalized);
  const payer = parsePayerForParticipants(normalized, participants);
  const note = parseNote(normalized);
  let amount = semantic?.amount ?? parseAmount(normalized);
  const shares = semantic?.shares ? { ...semantic.shares } : {};
  participants.forEach((name) => {
    if (shares[name] === undefined) {
      const value = parsePersonAmountForParticipant(normalized, name);
      if (value !== null) shares[name] = value;
    }
  });
  let shareH = shares['H女士'] ?? semantic?.shareH ?? parsePersonAmount(normalized, 'H女士');
  let shareDaisy = shares.Daisy ?? semantic?.shareDaisy ?? parsePersonAmount(normalized, 'Daisy');
  const usesWeight = /(?:花|消费|凑单|凑了|凑一件|原价|实际价格|叠加券|满减|抵|优惠|券后)/.test(normalized)
    && /(?:券后付款|叠加券后付款|优惠后付款|满减后付款|实付|实际付款|支付金额|付款金额|付款)/.test(normalized);

  if (!semantic && usesWeight && amount && shareH !== null && shareDaisy !== null) {
    const weightTotal = shareH + shareDaisy;
    shareH = weightTotal ? (amount * shareH) / weightTotal : shareH;
    shareDaisy = weightTotal ? (amount * shareDaisy) / weightTotal : shareDaisy;
  } else if (!amount && shareH !== null && shareDaisy !== null) {
    amount = shareH + shareDaisy;
  } else if (amount !== null && shareH === null && shareDaisy === null && findArithmeticExpression(normalized)) {
    participants.forEach((name) => {
      shares[name] = amount / participants.length;
    });
    shareH = shares['H女士'] ?? null;
    shareDaisy = shares.Daisy ?? null;
  }
  if (participants.includes('H女士') && shareH !== null && shareH !== undefined) shares['H女士'] = shareH;
  if (participants.includes('Daisy') && shareDaisy !== null && shareDaisy !== undefined) shares.Daisy = shareDaisy;

  return {
    date,
    scene,
    payer,
    note,
    amount,
    shares,
    shareH,
    shareDaisy,
    description: parseDescription(normalized, scene),
  };
}

function parseOcrText(text) {
  const normalized = normalizeSentence(text);
  const scene = parseScene(normalized) || '其他';
  return {
    date: parseDate(normalized),
    scene,
    amount: parseAmount(normalized),
    description: extractOcrDescription(normalized, scene),
    note: parseOcrNote(normalized),
  };
}

function extractOcrDescription(text, scene) {
  const lines = text
    .split(/[\n,，。;；]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/(实付|支付|合计|总计|金额|时间|订单|优惠|配送|¥|￥|\d+\.\d+)/.test(line));
  return (lines[0] || scene || '账单').slice(0, 24);
}

function parseOcrNote(text) {
  const amount = parseAmount(text);
  const scene = parseScene(text) || '其他';
  const parts = [`OCR识别：${scene}`];
  if (amount) parts.push(`金额${formatMoney(amount)}`);
  return parts.join('，');
}

function applyParsedFields(fields, source) {
  const participants = getTripParticipants();
  if (fields.date) els.entryDate.value = fields.date;
  if (fields.scene && SCENES.includes(fields.scene)) els.entryScene.value = fields.scene;
  if (fields.description) els.entryDescription.value = fields.description;
  if (fields.amount !== null && fields.amount !== undefined) els.entryAmount.value = formatMoney(fields.amount);
  if (fields.payer && participants.includes(fields.payer)) els.entryPayer.value = fields.payer;
  const shares = fields.shares || legacySharesFromFields(fields, participants);
  Object.entries(shares).forEach(([name, value]) => {
    const input = shareInputFor(name);
    if (input && value !== null && value !== undefined) input.value = formatMoney(value);
  });
  if (fields.note) els.entryNote.value = fields.note;
  els.entrySource.value = mergeSource(els.entrySource.value, source);
  renderChips();
}

function legacySharesFromFields(fields, participants = getTripParticipants()) {
  const shares = {};
  if (participants.includes('H女士') && fields.shareH !== null && fields.shareH !== undefined) shares['H女士'] = fields.shareH;
  if (participants.includes('Daisy') && fields.shareDaisy !== null && fields.shareDaisy !== undefined) shares.Daisy = fields.shareDaisy;
  return shares;
}

function mergeSource(current, next) {
  if ((current === 'ocr' && next === 'sentence') || (current === 'sentence' && next === 'ocr') || current === 'ocr+sentence') {
    return 'ocr+sentence';
  }
  return next || current || 'manual';
}

function renderChips() {
  const shareChips = Object.entries(readShareInputs())
    .filter(([, value]) => value !== '')
    .map(([name, value]) => [name, `${formatMoney(value)}元`]);
  const chips = [
    ['日期', els.entryDate.value],
    ['场景', els.entryScene.value],
    ['总额', els.entryAmount.value ? `${formatMoney(els.entryAmount.value)}元` : ''],
    ['付款', els.entryPayer.value],
    ...shareChips,
  ].filter(([, value]) => value);

  els.extractedChips.innerHTML = chips.map(([label, value]) => (
    `<span class="chip">${label} ${escapeHtml(value)}</span>`
  )).join('');
}

function shareInputFor(name) {
  return els.shareFields.querySelector(`[data-share-name="${cssEscape(name)}"]`);
}

function readShareInputs() {
  const shares = {};
  els.shareFields.querySelectorAll('.entry-share').forEach((input) => {
    shares[input.dataset.shareName] = input.value;
  });
  return shares;
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function computeShares(amount, shareInputs, participants = getTripParticipants()) {
  const total = Number(amount);
  const provided = participants
    .map((name) => ({ name, value: shareInputs[name] === '' || shareInputs[name] === undefined ? null : Number(shareInputs[name]) }));
  const specifiedTotal = provided.reduce((sum, item) => sum + (item.value === null ? 0 : item.value), 0);
  const missing = provided.filter((item) => item.value === null);
  const remaining = Math.max(0, total - specifiedTotal);

  if (missing.length === participants.length) {
    return participants.reduce((shares, name) => {
      shares[name] = total / participants.length;
      return shares;
    }, {});
  }

  return provided.reduce((shares, item) => {
    shares[item.name] = item.value === null ? remaining / missing.length : item.value;
    return shares;
  }, {});
}

function saveExpense(event) {
  event.preventDefault();
  const amount = toNumber(els.entryAmount.value);
  const participants = getTripParticipants();
  const shares = computeShares(amount, readShareInputs(), participants);
  const diff = Math.abs(Object.values(shares).reduce((sum, value) => sum + value, 0) - amount);

  if (!state.currentTripId) return setMessage('请先进入一个行程。');
  if (!els.entryDate.value || !els.entryDescription.value.trim()) return setMessage('日期和消费物品都要填一下。');
  if (amount <= 0) return setMessage('总金额需要大于 0。');
  if (diff > 0.01) return setMessage(`两人分摊合计和总金额差 ${formatMoney(diff)} 元，请确认。`);

  state.expenses.push({
    id: uid('expense'),
    tripId: state.currentTripId,
    date: els.entryDate.value,
    scene: els.entryScene.value,
    description: els.entryDescription.value.trim(),
    amount,
    payer: els.entryPayer.value,
    shares: Object.fromEntries(Object.entries(shares).map(([name, value]) => [name, Number(formatMoney(value))])),
    shareH: Number(formatMoney(shares['H女士'] || 0)),
    shareDaisy: Number(formatMoney(shares.Daisy || 0)),
    note: els.entryNote.value.trim(),
    source: els.entrySource.value || 'manual',
    ocrText: els.ocrTextOutput.value.trim(),
    sentenceText: els.sentenceInput.value.trim(),
    createdAt: new Date().toISOString(),
  });

  saveState();
  resetForm(true);
  renderDetail();
  setMessage('已保存到账本。');
}

function setMessage(text) {
  els.formMessage.textContent = text;
  if (text) {
    window.setTimeout(() => {
      if (els.formMessage.textContent === text) els.formMessage.textContent = '';
    }, 2600);
  }
}

function resetForm(keepDate = true) {
  els.expenseForm.reset();
  els.entryDate.value = keepDate ? today() : '';
  els.entryScene.value = '外卖';
  renderParticipantControls();
  els.entrySource.value = 'manual';
  els.extractedChips.innerHTML = '';
}

function buildAnalysisText() {
  const trip = currentTrip();
  const summary = summarize();
  if (!trip || summary.expenses.length === 0) return '还没有账单，保存后会生成可发送的分析。';

  const transfers = settlementTransfers(summary.people);
  const lines = [
    `行程：${trip.name}`,
    `角色：${summary.participants.join('、')}`,
    `总金额：${formatMoney(summary.total)} 元`,
    '',
    ...summary.people.map((person) => (
      `${person.name}：已付 ${formatMoney(person.paid)}，分摊 ${formatMoney(person.share)}，净额 ${formatMoney(person.net)}`
    )),
    '',
    `结算：${settlementText(summary)}`,
    ...transfers.slice(1).map((transfer) => `${transfer.from}需转 ${transfer.to} ¥${formatMoney(transfer.amount)}`),
    '',
    '账单明细：',
  ];

  summary.expenses.forEach((expense, index) => {
    lines.push(`${index + 1}. ${expense.date} ${expense.scene} ${expense.description} ${formatMoney(expense.amount)}元，${expense.payer}付款，${formatShareLine(expense)}`);
  });

  return lines.join('\n');
}

async function shareAnalysis() {
  const text = buildAnalysisText();
  if (navigator.share) {
    try {
      await navigator.share({ title: '账单分析', text });
      return;
    } catch (error) {
      // If the user closes the share sheet, fall back to copy.
    }
  }
  await copyText(text);
  setMessage('账单分析已复制，可以发给 Daisy。');
}

async function copyText(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function bindEvents() {
  els.createTripButton.addEventListener('click', () => {
    const name = els.newTripName.value.trim();
    if (!name) return;
    const trip = { id: uid('trip'), name, participants: getNewTripParticipants(), createdAt: new Date().toISOString() };
    state.trips.unshift(trip);
    state.currentTripId = trip.id;
    els.newTripName.value = '';
    els.tripRoleInputs.forEach((input) => {
      input.value = '';
    });
    saveState();
    openTrip(trip.id);
  });

  els.newTripName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') els.createTripButton.click();
  });

  els.backToTrips.addEventListener('click', showTrips);
  els.shareTripButton.addEventListener('click', shareAnalysis);
  els.copyAnalysisButton.addEventListener('click', async () => {
    await copyText(buildAnalysisText());
    setMessage('账单分析已复制。');
  });

  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.mode-panel').forEach((panel) => panel.classList.add('hidden'));
      $(`${tab.dataset.mode}-mode`).classList.remove('hidden');
    });
  });

  els.parseSentenceButton.addEventListener('click', () => {
    const text = els.sentenceInput.value.trim();
    if (!text) return setMessage('先输入一句话账单说明。');
    applyParsedFields(parseSentence(text, getTripParticipants()), 'sentence');
    setMessage('已从一句话里提取账单分摊。');
  });

  els.ocrImageInput.addEventListener('change', () => {
    const file = els.ocrImageInput.files?.[0];
    if (!file) return;
    els.ocrPreview.src = URL.createObjectURL(file);
    els.ocrPreview.classList.remove('hidden');
  });

  els.ocrExtractButton.addEventListener('click', async () => {
    const file = els.ocrImageInput.files?.[0];
    if (!file) return setMessage('先选择一张账单截图。');
    if (!window.Tesseract) return setMessage('OCR 脚本暂时不可用，可以先把账单文字粘贴到 OCR 原文框再分析。');

    els.ocrStatus.textContent = '正在识别图片...';
    try {
      const result = await Tesseract.recognize(file, 'chi_sim+eng', {
        logger: (message) => {
          if (message.status === 'recognizing text') {
            els.ocrStatus.textContent = `识别中 ${Math.round(message.progress * 100)}%`;
          }
        },
      });
      const text = result.data.text.trim();
      els.ocrTextOutput.value = text;
      applyParsedFields(parseOcrText(text), 'ocr');
      els.ocrStatus.textContent = '已提取图片中的账单信息。可以再用一句话补充分摊。';
    } catch (error) {
      els.ocrStatus.textContent = '识别失败，可以手动粘贴账单文字或直接录入。';
    }
  });

  els.analyzeOcrTextButton.addEventListener('click', () => {
    const text = els.ocrTextOutput.value.trim();
    if (!text) return setMessage('先粘贴或识别一段账单文字。');
    applyParsedFields(parseOcrText(text), 'ocr');
    setMessage('已分析账单文字。');
  });

  [els.entryDate, els.entryScene, els.entryAmount, els.entryPayer]
    .forEach((input) => input.addEventListener('input', renderChips));

  els.expenseForm.addEventListener('submit', saveExpense);
}

loadState();
bindEvents();
renderTrips();
resetForm(false);

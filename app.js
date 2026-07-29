const policies = {
  apple: {
    name: 'Apple',
    days: 14,
    url: 'https://www.apple.com/shop/help/returns_refund',
    note: 'Apple’s U.S. standard policy gives 14 calendar days from receipt for eligible items purchased directly from Apple. Some items are ineligible or have additional conditions.'
  },
  bestbuy: {
    name: 'Best Buy',
    days: 15,
    url: 'https://www.bestbuy.com/site/help-topics/return-exchange-policy/pcmcat260800050014.c',
    note: 'Best Buy’s standard window is 15 days for most products. Plus/Total members and certain product categories may have different windows or fees.'
  },
  target: {
    name: 'Target',
    days: 90,
    url: 'https://www.target.com/help/articles/returns-exchanges/returns',
    note: 'Target’s standard policy covers most unopened items sold by Target in new condition for 90 days. Target Plus, electronics, owned brands, Circle benefits and final-sale categories may differ.'
  }
};

const form = document.querySelector('#returnForm');
const result = document.querySelector('#result');
const store = document.querySelector('#store');
const purchaseDate = document.querySelector('#purchaseDate');
const itemName = document.querySelector('#itemName');
const customDaysWrap = document.querySelector('#customDaysWrap');
const customDays = document.querySelector('#customDays');
const receiptInput = document.querySelector('#receiptInput');
const receiptPill = document.querySelector('#receiptPill');

purchaseDate.max = new Date().toISOString().slice(0,10);

store.addEventListener('change', () => {
  customDaysWrap.classList.toggle('hidden', store.value !== 'custom');
});

document.querySelectorAll('[data-scroll]').forEach(btn => {
  btn.addEventListener('click', () => document.querySelector(btn.dataset.scroll)?.scrollIntoView({behavior:'smooth'}));
});

document.querySelector('#focusForm').addEventListener('click', () => store.focus());

receiptInput.addEventListener('change', () => {
  const file = receiptInput.files?.[0];
  if (!file) return;
  const max = 8 * 1024 * 1024;
  if (file.size > max) {
    receiptPill.textContent = 'That file is over 8 MB. Choose a smaller receipt image or PDF.';
    receiptPill.classList.remove('hidden');
    receiptInput.value = '';
    return;
  }
  receiptPill.textContent = `✓ ${file.name} added locally. This MVP does not pretend to OCR it yet — enter the store and date to calculate accurately.`;
  receiptPill.classList.remove('hidden');
  store.focus();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!store.value || !purchaseDate.value) return;

  const start = parseLocalDate(purchaseDate.value);
  const today = startOfDay(new Date());
  if (start > today) {
    alert('The purchase / received date cannot be in the future.');
    return;
  }

  let policy;
  if (store.value === 'custom') {
    const days = Number(customDays.value);
    if (!Number.isFinite(days) || days < 1) return;
    policy = {
      name: 'Custom store',
      days,
      url: '',
      note: 'Custom result: verify the actual retailer policy and any product-specific exceptions before relying on this deadline.'
    };
  } else {
    policy = policies[store.value];
  }

  const deadline = addDays(start, policy.days);
  const msPerDay = 86400000;
  const daysLeft = Math.ceil((deadline - today) / msPerDay);
  const elapsed = Math.max(0, Math.floor((today - start) / msPerDay));
  const remainingRatio = Math.max(0, Math.min(1, (policy.days - elapsed) / policy.days));
  const eligible = daysLeft >= 0;

  form.classList.add('hidden');
  result.classList.remove('hidden');

  const badge = document.querySelector('#statusBadge');
  badge.classList.toggle('expired', !eligible);
  badge.textContent = eligible ? 'Inside standard window' : 'Standard window passed';

  const title = document.querySelector('#resultTitle');
  if (eligible) {
    title.textContent = daysLeft === 0 ? 'Today may be your last day' : `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
  } else {
    const past = Math.abs(daysLeft);
    title.textContent = `The standard window passed ${past} day${past === 1 ? '' : 's'} ago`;
  }

  document.querySelector('#deadlineText').textContent = eligible
    ? `Estimated standard return deadline: ${formatDate(deadline)}.`
    : `Estimated standard deadline was ${formatDate(deadline)}. Check exceptions anyway.`;

  document.querySelector('#progressFill').style.width = `${remainingRatio * 100}%`;
  document.querySelector('#resultStore').textContent = policy.name;
  document.querySelector('#resultItem').textContent = itemName.value.trim() || 'Not specified';
  document.querySelector('#resultDate').textContent = formatDate(start);
  document.querySelector('#resultWindow').textContent = `${policy.days} days`;
  document.querySelector('#policyNote').textContent = policy.note;

  const link = document.querySelector('#policyLink');
  if (policy.url) {
    link.href = policy.url;
    link.classList.remove('hidden');
  } else {
    link.classList.add('hidden');
  }
});

document.querySelector('#checkAnother').addEventListener('click', () => {
  result.classList.add('hidden');
  form.classList.remove('hidden');
  itemName.value = '';
  store.focus();
});

function parseLocalDate(value) {
  const [y,m,d] = value.split('-').map(Number);
  return new Date(y,m-1,d);
}
function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {weekday:'short', month:'long', day:'numeric', year:'numeric'}).format(date);
}

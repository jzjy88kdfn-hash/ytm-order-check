(() => {
  'use strict';
  const ACCESS_HASH = 'ed946f65d2c785d90e827c5ffd879ce3b49c68d4c88013074176a7e73bc58bcf';
  const ACCESS_STORAGE_KEY = 'ytm_access_until';
  const ACCESS_DAYS = 30;
  const gate = document.getElementById('accessGate');
  const accessForm = document.getElementById('accessForm');
  const accessPassword = document.getElementById('accessPassword');
  const accessError = document.getElementById('accessError');

  function unlock() {
    document.body.classList.remove('access-locked');
    gate.hidden = true;
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  const accessUntil = Number(localStorage.getItem(ACCESS_STORAGE_KEY));
  if (accessUntil > Date.now()) {
    unlock();
  } else {
    localStorage.removeItem(ACCESS_STORAGE_KEY);
    requestAnimationFrame(() => accessPassword.focus());
  }

  accessForm.addEventListener('submit', async event => {
    event.preventDefault();
    accessError.textContent = '';
    const submittedHash = await sha256(accessPassword.value);
    if (submittedHash === ACCESS_HASH) {
      localStorage.setItem(ACCESS_STORAGE_KEY, String(Date.now() + ACCESS_DAYS * 24 * 60 * 60 * 1000));
      accessPassword.value = '';
      unlock();
      return;
    }
    accessPassword.value = '';
    accessError.textContent = 'パスワードが違います';
    const panel = accessForm;
    panel.classList.remove('shake');
    void panel.offsetWidth;
    panel.classList.add('shake');
    accessPassword.focus();
  });

  const TAX_RATE = 10;
  const MIN_RATE = 50;
  const MAX_RATE = 100;
  const DEFAULT_RATE = 70;
  const PRESETS = [50,60,65,70,75,80,85,90,95,100];
  const $ = id => document.getElementById(id);
  const money = n => `${Math.max(0, Math.trunc(n)).toLocaleString('ja-JP')}円`;
  const numeric = value => {
    const s = String(value ?? '').replace(/[^0-9]/g, '');
    return s ? Math.min(Number(s), 999999999999) : 0;
  };
  const clampRate = n => Math.max(MIN_RATE, Math.min(MAX_RATE, Math.round(Number(n) || DEFAULT_RATE)));

  function taxFromGross(gross) {
    // 税込金額に含まれる10%消費税相当額。1円未満切捨て。
    return Math.floor(gross * TAX_RATE / (100 + TAX_RATE));
  }

  function calculate(salesGross, rate) {
    salesGross = Math.max(0, Math.trunc(salesGross));
    rate = clampRate(rate);
    const orderGross = Math.round(salesGross * rate / 100);
    const outputTax = taxFromGross(salesGross);
    const inputTax = taxFromGross(orderGross);
    const consumptionTaxGap = Math.max(0, outputTax - inputTax);
    const grossGap = salesGross - orderGross;
    const profitAfterConsumptionTax = Math.max(0, grossGap - consumptionTaxGap);
    const salesNet = salesGross - outputTax;
    const orderNet = orderGross - inputTax;
    const ownRate = 100 - rate;
    return {salesGross, rate, ownRate, orderGross, outputTax, inputTax, consumptionTaxGap, grossGap, profitAfterConsumptionTax, salesNet, orderNet};
  }
  window.YTM_CALCULATE = calculate;

  const sales = $('salesInput');
  const slider = $('rateSlider');
  const quick = $('quickRates');

  PRESETS.forEach(r => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.rate = r;
    b.textContent = `${r}%`;
    b.addEventListener('click', () => setRate(r));
    quick.appendChild(b);
  });

  function setRate(rate) {
    slider.value = clampRate(rate);
    render();
  }

  function render() {
    const x = calculate(numeric(sales.value), slider.value);
    $('rateNumber').textContent = x.rate;
    $('rateBox').textContent = `${x.rate}%`;
    $('heroRateText').textContent = x.rate;
    $('orderGross').textContent = money(x.orderGross);
    $('ownRate').textContent = `${x.ownRate}%`;
    $('grossGap').textContent = money(x.grossGap);
    $('taxGap').textContent = money(x.consumptionTaxGap);
    $('profitAfterTax').textContent = money(x.profitAfterConsumptionTax);
    $('outputTax').textContent = money(x.outputTax);
    $('inputTax').textContent = money(x.inputTax);
    $('salesNet').textContent = money(x.salesNet);
    $('orderNet').textContent = money(x.orderNet);
    $('fSales').textContent = money(x.salesGross);
    $('fOrder').textContent = money(x.orderGross);
    $('fGap').textContent = money(x.grossGap);
    $('fTax').textContent = money(x.consumptionTaxGap);
    $('fProfit').textContent = money(x.profitAfterConsumptionTax);
    document.querySelectorAll('#quickRates button').forEach(b => b.classList.toggle('active', Number(b.dataset.rate) === x.rate));
    window.__YTM_LAST = x;
  }

  sales.addEventListener('focus', () => {
    const n = numeric(sales.value);
    sales.value = n ? String(n) : '';
  });
  sales.addEventListener('input', render);
  sales.addEventListener('blur', () => {
    const n = numeric(sales.value);
    sales.value = n ? n.toLocaleString('ja-JP') : '';
    render();
  });
  $('clearAmount').addEventListener('click', () => { sales.value=''; sales.focus(); render(); });
  slider.addEventListener('input', render);
  $('minusRate').addEventListener('click', () => setRate(Number(slider.value)-1));
  $('plusRate').addEventListener('click', () => setRate(Number(slider.value)+1));
  $('saveDefault').addEventListener('click', () => {
    localStorage.setItem('ytm_default_order_rate', String(clampRate(slider.value)));
    toast(`標準発注率 ${clampRate(slider.value)}% を保存しました`);
  });
  $('restoreDefault').addEventListener('click', () => {
    const saved = Number(localStorage.getItem('ytm_default_order_rate'));
    setRate(saved >= MIN_RATE && saved <= MAX_RATE ? saved : DEFAULT_RATE);
    toast('標準発注率を呼び出しました');
  });
  $('toggleDetails').addEventListener('click', () => {
    const d=$('taxDetails'); const open=d.hidden; d.hidden=!open;
    $('detailsMark').textContent = open ? '▲' : '▼';
  });

  function toast(msg){
    const t=$('toast'); t.textContent=msg; t.classList.add('show');
    clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove('show'),1500);
  }

  $('copyResult').addEventListener('click', async () => {
    const x = window.__YTM_LAST;
    const text = `【山﨑塗装 発注金額査定】\n受注金額（税込）：${money(x.salesGross)}\n発注率：${x.rate}%\n協力会社への発注金額（税込）：${money(x.orderGross)}\n自社残り率：${x.ownRate}%\n受注−発注差額（税込）：${money(x.grossGap)}\n消費税差額（概算）：${money(x.consumptionTaxGap)}\n消費税差引後粗利益（概算）：${money(x.profitAfterConsumptionTax)}\n※所得税・住民税・事業税・現場経費等は未反映`;
    try { await navigator.clipboard.writeText(text); toast('査定結果をコピーしました'); }
    catch(e){
      const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('査定結果をコピーしました');
    }
  });

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  $('installTip').hidden = standalone;
  const saved = Number(localStorage.getItem('ytm_default_order_rate'));
  slider.value = saved >= MIN_RATE && saved <= MAX_RATE ? saved : DEFAULT_RATE;
  sales.value = numeric(sales.value).toLocaleString('ja-JP');
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  }
})();

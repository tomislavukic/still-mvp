(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let root;
  let activeRow;
  let currentData;

  function connectedCases() {
    try {
      const value = JSON.parse(localStorage.getItem('still-connected-cases-v60') || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  async function requestReward(row) {
    const response = await fetch(`/api/v1/cases/${encodeURIComponent(row.publicId)}/rewards`, {
      headers: { 'x-still-case-token': row.accessToken }
    });
    if (!response.ok) throw new Error('reward_unavailable');
    return response.json();
  }

  async function claimReward(row, offerId) {
    const response = await fetch(`/api/v1/cases/${encodeURIComponent(row.publicId)}/rewards/offers/${encodeURIComponent(offerId)}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-still-case-token': row.accessToken }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'claim_failed'), { data });
    return data;
  }

  function mountTeaser() {
    if ($('#buyerRewardsTeaserV91')) return;
    const positioning = $('.op83-positioning');
    if (!positioning) return;
    const teaser = document.createElement('a');
    teaser.id = 'buyerRewardsTeaserV91';
    teaser.className = 'v91-reward-teaser';
    teaser.href = '#buyerRewardsV76';
    teaser.innerHTML = `<span aria-hidden="true">★</span><b>${t('Still? Rewards', 'Still? Nagrade')}</b><small>${t('Earn points for reliable participation and use them for benefits from verified companies.', 'Zaradi bodove pouzdanim sudjelovanjem i koristi ih za pogodnosti verificiranih tvrtki.')}</small><i>↓</i>`;
    positioning.insertAdjacentElement('afterend', teaser);
  }

  function mount() {
    mountTeaser();
    if ($('#buyerRewardsV76')) return;
    const anchor = $('#howConnectsV83') || $('#timelineV83') || $('#relationshipV54') || $('#how') || $('main');
    if (!anchor) return;
    root = document.createElement('section');
    root.id = 'buyerRewardsV76';
    root.className = 'buyer-rewards-v76 section';
    root.innerHTML = `
      <div class="br76-head">
        <div>
          <span>${t('STILL? REWARDS', 'STILL? NAGRADE')}</span>
          <h2>${t('Reliable participation should be worth something.', 'Pouzdano sudjelovanje treba nešto vrijediti.')}</h2>
          <p>${t('Earn points from real, verifiable activity in Still?. Exchange them for benefits published by verified companies.', 'Skupljaj bodove kroz stvarnu i provjerljivu aktivnost na Still?. Zamijeni ih za pogodnosti koje objavljuju verificirane tvrtke.')}</p>
        </div>
        <div class="br76-balance" data-balance>
          <small>${t('YOUR POINTS', 'TVOJI BODOVI')}</small><b>—</b>
          <span>${t('Connect a real case to show your balance.', 'Poveži stvarni slučaj za prikaz stanja.')}</span>
        </div>
      </div>
      <div class="br76-grid">
        ${earningCard('+10', t('Structured case', 'Strukturirani slučaj'), t('Create a real case with verified transaction details.', 'Otvori stvarni slučaj s provjerenim podacima transakcije.'))}
        ${earningCard('+5', t('Verified connection', 'Provjereno povezivanje'), t('Route the case to a verified company.', 'Usmjeri slučaj verificiranoj tvrtki.'))}
        ${earningCard('+3', t('Useful response', 'Korisna komunikacija'), t('Respond inside the structured workflow.', 'Odgovori unutar strukturiranog tijeka.'))}
        ${earningCard('+20', t('Completed resolution', 'Dovršeno rješenje'), t('Complete or accept a recorded resolution.', 'Dovrši ili prihvati evidentirano rješenje.'))}
      </div>
      <div class="br76-rules">
        <div><strong>${t('Legitimate claims never reduce reputation.', 'Legitimni zahtjevi ne smanjuju reputaciju.')}</strong><p>${t('Reputation reflects truthful information, useful responses and completed outcomes—not how rarely you complain.', 'Reputacija odražava točne podatke, korisne odgovore i dovršene ishode—ne koliko se rijetko žališ.')}</p></div>
        <div><strong>${t('Benefits come from verified companies.', 'Pogodnosti nude verificirane tvrtke.')}</strong><p>${t('Offers may include discounts, free services, priority support or extended return benefits. Published terms always apply.', 'Ponude mogu uključivati popuste, besplatne usluge, prioritetnu podršku ili dulji rok povrata. Uvijek vrijede objavljeni uvjeti.')}</p></div>
      </div>
      <div class="br76-live" data-live hidden></div>`;
    anchor.insertAdjacentElement('afterend', root);
    root.addEventListener('click', handleClick);
    load();
  }

  function earningCard(points, title, description) {
    return `<article><b>${points}</b><strong>${title}</strong><p>${description}</p></article>`;
  }

  async function load() {
    const rows = connectedCases().filter(row => row?.publicId && row?.accessToken);
    if (!rows.length || !root) return;
    activeRow = undefined;
    currentData = undefined;
    for (const row of rows.slice(0, 10)) {
      try {
        const data = await requestReward(row);
        if (data?.available) {
          activeRow = row;
          currentData = data;
          break;
        }
      } catch {}
    }
    if (!currentData) return;
    renderLive();
  }

  function renderLive() {
    const balance = $('[data-balance]', root);
    const account = currentData.account || {};
    if (balance) balance.innerHTML = `<small>${t('YOUR POINTS', 'TVOJI BODOVI')}</small><b>${Number(account.points || 0).toLocaleString(isHr() ? 'hr-HR' : 'en-US')}</b><span>${t('Reputation', 'Reputacija')}: ${esc(account.reputationLevel)} · ${account.reputationScore}/100</span>`;
    const live = $('[data-live]', root);
    if (!live) return;
    const offers = currentData.offers || [];
    const activity = currentData.ledger || [];
    const redemptions = currentData.redemptions || [];
    live.hidden = false;
    live.innerHTML = `
      <div>
        <h3>${t('Benefits you can claim', 'Pogodnosti koje možeš preuzeti')}</h3>
        ${offers.length ? offers.slice(0, 8).map(offer => offerCard(offer, account.points || 0)).join('') : `<p>${t('The connected company has not published a benefit yet.', 'Povezana tvrtka još nije objavila pogodnost.')}</p>`}
        ${redemptions.length ? `<h3 class="br76-subhead">${t('Your claimed benefits', 'Tvoje preuzete pogodnosti')}</h3>${redemptions.slice(0, 5).map(redemption => `<article class="br76-redemption"><strong>${esc(redemption.title)}</strong><span>${esc(redemption.status)}</span><small>${esc(redemption.code || '')}</small></article>`).join('')}` : ''}
      </div>
      <div>
        <h3>${t('Recent point activity', 'Nedavna aktivnost bodova')}</h3>
        ${activity.length ? activity.slice(0, 8).map(item => `<article><strong>${item.points_delta > 0 ? '+' : ''}${item.points_delta}</strong><span>${esc(item.description || item.event_type)}</span><small>${new Date(item.created_at).toLocaleString(isHr() ? 'hr-HR' : 'en-US')}</small></article>`).join('') : `<p>${t('No point activity yet.', 'Još nema aktivnosti bodova.')}</p>`}
      </div>`;
  }

  function offerCard(offer, balance) {
    const disabled = Number(balance) < Number(offer.point_cost);
    return `<article class="br76-offer"><strong>${esc(offer.title)}</strong><span>${offer.point_cost} ${t('points', 'bodova')}</span><small>${esc(offer.description || offer.terms || '')}</small><button type="button" data-claim-offer="${esc(offer.id)}" ${disabled ? 'disabled' : ''}>${disabled ? t('More points needed', 'Treba još bodova') : t('Claim benefit', 'Preuzmi pogodnost')}</button></article>`;
  }

  async function handleClick(event) {
    const button = event.target.closest('[data-claim-offer]');
    if (!button || !activeRow) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = t('Claiming…', 'Preuzimanje…');
    try {
      const result = await claimReward(activeRow, button.dataset.claimOffer);
      await load();
      const live = $('[data-live]', root);
      live?.insertAdjacentHTML('afterbegin', `<div class="br76-claim-result"><b>${t('Benefit claimed', 'Pogodnost je preuzeta')}</b><strong>${esc(result.redemption.title)}</strong><code>${esc(result.redemption.code)}</code><small>${esc(result.redemption.terms || t('Show this code to the verified company.', 'Pokaži ovaj kod verificiranoj tvrtki.'))}</small></div>`);
    } catch (error) {
      const messages = {
        insufficient_points: t('You do not have enough points yet.', 'Još nemaš dovoljno bodova.'),
        already_claimed: t('You already claimed this benefit.', 'Već si preuzeo ovu pogodnost.'),
        offer_limit_reached: t('This benefit has reached its claim limit.', 'Ova je pogodnost dosegla ograničenje preuzimanja.')
      };
      button.textContent = messages[error.message] || t('Claim unavailable', 'Preuzimanje nije dostupno');
      setTimeout(() => { button.textContent = original; button.disabled = false; }, 2600);
    }
  }

  function remount() {
    $('#buyerRewardsV76')?.remove();
    $('#buyerRewardsTeaserV91')?.remove();
    root = undefined;
    activeRow = undefined;
    currentData = undefined;
    mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mount, 700), { once: true });
  else setTimeout(mount, 700);
  $('#language')?.addEventListener('change', () => setTimeout(remount, 90));
  window.addEventListener('still:language', () => setTimeout(remount, 90));
  window.addEventListener('storage', event => { if (event.key === 'still-connected-cases-v60') setTimeout(load, 100); });
})();

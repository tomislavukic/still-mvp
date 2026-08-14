import app from './worker-v139.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const now = () => new Date().toISOString();
const API_VERSION = '2026-06-24.dahlia';

async function stripeV2(env, path, options = {}) {
  if (!env.STRIPE_SECRET_KEY) throw Object.assign(new Error('payment_provider_not_configured'), { status: 503 });
  const headers = {
    authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    'stripe-version': API_VERSION,
    'content-type': 'application/json'
  };
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v2${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error?.message || 'payment_provider_error'), { status: response.status, code: data.error?.code });
  return data;
}

async function stripeV1(env, path, body, idempotencyKey = null) {
  if (!env.STRIPE_SECRET_KEY) throw Object.assign(new Error('payment_provider_not_configured'), { status: 503 });
  const headers = {
    authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    'stripe-version': API_VERSION,
    'content-type': 'application/x-www-form-urlencoded'
  };
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error?.message || 'payment_provider_error'), { status: response.status, code: data.error?.code });
  return data;
}

function merchantReadiness(account) {
  const capabilities = account?.configuration?.merchant?.capabilities || {};
  const cardStatus = capabilities.card_payments?.status || 'inactive';
  const payoutStatus = capabilities.stripe_balance?.payouts?.status || 'inactive';
  const chargesEnabled = cardStatus === 'active';
  const payoutsEnabled = payoutStatus === 'active';
  let onboardingStatus = 'incomplete';
  if (chargesEnabled && payoutsEnabled) onboardingStatus = 'ready';
  else if (cardStatus === 'pending' || payoutStatus === 'pending') onboardingStatus = 'review';
  return { chargesEnabled, payoutsEnabled, onboardingStatus, cardStatus, payoutStatus };
}

async function refreshV2Profile(env, profile) {
  if (!profile?.stripe_account_id || !env.STRIPE_SECRET_KEY) return null;
  try {
    const account = await stripeV2(env, `/core/accounts/${encodeURIComponent(profile.stripe_account_id)}?include=configuration.merchant&include=defaults&include=requirements`);
    const readiness = merchantReadiness(account);
    await env.DB.prepare('UPDATE commerce_business_profiles SET charges_enabled=?,payouts_enabled=?,onboarding_status=?,updated_at=? WHERE organization_id=?')
      .bind(readiness.chargesEnabled ? 1 : 0, readiness.payoutsEnabled ? 1 : 0, readiness.onboardingStatus, now(), profile.organization_id).run();
    return readiness;
  } catch (error) {
    // Existing pre-v2 connected accounts remain usable through the legacy layer.
    // We deliberately do not reinterpret legacy charges_enabled/payouts_enabled here.
    console.warn('stripe_v2_profile_refresh_skipped', profile.organization_id, error.code || error.message);
    return null;
  }
}

async function authenticatedCommerceProfile(request, env) {
  const url = new URL(request.url);
  url.pathname = '/api/v1/business/commerce/profile';
  const probe = new Request(url.toString(), { method: 'GET', headers: request.headers });
  const response = await app.fetch(probe, env);
  const payload = await response.clone().json().catch(() => ({}));
  if (!response.ok || !payload.profile?.publicSlug) return { response, payload, row: null };
  const row = await env.DB.prepare('SELECT * FROM commerce_business_profiles WHERE public_slug=?').bind(payload.profile.publicSlug).first();
  return { response, payload, row };
}

async function companyProfile(request, env) {
  const response = await app.fetch(request, env);
  if (!response.ok || request.method !== 'GET') return response;
  const payload = await response.clone().json().catch(() => ({}));
  if (!payload.profile?.publicSlug) return response;
  const row = await env.DB.prepare('SELECT * FROM commerce_business_profiles WHERE public_slug=?').bind(payload.profile.publicSlug).first();
  const readiness = await refreshV2Profile(env, row);
  if (!readiness) return response;
  payload.profile.chargesEnabled = readiness.chargesEnabled;
  payload.profile.payoutsEnabled = readiness.payoutsEnabled;
  payload.profile.onboardingStatus = readiness.onboardingStatus;
  payload.payments = {
    ...(payload.payments || {}),
    provider: 'Stripe Connect',
    accountModel: 'accounts_v2_merchant',
    chargeModel: 'direct_charges',
    cardPaymentsStatus: readiness.cardStatus,
    payoutsStatus: readiness.payoutStatus
  };
  return json(payload);
}

async function companyOnboarding(request, env) {
  const auth = await authenticatedCommerceProfile(request, env);
  if (!auth.response.ok || !auth.row) return auth.response;
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'payment_provider_not_configured', message: 'Add Stripe platform credentials before onboarding businesses.' }, 503);

  let accountId = auth.row.stripe_account_id;
  if (!accountId) {
    const country = env.STRIPE_CONNECTED_ACCOUNT_COUNTRY || 'HR';
    const account = await stripeV2(env, '/core/accounts', {
      method: 'POST',
      idempotencyKey: `still-v2-merchant-${auth.row.organization_id}`,
      body: {
        contact_email: auth.row.support_email,
        display_name: auth.row.display_name,
        dashboard: 'full',
        defaults: {
          currency: 'eur',
          responsibilities: {
            fees_collector: 'stripe',
            losses_collector: 'stripe'
          },
          profile: {
            doing_business_as: auth.row.display_name,
            product_description: 'Products and services sold by this verified business through Still Passport Commerce.'
          }
        },
        identity: { country },
        configuration: {
          merchant: {
            capabilities: {
              card_payments: { requested: true }
            }
          }
        },
        metadata: { still_organization_id: auth.row.organization_id },
        include: ['configuration.merchant', 'defaults', 'requirements']
      }
    });
    accountId = account.id;
    const readiness = merchantReadiness(account);
    await env.DB.prepare('UPDATE commerce_business_profiles SET stripe_account_id=?,charges_enabled=?,payouts_enabled=?,onboarding_status=?,updated_at=? WHERE organization_id=?')
      .bind(accountId, readiness.chargesEnabled ? 1 : 0, readiness.payoutsEnabled ? 1 : 0, readiness.onboardingStatus, now(), auth.row.organization_id).run();
  }

  // Stripe-hosted onboarding remains the compliance surface. Still never collects KYC data.
  const origin = new URL(request.url).origin;
  const link = await stripeV1(env, '/account_links', {
    account: accountId,
    refresh_url: `${origin}/company.html#passportCommerceV92`,
    return_url: `${origin}/company.html#passportCommerceV92`,
    type: 'account_onboarding'
  }, `still-v2-onboarding-${auth.row.organization_id}-${Math.floor(Date.now() / 60000)}`);
  return json({ ok: true, onboardingUrl: link.url, accountModel: 'accounts_v2_merchant' });
}

async function checkout(request, env, offerPublicId) {
  const seller = await env.DB.prepare(`SELECT p.* FROM commerce_offers o JOIN commerce_business_profiles p ON p.organization_id=o.organization_id WHERE o.public_id=?`).bind(offerPublicId).first();
  if (seller?.stripe_account_id) await refreshV2Profile(env, seller);
  return app.fetch(request, env);
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/v1/business/commerce/profile' && ['GET', 'PATCH'].includes(request.method)) return companyProfile(request, env);
      if (path === '/api/v1/business/commerce/onboarding' && request.method === 'POST') return companyOnboarding(request, env);
      const checkoutMatch = path.match(/^\/api\/v1\/commerce\/offers\/([^/]+)\/checkout$/);
      if (checkoutMatch && request.method === 'POST') return checkout(request, env, decodeURIComponent(checkoutMatch[1]));
      return app.fetch(request, env);
    } catch (error) {
      console.error('stripe_accounts_v2_error', error);
      return json({ error: error.message || 'internal_error' }, error.status && error.status >= 400 && error.status < 600 ? error.status : 500);
    }
  }
};

(() => {
  const featureScripts = [
    'company-commerce-v92.js',
    'company-passport-studio-v83.js',
    'company-lifecycle-v95.js',
    'company-operations-v96.js',
    'retailer-claim-v48.js',
    'company-inbox-v60.js',
    'company-relationship-v61.js',
    'company-branches-v68.js',
    'company-notifications-v69.js',
    'company-workbench-v72.js',
    'company-services-mount-v79.js',
    'company-services-v73.js',
    'company-ops-v74.js',
    'company-rewards-v75.js',
    'company-control-center-v101.js',
    'company-inventory-live-v110.js',
    'company-intelligence-v128.js',
    'companyos-v120.js'
  ];
  let loading;

  function activeBuildVersion() {
    const meta = document.querySelector('meta[name="still-build"]')?.content?.trim();
    if (meta) return meta;
    const ownScript = Array.from(document.scripts).find(script => script.src.includes('company-authenticated-loader-v82.js'));
    if (ownScript) {
      try {
        const version = new URL(ownScript.src, location.href).searchParams.get('v');
        if (version) return version;
      } catch {}
    }
    return '';
  }

  function versionedAsset(file) {
    const version = activeBuildVersion();
    return version ? `${file}?v=${encodeURIComponent(version)}` : file;
  }

  function loadScript(file) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-company-feature="${file}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = versionedAsset(file);
      script.dataset.companyFeature = file;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${file}`));
      document.head.appendChild(script);
    });
  }

  function loadAuthenticatedFeatures(event) {
    // Every authenticated organization receives the complete workspace.
    // Verification and subscription rules restrict individual actions,
    // not visibility of the application.
    if (!event?.detail?.organization) return Promise.resolve();
    window.__stillOrganization = event.detail.organization;
    if (loading) return loading;
    loading = featureScripts.reduce(
      (chain, file) => chain.then(() => loadScript(file)),
      Promise.resolve()
    ).catch(error => {
      loading = undefined;
      console.error('[Still?] Company feature loading failed.', error);
    });
    return loading;
  }

  window.addEventListener('still:company-authenticated', loadAuthenticatedFeatures);
})();

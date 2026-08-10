(() => {
  'use strict';

  const VERSION = '154';

  const MODAL_ID =
    'buyerOSOnboardingV154';

  const STYLE_ID =
    'buyerOSOnboardingV154Style';

  const METHODS = Object.freeze([
    Object.freeze({
      id:'single',
      title:'Add one thing',
      titleHr:'Dodaj jednu stvar',
      description:
        'Add something you already own.',
      descriptionHr:
        'Dodaj nešto što već posjeduješ.'
    }),

    Object.freeze({
      id:'document',
      title:'Start with a document',
      titleHr:'Počni s dokumentom',
      description:
        'Add a receipt, invoice or ownership document.',
      descriptionHr:
        'Dodaj račun, fakturu ili dokument vlasništva.'
    }),

    Object.freeze({
      id:'import',
      title:'Import several things',
      titleHr:'Uvezi više stvari',
      description:
        'Use the existing bulk import flow.',
      descriptionHr:
        'Upotrijebi postojeći masovni unos.'
    })
  ]);

  const $ = (
    selector,
    root = document
  ) => root.querySelector(
    selector
  );

  const $$ = (
    selector,
    root = document
  ) => [
    ...root.querySelectorAll(
      selector
    )
  ];

  function isHr() {
    return (
      $('#language')?.value ===
      'hr'
    );
  }

  function t(en, hr) {
    return isHr()
      ? hr
      : en;
  }

  function clean(value) {
    return String(
      value ?? ''
    ).trim();
  }

  function esc(value) {
    return clean(value).replace(
      /[&<>"']/g,
      character => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      })[character]
    );
  }

  function method(id) {
    const wanted =
      clean(id);

    return (
      METHODS.find(
        item =>
          item.id ===
          wanted
      ) ||
      null
    );
  }

  function methods() {
    return METHODS.map(
      item => ({
        ...item
      })
    );
  }

  function graph() {
    return (
      window.StillBuyerOSGraphV152 ||
      null
    );
  }

  function hasThings() {
    const api =
      graph();

    if (
      !api ||
      typeof api.householdContext !==
        'function'
    ) {
      return null;
    }

    try {
      const context =
        api.householdContext();

      if (
        Array.isArray(context)
      ) {
        return context.some(
          household =>
            Array.isArray(
              household
                ?.relationship
                ?.thingIds
            ) &&
            household
              .relationship
              .thingIds
              .length > 0
        );
      }

      return null;
    } catch {
      return null;
    }
  }

  function state() {
    const ownershipPresent =
      hasThings();

    return Object.freeze({
      version:
        VERSION,

      ownershipPresent,

      firstRun:
        ownershipPresent ===
        false,

      methods:
        methods(),

      recommended:
        ownershipPresent ===
        false
          ? 'single'
          : null
    });
  }

  function resolve(id) {
    const selected =
      method(id);

    if (!selected) {
      return Object.freeze({
        ok:false,
        code:
          'UNKNOWN_ONBOARDING_METHOD'
      });
    }

    return Object.freeze({
      ok:true,
      method:{
        ...selected
      }
    });
  }

  function installStyles() {
    if (
      document.getElementById(
        STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style'
      );

    style.id =
      STYLE_ID;

    style.textContent = `
      #${MODAL_ID}{
        position:fixed;
        inset:0;
        z-index:2147482600;
        display:grid;
        place-items:center;
        padding:24px;
        background:
          rgba(9,12,18,.48);
        backdrop-filter:
          blur(20px);
      }

      #${MODAL_ID}[hidden]{
        display:none !important;
      }

      .bos154-shell{
        width:min(680px,100%);
        max-height:
          calc(100vh - 48px);
        overflow:auto;
        border:
          1px solid var(--line);
        border-radius:24px;
        background:
          var(--surface);
        color:
          var(--ink);
        box-shadow:
          0 28px 80px
          rgba(0,0,0,.28);
        padding:24px;
      }

      .bos154-head{
        display:flex;
        align-items:flex-start;
        justify-content:
          space-between;
        gap:18px;
        margin-bottom:22px;
      }

      .bos154-head h2{
        margin:0 0 5px;
        font-size:24px;
        line-height:1.15;
      }

      .bos154-head p{
        margin:0;
        color:var(--muted);
        line-height:1.5;
      }

      .bos154-close{
        width:36px;
        height:36px;
        flex:0 0 auto;
        border:
          1px solid var(--line);
        border-radius:50%;
        background:
          var(--surface2);
        color:var(--ink);
        cursor:pointer;
      }

      .bos154-methods{
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:12px;
      }

      .bos154-method{
        min-height:158px;
        text-align:left;
        border:
          1px solid var(--line);
        border-radius:18px;
        background:
          var(--surface2);
        color:var(--ink);
        padding:18px;
        cursor:pointer;
        transition:
          transform .16s ease,
          border-color .16s ease;
      }

      .bos154-method:hover{
        transform:
          translateY(-2px);
      }

      .bos154-method strong{
        display:block;
        font-size:15px;
        margin-bottom:8px;
      }

      .bos154-method span{
        display:block;
        color:var(--muted);
        font-size:13px;
        line-height:1.5;
      }

      .bos154-launch{
        white-space:nowrap;
      }

      @media(max-width:700px){
        .bos154-methods{
          grid-template-columns:1fr;
        }

        .bos154-method{
          min-height:auto;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function modalHTML() {
    return `
      <div class="bos154-shell">
        <header class="bos154-head">
          <div>
            <h2>
              ${esc(
                t(
                  'Bring into Still',
                  'Dodaj u Still'
                )
              )}
            </h2>

            <p>
              ${esc(
                t(
                  'Choose the easiest way to add something you already own.',
                  'Odaberi najjednostavniji način za dodavanje onoga što već posjeduješ.'
                )
              )}
            </p>
          </div>

          <button
            type="button"
            class="bos154-close"
            data-v154-close
            aria-label="${esc(
              t(
                'Close',
                'Zatvori'
              )
            )}"
          >
            ×
          </button>
        </header>

        <div class="bos154-methods">
          ${METHODS.map(
            item => `
              <button
                type="button"
                class="bos154-method"
                data-v154-method="${esc(
                  item.id
                )}"
              >
                <strong>
                  ${esc(
                    t(
                      item.title,
                      item.titleHr
                    )
                  )}
                </strong>

                <span>
                  ${esc(
                    t(
                      item.description,
                      item.descriptionHr
                    )
                  )}
                </span>
              </button>
            `
          ).join('')}
        </div>
      </div>
    `;
  }

  function createModal() {
    let modal =
      document.getElementById(
        MODAL_ID
      );

    if (modal) {
      return modal;
    }

    modal =
      document.createElement(
        'div'
      );

    modal.id =
      MODAL_ID;

    modal.hidden =
      true;

    modal.innerHTML =
      modalHTML();

    document.body.appendChild(
      modal
    );

    modal.addEventListener(
      'click',
      event => {
        if (
          event.target ===
          modal ||
          event.target.closest(
            '[data-v154-close]'
          )
        ) {
          close();
          return;
        }

        const trigger =
          event.target.closest(
            '[data-v154-method]'
          );

        if (!trigger) {
          return;
        }

        launch(
          trigger.dataset
            .v154Method
        );
      }
    );

    return modal;
  }

  function open() {
    installStyles();

    const modal =
      createModal();

    modal.innerHTML =
      modalHTML();

    modal.hidden =
      false;

    modal.querySelector(
      '[data-v154-method]'
    )?.focus();

    window.dispatchEvent(
      new CustomEvent(
        'still:buyeros-onboarding-opened',
        {
          detail:{
            version:
              VERSION
          }
        }
      )
    );
  }

  function close() {
    const modal =
      document.getElementById(
        MODAL_ID
      );

    if (modal) {
      modal.hidden =
        true;
    }
  }

  function clickExisting(
    selector
  ) {
    const target =
      document.querySelector(
        selector
      );

    if (!target) {
      return false;
    }

    target.click();

    return true;
  }

  function launch(id) {
    const selected =
      resolve(id);

    if (!selected.ok) {
      return selected;
    }

    close();

    let launched =
      false;

    switch (id) {
      case 'single':
        launched =
          clickExisting(
            '[data-bos132-add="thing"]'
          );
        break;

      case 'document':
        launched =
          clickExisting(
            '[data-bos132-add="document"]'
          );

        if (!launched) {
          history.replaceState(
            null,
            '',
            '#buyeros-documents'
          );

          window.dispatchEvent(
            new Event(
              'hashchange'
            )
          );

          launched =
            true;
        }
        break;

      case 'import':
        launched =
          clickExisting(
            '[data-v146-launch]'
          );
        break;
    }

    const result =
      Object.freeze({
        ok:
          launched,

        method:
          id,

        code:
          launched
            ? null
            : 'FLOW_UNAVAILABLE'
      });

    window.dispatchEvent(
      new CustomEvent(
        'still:buyeros-onboarding-selection',
        {
          detail:{
            version:
              VERSION,
            method:
              id,
            launched
          }
        }
      )
    );

    return result;
  }

  function enhanceLaunchers() {
    $$(
      '[data-bos132-add="thing"]'
    ).forEach(
      addButton => {
        const container =
          addButton.parentElement;

        if (
          !container ||
          container.querySelector(
            '[data-v154-launch]'
          )
        ) {
          return;
        }

        const button =
          document.createElement(
            'button'
          );

        button.type =
          'button';

        button.className =
          addButton.className +
          ' bos154-launch';

        button.dataset
          .v154Launch =
          'true';

        button.textContent =
          t(
            'Bring into Still',
            'Dodaj u Still'
          );

        button.addEventListener(
          'click',
          event => {
            event.preventDefault();
            event.stopPropagation();
            open();
          }
        );

        addButton.insertAdjacentElement(
          'beforebegin',
          button
        );
      }
    );
  }

  let enhanceScheduled =
    false;

  function scheduleEnhance() {
    if (enhanceScheduled) {
      return;
    }

    enhanceScheduled =
      true;

    requestAnimationFrame(
      () => {
        enhanceScheduled =
          false;

        enhanceLaunchers();
      }
    );
  }

  function boot() {
    installStyles();
    createModal();
    scheduleEnhance();

    window.addEventListener(
      'hashchange',
      scheduleEnhance
    );

    window.addEventListener(
      'still:ownership-updated',
      scheduleEnhance
    );

    window.addEventListener(
      'still:buyeros-data-updated',
      scheduleEnhance
    );

    window.addEventListener(
      'still:language',
      () => {
        const modal =
          document.getElementById(
            MODAL_ID
          );

        if (
          modal &&
          !modal.hidden
        ) {
          modal.innerHTML =
            modalHTML();
        }

        scheduleEnhance();
      }
    );

    $('#language')
      ?.addEventListener(
        'change',
        scheduleEnhance
      );

    document.addEventListener(
      'keydown',
      event => {
        if (
          event.key ===
          'Escape'
        ) {
          close();
        }
      }
    );
  }

  const api =
    Object.freeze({
      version:
        VERSION,

      methods,

      method,

      state,

      resolve,

      open,

      close,

      launch
    });

  Object.defineProperty(
    window,
    'StillBuyerOSOnboardingV154',
    {
      value:api,
      enumerable:false,
      writable:false,
      configurable:false
    }
  );

  window.dispatchEvent(
    new CustomEvent(
      'still:buyeros-onboarding-ready',
      {
        detail:{
          version:
            VERSION
        }
      }
    )
  );

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {
        once:true
      }
    );
  } else {
    boot();
  }
})();

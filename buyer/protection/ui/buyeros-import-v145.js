(() => {
  'use strict';

  const ROOT = '#buyerOSV132';
  const STORAGE_KEY = 'still-ownership-passports-v83';
  const STYLE_ID = 'buyerOSImportV145Style';
  const MODAL_ID = 'buyerOSImportV145';

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const isHr = () =>
    $('#language')?.value === 'hr';

  const t = (en, hr) =>
    isHr() ? hr : en;

  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      })[char]
    );

  function readThings() {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(STORAGE_KEY) ||
          '[]'
        );

      return Array.isArray(value)
        ? value
        : [];
    } catch {
      return [];
    }
  }

  function writeThings(value) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(value)
    );

    window.dispatchEvent(
      new CustomEvent(
        'still:ownership-updated',
        {
          detail:{
            source:'import-v145',
            count:value.length
          }
        }
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        'still:buyeros-data-updated',
        {
          detail:{
            key:STORAGE_KEY,
            count:value.length
          }
        }
      )
    );
  }

  function uid(prefix = 'thing') {
    if (
      globalThis.crypto &&
      typeof crypto.randomUUID ===
        'function'
    ) {
      return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${performance.now()
      .toString(36)
      .replace('.','')}`;
  }

  function clean(value) {
    const result =
      String(value ?? '').trim();

    return result || '';
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
      document.createElement('style');

    style.id = STYLE_ID;

    style.textContent = `
      #${MODAL_ID}{
        position:fixed;
        inset:0;
        z-index:10020;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(8,14,18,.46);
        backdrop-filter:blur(16px)
      }

      #${MODAL_ID}[hidden]{
        display:none
      }

      .bos145-modal{
        width:min(720px,100%);
        max-height:min(760px,calc(100vh - 40px));
        overflow:auto;
        border:1px solid var(--line,#d9e1e5);
        border-radius:22px;
        background:var(--surface,#fff);
        box-shadow:0 30px 100px rgba(0,0,0,.25)
      }

      .bos145-head{
        display:flex;
        justify-content:space-between;
        gap:16px;
        align-items:flex-start;
        padding:20px;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      .bos145-head h2{
        margin:4px 0 0;
        font-size:24px;
        letter-spacing:-.04em
      }

      .bos145-head p{
        margin:6px 0 0;
        max-width:520px;
        color:var(--muted,#66727a);
        font-size:10px;
        line-height:1.55
      }

      .bos145-close{
        width:34px;
        height:34px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:50%;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        cursor:pointer
      }

      .bos145-body{
        padding:20px
      }

      .bos145-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:11px
      }

      .bos145-field{
        display:grid;
        gap:5px
      }

      .bos145-field-wide{
        grid-column:1/-1
      }

      .bos145-field label{
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:780;
        letter-spacing:.04em
      }

      .bos145-field input,
      .bos145-field select,
      .bos145-field textarea{
        width:100%;
        box-sizing:border-box;
        min-height:40px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:11px;
        padding:9px 11px;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        font:inherit;
        font-size:11px;
        outline:none
      }

      .bos145-field textarea{
        min-height:92px;
        resize:vertical
      }

      .bos145-field input:focus,
      .bos145-field select:focus,
      .bos145-field textarea:focus{
        border-color:var(--accent,#6c5ce7)
      }

      .bos145-section-title{
        grid-column:1/-1;
        margin-top:7px;
        padding-top:13px;
        border-top:1px solid var(--line,#d9e1e5);
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:850;
        letter-spacing:.08em;
        text-transform:uppercase
      }

      .bos145-footer{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        padding:15px 20px;
        border-top:1px solid var(--line,#d9e1e5)
      }

      .bos145-footer small{
        max-width:390px;
        color:var(--muted,#66727a);
        font-size:9px;
        line-height:1.45
      }

      .bos145-actions{
        display:flex;
        gap:7px
      }

      .bos145-actions button{
        min-height:38px;
        padding:0 13px;
        border-radius:10px;
        font:inherit;
        font-size:10px;
        font-weight:800;
        cursor:pointer
      }

      .bos145-secondary{
        border:1px solid var(--line,#d9e1e5);
        background:var(--surface,#fff);
        color:var(--ink,#111)
      }

      .bos145-primary{
        border:0;
        background:var(--accent,#6558e8);
        color:#fff
      }

      .bos145-launch{
        display:inline-flex;
        align-items:center;
        gap:7px
      }

      .bos145-launch::before{
        content:'+';
        font-size:14px
      }

      .bos145-success{
        margin-bottom:12px;
        padding:10px 12px;
        border-radius:12px;
        background:rgba(51,123,88,.09);
        color:var(--green,#337b58);
        font-size:10px;
        font-weight:700
      }

      @media(max-width:620px){
        .bos145-grid{
          grid-template-columns:1fr
        }

        .bos145-field-wide,
        .bos145-section-title{
          grid-column:auto
        }

        .bos145-footer{
          align-items:stretch;
          flex-direction:column
        }

        .bos145-actions{
          width:100%
        }

        .bos145-actions button{
          flex:1
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createModal() {
    if (
      document.getElementById(
        MODAL_ID
      )
    ) {
      return;
    }

    const modal =
      document.createElement('div');

    modal.id = MODAL_ID;
    modal.hidden = true;

    modal.innerHTML = `
      <section
        class="bos145-modal"
        role="dialog"
        aria-modal="true"
      >
        <header class="bos145-head">
          <div>
            <span class="bos132-eyebrow">
              ${esc(
                t(
                  'BRING YOUR THINGS INTO STILL',
                  'DONESI SVOJE STVARI U STILL'
                )
              )}
            </span>

            <h2>
              ${esc(
                t(
                  'Add something you already own.',
                  'Dodaj nešto što već posjeduješ.'
                )
              )}
            </h2>

            <p>
              ${esc(
                t(
                  'Start with what you remember. You can complete the Passport later.',
                  'Počni s onim čega se sjećaš. Putovnicu možeš dopuniti kasnije.'
                )
              )}
            </p>
          </div>

          <button
            type="button"
            class="bos145-close"
            data-v145-close
            aria-label="${esc(t('Close','Zatvori'))}"
          >
            ×
          </button>
        </header>

        <form data-v145-form>
          <div class="bos145-body">
            <div data-v145-message></div>

            <div class="bos145-grid">
              <div class="bos145-field bos145-field-wide">
                <label>
                  ${esc(t('NAME','NAZIV'))}
                </label>

                <input
                  name="title"
                  required
                  maxlength="160"
                  placeholder="${esc(
                    t(
                      'e.g. MacBook Pro',
                      'npr. MacBook Pro'
                    )
                  )}"
                >
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(t('TYPE','VRSTA'))}
                </label>

                <select name="kind">
                  <option value="product">
                    ${esc(t('Product','Proizvod'))}
                  </option>
                  <option value="service">
                    ${esc(t('Service','Usluga'))}
                  </option>
                  <option value="subscription">
                    ${esc(t('Subscription','Pretplata'))}
                  </option>
                  <option value="rental">
                    ${esc(t('Rental','Najam'))}
                  </option>
                  <option value="booking">
                    ${esc(t('Booking','Rezervacija'))}
                  </option>
                </select>
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(t('BRAND','MARKA'))}
                </label>

                <input
                  name="brand"
                  maxlength="120"
                >
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(t('MODEL','MODEL'))}
                </label>

                <input
                  name="model"
                  maxlength="120"
                >
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(
                    t(
                      'SERIAL NUMBER',
                      'SERIJSKI BROJ'
                    )
                  )}
                </label>

                <input
                  name="serialNumber"
                  maxlength="160"
                >
              </div>

              <div class="bos145-section-title">
                ${esc(
                  t(
                    'Purchase',
                    'Kupnja'
                  )
                )}
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(
                    t(
                      'PURCHASE DATE',
                      'DATUM KUPNJE'
                    )
                  )}
                </label>

                <input
                  name="purchaseDate"
                  type="date"
                >
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(
                    t(
                      'PURCHASE PRICE',
                      'CIJENA KUPNJE'
                    )
                  )}
                </label>

                <input
                  name="purchasePrice"
                  inputmode="decimal"
                  maxlength="40"
                >
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(
                    t(
                      'PURCHASED FROM',
                      'KUPLJENO KOD'
                    )
                  )}
                </label>

                <input
                  name="business"
                  maxlength="160"
                >
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(
                    t(
                      'LOCATION',
                      'LOKACIJA'
                    )
                  )}
                </label>

                <input
                  name="location"
                  maxlength="120"
                >
              </div>

              <div class="bos145-section-title">
                ${esc(
                  t(
                    'Protection',
                    'Zaštita'
                  )
                )}
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(
                    t(
                      'WARRANTY UNTIL',
                      'JAMSTVO DO'
                    )
                  )}
                </label>

                <input
                  name="warrantyUntil"
                  type="date"
                >
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(
                    t(
                      'RETURN BY',
                      'POVRAT DO'
                    )
                  )}
                </label>

                <input
                  name="returnBy"
                  type="date"
                >
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(
                    t(
                      'RENEWAL',
                      'OBNOVA'
                    )
                  )}
                </label>

                <input
                  name="renewalAt"
                  type="date"
                >
              </div>

              <div class="bos145-field">
                <label>
                  ${esc(
                    t(
                      'CONDITION',
                      'STANJE'
                    )
                  )}
                </label>

                <input
                  name="condition"
                  maxlength="100"
                >
              </div>

              <div class="bos145-field bos145-field-wide">
                <label>
                  ${esc(t('NOTES','BILJEŠKE'))}
                </label>

                <textarea
                  name="notes"
                  maxlength="1600"
                ></textarea>
              </div>
            </div>
          </div>

          <footer class="bos145-footer">
            <small>
              ${esc(
                t(
                  'Only the information you enter is stored. Missing details remain empty and can be added later.',
                  'Spremaju se samo podaci koje uneseš. Podaci koji nedostaju ostaju prazni i mogu se dodati kasnije.'
                )
              )}
            </small>

            <div class="bos145-actions">
              <button
                type="button"
                class="bos145-secondary"
                data-v145-save-another
              >
                ${esc(
                  t(
                    'Save & add another',
                    'Spremi i dodaj još'
                  )
                )}
              </button>

              <button
                type="submit"
                class="bos145-primary"
              >
                ${esc(
                  t(
                    'Add to Still',
                    'Dodaj u Still'
                  )
                )}
              </button>
            </div>
          </footer>
        </form>
      </section>
    `;

    document.body.appendChild(modal);

    modal.addEventListener(
      'click',
      event => {
        if (
          event.target === modal
        ) {
          closeModal();
        }
      }
    );

    $('[data-v145-close]', modal)
      ?.addEventListener(
        'click',
        closeModal
      );

    $('[data-v145-form]', modal)
      ?.addEventListener(
        'submit',
        event => {
          event.preventDefault();
          saveForm(event.currentTarget,false);
        }
      );

    $('[data-v145-save-another]', modal)
      ?.addEventListener(
        'click',
        () => {
          const form =
            $('[data-v145-form]', modal);

          if (!form)
            return;

          if (!form.reportValidity())
            return;

          saveForm(form,true);
        }
      );
  }

  function formRecord(form) {
    const fd =
      new FormData(form);

    const now =
      new Date().toISOString();

    return {
      id:uid('thing'),

      title:
        clean(fd.get('title')),

      kind:
        clean(fd.get('kind')) ||
        'product',

      brand:
        clean(fd.get('brand')),

      model:
        clean(fd.get('model')),

      serialNumber:
        clean(fd.get('serialNumber')),

      purchaseDate:
        clean(fd.get('purchaseDate')),

      purchasedOn:
        clean(fd.get('purchaseDate')),

      purchasePrice:
        clean(fd.get('purchasePrice')),

      business:
        clean(fd.get('business')),

      location:
        clean(fd.get('location')),

      warrantyUntil:
        clean(fd.get('warrantyUntil')),

      returnBy:
        clean(fd.get('returnBy')),

      renewalAt:
        clean(fd.get('renewalAt')),

      condition:
        clean(fd.get('condition')),

      notes:
        clean(fd.get('notes')),

      serviceHistory:[],

      createdAt:now,
      updatedAt:now
    };
  }

  function saveForm(
    form,
    addAnother
  ) {
    const record =
      formRecord(form);

    if (!record.title)
      return;

    const data =
      readThings();

    data.push(record);

    writeThings(data);

    const message =
      $('[data-v145-message]');

    if (message) {
      message.innerHTML = `
        <div class="bos145-success">
          ${esc(
            t(
              `${record.title} was added to Still.`,
              `${record.title} je dodano u Still.`
            )
          )}
        </div>
      `;
    }

    if (addAnother) {
      form.reset();

      $('[name="title"]', form)
        ?.focus();

      return;
    }

    closeModal();

    history.replaceState(
      null,
      '',
      '#buyeros-things'
    );

    window.dispatchEvent(
      new Event('hashchange')
    );
  }

  function openModal() {
    installStyles();
    createModal();

    const modal =
      document.getElementById(
        MODAL_ID
      );

    modal.hidden = false;

    setTimeout(() => {
      $('[name="title"]', modal)
        ?.focus();
    },0);
  }

  function closeModal() {
    const modal =
      document.getElementById(
        MODAL_ID
      );

    if (modal)
      modal.hidden = true;
  }

  function enhanceButtons() {
    $$(
      '[data-bos132-add="thing"]'
    ).forEach(button => {
      if (
        button.dataset
          .v145Bound ===
        'true'
      ) {
        return;
      }

      button.dataset.v145Bound =
        'true';

      button.classList.add(
        'bos145-launch'
      );

      button.addEventListener(
        'click',
        event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          openModal();
        },
        true
      );
    });
  }

  function boot() {
    installStyles();
    createModal();
    enhanceButtons();

    const observer =
      new MutationObserver(
        enhanceButtons
      );

    observer.observe(
      document.documentElement,
      {
        childList:true,
        subtree:true
      }
    );

    document.addEventListener(
      'keydown',
      event => {
        if (
          event.key === 'Escape' &&
          !document.getElementById(
            MODAL_ID
          )?.hidden
        ) {
          closeModal();
        }
      }
    );
  }

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once:true }
    );
  } else {
    boot();
  }
})();


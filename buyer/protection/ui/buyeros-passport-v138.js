(() => {
  'use strict';

  const ROOT = '#buyerOSV132';
  const STYLE_ID = 'buyerOSPassportV138Style';

  const OWNERSHIP_KEY =
    'still-ownership-passports-v83';

  const DOCUMENTS_KEY =
    'still-buyeros-documents-v132';

  const SELECTED_KEY =
    'still-buyeros-selected-thing-v135';

  let rootObserver = null;
  let enhanceTimer = null;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const isHr = () =>
    $('#language')?.value === 'hr';

  const t = (en, hr) =>
    isHr() ? hr : en;

  const esc = value =>
    String(value ?? '')
      .replace(
        /[&<>"']/g,
        char => ({
          '&':'&amp;',
          '<':'&lt;',
          '>':'&gt;',
          '"':'&quot;',
          "'":'&#39;'
        })[char]
      );

  function readArray(key) {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(key) || '[]'
        );

      return Array.isArray(value)
        ? value
        : [];
    } catch {
      return [];
    }
  }

  function things() {
    return readArray(OWNERSHIP_KEY);
  }

  function documents() {
    return readArray(DOCUMENTS_KEY);
  }

  function selectedThing() {
    const id =
      sessionStorage.getItem(
        SELECTED_KEY
      );

    if (!id) return null;

    return things().find(
      item => item.id === id
    ) || null;
  }

  function purchaseDate(item) {
    return (
      item.purchasedOn ||
      item.purchaseDate ||
      ''
    );
  }

  function services(item) {
    return Array.isArray(
      item.serviceHistory
    )
      ? item.serviceHistory
      : [];
  }

  function linkedDocuments(item) {
    const title =
      String(item.title || '')
        .trim()
        .toLowerCase();

    return documents().filter(doc =>
      doc.thingId === item.id ||
      doc.relatedThingId === item.id ||
      (
        title &&
        String(
          doc.relatedThing || ''
        )
          .trim()
          .toLowerCase() === title
      )
    );
  }

  function dateText(value) {
    if (!value) return '';

    const date =
      new Date(
        `${String(value).slice(0,10)}T12:00:00`
      );

    if (
      Number.isNaN(
        date.valueOf()
      )
    ) {
      return '';
    }

    return new Intl.DateTimeFormat(
      isHr()
        ? 'hr-HR'
        : 'en-GB',
      {
        dateStyle:'medium'
      }
    ).format(date);
  }

  function daysUntil(value) {
    if (!value) return null;

    const date =
      new Date(
        `${String(value).slice(0,10)}T12:00:00`
      );

    if (
      Number.isNaN(
        date.valueOf()
      )
    ) {
      return null;
    }

    const now = new Date();

    now.setHours(
      12,
      0,
      0,
      0
    );

    return Math.ceil(
      (date - now) /
      86400000
    );
  }

  function firstValue(
    item,
    keys
  ) {
    for (
      const key of keys
    ) {
      const value = item[key];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim()
      ) {
        return String(value).trim();
      }
    }

    return '';
  }

  function brandOf(item) {
    return firstValue(
      item,
      [
        'brand',
        'manufacturer',
        'maker'
      ]
    );
  }

  function modelOf(item) {
    return firstValue(
      item,
      [
        'model',
        'modelName',
        'productModel'
      ]
    );
  }

  function serialOf(item) {
    return firstValue(
      item,
      [
        'serialNumber',
        'serial',
        'serialNo',
        'reference'
      ]
    );
  }

  function priceOf(item) {
    return firstValue(
      item,
      [
        'purchasePrice',
        'price',
        'amount'
      ]
    );
  }

  function locationOf(item) {
    return firstValue(
      item,
      [
        'location',
        'room',
        'storageLocation'
      ]
    );
  }

  function ownerOf(item) {
    return firstValue(
      item,
      [
        'owner',
        'ownerName',
        'assignedTo'
      ]
    );
  }

  function conditionOf(item) {
    return firstValue(
      item,
      [
        'condition',
        'state'
      ]
    );
  }

  function productImage(item) {
    const direct =
      firstValue(
        item,
        [
          'imageUrl',
          'image',
          'photo',
          'photoUrl'
        ]
      );

    if (direct) return direct;

    const arrays = [
      item.images,
      item.photos,
      item.gallery
    ];

    for (
      const value of arrays
    ) {
      if (
        Array.isArray(value) &&
        value.length
      ) {
        const first =
          typeof value[0] === 'string'
            ? value[0]
            : (
                value[0]?.url ||
                value[0]?.src ||
                ''
              );

        if (first) {
          return String(first);
        }
      }
    }

    return '';
  }

  function allImages(item) {
    const result = [];

    const direct =
      productImage(item);

    if (direct) {
      result.push(direct);
    }

    [
      item.images,
      item.photos,
      item.gallery
    ].forEach(values => {
      if (!Array.isArray(values)) {
        return;
      }

      values.forEach(value => {
        const url =
          typeof value === 'string'
            ? value
            : (
                value?.url ||
                value?.src ||
                ''
              );

        if (
          url &&
          !result.includes(url)
        ) {
          result.push(
            String(url)
          );
        }
      });
    });

    return result.slice(0,6);
  }

  function protectionScore(
    item,
    docs
  ) {
    const signals = [
      Boolean(
        item.warrantyUntil
      ),
      Boolean(
        item.returnBy
      ),
      Boolean(
        item.renewalAt
      ),
      docs.some(doc =>
        /receipt|invoice|račun|fakt/i
          .test(
            `${doc.type} ${doc.title}`
          )
      ),
      docs.some(doc =>
        /warranty|jamstvo/i
          .test(
            `${doc.type} ${doc.title}`
          )
      )
    ];

    return Math.round(
      (
        signals.filter(Boolean).length /
        signals.length
      ) * 100
    );
  }

  function completionScore(
    item,
    docs,
    serviceEvents
  ) {
    const signals = [
      Boolean(item.title),
      Boolean(item.kind),
      Boolean(brandOf(item)),
      Boolean(modelOf(item)),
      Boolean(purchaseDate(item)),
      Boolean(serialOf(item)),
      docs.length > 0,
      serviceEvents.length > 0,
      Boolean(
        item.warrantyUntil ||
        item.returnBy ||
        item.renewalAt
      )
    ];

    return Math.round(
      (
        signals.filter(Boolean).length /
        signals.length
      ) * 100
    );
  }

  function lastActivity(
    item,
    docs,
    serviceEvents
  ) {
    const values = [
      item.updatedAt,
      item.createdAt,
      purchaseDate(item),
      item.warrantyUntil,
      item.returnBy,
      item.renewalAt,
      ...docs.map(doc =>
        doc.date ||
        doc.createdAt
      ),
      ...serviceEvents.map(event =>
        event.occurredOn ||
        event.createdAt
      )
    ]
      .filter(Boolean)
      .map(value => ({
        raw:value,
        time:
          new Date(value)
            .valueOf()
      }))
      .filter(entry =>
        Number.isFinite(
          entry.time
        )
      )
      .sort(
        (a,b) =>
          b.time - a.time
      );

    return values[0]?.raw || '';
  }

  function relatedThings(item) {
    const brand =
      brandOf(item)
        .toLowerCase();

    const business =
      String(
        item.business ||
        item.store ||
        ''
      )
        .trim()
        .toLowerCase();

    const kind =
      String(
        item.kind || ''
      )
        .trim()
        .toLowerCase();

    return things()
      .filter(other => {
        if (
          !other ||
          other.id === item.id
        ) {
          return false;
        }

        const sameBrand =
          brand &&
          brandOf(other)
            .toLowerCase() === brand;

        const sameBusiness =
          business &&
          String(
            other.business ||
            other.store ||
            ''
          )
            .trim()
            .toLowerCase() === business;

        const sameKind =
          kind &&
          String(
            other.kind || ''
          )
            .trim()
            .toLowerCase() === kind;

        return (
          sameBrand ||
          sameBusiness ||
          sameKind
        );
      })
      .slice(0,6);
  }

  function metaRow(
    label,
    value
  ) {
    return `
      <div class="bos138-detail-row">
        <span>${esc(label)}</span>
        <strong>${
          value
            ? esc(value)
            : `<em>${
                esc(
                  t(
                    'Not stored',
                    'Nije spremljeno'
                  )
                )
              }</em>`
        }</strong>
      </div>
    `;
  }

  function docLabel(doc) {
    return (
      doc.type ||
      t(
        'Document',
        'Dokument'
      )
    );
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

    style.id = STYLE_ID;

    style.textContent = `
      ${ROOT} .bos138-layout{
        display:grid;
        grid-template-columns:minmax(0,1fr) 280px;
        gap:14px;
        align-items:start;
        margin-top:14px
      }

      ${ROOT} .bos138-main{
        min-width:0
      }

      ${ROOT} .bos138-side{
        position:sticky;
        top:14px;
        display:grid;
        gap:10px
      }

      ${ROOT} .bos138-panel{
        border:1px solid var(--line,#d9e1e5);
        border-radius:18px;
        padding:15px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos138-panel h4{
        margin:0;
        font-size:13px
      }

      ${ROOT} .bos138-panel > small{
        display:block;
        margin-top:4px;
        color:var(--muted,#66727a);
        line-height:1.45
      }

      ${ROOT} .bos138-score{
        display:grid;
        grid-template-columns:1fr auto;
        gap:8px;
        align-items:end;
        margin-top:13px
      }

      ${ROOT} .bos138-score span{
        color:var(--muted,#66727a);
        font-size:10px
      }

      ${ROOT} .bos138-score strong{
        font-size:24px;
        letter-spacing:-.04em
      }

      ${ROOT} .bos138-meter{
        grid-column:1/-1;
        height:6px;
        overflow:hidden;
        border-radius:999px;
        background:var(--soft,#edf3ef)
      }

      ${ROOT} .bos138-meter i{
        display:block;
        height:100%;
        width:var(--value);
        border-radius:inherit;
        background:var(--green,#337b58)
      }

      ${ROOT} .bos138-media{
        display:grid;
        grid-template-columns:96px minmax(0,1fr);
        gap:16px;
        align-items:center;
        margin-top:16px
      }

      ${ROOT} .bos138-cover{
        width:96px;
        aspect-ratio:1;
        overflow:hidden;
        border:1px solid var(--line,#d9e1e5);
        border-radius:20px;
        background:var(--soft,#edf3ef);
        display:grid;
        place-items:center;
        font-size:30px
      }

      ${ROOT} .bos138-cover img{
        width:100%;
        height:100%;
        object-fit:cover
      }

      ${ROOT} .bos138-chip-row{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:9px
      }

      ${ROOT} .bos138-chip{
        display:inline-flex;
        align-items:center;
        min-height:25px;
        padding:0 9px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:999px;
        color:var(--muted,#66727a);
        background:var(--surface,#fff);
        font-size:9px;
        font-weight:760
      }

      ${ROOT} .bos138-actions{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-top:13px
      }

      ${ROOT} .bos138-actions button{
        min-height:36px;
        padding:0 11px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:10px;
        background:var(--surface,#fff);
        color:var(--ink,#111);
        font:inherit;
        font-size:10px;
        font-weight:780;
        cursor:pointer
      }

      ${ROOT} .bos138-details{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
        margin-top:12px
      }

      ${ROOT} .bos138-detail-row{
        min-width:0;
        padding:11px;
        border-radius:12px;
        background:var(--soft,#f3f6f4)
      }

      ${ROOT} .bos138-detail-row span{
        display:block;
        color:var(--muted,#66727a);
        font-size:9px;
        font-weight:780;
        letter-spacing:.05em;
        text-transform:uppercase
      }

      ${ROOT} .bos138-detail-row strong{
        display:block;
        margin-top:4px;
        overflow-wrap:anywhere;
        font-size:11px
      }

      ${ROOT} .bos138-detail-row em{
        color:var(--muted,#66727a);
        font-style:normal;
        font-weight:500
      }

      ${ROOT} .bos138-gallery{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
        margin-top:12px
      }

      ${ROOT} .bos138-gallery img{
        width:100%;
        aspect-ratio:4/3;
        object-fit:cover;
        border-radius:12px;
        border:1px solid var(--line,#d9e1e5)
      }

      ${ROOT} .bos138-document{
        display:grid;
        grid-template-columns:36px minmax(0,1fr) auto;
        gap:9px;
        align-items:center;
        padding:10px;
        border-radius:12px;
        background:var(--soft,#f3f6f4)
      }

      ${ROOT} .bos138-document-icon{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        border-radius:10px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos138-document b{
        display:block;
        font-size:11px
      }

      ${ROOT} .bos138-document small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a)
      }

      ${ROOT} .bos138-list{
        display:grid;
        gap:7px;
        margin-top:11px
      }

      ${ROOT} .bos138-related{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:7px;
        margin-top:11px
      }

      ${ROOT} .bos138-related button{
        border:1px solid var(--line,#d9e1e5);
        border-radius:13px;
        padding:11px;
        text-align:left;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        cursor:pointer
      }

      ${ROOT} .bos138-related b{
        display:block;
        font-size:11px
      }

      ${ROOT} .bos138-related small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a)
      }

      ${ROOT} .bos138-side-actions{
        display:grid;
        gap:6px;
        margin-top:11px
      }

      ${ROOT} .bos138-side-actions button{
        min-height:36px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:10px;
        background:var(--soft,#f3f6f4);
        color:var(--ink,#111);
        font:inherit;
        font-size:10px;
        font-weight:760;
        cursor:pointer
      }

      ${ROOT} .bos138-side-doc{
        margin-top:7px;
        padding:8px 0;
        border-bottom:1px solid var(--line,#d9e1e5)
      }

      ${ROOT} .bos138-side-doc:last-child{
        border-bottom:0
      }

      ${ROOT} .bos138-side-doc b{
        display:block;
        font-size:10px
      }

      ${ROOT} .bos138-side-doc small{
        display:block;
        margin-top:2px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      @media(max-width:960px){
        ${ROOT} .bos138-layout{
          grid-template-columns:1fr
        }

        ${ROOT} .bos138-side{
          position:static;
          grid-template-columns:1fr 1fr
        }
      }

      @media(max-width:620px){
        ${ROOT} .bos138-media{
          grid-template-columns:1fr
        }

        ${ROOT} .bos138-cover{
          width:84px
        }

        ${ROOT} .bos138-details,
        ${ROOT} .bos138-related,
        ${ROOT} .bos138-side{
          grid-template-columns:1fr
        }

        ${ROOT} .bos138-gallery{
          grid-template-columns:1fr 1fr
        }
      }

      @media print{
        body *{
          visibility:hidden!important
        }

        ${ROOT},
        ${ROOT} *{
          visibility:visible!important
        }

        ${ROOT}{
          position:absolute!important;
          left:0!important;
          top:0!important;
          width:100%!important
        }

        ${ROOT} .bos132-sidebar,
        ${ROOT} button{
          display:none!important
        }

        ${ROOT} .bos132-shell{
          display:block!important;
          border:0!important;
          box-shadow:none!important
        }

        ${ROOT} .bos132-main{
          padding:0!important
        }

        ${ROOT} .bos138-layout{
          display:block!important
        }

        ${ROOT} .bos138-side{
          position:static!important;
          margin-top:12px
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  async function copyLink() {
    const url =
      window.location.href;

    try {
      await navigator.clipboard
        .writeText(url);

      return true;
    } catch {
      const input =
        document.createElement(
          'textarea'
        );

      input.value = url;
      input.style.position =
        'fixed';

      input.style.opacity = '0';

      document.body
        .appendChild(input);

      input.select();

      const copied =
        document.execCommand(
          'copy'
        );

      input.remove();

      return copied;
    }
  }

  async function share(item) {
    const data = {
      title:
        item.title ||
        'Still',
      text:
        item.title ||
        'Still ownership passport',
      url:
        window.location.href
    };

    if (
      navigator.share
    ) {
      try {
        await navigator.share(
          data
        );

        return;
      } catch (error) {
        if (
          error?.name ===
          'AbortError'
        ) {
          return;
        }
      }
    }

    await copyLink();

    window.dispatchEvent(
      new CustomEvent(
        'still:buyeros-passport-copy',
        {
          detail:{
            itemId:item.id
          }
        }
      )
    );
  }

  function scrollToSection(name) {
    const node =
      document.querySelector(
        `${ROOT} [data-bos135-section="${CSS.escape(name)}"]`
      );

    node?.scrollIntoView({
      behavior:
        window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches
          ? 'auto'
          : 'smooth',
      block:'start'
    });
  }

  function openRelated(id) {
    if (!id) return;

    sessionStorage.setItem(
      SELECTED_KEY,
      id
    );

    history.replaceState(
      null,
      '',
      '#buyeros-thing'
    );

    window.dispatchEvent(
      new CustomEvent(
        'still:ownership-updated'
      )
    );
  }

  function createMedia(
    item
  ) {
    const image =
      productImage(item);

    const brand =
      brandOf(item);

    const model =
      modelOf(item);

    const serial =
      serialOf(item);

    const chips = [
      brand,
      model,
      serial
        ? `${t('Serial','Serijski broj')}: ${serial}`
        : '',
      item.kind
    ].filter(Boolean);

    const node =
      document.createElement(
        'section'
      );

    node.className =
      'bos138-media';

    node.innerHTML = `
      <div class="bos138-cover">
        ${
          image
            ? `<img src="${esc(image)}" alt="">`
            : '◇'
        }
      </div>

      <div>
        <span class="bos132-eyebrow">
          ${esc(
            t(
              'PRODUCT PASSPORT',
              'PUTOVNICA PROIZVODA'
            )
          )}
        </span>

        <div class="bos138-chip-row">
          ${
            chips.length
              ? chips
                  .map(
                    value =>
                      `<span class="bos138-chip">${esc(value)}</span>`
                  )
                  .join('')
              : `<span class="bos138-chip">${esc(
                  t(
                    'Add more product details',
                    'Dodaj više podataka o proizvodu'
                  )
                )}</span>`
          }
        </div>

        <div class="bos138-actions">
          <button
            type="button"
            data-v138-share
          >
            ${esc(
              t(
                'Share',
                'Podijeli'
              )
            )}
          </button>

          <button
            type="button"
            data-v138-copy
          >
            ${esc(
              t(
                'Copy link',
                'Kopiraj poveznicu'
              )
            )}
          </button>

          <button
            type="button"
            data-v138-print
          >
            ${esc(
              t(
                'Print / Save PDF',
                'Ispis / Spremi PDF'
              )
            )}
          </button>

          <button
            type="button"
            data-v138-timeline
          >
            ${esc(
              t(
                'Open timeline',
                'Otvori vremensku crtu'
              )
            )}
          </button>
        </div>
      </div>
    `;

    return node;
  }

  function createOverview(
    item
  ) {
    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos132-section bos138-extra';

    section.dataset.v138Section =
      'identity';

    section.innerHTML = `
      <div class="bos132-section-head">
        <div>
          <h3>
            ${esc(
              t(
                'Product identity',
                'Identitet proizvoda'
              )
            )}
          </h3>

          <p class="bos132-section-note">
            ${esc(
              t(
                'Only information actually stored in Still is shown here.',
                'Ovdje se prikazuju samo podaci koji su stvarno spremljeni u Still.'
              )
            )}
          </p>
        </div>
      </div>

      <div class="bos138-details">
        ${metaRow(
          t('Brand','Marka'),
          brandOf(item)
        )}

        ${metaRow(
          t('Model','Model'),
          modelOf(item)
        )}

        ${metaRow(
          t(
            'Serial number',
            'Serijski broj'
          ),
          serialOf(item)
        )}

        ${metaRow(
          t(
            'Category',
            'Kategorija'
          ),
          item.kind
        )}

        ${metaRow(
          t(
            'Purchase date',
            'Datum kupnje'
          ),
          dateText(
            purchaseDate(item)
          )
        )}

        ${metaRow(
          t(
            'Purchase price',
            'Cijena kupnje'
          ),
          priceOf(item)
        )}

        ${metaRow(
          t(
            'Purchased from',
            'Kupljeno kod'
          ),
          item.business ||
          item.store ||
          ''
        )}

        ${metaRow(
          t('Owner','Vlasnik'),
          ownerOf(item)
        )}

        ${metaRow(
          t(
            'Location',
            'Lokacija'
          ),
          locationOf(item)
        )}

        ${metaRow(
          t(
            'Condition',
            'Stanje'
          ),
          conditionOf(item)
        )}

        ${metaRow(
          t(
            'Created',
            'Kreirano'
          ),
          dateText(
            item.createdAt
          )
        )}

        ${metaRow(
          t(
            'Last updated',
            'Zadnja izmjena'
          ),
          dateText(
            item.updatedAt
          )
        )}
      </div>
    `;

    return section;
  }

  function createGallery(item) {
    const images =
      allImages(item);

    if (!images.length) {
      return null;
    }

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos132-section bos138-extra';

    section.innerHTML = `
      <div class="bos132-section-head">
        <h3>
          ${esc(
            t(
              'Photos',
              'Fotografije'
            )
          )}
        </h3>
      </div>

      <div class="bos138-gallery">
        ${
          images.map(url =>
            `<img src="${esc(url)}" alt="">`
          ).join('')
        }
      </div>
    `;

    return section;
  }

  function createDocumentSummary(
    docs
  ) {
    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos132-section bos138-extra';

    section.innerHTML = `
      <div class="bos132-section-head">
        <div>
          <h3>
            ${esc(
              t(
                'Passport documents',
                'Dokumenti putovnice'
              )
            )}
          </h3>

          <p class="bos132-section-note">
            ${docs.length}
            ${esc(
              t(
                'linked records',
                'povezanih zapisa'
              )
            )}
          </p>
        </div>
      </div>

      ${
        docs.length
          ? `
            <div class="bos138-list">
              ${
                docs.map(doc => `
                  <div class="bos138-document">
                    <span class="bos138-document-icon">
                      ▤
                    </span>

                    <div>
                      <b>
                        ${esc(
                          doc.title ||
                          docLabel(doc)
                        )}
                      </b>

                      <small>
                        ${esc(
                          docLabel(doc)
                        )}
                        ${
                          doc.date
                            ? ` · ${esc(dateText(doc.date))}`
                            : ''
                        }
                      </small>
                    </div>

                    <span>›</span>
                  </div>
                `).join('')
              }
            </div>
          `
          : `
            <div class="bos135-empty">
              ${esc(
                t(
                  'No documents are linked to this product yet.',
                  'Uz ovaj proizvod još nema povezanih dokumenata.'
                )
              )}
            </div>
          `
      }
    `;

    return section;
  }

  function createProtectionSummary(
    item,
    docs
  ) {
    const warranty =
      daysUntil(
        item.warrantyUntil
      );

    const returns =
      daysUntil(
        item.returnBy
      );

    const score =
      protectionScore(
        item,
        docs
      );

    const receipt =
      docs.some(doc =>
        /receipt|invoice|račun|fakt/i
          .test(
            `${doc.type} ${doc.title}`
          )
      );

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos132-section bos138-extra';

    section.innerHTML = `
      <div class="bos132-section-head">
        <div>
          <h3>
            ${esc(
              t(
                'Protection summary',
                'Sažetak zaštite'
              )
            )}
          </h3>

          <p class="bos132-section-note">
            ${esc(
              t(
                'Calculated only from protection information stored for this item.',
                'Izračun se temelji samo na podacima zaštite spremljenima za ovu stvar.'
              )
            )}
          </p>
        </div>
      </div>

      <div class="bos138-details">
        ${metaRow(
          t(
            'Protection score',
            'Ocjena zaštite'
          ),
          `${score}%`
        )}

        ${metaRow(
          t(
            'Receipt / invoice',
            'Račun / faktura'
          ),
          receipt
            ? t(
                'Stored',
                'Spremljeno'
              )
            : t(
                'Missing',
                'Nedostaje'
              )
        )}

        ${metaRow(
          t(
            'Warranty',
            'Jamstvo'
          ),
          item.warrantyUntil
            ? (
                warranty !== null &&
                warranty >= 0
                  ? `${dateText(item.warrantyUntil)} · ${warranty}d`
                  : dateText(item.warrantyUntil)
              )
            : ''
        )}

        ${metaRow(
          t(
            'Return window',
            'Rok povrata'
          ),
          item.returnBy
            ? (
                returns !== null &&
                returns >= 0
                  ? `${dateText(item.returnBy)} · ${returns}d`
                  : dateText(item.returnBy)
              )
            : ''
        )}

        ${metaRow(
          t(
            'Renewal',
            'Obnova'
          ),
          dateText(
            item.renewalAt
          )
        )}

        ${metaRow(
          t(
            'Insurance',
            'Osiguranje'
          ),
          firstValue(
            item,
            [
              'insurance',
              'insuranceProvider',
              'insurancePolicy'
            ]
          )
        )}
      </div>
    `;

    return section;
  }

  function createKnowledge(
    item
  ) {
    const specifications =
      firstValue(
        item,
        [
          'specifications',
          'specs'
        ]
      );

    const accessories =
      firstValue(
        item,
        [
          'accessories'
        ]
      );

    const compatibility =
      firstValue(
        item,
        [
          'compatibility'
        ]
      );

    const software =
      firstValue(
        item,
        [
          'software'
        ]
      );

    const firmware =
      firstValue(
        item,
        [
          'firmware',
          'firmwareVersion'
        ]
      );

    const usefulLink =
      firstValue(
        item,
        [
          'url',
          'reference',
          'supportUrl',
          'manualUrl'
        ]
      );

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos132-section bos138-extra';

    section.innerHTML = `
      <div class="bos132-section-head">
        <div>
          <h3>
            ${esc(
              t(
                'Knowledge',
                'Znanje'
              )
            )}
          </h3>

          <p class="bos132-section-note">
            ${esc(
              t(
                'Product knowledge saved with this ownership record.',
                'Podaci o proizvodu spremljeni uz ovaj zapis vlasništva.'
              )
            )}
          </p>
        </div>
      </div>

      <div class="bos138-details">
        ${metaRow(
          t(
            'Specifications',
            'Specifikacije'
          ),
          specifications
        )}

        ${metaRow(
          t(
            'Accessories',
            'Dodaci'
          ),
          accessories
        )}

        ${metaRow(
          t(
            'Compatibility',
            'Kompatibilnost'
          ),
          compatibility
        )}

        ${metaRow(
          t(
            'Software',
            'Softver'
          ),
          software
        )}

        ${metaRow(
          t(
            'Firmware',
            'Firmware'
          ),
          firmware
        )}

        ${metaRow(
          t(
            'Useful link',
            'Korisna poveznica'
          ),
          usefulLink
        )}
      </div>
    `;

    return section;
  }

  function createRelated(
    item
  ) {
    const related =
      relatedThings(item);

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos132-section bos138-extra';

    section.innerHTML = `
      <div class="bos132-section-head">
        <div>
          <h3>
            ${esc(
              t(
                'Related in your Still',
                'Povezano u tvom Still-u'
              )
            )}
          </h3>

          <p class="bos132-section-note">
            ${esc(
              t(
                'Based on shared brand, provider or category in your own stored records.',
                'Temelji se na zajedničkoj marki, pružatelju ili kategoriji u tvojim spremljenim zapisima.'
              )
            )}
          </p>
        </div>
      </div>

      ${
        related.length
          ? `
            <div class="bos138-related">
              ${
                related.map(other => `
                  <button
                    type="button"
                    data-v138-related="${esc(other.id)}"
                  >
                    <b>
                      ${esc(
                        other.title ||
                        t(
                          'Untitled thing',
                          'Stvar bez naziva'
                        )
                      )}
                    </b>

                    <small>
                      ${esc(
                        brandOf(other) ||
                        other.business ||
                        other.kind ||
                        ''
                      )}
                    </small>
                  </button>
                `).join('')
              }
            </div>
          `
          : `
            <div class="bos135-empty">
              ${esc(
                t(
                  'No related ownership records were found.',
                  'Nisu pronađeni povezani zapisi vlasništva.'
                )
              )}
            </div>
          `
      }
    `;

    return section;
  }

  function createSidebar(
    item,
    docs,
    serviceEvents
  ) {
    const completion =
      completionScore(
        item,
        docs,
        serviceEvents
      );

    const protection =
      protectionScore(
        item,
        docs
      );

    const last =
      lastActivity(
        item,
        docs,
        serviceEvents
      );

    const node =
      document.createElement(
        'aside'
      );

    node.className =
      'bos138-side';

    node.innerHTML = `
      <section class="bos138-panel">
        <h4>
          ${esc(
            t(
              'Passport completion',
              'Popunjenost putovnice'
            )
          )}
        </h4>

        <div class="bos138-score">
          <span>
            ${esc(
              t(
                'Stored information',
                'Spremljeni podaci'
              )
            )}
          </span>

          <strong>
            ${completion}%
          </strong>

          <div
            class="bos138-meter"
            style="--value:${completion}%"
          >
            <i></i>
          </div>
        </div>
      </section>

      <section class="bos138-panel">
        <h4>
          ${esc(
            t(
              'Protection',
              'Zaštita'
            )
          )}
        </h4>

        <div class="bos138-score">
          <span>
            ${esc(
              t(
                'Protection data',
                'Podaci zaštite'
              )
            )}
          </span>

          <strong>
            ${protection}%
          </strong>

          <div
            class="bos138-meter"
            style="--value:${protection}%"
          >
            <i></i>
          </div>
        </div>
      </section>

      <section class="bos138-panel">
        <h4>
          ${esc(
            t(
              'Last activity',
              'Zadnja aktivnost'
            )
          )}
        </h4>

        <small>
          ${
            last
              ? esc(
                  dateText(last)
                )
              : esc(
                  t(
                    'No dated activity stored',
                    'Nema spremljene aktivnosti s datumom'
                  )
                )
          }
        </small>

        <div class="bos138-side-actions">
          <button
            type="button"
            data-v138-timeline
          >
            ${esc(
              t(
                'Timeline',
                'Vremenska crta'
              )
            )}
          </button>

          <button
            type="button"
            data-v138-share
          >
            ${esc(
              t(
                'Share passport',
                'Podijeli putovnicu'
              )
            )}
          </button>

          <button
            type="button"
            data-v138-print
          >
            ${esc(
              t(
                'Print / Save PDF',
                'Ispis / Spremi PDF'
              )
            )}
          </button>
        </div>
      </section>

      <section class="bos138-panel">
        <h4>
          ${esc(
            t(
              'Recent documents',
              'Nedavni dokumenti'
            )
          )}
        </h4>

        ${
          docs.length
            ? docs
                .slice()
                .sort(
                  (a,b) =>
                    String(
                      b.date ||
                      b.createdAt ||
                      ''
                    )
                      .localeCompare(
                        String(
                          a.date ||
                          a.createdAt ||
                          ''
                        )
                      )
                )
                .slice(0,3)
                .map(doc => `
                  <div class="bos138-side-doc">
                    <b>
                      ${esc(
                        doc.title ||
                        docLabel(doc)
                      )}
                    </b>

                    <small>
                      ${esc(
                        docLabel(doc)
                      )}
                      ${
                        doc.date
                          ? ` · ${esc(dateText(doc.date))}`
                          : ''
                      }
                    </small>
                  </div>
                `)
                .join('')
            : `
              <small>
                ${esc(
                  t(
                    'No linked documents',
                    'Nema povezanih dokumenata'
                  )
                )}
              </small>
            `
        }
      </section>
    `;

    return node;
  }

  function bindActions(
    root,
    item
  ) {
    if (
      root.dataset.v138Bound ===
      'true'
    ) {
      return;
    }

    root.dataset.v138Bound =
      'true';

    root.addEventListener(
      'click',
      async event => {
        const shareButton =
          event.target.closest(
            '[data-v138-share]'
          );

        if (shareButton) {
          await share(item);
          return;
        }

        const copyButton =
          event.target.closest(
            '[data-v138-copy]'
          );

        if (copyButton) {
          const success =
            await copyLink();

          copyButton.textContent =
            success
              ? t(
                  'Copied',
                  'Kopirano'
                )
              : t(
                  'Copy failed',
                  'Kopiranje nije uspjelo'
                );

          setTimeout(() => {
            copyButton.textContent =
              t(
                'Copy link',
                'Kopiraj poveznicu'
              );
          },1500);

          return;
        }

        if (
          event.target.closest(
            '[data-v138-print]'
          )
        ) {
          window.print();
          return;
        }

        if (
          event.target.closest(
            '[data-v138-timeline]'
          )
        ) {
          scrollToSection(
            'timeline'
          );
          return;
        }

        const related =
          event.target.closest(
            '[data-v138-related]'
          );

        if (related) {
          openRelated(
            related.dataset
              .v138Related
          );
        }
      }
    );
  }

  function enhanceThingPage(
    root
  ) {
    if (
      location.hash !==
      '#buyeros-thing'
    ) {
      return;
    }

    const item =
      selectedThing();

    if (!item) return;

    const hero =
      $('.bos136-passport', root);

    const content =
      $('#bos132Content', root);

    if (
      !hero ||
      !content
    ) {
      return;
    }

    if (
      content.dataset.v138Enhanced ===
      item.id
    ) {
      bindActions(
        root,
        item
      );

      return;
    }

    $$('.bos138-extra', content)
      .forEach(node =>
        node.remove()
      );

    $('.bos138-layout', content)
      ?.replaceWith(
        ...[]
      );

    content.dataset.v138Enhanced =
      item.id;

    installStyles();

    const docs =
      linkedDocuments(item);

    const serviceEvents =
      services(item);

    const media =
      createMedia(item);

    if (
      !$('.bos138-media', hero)
    ) {
      hero.appendChild(
        media
      );
    }

    const existingSections =
      [
        ...content.children
      ].filter(node =>
        node !== hero &&
        !node.classList
          .contains(
            'bos135-tabs'
          ) &&
        !node.classList
          .contains(
            'bos136-status-strip'
          ) &&
        !node.classList
          .contains(
            'bos136-next'
          ) &&
        !node.classList
          .contains(
            'bos135-back'
          )
      );

    const layout =
      document.createElement(
        'div'
      );

    layout.className =
      'bos138-layout';

    const main =
      document.createElement(
        'div'
      );

    main.className =
      'bos138-main';

    const identity =
      createOverview(item);

    main.appendChild(
      identity
    );

    const gallery =
      createGallery(item);

    if (gallery) {
      main.appendChild(
        gallery
      );
    }

    existingSections
      .forEach(section => {
        main.appendChild(
          section
        );
      });

    main.appendChild(
      createDocumentSummary(
        docs
      )
    );

    main.appendChild(
      createProtectionSummary(
        item,
        docs
      )
    );

    main.appendChild(
      createKnowledge(
        item
      )
    );

    main.appendChild(
      createRelated(
        item
      )
    );

    layout.appendChild(
      main
    );

    layout.appendChild(
      createSidebar(
        item,
        docs,
        serviceEvents
      )
    );

    content.appendChild(
      layout
    );

    bindActions(
      root,
      item
    );
  }

  function enhance() {
    const root =
      document.querySelector(
        ROOT
      );

    if (!root) return false;

    enhanceThingPage(
      root
    );

    return true;
  }

  function scheduleEnhance() {
    clearTimeout(
      enhanceTimer
    );

    enhanceTimer =
      setTimeout(
        enhance,
        20
      );
  }

  function boot() {
    installStyles();

    const start = () => {
      const root =
        document.querySelector(
          ROOT
        );

      if (!root) {
        return false;
      }

      enhance();

      rootObserver?.disconnect();

      rootObserver =
        new MutationObserver(
          scheduleEnhance
        );

      rootObserver.observe(
        root,
        {
          childList:true,
          subtree:true
        }
      );

      return true;
    };

    if (start()) return;

    const pageObserver =
      new MutationObserver(
        () => {
          if (start()) {
            pageObserver.disconnect();
          }
        }
      );

    pageObserver.observe(
      document.documentElement,
      {
        childList:true,
        subtree:true
      }
    );
  }

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
    scheduleEnhance
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

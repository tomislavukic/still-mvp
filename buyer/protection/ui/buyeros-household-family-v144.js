(() => {
  'use strict';

  const ROOT = '#buyerOSV132';
  const STYLE_ID = 'buyerOSHouseholdFamilyV144Style';

  const OWNERSHIP_KEY =
    'still-ownership-passports-v83';

  const HOUSEHOLD_KEY =
    'still-buyeros-household-v132';

  const FAMILY_KEY =
    'still-buyeros-family-v132';

  const SELECTED_KEY =
    'still-buyeros-selected-thing-v135';

  let observer = null;
  let timer = null;

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
    return readArray(
      OWNERSHIP_KEY
    );
  }

  function household() {
    return readArray(
      HOUSEHOLD_KEY
    );
  }

  function family() {
    return readArray(
      FAMILY_KEY
    );
  }

  function normalize(value) {
    return String(value ?? '')
      .trim()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLowerCase();
  }

  function firstValue(
    object,
    fields
  ) {
    for (
      const field of fields
    ) {
      const value =
        object?.[field];

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

  function displayName(record) {
    return firstValue(
      record,
      [
        'name',
        'title',
        'displayName',
        'fullName',
        'label'
      ]
    ) || t(
      'Unnamed member',
      'Član bez naziva'
    );
  }

  function role(record) {
    return firstValue(
      record,
      [
        'role',
        'relationship',
        'type'
      ]
    );
  }

  function contact(record) {
    return firstValue(
      record,
      [
        'email',
        'phone'
      ]
    );
  }

  function memberId(record) {
    return firstValue(
      record,
      [
        'id',
        'memberId',
        'personId',
        'profileId'
      ]
    );
  }

  function itemMatchesMember(
    item,
    member
  ) {
    const id =
      memberId(member);

    const name =
      normalize(
        displayName(member)
      );

    const itemIds = [
      item.ownerId,
      item.memberId,
      item.familyMemberId,
      item.assignedToId
    ]
      .filter(Boolean)
      .map(String);

    if (
      id &&
      itemIds.includes(id)
    ) {
      return true;
    }

    const itemNames = [
      item.owner,
      item.ownerName,
      item.assignedTo
    ]
      .filter(Boolean)
      .map(normalize);

    return (
      name &&
      itemNames.includes(name)
    );
  }

  function thingsForMember(
    member
  ) {
    return things().filter(
      item =>
        itemMatchesMember(
          item,
          member
        )
    );
  }

  function householdThings(
    record
  ) {
    const id =
      firstValue(
        record,
        [
          'id',
          'householdId'
        ]
      );

    if (!id)
      return [];

    return things().filter(
      item =>
        String(
          item.householdId ||
          ''
        ) === id
    );
  }

  function openThing(id) {
    if (!id)
      return;

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
        'still:ownership-updated',
        {
          detail:{
            thingId:id,
            source:'household-family-v144'
          }
        }
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

    style.id =
      STYLE_ID;

    style.textContent = `
      ${ROOT} .bos144{
        margin-top:14px
      }

      ${ROOT} .bos144-summary{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px
      }

      ${ROOT} .bos144-stat{
        padding:13px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:15px;
        background:var(--surface,#fff)
      }

      ${ROOT} .bos144-stat span{
        display:block;
        color:var(--muted,#66727a);
        font-size:8px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.06em
      }

      ${ROOT} .bos144-stat strong{
        display:block;
        margin-top:5px;
        font-size:21px;
        letter-spacing:-.04em
      }

      ${ROOT} .bos144-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:9px;
        margin-top:11px
      }

      ${ROOT} .bos144-card{
        border:1px solid var(--line,#d9e1e5);
        border-radius:17px;
        background:var(--surface,#fff);
        overflow:hidden
      }

      ${ROOT} .bos144-card-head{
        display:grid;
        grid-template-columns:42px minmax(0,1fr);
        gap:10px;
        align-items:center;
        padding:13px
      }

      ${ROOT} .bos144-avatar{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:var(--soft,#f3f6f4);
        font-size:14px;
        font-weight:850
      }

      ${ROOT} .bos144-card b{
        display:block;
        font-size:12px
      }

      ${ROOT} .bos144-card small{
        display:block;
        margin-top:3px;
        color:var(--muted,#66727a);
        font-size:9px
      }

      ${ROOT} .bos144-meta{
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        padding:0 13px 12px
      }

      ${ROOT} .bos144-pill{
        display:inline-flex;
        min-height:24px;
        align-items:center;
        padding:0 8px;
        border:1px solid var(--line,#d9e1e5);
        border-radius:999px;
        color:var(--muted,#66727a);
        font-size:8px;
        font-weight:760
      }

      ${ROOT} .bos144-things{
        border-top:1px solid var(--line,#d9e1e5);
        display:grid
      }

      ${ROOT} .bos144-thing{
        display:grid;
        grid-template-columns:34px minmax(0,1fr) auto;
        gap:9px;
        align-items:center;
        padding:9px 12px;
        border:0;
        border-bottom:1px solid var(--line,#d9e1e5);
        background:transparent;
        color:var(--ink,#111);
        text-align:left;
        font:inherit;
        cursor:pointer
      }

      ${ROOT} .bos144-thing:last-child{
        border-bottom:0
      }

      ${ROOT} .bos144-thing:hover{
        background:var(--soft,#f3f6f4)
      }

      ${ROOT} .bos144-thing-icon{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        border-radius:10px;
        background:var(--soft,#f3f6f4)
      }

      ${ROOT} .bos144-thing b{
        font-size:10px
      }

      ${ROOT} .bos144-empty{
        padding:22px;
        margin-top:10px;
        border:1px dashed var(--line,#d9e1e5);
        border-radius:16px;
        text-align:center;
        color:var(--muted,#66727a);
        font-size:10px
      }

      ${ROOT} .bos144-empty b{
        display:block;
        margin-bottom:4px;
        color:var(--ink,#111);
        font-size:12px
      }

      ${ROOT} .bos144-section-title{
        margin:16px 0 7px;
        font-size:13px
      }

      @media(max-width:760px){
        ${ROOT} .bos144-summary,
        ${ROOT} .bos144-grid{
          grid-template-columns:1fr 1fr
        }
      }

      @media(max-width:560px){
        ${ROOT} .bos144-summary,
        ${ROOT} .bos144-grid{
          grid-template-columns:1fr
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function initials(name) {
    const parts =
      String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length)
      return '•';

    return parts
      .slice(0,2)
      .map(part =>
        part[0]
          .toUpperCase()
      )
      .join('');
  }

  function memberCard(member) {
    const memberThings =
      thingsForMember(member);

    const name =
      displayName(member);

    const memberRole =
      role(member);

    const memberContact =
      contact(member);

    return `
      <article class="bos144-card">
        <div class="bos144-card-head">
          <span class="bos144-avatar">
            ${esc(
              initials(name)
            )}
          </span>

          <div>
            <b>
              ${esc(name)}
            </b>

            <small>
              ${esc(
                memberRole ||
                t(
                  'Family member',
                  'Član obitelji'
                )
              )}
            </small>
          </div>
        </div>

        <div class="bos144-meta">
          <span class="bos144-pill">
            ${memberThings.length}
            ${esc(
              t(
                'things',
                'stvari'
              )
            )}
          </span>

          ${
            memberContact
              ? `
                <span class="bos144-pill">
                  ${esc(
                    memberContact
                  )}
                </span>
              `
              : ''
          }
        </div>

        ${
          memberThings.length
            ? `
              <div class="bos144-things">
                ${
                  memberThings
                    .slice(0,6)
                    .map(item => `
                      <button
                        type="button"
                        class="bos144-thing"
                        data-v144-thing="${esc(item.id)}"
                      >
                        <span class="bos144-thing-icon">
                          ◇
                        </span>

                        <span>
                          <b>
                            ${esc(
                              item.title ||
                              t(
                                'Untitled thing',
                                'Stvar bez naziva'
                              )
                            )}
                          </b>

                          <small>
                            ${esc(
                              item.brand ||
                              item.manufacturer ||
                              item.kind ||
                              ''
                            )}
                          </small>
                        </span>

                        <span>→</span>
                      </button>
                    `)
                    .join('')
                }
              </div>
            `
            : ''
        }
      </article>
    `;
  }

  function householdCard(
    record
  ) {
    const linked =
      householdThings(
        record
      );

    const name =
      displayName(record);

    const location =
      firstValue(
        record,
        [
          'address',
          'location',
          'city'
        ]
      );

    return `
      <article class="bos144-card">
        <div class="bos144-card-head">
          <span class="bos144-avatar">
            ⌂
          </span>

          <div>
            <b>
              ${esc(name)}
            </b>

            <small>
              ${esc(
                location ||
                t(
                  'Household',
                  'Kućanstvo'
                )
              )}
            </small>
          </div>
        </div>

        <div class="bos144-meta">
          <span class="bos144-pill">
            ${linked.length}
            ${esc(
              t(
                'linked things',
                'povezanih stvari'
              )
            )}
          </span>
        </div>

        ${
          linked.length
            ? `
              <div class="bos144-things">
                ${
                  linked
                    .slice(0,6)
                    .map(item => `
                      <button
                        type="button"
                        class="bos144-thing"
                        data-v144-thing="${esc(item.id)}"
                      >
                        <span class="bos144-thing-icon">
                          ◇
                        </span>

                        <span>
                          <b>
                            ${esc(
                              item.title ||
                              t(
                                'Untitled thing',
                                'Stvar bez naziva'
                              )
                            )}
                          </b>

                          <small>
                            ${esc(
                              item.location ||
                              item.kind ||
                              ''
                            )}
                          </small>
                        </span>

                        <span>→</span>
                      </button>
                    `)
                    .join('')
                }
              </div>
            `
            : ''
        }
      </article>
    `;
  }

  function bindThings(
    root
  ) {
    $$(
      '[data-v144-thing]',
      root
    ).forEach(button => {
      button.addEventListener(
        'click',
        () =>
          openThing(
            button.dataset
              .v144Thing
          )
      );
    });
  }

  function createFamilyView() {
    const members =
      family();

    const allThings =
      things();

    const assigned =
      allThings.filter(item =>
        members.some(member =>
          itemMatchesMember(
            item,
            member
          )
        )
      );

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos144';

    section.dataset
      .v144Family =
      'true';

    section.innerHTML = `
      <div class="bos144-summary">
        <article class="bos144-stat">
          <span>
            ${esc(
              t(
                'MEMBERS',
                'ČLANOVI'
              )
            )}
          </span>
          <strong>
            ${members.length}
          </strong>
        </article>

        <article class="bos144-stat">
          <span>
            ${esc(
              t(
                'THINGS',
                'STVARI'
              )
            )}
          </span>
          <strong>
            ${allThings.length}
          </strong>
        </article>

        <article class="bos144-stat">
          <span>
            ${esc(
              t(
                'ASSIGNED',
                'DODIJELJENO'
              )
            )}
          </span>
          <strong>
            ${assigned.length}
          </strong>
        </article>

        <article class="bos144-stat">
          <span>
            ${esc(
              t(
                'UNASSIGNED',
                'NEDODIJELJENO'
              )
            )}
          </span>
          <strong>
            ${
              Math.max(
                0,
                allThings.length -
                assigned.length
              )
            }
          </strong>
        </article>
      </div>

      ${
        members.length
          ? `
            <h3 class="bos144-section-title">
              ${esc(
                t(
                  'People in your BuyerOS',
                  'Ljudi u tvom BuyerOS-u'
                )
              )}
            </h3>

            <div class="bos144-grid">
              ${
                members
                  .map(member =>
                    memberCard(member)
                  )
                  .join('')
              }
            </div>
          `
          : `
            <div class="bos144-empty">
              <b>
                ${esc(
                  t(
                    'No family members yet.',
                    'Još nema članova obitelji.'
                  )
                )}
              </b>

              ${esc(
                t(
                  'BuyerOS will show people here when they are saved through the existing Family workflow.',
                  'BuyerOS će ovdje prikazati osobe kada ih spremiš kroz postojeći Family postupak.'
                )
              )}
            </div>
          `
      }
    `;

    bindThings(section);

    return section;
  }

  function createHouseholdView() {
    const homes =
      household();

    const allThings =
      things();

    const linkedIds =
      new Set();

    homes.forEach(home => {
      householdThings(home)
        .forEach(item =>
          linkedIds.add(
            item.id
          )
        );
    });

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'bos144';

    section.dataset
      .v144Household =
      'true';

    section.innerHTML = `
      <div class="bos144-summary">
        <article class="bos144-stat">
          <span>
            ${esc(
              t(
                'HOUSEHOLDS',
                'KUĆANSTVA'
              )
            )}
          </span>
          <strong>
            ${homes.length}
          </strong>
        </article>

        <article class="bos144-stat">
          <span>
            ${esc(
              t(
                'THINGS',
                'STVARI'
              )
            )}
          </span>
          <strong>
            ${allThings.length}
          </strong>
        </article>

        <article class="bos144-stat">
          <span>
            ${esc(
              t(
                'LINKED',
                'POVEZANO'
              )
            )}
          </span>
          <strong>
            ${linkedIds.size}
          </strong>
        </article>

        <article class="bos144-stat">
          <span>
            ${esc(
              t(
                'UNLINKED',
                'NEPOVEZANO'
              )
            )}
          </span>
          <strong>
            ${
              Math.max(
                0,
                allThings.length -
                linkedIds.size
              )
            }
          </strong>
        </article>
      </div>

      ${
        homes.length
          ? `
            <h3 class="bos144-section-title">
              ${esc(
                t(
                  'Your households',
                  'Tvoja kućanstva'
                )
              )}
            </h3>

            <div class="bos144-grid">
              ${
                homes
                  .map(home =>
                    householdCard(home)
                  )
                  .join('')
              }
            </div>
          `
          : `
            <div class="bos144-empty">
              <b>
                ${esc(
                  t(
                    'No household profiles yet.',
                    'Još nema profila kućanstva.'
                  )
                )}
              </b>

              ${esc(
                t(
                  'Nothing is fabricated here. Household profiles appear only after you save them.',
                  'Ovdje se ništa ne izmišlja. Profili kućanstva pojavljuju se tek kada ih spremiš.'
                )
              )}
            </div>
          `
      }
    `;

    bindThings(section);

    return section;
  }

  function enhancePage(
    root
  ) {
    const isHousehold =
      location.hash ===
      '#buyeros-household';

    const isFamily =
      location.hash ===
      '#buyeros-family';

    if (
      !isHousehold &&
      !isFamily
    ) {
      return;
    }

    const content =
      $('#bos132Content', root);

    if (!content)
      return;

    $$(
      '[data-v144-household], [data-v144-family]',
      content
    ).forEach(node =>
      node.remove()
    );

    const view =
      isFamily
        ? createFamilyView()
        : createHouseholdView();

    const head =
      $('.bos132-page-head', content);

    if (head) {
      head.insertAdjacentElement(
        'afterend',
        view
      );
    } else {
      content.prepend(view);
    }
  }

  function enhance() {
    const root =
      document.querySelector(
        ROOT
      );

    if (!root)
      return false;

    installStyles();
    enhancePage(root);

    return true;
  }

  function schedule() {
    clearTimeout(timer);

    timer =
      setTimeout(
        enhance,
        40
      );
  }

  function boot() {
    installStyles();

    const start = () => {
      const root =
        document.querySelector(
          ROOT
        );

      if (!root)
        return false;

      enhance();

      observer?.disconnect();

      observer =
        new MutationObserver(
          mutations => {
            const relevant =
              mutations.some(
                mutation =>
                  [...mutation.addedNodes]
                    .some(node =>
                      node.nodeType === 1 &&
                      !node.matches?.(
                        '[data-v144-household], [data-v144-family]'
                      ) &&
                      !node.closest?.(
                        '[data-v144-household], [data-v144-family]'
                      )
                    )
              );

            if (relevant)
              schedule();
          }
        );

      observer.observe(
        root,
        {
          childList:true,
          subtree:true
        }
      );

      return true;
    };

    if (start())
      return;

    const pageObserver =
      new MutationObserver(
        () => {
          if (start())
            pageObserver.disconnect();
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
    schedule
  );

  window.addEventListener(
    'still:ownership-updated',
    schedule
  );

  window.addEventListener(
    'still:buyeros-data-updated',
    schedule
  );

  window.addEventListener(
    'still:language',
    schedule
  );

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

(() => {
  'use strict';

  /*
   * BuyerOS Tool Layer V149
   *
   * Read-only access layer for future BuyerOS intelligence.
   *
   * Rules:
   * - no DOM rendering
   * - does not watch DOM mutations
   * - no network calls
   * - no storage writes
   * - no fabricated data
   */

  const VERSION = '149';

  const STORAGE = Object.freeze({
    things: 'still-ownership-passports-v83',
    documents: 'still-buyeros-documents-v132',
    household: 'still-buyeros-household-v132',
    family: 'still-buyeros-family-v132'
  });

  const registry = new Map();

  function readArray(key) {
    try {
      const value = JSON.parse(
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
      STORAGE.things
    );
  }

  function documents() {
    return readArray(
      STORAGE.documents
    );
  }

  function households() {
    return readArray(
      STORAGE.household
    );
  }

  function family() {
    return readArray(
      STORAGE.family
    );
  }

  function clean(value) {
    return String(
      value ?? ''
    ).trim();
  }

  function normalize(value) {
    return clean(value)
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLowerCase();
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    const date = new Date(
      String(value).length <= 10
        ? `${String(value).slice(0,10)}T12:00:00`
        : value
    );

    return Number.isNaN(
      date.valueOf()
    )
      ? null
      : date;
  }

  function daysUntil(value) {
    const target =
      parseDate(value);

    if (!target) {
      return null;
    }

    const now = new Date();

    now.setHours(
      12,
      0,
      0,
      0
    );

    target.setHours(
      12,
      0,
      0,
      0
    );

    return Math.ceil(
      (
        target.getTime() -
        now.getTime()
      ) / 86400000
    );
  }

  function clampInteger(
    value,
    fallback,
    min,
    max
  ) {
    const number =
      Number.parseInt(
        value,
        10
      );

    if (
      !Number.isFinite(number)
    ) {
      return fallback;
    }

    return Math.min(
      max,
      Math.max(
        min,
        number
      )
    );
  }

  function copy(value) {
    if (
      value === undefined
    ) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function ok(
    tool,
    data,
    meta = {}
  ) {
    return {
      ok: true,
      tool,
      data: copy(data),
      meta: copy(meta),
      error: null
    };
  }

  function fail(
    tool,
    code,
    message,
    meta = {}
  ) {
    return {
      ok: false,
      tool,
      data: null,
      meta: copy(meta),
      error: {
        code,
        message
      }
    };
  }

  function thingSearchText(item) {
    return normalize(
      [
        item.id,
        item.title,
        item.kind,
        item.brand,
        item.manufacturer,
        item.model,
        item.modelName,
        item.serialNumber,
        item.serial,
        item.business,
        item.store,
        item.location,
        item.owner,
        item.ownerName,
        item.notes
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  function scoreThing(
    item,
    query
  ) {
    const needle =
      normalize(query);

    if (!needle) {
      return 1;
    }

    const title =
      normalize(item.title);

    const brand =
      normalize(
        item.brand ||
        item.manufacturer
      );

    const model =
      normalize(
        item.model ||
        item.modelName
      );

    const serial =
      normalize(
        item.serialNumber ||
        item.serial
      );

    const text =
      thingSearchText(item);

    let score = 0;

    if (
      title === needle
    ) {
      score += 100;
    }

    if (
      title.startsWith(
        needle
      )
    ) {
      score += 70;
    }

    if (
      title.includes(
        needle
      )
    ) {
      score += 50;
    }

    if (
      serial &&
      serial.includes(
        needle
      )
    ) {
      score += 50;
    }

    if (
      brand &&
      brand.includes(
        needle
      )
    ) {
      score += 35;
    }

    if (
      model &&
      model.includes(
        needle
      )
    ) {
      score += 35;
    }

    if (
      text.includes(
        needle
      )
    ) {
      score += 20;
    }

    needle
      .split(/\s+/)
      .filter(Boolean)
      .forEach(token => {
        if (
          text.includes(token)
        ) {
          score += 5;
        }
      });

    return score;
  }

  function searchThings(
    query,
    limit = 20
  ) {
    return things()
      .map(item => ({
        item,
        score:
          scoreThing(
            item,
            query
          )
      }))
      .filter(entry =>
        entry.score > 0
      )
      .sort(
        (a,b) =>
          b.score -
          a.score
      )
      .slice(
        0,
        limit
      );
  }

  function findThingById(id) {
    const needle =
      clean(id);

    if (!needle) {
      return null;
    }

    return things().find(
      item =>
        String(
          item.id ||
          ''
        ) === needle
    ) || null;
  }

  function relatedThing(doc) {
    const all =
      things();

    if (
      doc.thingId
    ) {
      const match =
        all.find(
          item =>
            item.id ===
            doc.thingId
        );

      if (match) {
        return match;
      }
    }

    if (
      doc.relatedThingId
    ) {
      const match =
        all.find(
          item =>
            item.id ===
            doc.relatedThingId
        );

      if (match) {
        return match;
      }
    }

    const title =
      normalize(
        doc.relatedThing
      );

    if (!title) {
      return null;
    }

    return all.find(
      item =>
        normalize(
          item.title
        ) === title
    ) || null;
  }

  function docsForThing(
    thingId
  ) {
    return documents().filter(
      doc =>
        relatedThing(doc)?.id ===
        thingId
    );
  }

  function serviceHistoryFor(
    thingId = ''
  ) {
    return things()
      .flatMap(item => {
        if (
          thingId &&
          item.id !==
          thingId
        ) {
          return [];
        }

        if (
          !Array.isArray(
            item.serviceHistory
          )
        ) {
          return [];
        }

        return item
          .serviceHistory
          .map(
            (event,index) => ({
              ...event,

              id:
                event.id ||
                `service:${item.id}:${index}`,

              thingId:
                item.id,

              thingTitle:
                item.title ||
                ''
            })
          );
      })
      .sort(
        (a,b) =>
          String(
            b.occurredOn ||
            b.date ||
            ''
          ).localeCompare(
            String(
              a.occurredOn ||
              a.date ||
              ''
            )
          )
      );
  }

  function attention(
    horizonDays
  ) {
    const result = [];

    const fields = [
      {
        field:'warrantyUntil',
        type:'warranty'
      },
      {
        field:'returnBy',
        type:'return'
      },
      {
        field:'renewalAt',
        type:'renewal'
      },
      {
        field:'nextActionAt',
        type:'next_action'
      }
    ];

    things().forEach(item => {
      fields.forEach(
        definition => {
          const value =
            item[
              definition.field
            ];

          const days =
            daysUntil(value);

          if (
            days === null ||
            days < 0 ||
            days > horizonDays
          ) {
            return;
          }

          result.push({
            type:
              definition.type,

            field:
              definition.field,

            date:
              value,

            days,

            thingId:
              item.id,

            thingTitle:
              item.title ||
              ''
          });
        }
      );
    });

    return result.sort(
      (a,b) =>
        a.days - b.days
    );
  }

  function timeline(
    thingId = '',
    limit = 100
  ) {
    const events = [];

    const selectedThings =
      thingId
        ? things().filter(
            item =>
              item.id === thingId
          )
        : things();

    selectedThings.forEach(
      item => {
        const base = {
          thingId:
            item.id,

          thingTitle:
            item.title ||
            ''
        };

        const purchaseDate =
          item.purchaseDate ||
          item.purchasedOn;

        if (
          parseDate(
            purchaseDate
          )
        ) {
          events.push({
            ...base,
            type:'purchase',
            date:purchaseDate,
            title:'Purchased'
          });
        }

        if (
          parseDate(
            item.warrantyUntil
          )
        ) {
          events.push({
            ...base,
            type:'warranty',
            date:
              item.warrantyUntil,
            title:'Warranty ends'
          });
        }

        if (
          parseDate(
            item.returnBy
          )
        ) {
          events.push({
            ...base,
            type:'return',
            date:
              item.returnBy,
            title:
              'Return window ends'
          });
        }

        if (
          parseDate(
            item.renewalAt
          )
        ) {
          events.push({
            ...base,
            type:'renewal',
            date:
              item.renewalAt,
            title:'Renewal'
          });
        }

        if (
          parseDate(
            item.createdAt
          )
        ) {
          events.push({
            ...base,
            type:'created',
            date:
              item.createdAt,
            title:'Added to Still'
          });
        }

        if (
          item.updatedAt &&
          item.updatedAt !==
            item.createdAt &&
          parseDate(
            item.updatedAt
          )
        ) {
          events.push({
            ...base,
            type:'updated',
            date:
              item.updatedAt,
            title:
              'Ownership record updated'
          });
        }

        if (
          Array.isArray(
            item.serviceHistory
          )
        ) {
          item.serviceHistory
            .forEach(
              (event,index) => {
                const date =
                  event.occurredOn ||
                  event.date ||
                  event.createdAt;

                if (
                  !parseDate(date)
                ) {
                  return;
                }

                events.push({
                  ...base,

                  id:
                    event.id ||
                    `service:${item.id}:${index}`,

                  type:'service',

                  date,

                  title:
                    event.title ||
                    'Service',

                  providerName:
                    event.providerName ||
                    ''
                });
              }
            );
        }
      }
    );

    documents()
      .forEach(
        (doc,index) => {
          const item =
            relatedThing(doc);

          if (
            thingId &&
            item?.id !== thingId
          ) {
            return;
          }

          const date =
            doc.date ||
            doc.createdAt ||
            doc.updatedAt;

          if (
            !parseDate(date)
          ) {
            return;
          }

          events.push({
            id:
              doc.id ||
              `document:${index}`,

            type:'document',

            date,

            title:
              doc.title ||
              doc.type ||
              'Document',

            thingId:
              item?.id ||
              null,

            thingTitle:
              item?.title ||
              ''
          });
        }
      );

    return events
      .sort(
        (a,b) =>
          parseDate(b.date) -
          parseDate(a.date)
      )
      .slice(
        0,
        limit
      );
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
        clean(value)
      ) {
        return clean(value);
      }
    }

    return '';
  }

  function memberId(
    member
  ) {
    return firstValue(
      member,
      [
        'id',
        'memberId',
        'personId',
        'profileId'
      ]
    );
  }

  function memberName(
    member
  ) {
    return firstValue(
      member,
      [
        'name',
        'title',
        'displayName',
        'fullName',
        'label'
      ]
    );
  }

  function memberThingIds(
    member
  ) {
    const id =
      memberId(member);

    const name =
      normalize(
        memberName(member)
      );

    return things()
      .filter(item => {
        const ids = [
          item.ownerId,
          item.memberId,
          item.familyMemberId,
          item.assignedToId
        ]
          .filter(Boolean)
          .map(String);

        if (
          id &&
          ids.includes(id)
        ) {
          return true;
        }

        const names = [
          item.owner,
          item.ownerName,
          item.assignedTo
        ]
          .filter(Boolean)
          .map(normalize);

        return (
          Boolean(name) &&
          names.includes(name)
        );
      })
      .map(item =>
        item.id
      );
  }

  function householdContext() {
    const allThings =
      things();

    const homes =
      households().map(home => {
        const id =
          firstValue(
            home,
            [
              'id',
              'householdId'
            ]
          );

        const linkedThingIds =
          id
            ? allThings
                .filter(
                  item =>
                    String(
                      item.householdId ||
                      ''
                    ) === id
                )
                .map(item =>
                  item.id
                )
            : [];

        return {
          id: id || null,

          name:
            firstValue(
              home,
              [
                'name',
                'title',
                'label'
              ]
            ),

          location:
            firstValue(
              home,
              [
                'address',
                'location',
                'city'
              ]
            ),

          thingIds:
            linkedThingIds,

          thingCount:
            linkedThingIds.length
        };
      });

    const members =
      family().map(member => {
        const linked =
          memberThingIds(
            member
          );

        return {
          id:
            memberId(member) ||
            null,

          name:
            memberName(member),

          role:
            firstValue(
              member,
              [
                'role',
                'relationship',
                'type'
              ]
            ),

          thingIds:
            linked,

          thingCount:
            linked.length
        };
      });

    return {
      households:
        homes,

      family:
        members,

      totalThings:
        allThings.length
    };
  }

  function register(
    name,
    description,
    handler
  ) {
    if (
      registry.has(name)
    ) {
      throw new Error(
        `Duplicate BuyerOS tool: ${name}`
      );
    }

    registry.set(
      name,
      Object.freeze({
        name,
        description,
        readOnly:true,
        handler
      })
    );
  }

  register(
    'list_things',
    'List BuyerOS ownership records using read-only filters.',
    args => {
      const limit =
        clampInteger(
          args?.limit,
          100,
          1,
          250
        );

      const kind =
        normalize(
          args?.kind
        );

      const hasSerial =
        args?.hasSerial === true;

      const missingWarranty =
        args?.missingWarranty === true;

      return things()
        .filter(item => {
          if (
            kind &&
            normalize(
              item.kind
            ) !== kind
          ) {
            return false;
          }

          if (
            hasSerial &&
            !(
              clean(
                item.serialNumber
              ) ||
              clean(
                item.serial
              )
            )
          ) {
            return false;
          }

          if (
            missingWarranty &&
            clean(
              item.warrantyUntil
            )
          ) {
            return false;
          }

          return true;
        })
        .slice(
          0,
          limit
        );
    }
  );

  register(
    'count_things',
    'Count ownership records currently stored in BuyerOS.',
    () => {
      const all =
        things();

      const byKind = {};

      all.forEach(item => {
        const kind =
          clean(
            item.kind
          ) || 'unknown';

        byKind[kind] =
          (
            byKind[kind] ||
            0
          ) + 1;
      });

      return {
        total:
          all.length,

        byKind
      };
    }
  );

  register(
    'search_things',
    'Search BuyerOS ownership records by title, brand, model, serial, retailer, location or notes.',
    args => {
      const query =
        clean(
          args?.query
        );

      const limit =
        clampInteger(
          args?.limit,
          20,
          1,
          50
        );

      if (!query) {
        throw Object.assign(
          new Error(
            'query is required'
          ),
          {
            code:
              'INVALID_ARGUMENT'
          }
        );
      }

      return searchThings(
        query,
        limit
      ).map(entry => ({
        score:
          entry.score,

        thing:
          entry.item
      }));
    }
  );

  register(
    'get_thing',
    'Get one BuyerOS ownership record by ID, or resolve one unique record by search query.',
    args => {
      const id =
        clean(
          args?.id
        );

      if (id) {
        const item =
          findThingById(id);

        if (!item) {
          throw Object.assign(
            new Error(
              'Thing not found'
            ),
            {
              code:'NOT_FOUND'
            }
          );
        }

        return item;
      }

      const query =
        clean(
          args?.query
        );

      if (!query) {
        throw Object.assign(
          new Error(
            'id or query is required'
          ),
          {
            code:
              'INVALID_ARGUMENT'
          }
        );
      }

      const matches =
        searchThings(
          query,
          5
        );

      if (
        !matches.length
      ) {
        throw Object.assign(
          new Error(
            'Thing not found'
          ),
          {
            code:'NOT_FOUND'
          }
        );
      }

      if (
        matches.length > 1 &&
        matches[0].score ===
          matches[1].score
      ) {
        throw Object.assign(
          new Error(
            'More than one thing matches this query'
          ),
          {
            code:'AMBIGUOUS'
          }
        );
      }

      return matches[0].item;
    }
  );

  register(
    'get_documents',
    'Get documents linked to one BuyerOS thing, or inspect document linkage status.',
    args => {
      const thingId =
        clean(
          args?.thingId
        );

      if (thingId) {
        if (
          !findThingById(
            thingId
          )
        ) {
          throw Object.assign(
            new Error(
              'Thing not found'
            ),
            {
              code:'NOT_FOUND'
            }
          );
        }

        return docsForThing(
          thingId
        );
      }

      return documents().map(
        doc => {
          const item =
            relatedThing(doc);

          return {
            ...doc,

            linkedThingId:
              item?.id ||
              null,

            linkedThingTitle:
              item?.title ||
              ''
          };
        }
      );
    }
  );

  register(
    'get_service_history',
    'Get stored service history, optionally limited to one ownership record.',
    args => {
      const thingId =
        clean(
          args?.thingId
        );

      if (
        thingId &&
        !findThingById(
          thingId
        )
      ) {
        throw Object.assign(
          new Error(
            'Thing not found'
          ),
          {
            code:'NOT_FOUND'
          }
        );
      }

      return serviceHistoryFor(
        thingId
      );
    }
  );

  register(
    'get_attention',
    'Get upcoming warranties, return windows, renewals and next actions from BuyerOS dates.',
    args => {
      const horizonDays =
        clampInteger(
          args?.horizonDays,
          30,
          1,
          365
        );

      return attention(
        horizonDays
      );
    }
  );

  register(
    'get_timeline',
    'Build a read-only ownership timeline from stored purchases, documents, protection dates and service events.',
    args => {
      const thingId =
        clean(
          args?.thingId
        );

      const limit =
        clampInteger(
          args?.limit,
          100,
          1,
          250
        );

      if (
        thingId &&
        !findThingById(
          thingId
        )
      ) {
        throw Object.assign(
          new Error(
            'Thing not found'
          ),
          {
            code:'NOT_FOUND'
          }
        );
      }

      return timeline(
        thingId,
        limit
      );
    }
  );

  register(
    'get_household_context',
    'Get privacy-minimized household and family ownership relationships. Contact details are intentionally excluded.',
    () =>
      householdContext()
  );

  function list() {
    return [
      ...registry.values()
    ].map(tool => ({
      name:
        tool.name,

      description:
        tool.description,

      readOnly:
        tool.readOnly
    }));
  }

  function describe(name) {
    const tool =
      registry.get(
        clean(name)
      );

    if (!tool) {
      return null;
    }

    return {
      name:
        tool.name,

      description:
        tool.description,

      readOnly:
        tool.readOnly
    };
  }

  async function execute(
    name,
    args = {}
  ) {
    const toolName =
      clean(name);

    const tool =
      registry.get(
        toolName
      );

    if (!tool) {
      return fail(
        toolName ||
        'unknown',
        'UNKNOWN_TOOL',
        `Unknown BuyerOS tool: ${
          toolName ||
          '(empty)'
        }`
      );
    }

    try {
      const data =
        await tool.handler(
          copy(args) || {}
        );

      return ok(
        tool.name,
        data,
        {
          version:
            VERSION,

          readOnly:true
        }
      );
    } catch (error) {
      return fail(
        tool.name,

        error?.code ||
        'TOOL_ERROR',

        error?.message ||
        'BuyerOS tool failed',

        {
          version:
            VERSION,

          readOnly:true
        }
      );
    }
  }

  const api =
    Object.freeze({
      version:
        VERSION,

      readOnly:
        true,

      list,

      describe,

      execute
    });

  Object.defineProperty(
    window,
    'StillBuyerOSToolsV149',
    {
      value:api,
      configurable:false,
      enumerable:false,
      writable:false
    }
  );

  window.dispatchEvent(
    new CustomEvent(
      'still:buyeros-tools-ready',
      {
        detail:{
          version:
            VERSION,

          tools:
            list().map(
              tool =>
                tool.name
            )
        }
      }
    )
  );
})();

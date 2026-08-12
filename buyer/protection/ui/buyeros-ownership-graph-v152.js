(() => {
  'use strict';

  const VERSION = '152';

  const STORAGE = Object.freeze({
    things:
      'still-ownership-passports-v83',

    documents:
      'still-buyeros-documents-v132',

    household:
      'still-buyeros-household-v132',

    family:
      'still-buyeros-family-v132'
  });

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

  function clone(value) {
    if (
      value === undefined
    ) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function readArray(key) {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(key) ||
          '[]'
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

  function thingById(id) {
    const needle =
      clean(id);

    if (!needle) {
      return null;
    }

    return things().find(
      item =>
        clean(item.id) ===
        needle
    ) || null;
  }

  function householdById(id) {
    const needle =
      clean(id);

    if (!needle) {
      return null;
    }

    return households().find(
      item =>
        clean(
          item.id ||
          item.householdId
        ) === needle
    ) || null;
  }

  function memberId(member) {
    return clean(
      member?.id ||
      member?.memberId ||
      member?.personId ||
      member?.profileId
    );
  }

  function memberName(member) {
    return clean(
      member?.name ||
      member?.title ||
      member?.displayName ||
      member?.fullName ||
      member?.label
    );
  }

  function memberById(id) {
    const needle =
      clean(id);

    if (!needle) {
      return null;
    }

    return family().find(
      member =>
        memberId(member) ===
        needle
    ) || null;
  }

  function memberByName(name) {
    const needle =
      normalize(name);

    if (!needle) {
      return null;
    }

    return family().find(
      member =>
        normalize(
          memberName(member)
        ) === needle
    ) || null;
  }

  function resolveThingForDocument(doc) {
    if (!doc) {
      return null;
    }

    const directIds = [
      doc.thingId,
      doc.relatedThingId,
      doc.linkedThingId
    ]
      .map(clean)
      .filter(Boolean);

    for (
      const id of directIds
    ) {
      const match =
        thingById(id);

      if (match) {
        return match;
      }
    }

    const legacyTitle =
      normalize(
        doc.relatedThing ||
        doc.linkedThingTitle
      );

    if (!legacyTitle) {
      return null;
    }

    return things().find(
      item =>
        normalize(
          item.title
        ) === legacyTitle
    ) || null;
  }

  function resolveOwnerForThing(item) {
    if (!item) {
      return null;
    }

    const ownerIds = [
      item.ownerId,
      item.memberId,
      item.familyMemberId,
      item.assignedToId
    ]
      .map(clean)
      .filter(Boolean);

    for (
      const id of ownerIds
    ) {
      const match =
        memberById(id);

      if (match) {
        return match;
      }
    }

    const ownerNames = [
      item.owner,
      item.ownerName,
      item.assignedTo
    ]
      .map(clean)
      .filter(Boolean);

    for (
      const name of ownerNames
    ) {
      const match =
        memberByName(name);

      if (match) {
        return match;
      }
    }

    return null;
  }

  function resolveHouseholdForThing(item) {
    if (!item) {
      return null;
    }

    const id =
      clean(
        item.householdId
      );

    if (!id) {
      return null;
    }

    return householdById(id);
  }

  function canonicalDocument(doc) {
    const thing =
      resolveThingForDocument(
        doc
      );

    return {
      ...clone(doc),

      relationship:{
        thingId:
          thing?.id ||
          null,

        thingTitle:
          thing?.title ||
          clean(
            doc?.relatedThing ||
            doc?.linkedThingTitle
          )
      }
    };
  }

  function canonicalThing(item) {
    const owner =
      resolveOwnerForThing(
        item
      );

    const household =
      resolveHouseholdForThing(
        item
      );

    const linkedDocuments =
      documents()
        .filter(
          doc =>
            resolveThingForDocument(
              doc
            )?.id ===
            item.id
        )
        .map(doc =>
          doc.id
        )
        .filter(Boolean);

    const serviceEvents =
      Array.isArray(
        item.serviceHistory
      )
        ? item.serviceHistory
        : [];

    return {
      ...clone(item),

      relationship:{
        ownerId:
          owner
            ? memberId(owner)
            : null,

        ownerName:
          owner
            ? memberName(owner)
            : clean(
                item.owner ||
                item.ownerName ||
                item.assignedTo
              ),

        householdId:
          household
            ? clean(
                household.id ||
                household.householdId
              )
            : clean(
                item.householdId
              ) || null,

        documentIds:
          linkedDocuments,

        serviceCount:
          serviceEvents.length
      }
    };
  }

  function documentLinksForThing(
    thingId
  ) {
    const id =
      clean(
        thingId
      );

    if (!id) {
      return [];
    }

    return documents()
      .filter(
        doc =>
          resolveThingForDocument(
            doc
          )?.id === id
      )
      .map(
        canonicalDocument
      );
  }

  function serviceEventsForThing(
    thingId
  ) {
    const item =
      thingById(
        thingId
      );

    if (!item) {
      return [];
    }

    const history =
      Array.isArray(
        item.serviceHistory
      )
        ? item.serviceHistory
        : [];

    return history.map(
      (event,index) => ({
        ...clone(event),

        relationship:{
          thingId:
            item.id,

          thingTitle:
            item.title ||
            '',

          eventId:
            event.id ||
            `service:${item.id}:${index}`
        }
      })
    );
  }

  function householdContext() {
    return households().map(
      household => {
        const id =
          clean(
            household.id ||
            household.householdId
          );

        const linkedThings =
          things()
            .filter(
              item =>
                clean(
                  item.householdId
                ) === id
            )
            .map(item =>
              item.id
            );

        return {
          ...clone(household),

          relationship:{
            householdId:
              id ||
              null,

            thingIds:
              linkedThings
          }
        };
      }
    );
  }

  function familyContext() {
    return family().map(
      member => {
        const id =
          memberId(member);

        const name =
          memberName(member);

        const linkedThings =
          things()
            .filter(item => {
              const owner =
                resolveOwnerForThing(
                  item
                );

              if (!owner) {
                return false;
              }

              return (
                memberId(owner) ===
                id
              );
            })
            .map(item =>
              item.id
            );

        return {
          id:
            id ||
            null,

          name,

          role:
            clean(
              member.role ||
              member.relationship ||
              member.type
            ),

          relationship:{
            thingIds:
              linkedThings
          }
        };
      }
    );
  }

  function graphForThing(
    thingId
  ) {
    const item =
      thingById(
        thingId
      );

    if (!item) {
      return null;
    }

    const owner =
      resolveOwnerForThing(
        item
      );

    const household =
      resolveHouseholdForThing(
        item
      );

    return {
      thing:
        canonicalThing(
          item
        ),

      owner:
        owner
          ? {
              id:
                memberId(owner),

              name:
                memberName(owner),

              role:
                clean(
                  owner.role ||
                  owner.relationship ||
                  owner.type
                )
            }
          : null,

      household:
        household
          ? clone(
              household
            )
          : null,

      documents:
        documentLinksForThing(
          item.id
        ),

      services:
        serviceEventsForThing(
          item.id
        )
    };
  }

  const api =
    Object.freeze({
      version:
        VERSION,

      thingById,

      resolveThingForDocument,

      resolveOwnerForThing,

      resolveHouseholdForThing,

      canonicalThing,

      canonicalDocument,

      documentLinksForThing,

      serviceEventsForThing,

      householdContext,

      familyContext,

      graphForThing
    });

  Object.defineProperty(
    window,
    'StillBuyerOSGraphV152',
    {
      value:api,
      enumerable:false,
      writable:false,
      configurable:false
    }
  );

  window.dispatchEvent(
    new CustomEvent(
      'still:buyeros-graph-ready',
      {
        detail:{
          version:
            VERSION
        }
      }
    )
  );
})();


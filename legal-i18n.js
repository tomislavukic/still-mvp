(() => {
  const root = document.documentElement;
  const preferred = () => localStorage.getItem('still-lang') === 'hr' ? 'hr' : 'en';

  function section(titleEn, titleHr, bodyEn, bodyHr) {
    const wrap = document.createElement('section');
    wrap.innerHTML = `<h2 data-en="${titleEn}" data-hr="${titleHr}"></h2><p data-en="${bodyEn}" data-hr="${bodyHr}"></p>`;
    return wrap;
  }

  function mountPlatformDisclosures() {
    const main = document.querySelector('main.card');
    if (!main || document.querySelector('#platformDisclosureV83')) return;
    const wrap = document.createElement('div');
    wrap.id = 'platformDisclosureV83';
    const isPrivacy = location.pathname.endsWith('/privacy.html');
    if (isPrivacy) {
      wrap.append(
        section(
          'Ownership passports and account sync', 'Putovnice vlasništva i sinkronizacija računa',
          'Passports you create are stored in this browser first. If you choose account sync, the structured passport—including private notes and order references—is stored with your buyer account. Do not sync information you do not want stored by Still?.',
          'Putovnice koje izradite prvo se spremaju u ovaj preglednik. Ako odaberete sinkronizaciju računa, strukturirana putovnica—uključujući privatne bilješke i reference narudžbe—sprema se uz vaš račun kupca. Nemojte sinkronizirati podatke koje ne želite pohraniti u Still?.'
        ),
        section(
          'Connecting with a verified company', 'Povezivanje s verificiranom tvrtkom',
          'A company-issued passport connects only after a signed-in buyer enters its one-time code. The company can see and update the shared passport and its attributable commitments. Buyer-created private notes are not shared through the transfer action and are not exposed to an unconnected company.',
          'Putovnica koju izdaje tvrtka povezuje se tek kada prijavljeni kupac unese jednokratni kod. Tvrtka može vidjeti i ažurirati zajedničku putovnicu i svoja pripisiva obećanja. Privatne bilješke kupca ne dijele se radnjom prijenosa niti se otkrivaju nepovezanoj tvrtki.'
        ),
        section(
          'Profiles, photos and company logos', 'Profili, fotografije i logotipi tvrtki',
          'Signed-in buyers may store a display name, profile photo and short biography. A buyer can turn off profile sharing with connected businesses at any time. When sharing is on, only a business already connected through that buyer’s passport or case may retrieve the buyer photo. Verified company names, logos, descriptions and websites are public issuer information. Uploaded profile media is stored separately from public site files.',
          'Prijavljeni kupci mogu spremiti prikazno ime, profilnu fotografiju i kratak opis. Kupac u svakom trenutku može isključiti dijeljenje profila s povezanim tvrtkama. Kada je dijeljenje uključeno, fotografiju kupca može dohvatiti samo tvrtka koja je već povezana putem putovnice ili slučaja tog kupca. Nazivi, logotipi, opisi i web-stranice verificiranih tvrtki javni su podaci o izdavatelju. Preneseni profilni mediji pohranjuju se odvojeno od javnih datoteka web-mjesta.'
        ),
        section(
          'Contact details and order snapshots', 'Kontaktni podaci i snimke narudžbe',
          'Buyer phone and address details remain private unless the buyer enables sharing with connected businesses or submits them for a specific checkout. At checkout, Still? stores an immutable buyer and seller contact snapshot with the order so fulfilment details remain attributable even if either profile changes later. The seller for that order can see the submitted buyer name, email, phone, delivery address and instructions. Public verified-company contact and location details may be shown before purchase.',
          'Telefon i adresa kupca ostaju privatni osim ako kupac uključi dijeljenje s povezanim tvrtkama ili ih pošalje za određenu naplatu. Pri naplati Still? uz narudžbu sprema nepromjenjivu snimku kontakta kupca i prodavatelja kako bi podaci izvršenja ostali pripisivi čak i ako se profili kasnije promijene. Prodavatelj te narudžbe može vidjeti poslano ime, e-poštu, telefon, adresu dostave i upute kupca. Javni kontaktni i lokacijski podaci verificirane tvrtke mogu se prikazati prije kupnje.'
        ),
        section(
          'Passport QR links and portable snapshots', 'QR poveznice putovnice i prenosive snimke',
          'A Passport QR encodes only the passport title and type, named business, selected lifecycle dates, public record ID and public company commitments. Private notes, order references and internal evidence are excluded. The visible centre badge may show the verified issuer logo or the signed-in buyer’s profile photo; anyone receiving the QR image can see that badge, but it is not encoded as identity data in the QR destination. Server-verified links expire and can be revoked. A portable snapshot travels inside its QR and is clearly marked as not authenticated by Still?.',
          'QR putovnice kodira samo naziv i vrstu putovnice, imenovanu tvrtku, odabrane datume životnog ciklusa, javni ID zapisa i javna obećanja tvrtke. Privatne bilješke, reference narudžbe i interni dokazi su izostavljeni. Vidljiva oznaka u sredini može prikazati logotip verificiranog izdavatelja ili profilnu fotografiju prijavljenog kupca; svatko tko primi sliku QR koda može vidjeti tu oznaku, ali ona nije kodirana kao podatak o identitetu u QR odredištu. Poveznice koje provjerava poslužitelj istječu i mogu se opozvati. Prenosiva snimka putuje unutar QR koda i jasno je označena kao neautentificirana od strane Still?.'
        ),
        section(
          'Lifecycle history, alerts and support', 'Povijest životnog ciklusa, upozorenja i podrška',
          'Service history, lifecycle actions and support messages are stored with the buyer account when a passport is synced. A connected verified business can see support messages and shared passport context, add attributable service events and issue alerts only for passports connected to that business. Service costs, internal notes and private buyer details are excluded from public QR views.',
          'Servisna povijest, radnje životnog ciklusa i poruke podrške spremaju se uz račun kupca kada je putovnica sinkronizirana. Povezana verificirana tvrtka može vidjeti poruke podrške i zajednički kontekst putovnice, dodati pripisive servisne zapise i izdati upozorenja samo za putovnice povezane s tom tvrtkom. Troškovi servisa, interne bilješke i privatni podaci kupca izostavljeni su iz javnog QR prikaza.'
        ),
        section(
          'Company operations and traceability', 'Poslovne operacije i sljedivost',
          'Verified businesses can store private operational records including products, stock locations and movements, batches or serials, suppliers, purchase orders, repair jobs, returns, fulfilment, agreements, appointments, contacts and quotes. A product is linked to a buyer passport only when that verified business issued or is connected to the passport. Batch or serial recalls create a targeted passport alert and retain delivery and acknowledgement timestamps. These operational records are not public.',
          'Verificirane tvrtke mogu spremati privatne operativne zapise, uključujući proizvode, lokacije i promjene zaliha, serije ili serijske brojeve, dobavljače, narudžbenice, radne naloge, povrate, isporuke, ugovore, termine, kontakte i ponude. Proizvod se povezuje s putovnicom kupca samo kada je ta verificirana tvrtka izdala putovnicu ili je s njom povezana. Opoziv serije ili serijskog broja stvara ciljano upozorenje putovnice te čuva vrijeme isporuke i potvrde. Ti operativni zapisi nisu javni.'
        ),
        section(
          'Pre-verification company setup', 'Postavljanje tvrtke prije verifikacije',
          'A signed-in company awaiting approval may privately save its business type, team size, offer and fulfilment model, operating region, preferred currency, launch goal and internal setup notes. This information prepares the future workspace and is not published to buyers. Public offers, real orders or payments, buyer contacts, official passport issuance and live operational actions remain unavailable until the company identity is approved.',
          'Prijavljena tvrtka koja čeka odobrenje može privatno spremiti vrstu poslovanja, veličinu tima, model ponude i ispunjenja, područje poslovanja, željenu valutu, cilj početka i interne bilješke postavljanja. Ti podaci pripremaju budući radni prostor i ne objavljuju se kupcima. Javne ponude, stvarne narudžbe ili plaćanja, kontakti kupaca, izdavanje službenih putovnica i stvarne operativne radnje ostaju nedostupni dok identitet tvrtke nije odobren.'
        ),
        section(
          'Electronic shelf labels and price updates', 'Elektroničke cijene i promjene cijena',
          'Verified companies may store private electronic shelf-label designs, product identifiers, prices, physical display dimensions, pixel resolutions, connector mappings and scheduled price-update records. Still? exports portable display packages but does not transmit them to manufacturer hardware without a separately configured and authenticated vendor gateway. Temporary pre-verification label designs remain only in that browser session.',
          'Verificirane tvrtke mogu spremati privatne dizajne elektroničkih cijena, identifikatore proizvoda, cijene, fizičke dimenzije zaslona, rezolucije, mapiranja konektora i zakazane zapise promjene cijena. Still? izvozi prenosive pakete zaslona, ali ih ne šalje na hardver proizvođača bez zasebno postavljenog i autentificiranog pristupnika dobavljača. Privremeni dizajni prije verifikacije ostaju samo u toj sesiji preglednika.'
        )
      );
    } else if (location.pathname.endsWith('/terms.html')) {
      wrap.append(
        section(
          'Still? is a mediator, not a webshop', 'Still? je posrednik, a ne webshop',
          'Still? does not own inventory or become the seller. A verified business may publish a Passport Offer and receive payment through its connected payment account. That named business remains responsible for price, tax, invoice, fulfilment, cancellation, refund, product safety and warranty. Still? structures checkout, records, communication, commitments and evidence between the parties and may collect a disclosed platform fee.',
          'Still? ne posjeduje zalihe niti postaje prodavatelj. Verificirana tvrtka može objaviti Passport ponudu i primiti plaćanje putem svojeg povezanog računa naplate. Ta imenovana tvrtka ostaje odgovorna za cijenu, porez, račun, izvršenje, otkazivanje, povrat, sigurnost proizvoda i jamstvo. Still? strukturira naplatu, zapise, komunikaciju, obećanja i dokaze između strana te može naplatiti objavljenu platformsku naknadu.'
        ),
        section(
          'Payment and demonstration mode', 'Plaćanje i demonstracijski način',
          'Live payment is available only when Still? has configured a licensed payment provider and the seller has completed provider onboarding. A checkout explicitly labelled DEMO does not charge a card, transfer money, prove payment or create a seller invoice. Never send card details through messages, notes or forms other than the licensed provider payment form.',
          'Živo plaćanje dostupno je samo kada Still? konfigurira licenciranog pružatelja naplate i prodavatelj dovrši njegovo povezivanje. Naplata izričito označena kao DEMO ne tereti karticu, ne prenosi novac, ne dokazuje plaćanje niti stvara račun prodavatelja. Nikada ne šaljite podatke kartice kroz poruke, bilješke ili obrasce osim obrasca licenciranog pružatelja naplate.'
        ),
        section(
          'Shared commitments are evidence, not a guaranteed outcome', 'Zajednička obećanja su dokaz, a ne zajamčeni ishod',
          'A passport or company commitment records what a party entered and when. It does not itself prove legal entitlement, guarantee performance, replace original evidence, or make Still? the final decision-maker in a dispute.',
          'Putovnica ili obećanje tvrtke bilježi što je strana unijela i kada. Sam zapis ne dokazuje zakonsko pravo, ne jamči izvršenje, ne zamjenjuje izvorne dokaze niti čini Still? konačnim donositeljem odluke u sporu.'
        ),
        section(
          'Outcome reputation and safety notices', 'Reputacija ishoda i sigurnosne obavijesti',
          'Outcome reputation is a transparent operational indicator calculated from recorded commitments and resolved passport support threads. It is not a guarantee, product certification or complete measure of company quality. Safety and recall alerts are issued by the named business; buyers should follow the linked official instructions and relevant authority guidance.',
          'Reputacija ishoda je transparentan operativni pokazatelj izračunat iz zabilježenih obećanja i riješenih razgovora podrške putovnice. Nije jamstvo, certifikat proizvoda niti potpuna mjera kvalitete tvrtke. Sigurnosna upozorenja i opozive izdaje imenovana tvrtka; kupci trebaju slijediti povezane službene upute i smjernice nadležnih tijela.'
        ),
        section(
          'Business asset passports', 'Putovnice poslovne imovine',
          'Business asset passports are private operational records for equipment, licences, rentals, contracts and suppliers. Still? does not verify ownership, licence validity, accounting treatment, tax position or contractual enforceability merely because a record exists.',
          'Putovnice poslovne imovine privatni su operativni zapisi za opremu, licence, najmove, ugovore i dobavljače. Still? samim postojanjem zapisa ne potvrđuje vlasništvo, valjanost licence, računovodstveni tretman, porezni položaj niti provedivost ugovora.'
        ),
        section(
          'Company operations remain the company’s responsibility', 'Poslovne operacije ostaju odgovornost tvrtke',
          'Inventory balances, reorder suggestions, reservations, repair estimates, appointment conflict checks, warranty metrics, supplier metrics, quotes and recall matching are operational aids based on data entered by the verified business. The business must validate accuracy, maintain legally required accounting and safety records elsewhere when required, and remains solely responsible for fulfilment, workplace decisions, product safety and regulatory notifications.',
          'Stanja zaliha, prijedlozi nabave, rezervacije, procjene popravka, provjere preklapanja termina, pokazatelji jamstva i dobavljača, ponude te povezivanje opoziva operativna su pomoć koja se temelji na podacima verificirane tvrtke. Tvrtka mora provjeravati točnost, voditi zakonom propisane računovodstvene i sigurnosne evidencije na drugom mjestu kada je potrebno te ostaje isključivo odgovorna za izvršenje, odluke o radu, sigurnost proizvoda i regulatorne obavijesti.'
        ),
        section(
          'Shelf-price accuracy and vendor delivery', 'Točnost cijena na policama i isporuka dobavljaču',
          'Electronic shelf-label previews and exports are operational aids. The business remains responsible for lawful price display, taxes, unit pricing, promotion dates, accessibility, consistency between shelf and checkout, hardware validation and the timing of every price change. A connector profile does not prove that a vendor accepted or displayed an update; only a confirmed response from the configured vendor gateway can establish delivery.',
          'Pregledi i izvozi elektroničkih cijena operativna su pomoć. Tvrtka ostaje odgovorna za zakonit prikaz cijene, poreze, jedinične cijene, datume promocije, pristupačnost, usklađenost cijene na polici i blagajni, provjeru hardvera i vrijeme svake promjene cijene. Profil konektora ne dokazuje da je dobavljač prihvatio ili prikazao promjenu; isporuku može potvrditi samo potvrđeni odgovor postavljenog pristupnika dobavljača.'
        )
      );
    }
    main.querySelector(':scope > p:last-of-type')?.before(wrap);
  }

  function paint(lang) {
    root.lang = lang;
    localStorage.setItem('still-lang', lang);
    document.querySelectorAll('[data-en][data-hr]').forEach(element => {
      element.textContent = element.dataset[lang];
    });
    document.querySelectorAll('[data-title-en][data-title-hr]').forEach(element => {
      document.title = element.dataset[`title${lang === 'hr' ? 'Hr' : 'En'}`];
    });
    document.querySelectorAll('[data-set-lang]').forEach(button => {
      const active = button.dataset.setLang === lang;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('active', active);
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-set-lang]');
    if (button) paint(button.dataset.setLang);
  });
  mountPlatformDisclosures();
  paint(preferred());
})();

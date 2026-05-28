// ── QP DIAGNOSTIC SIMULATION HARNESS ─────────────────────────────────────────
// Extracts and runs the generateResults logic against test profiles.
// Asserts rules. Flags any output that violates expected behavior.

// ── HELPERS (mirrored from diagnostic.html) ────────────────────────────────
function fmtD(n){const r=Math.round(n/100)*100;return'$'+r.toLocaleString();}
function firstName(fullName){return(fullName||'').split(' ')[0]||'You';}

// ── CAPTURE OUTPUT ─────────────────────────────────────────────────────────
// Instead of writing to DOM, we return a structured result object.

function generateResults(d) {
  const out = {
    corrections: [],
    afterItems: [],
    beforeItems: [],
    spRows: [],
    statusRows: [],
    valueRows: [],
    dashboard: {},
    errors: []
  };

  const spend=parseFloat((d.total_spend||'0').replace(/[,$]/g,''))||0;
  const dining=parseFloat((d.dining_spend||'0').replace(/[,$]/g,''))||0;
  const grocery=parseFloat((d.grocery_spend||'0').replace(/[,$]/g,''))||0;
  const general=parseFloat((d.general_spend||'0').replace(/[,$]/g,''))||0;
  const fname=firstName(d.full_name);

  const cardAirfare=(d.card_airfare||'').toLowerCase();
  const cardDining=(d.card_dining||'').toLowerCase();
  const cardGrocery=(d.card_groceries||'').toLowerCase();
  const cardHotels=(d.card_hotels||'').toLowerCase();
  const cardGeneral=(d.card_general||'').toLowerCase();

  const isGoldDining=cardDining.includes('gold');
  const isGoldGrocery=cardGrocery.includes('gold');
  const isDeltaReserve=id=>id.includes('reserve')&&(id.includes('delta')||id.includes('skymiles'));
  const isDeltaReserveAirfare=isDeltaReserve(cardAirfare);
  const isDeltaReserveGeneral=isDeltaReserve(cardGeneral);
  const isPlatHotel=cardHotels.includes('platinum');
  const isAmexTravelBooking=d.booking_method==='Direct'||d.booking_method==='Mixed';

  const diningCurrentRate=cardDining.includes('platinum')?1:cardDining.includes('gold')?4:3;
  const groceryCurrentRate=cardGrocery.includes('platinum')?1:cardGrocery.includes('gold')?4:3;

  const hasAirlineStatus=d.primary_airline&&!d.primary_airline.toLowerCase().includes('none')&&d.primary_airline.trim()!=='';
  const airlineEco=(d.primary_airline_eco||'').toLowerCase();
  const isDeltaEco=airlineEco==='delta'||airlineEco==='mixed'||airlineEco==='southwest'||airlineEco==='';
  const isUnitedEco=airlineEco==='united';
  const isAmericanEco=airlineEco==='american';
  const isSouthwestEco=airlineEco==='southwest';
  const hasDeltaStatus=d.primary_airline&&d.primary_airline.toLowerCase().includes('delta');
  const hotelInput=(d.primary_hotel||'').toLowerCase();
  const hasHyatt=hotelInput.includes('hyatt');
  const hasMarriott=hotelInput.includes('marriott')||hotelInput.includes('bonvoy');
  const hasHotelStatus=hotelInput!==''&&!hotelInput.includes('none')&&hotelInput.trim()!=='';
  const hotelConcentrated=['50-74%','75-100%'].includes(d.hotel_conc);
  const hotelFragmented=['0-24%','25-49%'].includes(d.hotel_conc);
  const hasUpgrades=d.upgrades_unasked==='Yes';
  const noRedeem=d.pts_redeemed==='None'||d.pts_redeemed==='Unsure';
  const disrupted=d.disruption==='Yes';
  const luxuryEngaged=d.luxury_retail_method&&d.luxury_retail_method!=='Not engaged';

  const flights=d.flights_taken==='40+'?42:d.flights_taken==='21-40'?30:d.flights_taken==='11-20'?15:d.flights_taken==='6-10'?8:4;
  const nights=d.hotel_nights==='40+'?42:d.hotel_nights==='21-39'?30:d.hotel_nights==='11-20'?15:d.hotel_nights==='6-10'?8:4;

  const airlineSpendEst=d.airline_spend==='$20k+'?22000:d.airline_spend==='$10k-$20k'?15000:d.airline_spend==='$5k-$10k'?7500:d.airline_spend==='Under $5k'?3000:d.airline_spend==='Likely over $10k'?12000:8000;
  const hotelSpendEst=nights*500;
  const reserveSpendEst=Math.max(0,spend-dining-grocery-hotelSpendEst);
  const mqdsHeadstart=2500;
  const mqdsCard=Math.round(reserveSpendEst/10);
  const mqdsFlights=Math.round(airlineSpendEst*0.95);
  const mqdsTotal=mqdsHeadstart+mqdsCard+mqdsFlights;
  const canReachDiamond=mqdsTotal>=28000;
  const canReachPlatinum=mqdsTotal>=15000;
  const canReachGold=mqdsTotal>=10000;
  const canReachSilver=mqdsTotal>=5000;

  const pqpCard=isUnitedEco?Math.min(28000,Math.round(reserveSpendEst/15)):0;
  const pqpBonus=isUnitedEco?1500:0;
  const pqpFlights=isUnitedEco?Math.round(airlineSpendEst):0;
  const pqpTotal=pqpCard+pqpBonus+pqpFlights;
  const canReachUnited1K=pqpTotal>=28000;
  const canReachUnitedPlatinum=pqpTotal>=18000;
  const canReachUnitedGold=pqpTotal>=12000;
  const canReachUnitedSilver=pqpTotal>=6000;
  const unitedStatusTarget=canReachUnited1K?'United Premier 1K':canReachUnitedPlatinum?'United Premier Platinum':canReachUnitedGold?'United Premier Gold':canReachUnitedSilver?'United Premier Silver':'United Silver — within reach';

  const lpCard=isAmericanEco?Math.round(reserveSpendEst):0;
  const lpFlights=isAmericanEco?Math.round(airlineSpendEst*5):0;
  const lpTotal=lpCard+lpFlights;
  const canReachAAExecPlat=lpTotal>=200000;
  const canReachAAPlat=lpTotal>=75000;
  const canReachAAGold=lpTotal>=40000;
  const aaStatusTarget=canReachAAExecPlat?'AAdvantage Executive Platinum':canReachAAPlat?'AAdvantage Platinum':canReachAAGold?'AAdvantage Gold':'AAdvantage Gold — within reach';

  const diningLeakPerDollar=(4-diningCurrentRate)*0.015;
  const groceryLeakPerDollar=(4-groceryCurrentRate)*0.015;
  let cardLeakAirfare=isDeltaReserveAirfare?0:spend*0.012;
  let cardLeakDining=isGoldDining?0:Math.max(0,dining*diningLeakPerDollar);
  let cardLeakGrocery=isGoldGrocery?0:Math.max(0,grocery*groceryLeakPerDollar);
  let cardLeakHotel=isPlatHotel&&isAmexTravelBooking?0:spend*0.005;
  let cardLeakGeneral=isDeltaReserveGeneral?0:general*0.005;
  let totalCardLeak=cardLeakAirfare+cardLeakDining+cardLeakGrocery+cardLeakHotel+cardLeakGeneral;

  const fhrVal=isPlatHotel&&isAmexTravelBooking?0:nights>=6?800:400;
  const tsaClearActivated=d.tsa_clear_activated||'No';
  const clearVal=tsaClearActivated==='Yes — both'?0:tsaClearActivated==='PreCheck only'?189:tsaClearActivated==='CLEAR only'?85:tsaClearActivated==='Not available'?0:274;
  const cardCredits=isGoldDining?0:204;
  const ptsVal=noRedeem?Math.round(spend*0.003/100)*100:0;
  const compVal=isDeltaEco&&isDeltaReserveAirfare?0:isDeltaEco?spend>=150000?800:400:0;
  const rucVal=isDeltaEco&&canReachPlatinum?800:0;
  const bagVal=isUnitedEco?Math.round(flights*0.6)*60:isAmericanEco?Math.round(flights*0.6)*35:0;

  const v1=Math.round(totalCardLeak*0.9/100)*100;
  const v2=fhrVal;
  const v3=clearVal;
  const v4=ptsVal;
  const v5=cardCredits;
  const v6=compVal;
  const v7=rucVal;
  const v8=bagVal;
  const vt=v1+v2+v3+v4+v5+v6+v7+v8;

  out.dashboard = { value: vt, ecosystem: airlineEco||'delta(default)', isDeltaEco, isUnitedEco, isAmericanEco, isSouthwestEco };

  // Corrections
  if(!isDeltaReserveAirfare&&isDeltaEco) out.corrections.push('Delta Reserve airfare');
  if(isUnitedEco) out.corrections.push('United Club Infinite');
  if(isAmericanEco) out.corrections.push('Citi AAdvantage Executive');
  if(!isGoldDining&&dining>0) out.corrections.push('Amex Gold dining');
  if(!isPlatHotel||!isAmexTravelBooking) out.corrections.push('Amex Platinum hotel');
  if(!isDeltaReserveGeneral&&general>0&&isDeltaEco) out.corrections.push('Delta Reserve general');
  if(general>0&&(isUnitedEco||isAmericanEco)) out.corrections.push('Airline card general');

  // Status path label
  const isAtGoldOrAbove=hasDeltaStatus&&(d.primary_airline.toLowerCase().includes('gold')||d.primary_airline.toLowerCase().includes('platinum')||d.primary_airline.toLowerCase().includes('diamond'));
  const isAtPlatinumOrAbove=hasDeltaStatus&&(d.primary_airline.toLowerCase().includes('platinum')||d.primary_airline.toLowerCase().includes('diamond'));
  const statusInput=(d.primary_airline||'').toLowerCase();
  const hasUnitedStatus=statusInput.includes('premier')||(statusInput.includes('united')&&!statusInput.includes('none'));
  const isAtUnitedGoldOrAbove=hasUnitedStatus&&(statusInput.includes('gold')||statusInput.includes('platinum')||statusInput.includes('1k'));
  const isAtUnitedPlatOrAbove=hasUnitedStatus&&(statusInput.includes('platinum')||statusInput.includes('1k'));
  const hasAAStatus=statusInput.includes('aadvantage')||statusInput.includes('executive platinum')||(statusInput.includes('american')&&!statusInput.includes('none')&&!statusInput.includes('american express'));
  const isAtAAGoldOrAbove=hasAAStatus&&(statusInput.includes('gold')||statusInput.includes('platinum'));
  const isAtAAExecPlatOrAbove=hasAAStatus&&statusInput.includes('executive platinum');

  // Build afterItems text (what we actually check for ecosystem bleed)
  const afterTexts=[];
  if(isDeltaEco){
    if(isSouthwestEco){
      afterTexts.push('A parallel premium airline relationship');
      afterTexts.push('Lounge access on every departure — including Southwest travel days');
      afterTexts.push('A first class cabin that actually upgrades');
    } else {
      if(!isAtPlatinumOrAbove) afterTexts.push('Delta Platinum Medallion');
      if(!isAtGoldOrAbove) afterTexts.push('Upgrade eligibility begins at Gold');
      else if(!isAtPlatinumOrAbove) afterTexts.push('Platinum adds what Gold does not have');
      afterTexts.push('Both lounge networks on every departure');
    }
  } else if(isUnitedEco){
    if(!isAtUnitedPlatOrAbove) afterTexts.push('United Premier status');
    if(!isAtUnitedGoldOrAbove) afterTexts.push('Premier Gold delivers upgrade eligibility');
    afterTexts.push('United Club on every United departure');
  } else if(isAmericanEco){
    if(!isAtAAExecPlatOrAbove) afterTexts.push('AAdvantage status built from everyday spend');
    if(!isAtAAGoldOrAbove) afterTexts.push('AAdvantage Gold — the entry point');
    afterTexts.push('Admirals Club on every American departure');
  }
  afterTexts.push('The hotel room is better before check-in');
  out.afterItems = afterTexts;

  // Status path target
  const isAtGoldOrAboveForPath=hasDeltaStatus&&(d.primary_airline.toLowerCase().includes('gold')||d.primary_airline.toLowerCase().includes('platinum')||d.primary_airline.toLowerCase().includes('diamond'));
  const isAtPlatinumOrAboveForPath=hasDeltaStatus&&(d.primary_airline.toLowerCase().includes('platinum')||d.primary_airline.toLowerCase().includes('diamond'));
  const projectedTierLabel=canReachDiamond?'Delta Diamond':canReachPlatinum?'Delta Platinum':canReachGold?'Delta Gold':canReachSilver?'Delta Silver':'Delta building';
  let statusTarget;
  if(isDeltaEco){
    const nextTierLabel=isAtPlatinumOrAboveForPath?(canReachDiamond?'Diamond':'Diamond — longer runway'):isAtGoldOrAboveForPath?(canReachPlatinum?'Delta Platinum':'Delta Platinum — within reach'):projectedTierLabel;
    statusTarget=nextTierLabel;
  } else if(isUnitedEco){
    statusTarget=unitedStatusTarget;
  } else {
    statusTarget=aaStatusTarget;
  }
  out.statusTarget = statusTarget;

  // Routing table third card
  const ecosystem=airlineEco;
  const thirdCardName=ecosystem==='united'?'United Club Infinite':ecosystem==='american'?'Citi AAdvantage Executive':'Delta SkyMiles Reserve';
  out.thirdCard = thirdCardName;

  // Value
  out.value = { v1,v2,v3,v4,v5,v6,v7,v8,vt,rucVal,compVal,bagVal,clearVal };

  return out;
}

// ── ASSERTION ENGINE ──────────────────────────────────────────────────────────
function assert(condition, msg, profile, results) {
  if(!condition){
    results.push({ FAIL: true, profile: profile.label, msg });
  }
}

function runAssertions(label, d, r, results) {
  const eco = r.dashboard.ecosystem;
  const afterStr = r.afterItems.join('|');
  const corrStr = r.corrections.join('|');

  // ── ECOSYSTEM BLEED — most critical ───────────────────────────────────────
  if(r.dashboard.isSouthwestEco) {
    assert(r.statusTarget.toLowerCase().includes('delta'), `STATUS PATH: Southwest profile has non-Delta status target: "${r.statusTarget}"`, d, results);
    assert(!r.statusTarget.toLowerCase().includes('aadvantage'), `STATUS PATH BLEED: "aadvantage" in Southwest status target: "${r.statusTarget}"`, d, results);
  }
  if(r.dashboard.isAmericanEco) {
    assert(!afterStr.includes('Delta Platinum'), `ECOSYSTEM BLEED: "Delta Platinum" in afterItems for ${eco} profile`, d, results);
    assert(!afterStr.includes('Delta Gold'), `ECOSYSTEM BLEED: "Delta Gold" in afterItems for ${eco} profile`, d, results);
    assert(!afterStr.includes('Sky Club'), `ECOSYSTEM BLEED: "Sky Club" in afterItems for ${eco} profile`, d, results);
    assert(!corrStr.includes('Delta Reserve airfare'), `ECOSYSTEM BLEED: Delta Reserve correction surfaced for ${eco} profile`, d, results);
    assert(!corrStr.includes('Delta Reserve general'), `ECOSYSTEM BLEED: Delta Reserve general correction surfaced for ${eco} profile`, d, results);
    assert(r.thirdCard === 'Citi AAdvantage Executive', `WRONG THIRD CARD: got "${r.thirdCard}" for American profile`, d, results);
  }
  if(r.dashboard.isSouthwestEco) {
    // Southwest intentionally uses Delta Reserve — assert Delta architecture is present, not absent
    assert(corrStr.includes('Delta Reserve airfare') || corrStr.includes('Build a Delta relationship'), `SOUTHWEST: Delta relationship correction missing for Southwest profile`, d, results);
    assert(r.thirdCard === 'Delta SkyMiles Reserve', `WRONG THIRD CARD: got "${r.thirdCard}" for Southwest profile`, d, results);
    assert(!afterStr.includes('Upgrade eligibility begins at Gold'), `SOUTHWEST BLEED: Delta-specific upgrade text in Southwest afterItems`, d, results);
    assert(!afterStr.includes('Platinum adds what Gold'), `SOUTHWEST BLEED: Delta RUC text in Southwest afterItems`, d, results);
  }

  if(r.dashboard.isUnitedEco) {
    assert(!afterStr.includes('Delta Platinum'), `ECOSYSTEM BLEED: "Delta Platinum" in afterItems for United profile`, d, results);
    assert(!afterStr.includes('Sky Club'), `ECOSYSTEM BLEED: "Sky Club" in afterItems for United profile (should say United Club)`, d, results);
    assert(!corrStr.includes('Delta Reserve airfare'), `ECOSYSTEM BLEED: Delta Reserve correction surfaced for United profile`, d, results);
    assert(r.thirdCard === 'United Club Infinite', `WRONG THIRD CARD: got "${r.thirdCard}" for United profile`, d, results);
  }

  // ── CORRECT CARD IN CORRECTIONS ───────────────────────────────────────────
  if(r.dashboard.isAmericanEco) {
    assert(corrStr.includes('Citi AAdvantage Executive'), `MISSING CORRECTION: Citi AAdvantage Executive not in corrections for American profile`, d, results);
  }
  if(r.dashboard.isUnitedEco) {
    assert(corrStr.includes('United Club Infinite'), `MISSING CORRECTION: United Club Infinite not in corrections for United profile`, d, results);
  }

  // ── VALUE SANITY ──────────────────────────────────────────────────────────
  assert(r.value.vt >= 0, `NEGATIVE VALUE: total value is ${r.value.vt}`, d, results);
  assert(r.value.vt <= 50000, `IMPLAUSIBLE VALUE: total is $${r.value.vt} — check spend inputs`, d, results);

  // RUC should only appear for Delta ecosystem at Platinum
  if(!r.dashboard.isDeltaEco) {
    assert(r.value.rucVal === 0, `RUC LEAK: rucVal=${r.value.rucVal} for non-Delta ecosystem`, d, results);
  }

  // Companion cert should only appear for Delta ecosystem
  if(!r.dashboard.isDeltaEco) {
    assert(r.value.compVal === 0, `COMP CERT LEAK: compVal=${r.value.compVal} for non-Delta ecosystem`, d, results);
  }

  // Bag savings: only United or American
  if(r.dashboard.isDeltaEco) {
    assert(r.value.bagVal === 0, `BAG VALUE LEAK: bagVal=${r.value.bagVal} for Delta ecosystem`, d, results);
  }

  // ── STATUS PATH SANITY ────────────────────────────────────────────────────
  if(r.dashboard.isAmericanEco) {
    assert(r.statusTarget.toLowerCase().includes('aadvantage') || r.statusTarget.toLowerCase().includes('gold') || r.statusTarget.toLowerCase().includes('platinum') || r.statusTarget.toLowerCase().includes('executive'),
      `STATUS PATH: American profile has non-AA status target: "${r.statusTarget}"`, d, results);
    assert(!r.statusTarget.toLowerCase().includes('delta'), `STATUS PATH BLEED: "delta" in status target for American profile: "${r.statusTarget}"`, d, results);
  }
  if(r.dashboard.isUnitedEco) {
    assert(r.statusTarget.toLowerCase().includes('united') || r.statusTarget.toLowerCase().includes('premier'),
      `STATUS PATH: United profile has non-United status target: "${r.statusTarget}"`, d, results);
    assert(!r.statusTarget.toLowerCase().includes('delta'), `STATUS PATH BLEED: "delta" in status target for United profile: "${r.statusTarget}"`, d, results);
  }

  // ── TSA/CLEAR ─────────────────────────────────────────────────────────────
  if(d.tsa_clear_activated === 'Yes — both') {
    assert(r.value.clearVal === 0, `TSA/CLEAR: clearVal should be 0 when already activated, got ${r.value.clearVal}`, d, results);
  }
  if(d.tsa_clear_activated === 'No') {
    assert(r.value.clearVal === 274, `TSA/CLEAR: clearVal should be 274 when neither activated, got ${r.value.clearVal}`, d, results);
  }
}

// ── TEST PROFILES ─────────────────────────────────────────────────────────────
const profiles = [
  // ── DELTA PROFILES ────────────────────────────────────────────────────────
  {
    label: 'Delta / No status / Wrong cards / $150K',
    total_spend:'150000', dining_spend:'20000', grocery_spend:'15000', general_spend:'60000',
    card_airfare:'Chase Sapphire Preferred', card_hotels:'Chase Sapphire Preferred',
    card_dining:'Chase Sapphire Preferred', card_groceries:'Chase Sapphire Preferred', card_general:'Chase Sapphire Preferred',
    primary_airline_eco:'Delta', primary_airline:'None',
    tsa_clear_activated:'No', booking_method:'Direct',
    flights_taken:'11-20', hotel_nights:'11-20', airline_spend:'$5k-$10k',
    airline_conc:'75-100%', hotel_conc:'0-24%', primary_hotel:'None',
    pts_redeemed:'None', upgrades_unasked:'No', disruption:'Yes',
    desired_outcomes:'Earlier airline upgrades', luxury_retail_method:'Not engaged',
    general_spend_cats:'Online retail', booking_control:'I do',
    largest_purchase:'10000', primary_cards:'Chase Sapphire Preferred',
    full_name:'Test Delta User', email:'test@test.com', credit_score:'760-799',
    frequent_destinations:'JFK,LAX', cabin_booked:'Economy', upgrade_spend:'Under $1k'
  },
  {
    label: 'Delta / Gold status / Correct cards',
    total_spend:'200000', dining_spend:'25000', grocery_spend:'18000', general_spend:'80000',
    card_airfare:'Delta SkyMiles Reserve American Express Card', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'Delta SkyMiles Reserve American Express Card',
    primary_airline_eco:'Delta', primary_airline:'Delta Gold Medallion',
    tsa_clear_activated:'Yes — both', booking_method:'Direct',
    flights_taken:'21-40', hotel_nights:'21-39', airline_spend:'$10k-$20k',
    airline_conc:'75-100%', hotel_conc:'75-100%', primary_hotel:'Hyatt Globalist',
    pts_redeemed:'75k-150k', upgrades_unasked:'Yes', disruption:'No',
    desired_outcomes:'Earlier airline upgrades', luxury_retail_method:'Through dedicated advisor',
    general_spend_cats:'Luxury retail', booking_control:'I do',
    largest_purchase:'15000', primary_cards:'Delta Reserve, Amex Platinum, Amex Gold',
    full_name:'Delta Gold User', email:'test@test.com', credit_score:'800+',
    frequent_destinations:'JFK,LAX', cabin_booked:'First', upgrade_spend:'$1k-$3k'
  },
  {
    label: 'Delta / Platinum status / Already correct',
    total_spend:'300000', dining_spend:'30000', grocery_spend:'20000', general_spend:'100000',
    card_airfare:'Delta SkyMiles Reserve American Express Card', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'Delta SkyMiles Reserve American Express Card',
    primary_airline_eco:'Delta', primary_airline:'Delta Platinum Medallion',
    tsa_clear_activated:'Yes — both', booking_method:'Direct',
    flights_taken:'40+', hotel_nights:'40+', airline_spend:'$20k+',
    airline_conc:'75-100%', hotel_conc:'75-100%', primary_hotel:'Marriott Titanium',
    pts_redeemed:'Over 150k', upgrades_unasked:'Yes', disruption:'No',
    desired_outcomes:'Consistent recognition', luxury_retail_method:'Through dedicated advisor',
    general_spend_cats:'Luxury retail, Insurance', booking_control:'I do',
    largest_purchase:'50000', primary_cards:'Delta Reserve, Amex Platinum, Amex Gold',
    full_name:'Delta Plat User', email:'test@test.com', credit_score:'800+',
    frequent_destinations:'JFK,LAX,ORD', cabin_booked:'First', upgrade_spend:'Over $7k'
  },
  {
    label: 'Delta / High spend ($300K+) / No cards',
    total_spend:'320000', dining_spend:'40000', grocery_spend:'20000', general_spend:'150000',
    card_airfare:'Citi Double Cash', card_hotels:'Citi Double Cash',
    card_dining:'Citi Double Cash', card_groceries:'Citi Double Cash', card_general:'Citi Double Cash',
    primary_airline_eco:'Delta', primary_airline:'None',
    tsa_clear_activated:'Not available', booking_method:'OTA',
    flights_taken:'40+', hotel_nights:'21-39', airline_spend:'$20k+',
    airline_conc:'75-100%', hotel_conc:'25-49%', primary_hotel:'None',
    pts_redeemed:'None', upgrades_unasked:'No', disruption:'Yes',
    desired_outcomes:'Airport experience; Earlier airline upgrades', luxury_retail_method:'Online',
    general_spend_cats:'Online retail, Insurance, Luxury retail', booking_control:'I do',
    largest_purchase:'75000', primary_cards:'Citi Double Cash',
    full_name:'Delta High Spend', email:'test@test.com', credit_score:'800+',
    frequent_destinations:'JFK,LAX,ORD,DFW', cabin_booked:'Mixed', upgrade_spend:'$3k-$7k'
  },

  // ── AMERICAN PROFILES ─────────────────────────────────────────────────────
  {
    label: 'American / No status / Wrong cards / $150K',
    total_spend:'150000', dining_spend:'18000', grocery_spend:'14000', general_spend:'65000',
    card_airfare:'Chase Sapphire Preferred', card_hotels:'Chase Sapphire Preferred',
    card_dining:'Chase Sapphire Preferred', card_groceries:'Chase Sapphire Preferred', card_general:'Chase Sapphire Preferred',
    primary_airline_eco:'American', primary_airline:'None',
    tsa_clear_activated:'No', booking_method:'Direct',
    flights_taken:'11-20', hotel_nights:'11-20', airline_spend:'$5k-$10k',
    airline_conc:'75-100%', hotel_conc:'0-24%', primary_hotel:'None',
    pts_redeemed:'None', upgrades_unasked:'No', disruption:'Yes',
    desired_outcomes:'Earlier airline upgrades', luxury_retail_method:'Not engaged',
    general_spend_cats:'Online retail', booking_control:'I do',
    largest_purchase:'10000', primary_cards:'Chase Sapphire Preferred',
    full_name:'AA User No Status', email:'test@test.com', credit_score:'760-799',
    frequent_destinations:'DFW,LAX,ORD', cabin_booked:'Economy', upgrade_spend:'Under $1k'
  },
  {
    label: 'American / Gold status / DFW hub / $200K',
    total_spend:'200000', dining_spend:'22000', grocery_spend:'16000', general_spend:'90000',
    card_airfare:'Amex Platinum', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'Amex Platinum',
    primary_airline_eco:'American', primary_airline:'AAdvantage Gold',
    tsa_clear_activated:'PreCheck only', booking_method:'Direct',
    flights_taken:'21-40', hotel_nights:'11-20', airline_spend:'$10k-$20k',
    airline_conc:'75-100%', hotel_conc:'50-74%', primary_hotel:'Marriott Gold',
    pts_redeemed:'25k-75k', upgrades_unasked:'No', disruption:'No',
    desired_outcomes:'Earlier airline upgrades; Airport experience', luxury_retail_method:'In boutique without advisor',
    general_spend_cats:'Online retail, Insurance', booking_control:'I do',
    largest_purchase:'20000', primary_cards:'Amex Platinum, Amex Gold',
    full_name:'AA Gold DFW', email:'test@test.com', credit_score:'800+',
    frequent_destinations:'DFW,LAX,JFK,ORD', cabin_booked:'Mixed', upgrade_spend:'$1k-$3k'
  },
  {
    label: 'American / Exec Plat / High spend / Already correct',
    total_spend:'280000', dining_spend:'35000', grocery_spend:'18000', general_spend:'100000',
    card_airfare:'Citi AAdvantage Executive', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'Citi AAdvantage Executive',
    primary_airline_eco:'American', primary_airline:'AAdvantage Executive Platinum',
    tsa_clear_activated:'Yes — both', booking_method:'Direct',
    flights_taken:'40+', hotel_nights:'21-39', airline_spend:'$20k+',
    airline_conc:'75-100%', hotel_conc:'75-100%', primary_hotel:'Hyatt Globalist',
    pts_redeemed:'Over 150k', upgrades_unasked:'Yes', disruption:'No',
    desired_outcomes:'Consistent recognition', luxury_retail_method:'Through dedicated advisor',
    general_spend_cats:'Luxury retail', booking_control:'I do',
    largest_purchase:'40000', primary_cards:'Citi AAdvantage Executive, Amex Platinum, Amex Gold',
    full_name:'AA Exec Plat', email:'test@test.com', credit_score:'800+',
    frequent_destinations:'DFW,LAX,JFK', cabin_booked:'Business', upgrade_spend:'Over $7k'
  },
  {
    label: 'American / Platinum status / Low flight volume / $100K',
    total_spend:'100000', dining_spend:'12000', grocery_spend:'10000', general_spend:'45000',
    card_airfare:'Amex Platinum', card_hotels:'Amex Platinum',
    card_dining:'Chase Sapphire Preferred', card_groceries:'Chase Sapphire Preferred', card_general:'Amex Platinum',
    primary_airline_eco:'American', primary_airline:'AAdvantage Platinum',
    tsa_clear_activated:'Yes — both', booking_method:'Direct',
    flights_taken:'6-10', hotel_nights:'6-10', airline_spend:'Under $5k',
    airline_conc:'50-74%', hotel_conc:'50-74%', primary_hotel:'Marriott Platinum',
    pts_redeemed:'Under 25k', upgrades_unasked:'No', disruption:'No',
    desired_outcomes:'Earlier airline upgrades', luxury_retail_method:'Not engaged',
    general_spend_cats:'Online retail', booking_control:'Someone else',
    largest_purchase:'8000', primary_cards:'Amex Platinum, Chase Sapphire Preferred',
    full_name:'AA Plat Low Flights', email:'test@test.com', credit_score:'760-799',
    frequent_destinations:'DFW,ORD', cabin_booked:'Economy', upgrade_spend:'Under $1k'
  },

  // ── UNITED PROFILES ───────────────────────────────────────────────────────
  {
    label: 'United / No status / Wrong cards / $180K',
    total_spend:'180000', dining_spend:'22000', grocery_spend:'16000', general_spend:'80000',
    card_airfare:'Chase Sapphire Reserve', card_hotels:'Chase Sapphire Reserve',
    card_dining:'Chase Sapphire Reserve', card_groceries:'Chase Sapphire Reserve', card_general:'Chase Sapphire Reserve',
    primary_airline_eco:'United', primary_airline:'None',
    tsa_clear_activated:'No', booking_method:'Direct',
    flights_taken:'21-40', hotel_nights:'11-20', airline_spend:'$10k-$20k',
    airline_conc:'75-100%', hotel_conc:'25-49%', primary_hotel:'None',
    pts_redeemed:'None', upgrades_unasked:'No', disruption:'Yes',
    desired_outcomes:'Earlier airline upgrades; Airport experience', luxury_retail_method:'Not engaged',
    general_spend_cats:'Online retail, Insurance', booking_control:'I do',
    largest_purchase:'15000', primary_cards:'Chase Sapphire Reserve',
    full_name:'United No Status', email:'test@test.com', credit_score:'760-799',
    frequent_destinations:'ORD,SFO,LAX', cabin_booked:'Economy', upgrade_spend:'$1k-$3k'
  },
  {
    label: 'United / Gold status / Heavy Chase ecosystem / $250K',
    total_spend:'250000', dining_spend:'30000', grocery_spend:'20000', general_spend:'110000',
    card_airfare:'Chase Sapphire Reserve', card_hotels:'Chase Sapphire Reserve',
    card_dining:'Chase Sapphire Reserve', card_groceries:'Chase Sapphire Reserve', card_general:'Chase Sapphire Reserve',
    primary_airline_eco:'United', primary_airline:'United Premier Gold',
    tsa_clear_activated:'CLEAR only', booking_method:'Mixed',
    flights_taken:'21-40', hotel_nights:'21-39', airline_spend:'$10k-$20k',
    airline_conc:'75-100%', hotel_conc:'50-74%', primary_hotel:'Marriott Gold',
    pts_redeemed:'25k-75k', upgrades_unasked:'No', disruption:'No',
    desired_outcomes:'Earlier airline upgrades', luxury_retail_method:'Online',
    general_spend_cats:'Online retail, Insurance, Luxury retail', booking_control:'I do',
    largest_purchase:'25000', primary_cards:'Chase Sapphire Reserve, Chase Freedom',
    full_name:'United Gold Chase', email:'test@test.com', credit_score:'800+',
    frequent_destinations:'ORD,SFO,JFK', cabin_booked:'Mixed', upgrade_spend:'$1k-$3k'
  },
  {
    label: 'United / Premier 1K / Already correct / $300K',
    total_spend:'300000', dining_spend:'38000', grocery_spend:'22000', general_spend:'120000',
    card_airfare:'United Club Infinite', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'United Club Infinite',
    primary_airline_eco:'United', primary_airline:'United Premier 1K',
    tsa_clear_activated:'Yes — both', booking_method:'Direct',
    flights_taken:'40+', hotel_nights:'40+', airline_spend:'$20k+',
    airline_conc:'75-100%', hotel_conc:'75-100%', primary_hotel:'Hyatt Globalist',
    pts_redeemed:'Over 150k', upgrades_unasked:'Yes', disruption:'No',
    desired_outcomes:'Suite-level hotel upgrades', luxury_retail_method:'Through dedicated advisor',
    general_spend_cats:'Luxury retail', booking_control:'I do',
    largest_purchase:'60000', primary_cards:'United Club Infinite, Amex Platinum, Amex Gold',
    full_name:'United 1K Correct', email:'test@test.com', credit_score:'800+',
    frequent_destinations:'ORD,SFO,EWR', cabin_booked:'Business', upgrade_spend:'Over $7k'
  },

  // ── SOUTHWEST ─────────────────────────────────────────────────────────────
  {
    label: 'Southwest / defaults to Delta architecture',
    total_spend:'120000', dining_spend:'15000', grocery_spend:'12000', general_spend:'50000',
    card_airfare:'Southwest Rapid Rewards Priority', card_hotels:'Chase Sapphire Preferred',
    card_dining:'Chase Sapphire Preferred', card_groceries:'Chase Sapphire Preferred', card_general:'Southwest Rapid Rewards Priority',
    primary_airline_eco:'Southwest', primary_airline:'None',
    tsa_clear_activated:'No', booking_method:'Direct',
    flights_taken:'11-20', hotel_nights:'6-10', airline_spend:'$5k-$10k',
    airline_conc:'75-100%', hotel_conc:'0-24%', primary_hotel:'None',
    pts_redeemed:'Under 25k', upgrades_unasked:'No', disruption:'No',
    desired_outcomes:'Airport experience', luxury_retail_method:'Not engaged',
    general_spend_cats:'Online retail', booking_control:'I do',
    largest_purchase:'8000', primary_cards:'Southwest Rapid Rewards, Chase Sapphire Preferred',
    full_name:'Southwest User', email:'test@test.com', credit_score:'760-799',
    frequent_destinations:'MDW,DAL,HOU', cabin_booked:'Economy', upgrade_spend:'Under $1k'
  },

  // ── MIXED / NO PREFERENCE ─────────────────────────────────────────────────
  {
    label: 'Mixed airline / No status / $175K',
    total_spend:'175000', dining_spend:'20000', grocery_spend:'15000', general_spend:'75000',
    card_airfare:'Amex Platinum', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'Amex Platinum',
    primary_airline_eco:'Mixed', primary_airline:'None',
    tsa_clear_activated:'Yes — both', booking_method:'Direct',
    flights_taken:'21-40', hotel_nights:'11-20', airline_spend:'$10k-$20k',
    airline_conc:'25-49%', hotel_conc:'50-74%', primary_hotel:'Hyatt Explorist',
    pts_redeemed:'25k-75k', upgrades_unasked:'No', disruption:'No',
    desired_outcomes:'Suite-level hotel upgrades', luxury_retail_method:'Not engaged',
    general_spend_cats:'Online retail, Insurance', booking_control:'Shared',
    largest_purchase:'12000', primary_cards:'Amex Platinum, Amex Gold',
    full_name:'Mixed Airline User', email:'test@test.com', credit_score:'760-799',
    frequent_destinations:'JFK,LAX,ORD,ATL', cabin_booked:'Mixed', upgrade_spend:'$1k-$3k'
  },

  // ── EDGE CASES ────────────────────────────────────────────────────────────
  {
    label: 'EDGE: Minimum qualifying spend $100K / Delta',
    total_spend:'100000', dining_spend:'10000', grocery_spend:'8000', general_spend:'40000',
    card_airfare:'Delta SkyMiles Gold', card_hotels:'Delta SkyMiles Gold',
    card_dining:'Delta SkyMiles Gold', card_groceries:'Delta SkyMiles Gold', card_general:'Delta SkyMiles Gold',
    primary_airline_eco:'Delta', primary_airline:'None',
    tsa_clear_activated:'No', booking_method:'Direct',
    flights_taken:'6-10', hotel_nights:'6-10', airline_spend:'Under $5k',
    airline_conc:'50-74%', hotel_conc:'0-24%', primary_hotel:'None',
    pts_redeemed:'None', upgrades_unasked:'No', disruption:'No',
    desired_outcomes:'Earlier airline upgrades', luxury_retail_method:'Not engaged',
    general_spend_cats:'Online retail', booking_control:'I do',
    largest_purchase:'5000', primary_cards:'Delta SkyMiles Gold',
    full_name:'Min Spend Delta', email:'test@test.com', credit_score:'720-759',
    frequent_destinations:'ATL,JFK', cabin_booked:'Economy', upgrade_spend:'Under $1k'
  },
  {
    label: 'EDGE: TSA/CLEAR — PreCheck only activated',
    total_spend:'150000', dining_spend:'18000', grocery_spend:'14000', general_spend:'65000',
    card_airfare:'Chase Sapphire Preferred', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'Chase Sapphire Preferred',
    primary_airline_eco:'Delta', primary_airline:'Delta Silver Medallion',
    tsa_clear_activated:'PreCheck only', booking_method:'Direct',
    flights_taken:'11-20', hotel_nights:'11-20', airline_spend:'$5k-$10k',
    airline_conc:'75-100%', hotel_conc:'50-74%', primary_hotel:'Marriott Silver',
    pts_redeemed:'Under 25k', upgrades_unasked:'No', disruption:'No',
    desired_outcomes:'Earlier airline upgrades', luxury_retail_method:'Not engaged',
    general_spend_cats:'Online retail', booking_control:'I do',
    largest_purchase:'9000', primary_cards:'Chase Sapphire Preferred, Amex Platinum, Amex Gold',
    full_name:'TSA PreCheck Only', email:'test@test.com', credit_score:'760-799',
    frequent_destinations:'ATL,JFK,LAX', cabin_booked:'Economy', upgrade_spend:'Under $1k'
  },
  {
    label: 'EDGE: American — "american express" in status field (false positive risk)',
    total_spend:'160000', dining_spend:'20000', grocery_spend:'15000', general_spend:'70000',
    card_airfare:'Amex Platinum', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'Amex Platinum',
    primary_airline_eco:'American', primary_airline:'None',
    tsa_clear_activated:'No', booking_method:'Direct',
    flights_taken:'11-20', hotel_nights:'11-20', airline_spend:'$5k-$10k',
    airline_conc:'50-74%', hotel_conc:'0-24%', primary_hotel:'None',
    pts_redeemed:'None', upgrades_unasked:'No', disruption:'No',
    desired_outcomes:'Earlier airline upgrades', luxury_retail_method:'Not engaged',
    general_spend_cats:'Online retail', booking_control:'I do',
    largest_purchase:'12000', primary_cards:'Amex Platinum, Amex Gold',
    full_name:'Amex Cards AA Flyer', email:'test@test.com', credit_score:'760-799',
    frequent_destinations:'ORD,DFW,LAX', cabin_booked:'Economy', upgrade_spend:'Under $1k'
  },
  {
    label: 'EDGE: Very high spend $500K / United',
    total_spend:'500000', dining_spend:'60000', grocery_spend:'30000', general_spend:'200000',
    card_airfare:'United Club Infinite', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'United Club Infinite',
    primary_airline_eco:'United', primary_airline:'United Premier Platinum',
    tsa_clear_activated:'Yes — both', booking_method:'Direct',
    flights_taken:'40+', hotel_nights:'40+', airline_spend:'$20k+',
    airline_conc:'75-100%', hotel_conc:'75-100%', primary_hotel:'Hyatt Globalist',
    pts_redeemed:'Over 150k', upgrades_unasked:'Yes', disruption:'No',
    desired_outcomes:'Suite-level hotel upgrades', luxury_retail_method:'Through dedicated advisor',
    general_spend_cats:'Luxury retail', booking_control:'I do',
    largest_purchase:'100000', primary_cards:'United Club Infinite, Amex Platinum, Amex Gold',
    full_name:'Very High United', email:'test@test.com', credit_score:'800+',
    frequent_destinations:'ORD,EWR,LAX,SFO', cabin_booked:'Business', upgrade_spend:'Over $7k'
  },
  {
    label: 'EDGE: No hotel status / Disrupted / Zero redeemed / American',
    total_spend:'140000', dining_spend:'16000', grocery_spend:'12000', general_spend:'60000',
    card_airfare:'Delta SkyMiles Reserve American Express Card', card_hotels:'Chase Sapphire Preferred',
    card_dining:'Chase Sapphire Preferred', card_groceries:'Chase Sapphire Preferred', card_general:'Chase Sapphire Preferred',
    primary_airline_eco:'American', primary_airline:'None',
    tsa_clear_activated:'No', booking_method:'OTA',
    flights_taken:'11-20', hotel_nights:'1-5', airline_spend:'$5k-$10k',
    airline_conc:'50-74%', hotel_conc:'0-24%', primary_hotel:'None',
    pts_redeemed:'None', upgrades_unasked:'No', disruption:'Yes',
    desired_outcomes:'Operational reliability', luxury_retail_method:'Online',
    general_spend_cats:'Online retail, Luxury retail', booking_control:'I do',
    largest_purchase:'10000', primary_cards:'Delta SkyMiles Reserve, Chase Sapphire Preferred',
    full_name:'AA Switcher', email:'test@test.com', credit_score:'720-759',
    frequent_destinations:'ORD,DFW', cabin_booked:'Economy', upgrade_spend:'Under $1k'
  },
  {
    label: 'EDGE: Delta Diamond already / Correct full stack',
    total_spend:'400000', dining_spend:'50000', grocery_spend:'25000', general_spend:'150000',
    card_airfare:'Delta SkyMiles Reserve American Express Card', card_hotels:'Amex Platinum',
    card_dining:'Amex Gold', card_groceries:'Amex Gold', card_general:'Delta SkyMiles Reserve American Express Card',
    primary_airline_eco:'Delta', primary_airline:'Delta Diamond Medallion',
    tsa_clear_activated:'Yes — both', booking_method:'Direct',
    flights_taken:'40+', hotel_nights:'40+', airline_spend:'$20k+',
    airline_conc:'75-100%', hotel_conc:'75-100%', primary_hotel:'Hyatt Globalist',
    pts_redeemed:'Over 150k', upgrades_unasked:'Yes', disruption:'No',
    desired_outcomes:'Consistent recognition', luxury_retail_method:'Through dedicated advisor',
    general_spend_cats:'Luxury retail', booking_control:'Someone else',
    largest_purchase:'80000', primary_cards:'Delta Reserve, Amex Platinum, Amex Gold',
    full_name:'Delta Diamond Correct', email:'test@test.com', credit_score:'800+',
    frequent_destinations:'ATL,JFK,LAX,ORD', cabin_booked:'First', upgrade_spend:'Over $7k'
  },
];

// ── RUN ALL PROFILES ──────────────────────────────────────────────────────────
const failures = [];
const passed = [];

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  QUIET PREMIUM — DIAGNOSTIC SIMULATION HARNESS');
console.log('  ' + profiles.length + ' profiles · ' + new Date().toLocaleString());
console.log('═══════════════════════════════════════════════════════════\n');

for(const p of profiles){
  const r = generateResults(p);
  const before = failures.length;
  runAssertions(p.label, p, r, failures);
  const after = failures.length;
  const profileFailed = after > before;

  const eco = r.dashboard.ecosystem.padEnd(10);
  const val = ('$'+r.value.vt.toLocaleString()).padStart(10);
  const card = r.thirdCard.padEnd(28);
  const status = r.statusTarget.substring(0,35).padEnd(35);
  const mark = profileFailed ? '✗ FAIL' : '✓ PASS';

  console.log(`${mark}  ${p.label.substring(0,52).padEnd(52)} eco:${eco} val:${val}  card:${card}  status:${status}`);

  if(profileFailed){
    const newFails = failures.slice(before);
    for(const f of newFails){
      console.log(`       ↳ ${f.msg}`);
    }
  }
}

console.log('\n───────────────────────────────────────────────────────────');
console.log(`  RESULTS: ${profiles.length - [...new Set(failures.map(f=>f.profile))].length} passed / ${[...new Set(failures.map(f=>f.profile))].length} profiles with failures / ${failures.length} total assertions failed`);
if(failures.length === 0){
  console.log('  ALL ASSERTIONS PASSED');
}
console.log('═══════════════════════════════════════════════════════════\n');

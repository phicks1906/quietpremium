const D=require("./assets/diagnostic-v5.js");
globalThis.QP_AIRPORTS=[
  {c:"SDF",n:"Louisville International Standiford Field",y:"Louisville",o:"United States"},
  {c:"JFK",n:"John F Kennedy International Airport",y:"New York",o:"United States"},
  {c:"LGA",n:"La Guardia Airport",y:"New York",o:"United States"},
  {c:"ATL",n:"Hartsfield Jackson Atlanta International Airport",y:"Atlanta",o:"United States"}
];

let pass=0,fail=0;
const failures=[];
function ok(name,cond,detail=""){
  if(cond){pass++;return}
  fail++;failures.push({name,detail});
}
function eq(name,a,b){ok(name,JSON.stringify(a)===JSON.stringify(b),JSON.stringify({actual:a,expected:b}));}

const base={
  primary_airline_eco:"Delta",
  primary_airline_status:"Gold Medallion",
  delta_mqd_ytd:"8600",
  flights_taken:"20",
  airline_conc:"80",
  individual_airfare_spend:"12000",
  home_airport:"SDF",
  booking_control:"Full control",
  airfare_booking_method:"Direct airline",
  frequent_destinations:"ATL, JFK",
  primary_hotel_program:"Marriott",
  primary_hotel_status:"Gold Elite",
  hotel_nights:"20",
  hotel_stays:"12",
  hotel_spend:"15000",
  hotel_conc:"75",
  hotel_booking_method:"Direct",
  hotel_qualifying_nights_ytd:"18",
  hotel_qualifying_stays_ytd:"10",
  hotel_qualifying_spend_ytd:"9000",
  hotel_base_points_ytd:"",
  total_spend:"150000",
  dining_spend:"20000",
  grocery_spend:"15000",
  general_spend:"88000",
  primary_cards:"The Platinum Card from American Express, American Express Gold Card, Delta SkyMiles Reserve American Express Card",
  card_airfare:"The Platinum Card from American Express",
  card_hotels:"The Platinum Card from American Express",
  card_dining:"American Express Gold Card",
  card_groceries:"American Express Gold Card",
  card_general:"Delta SkyMiles Reserve American Express Card",
  desired_outcomes:"redemption, status",
  companion_travel_intent:"yes",
  companion_travel_frequency:"2_3",
  willing_to_concentrate:"yes",
  points_amex_mr:"250000",
  points_skymiles:"150000"
};

const p=D.buildProfileFromValues(base);
eq("three current cards survive",p.currentCards,["amex_platinum","amex_gold","delta_reserve"]);
ok("airfare spend survives",p.spend.airfare===12000,String(p.spend.airfare));
ok("hotel spend survives",p.spend.hotel===15000,String(p.spend.hotel));
ok("hotel program survives",p.primaryHotel==="marriott",p.primaryHotel);
ok("airline concentration survives",p.primaryAirlineShare===0.8,String(p.primaryAirlineShare));
ok("hotel concentration survives",p.primaryHotelShare===0.75,String(p.primaryHotelShare));
eq("goals remain separate",p.aspirations,["redemption","status"]);
ok("airfare routing survives",p.currentRouting.airfare[0]?.card==="amex_platinum",JSON.stringify(p.currentRouting.airfare));
ok("hotel routing survives",p.currentRouting.hotel[0]?.card==="amex_platinum",JSON.stringify(p.currentRouting.hotel));
ok("grocery routing survives",p.currentRouting.grocery[0]?.card==="amex_gold",JSON.stringify(p.currentRouting.grocery));
ok("Delta progress survives",p.statusProgress.delta.mqd===8600,String(p.statusProgress.delta.mqd));
ok("hotel current progress survives",p.statusProgress.hotel.qualifyingNights===18&&p.statusProgress.hotel.qualifyingSpend===9000,JSON.stringify(p.statusProgress.hotel));
ok("companion yes survives",p.companionTravelIntent==="yes"&&p.companionTravelFrequency==="2_3",JSON.stringify({intent:p.companionTravelIntent,frequency:p.companionTravelFrequency}));
ok("unknown remaining-year activity stays unknown",!("remainingYear" in p),JSON.stringify(p.remainingYear));
ok("stored point balances survive",p.pointBalances.amex_mr===250000&&p.pointBalances.skymiles===150000,JSON.stringify(p.pointBalances));
ok("old subjective benefit values are not mapped",!("benefitValueByType" in p)&&!("explicitBenefitUse" in p),JSON.stringify(p));
eq("home airport is canonicalized",p.homeAirport,"SDF");
eq("frequent destinations are canonicalized",p.frequentDestinations,["ATL","JFK"]);
ok("valid airport code resolves",D.resolveAirport("SDF").ok===true&&D.resolveAirport("SDF").code==="SDF",JSON.stringify(D.resolveAirport("SDF")));
ok("airport name resolves",D.resolveAirport("John F Kennedy International Airport").code==="JFK",JSON.stringify(D.resolveAirport("John F Kennedy International Airport")));
ok("ambiguous city is rejected",D.resolveAirport("New York").reason==="ambiguous",JSON.stringify(D.resolveAirport("New York")));
const badAirport={...base,home_airport:"ZZZ"};
ok("invalid home airport is rejected",D.validationErrors(badAirport).some(x=>x.includes("valid home airport")),JSON.stringify(D.validationErrors(badAirport)));
const ambiguousAirport={...base,home_airport:"New York"};
ok("ambiguous home airport is rejected",D.validationErrors(ambiguousAirport).some(x=>x.includes("specific home airport")),JSON.stringify(D.validationErrors(ambiguousAirport)));


const noComp={...base,companion_travel_intent:"no",companion_travel_frequency:""};
const pn=D.buildProfileFromValues(noComp);
ok("companion No remains No without fake frequency",pn.companionTravelIntent==="no"&&pn.companionTravelFrequency==="",JSON.stringify(pn));

const unsure={...base,companion_travel_intent:"not_sure",companion_travel_frequency:""};
const pu=D.buildProfileFromValues(unsure);
ok("companion Not sure remains unresolved",pu.companionTravelIntent==="not_sure"&&pu.companionTravelFrequency==="",JSON.stringify(pu));

const withRemaining={...base,remaining_general_spend:"25000",delta_remaining_mqd:"1400"};
const pr=D.buildProfileFromValues(withRemaining);
ok("remaining-year facts are passed only when supplied",pr.remainingYear?.cardSpend?.general===25000&&pr.remainingYear?.delta?.mqd===1400,JSON.stringify(pr.remainingYear));

const progressMissing={...base,delta_mqd_ytd:""};
ok("missing selected-airline progress is rejected",D.validationErrors(progressMissing).some(x=>x.includes("current Delta MQDs")),JSON.stringify(D.validationErrors(progressMissing)));

const hotelProgressMissing={...base,hotel_qualifying_nights_ytd:""};
ok("missing selected-hotel progress is rejected",D.validationErrors(hotelProgressMissing).some(x=>x.includes("qualifying hotel nights")),JSON.stringify(D.validationErrors(hotelProgressMissing)));

const walletMismatch={...base,card_dining:"Chase Sapphire Preferred"};
ok("routing card outside wallet is rejected",D.validationErrors(walletMismatch).some(x=>x.includes("dining spend")),JSON.stringify(D.validationErrors(walletMismatch)));

const cards=D.parseCardList("Chase Freedom Flex; Capital One Venture X Rewards\nWorld of Hyatt Credit Card");
eq("semicolon/newline wallet parsing works",cards,["chase_freedom_flex","venture_x","hyatt_consumer"]);

const lines=D.parseCardAmountLines("Delta SkyMiles Reserve: 42,000\nWorld of Hyatt Credit Card: 12,000");
ok("card YTD spend parser preserves card identity",lines.delta_reserve===42000&&lines.hyatt_consumer===12000,JSON.stringify(lines));

console.log(JSON.stringify({pass,fail,failures},null,2));
if(fail)process.exitCode=1;

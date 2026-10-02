/**
 * Country, region and city options for the checkout address.
 *
 * Shape of the data, and why:
 *
 * - Countries are complete. The codes are ISO 3166-1 alpha-2 and the display
 *   names come from Intl.DisplayNames, so there is no hand-maintained list of
 *   names to drift or to localise.
 * - Regions are only provided for the countries this shop actually expects.
 *   Shipping a complete worldwide subdivision list would be far more data
 *   than this is worth, so anything else falls back to a text input.
 * - Cities exist for Nigeria only. A worldwide city list is hundreds of
 *   thousands of rows; a partial one that silently lacks someone's city is
 *   worse than a text box. Everywhere else gets a text input.
 *
 * Addresses are stored as the display strings the customer picked, so the
 * order record and the confirmation email read naturally. The server
 * validates the country against this list; regions and cities stay free-form
 * because the data here is deliberately incomplete.
 */

const COUNTRY_CODES = [
  "AF","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BH","BD","BB",
  "BY","BE","BZ","BJ","BT","BO","BA","BW","BR","BN","BG","BF","BI","CV","KH",
  "CM","CA","CF","TD","CL","CN","CO","KM","CG","CD","CR","CI","HR","CU","CY",
  "CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FJ","FI",
  "FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HU",
  "IS","IN","ID","IR","IQ","IE","IL","IT","JM","JP","JO","KZ","KE","KI","KW",
  "KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MG","MW","MY","MV","ML",
  "MT","MH","MR","MU","MX","FM","MD","MC","MN","ME","MA","MZ","MM","NA","NR",
  "NP","NL","NZ","NI","NE","NG","KP","MK","NO","OM","PK","PW","PS","PA","PG",
  "PY","PE","PH","PL","PT","QA","RO","RU","RW","KN","LC","VC","WS","SM","ST",
  "SA","SN","RS","SC","SL","SG","SK","SI","SB","SO","ZA","KR","SS","ES","LK",
  "SD","SR","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TO","TT","TN","TR",
  "TM","TV","UG","UA","AE","GB","US","UY","UZ","VU","VA","VE","VN","YE","ZM",
  "ZW",
] as const;

export type Country = { code: string; name: string };

function buildCountries(): Country[] {
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    // Intl.DisplayNames is unavailable: fall back to the raw codes rather
    // than rendering an empty dropdown.
    display = null;
  }

  return COUNTRY_CODES.map((code) => ({
    code,
    name: display?.of(code) ?? code,
  })).sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export const COUNTRIES: Country[] = buildCountries();

const COUNTRY_NAMES = new Set(COUNTRIES.map((country) => country.name));

/** True if the string is one of the country names this form offers. */
export function isKnownCountry(name: string): boolean {
  return COUNTRY_NAMES.has(name.trim());
}

/* ---------- Regions, for the countries this shop expects ---------- */

const NIGERIA_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Federal Capital Territory",
  "Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos",
  "Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto",
  "Taraba","Yobe","Zamfara",
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho",
  "Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland",
  "Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana",
  "Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York",
  "North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania",
  "Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah",
  "Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

const CANADA_PROVINCES = [
  "Alberta","British Columbia","Manitoba","New Brunswick",
  "Newfoundland and Labrador","Northwest Territories","Nova Scotia","Nunavut",
  "Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon",
];

const UK_REGIONS = ["England", "Northern Ireland", "Scotland", "Wales"];

const REGIONS_BY_COUNTRY: Record<string, string[]> = {
  Nigeria: NIGERIA_STATES,
  "United States": US_STATES,
  Canada: CANADA_PROVINCES,
  "United Kingdom": UK_REGIONS,
};

/** Regions for a country, or [] when we don't ship a list for it. */
export function regionsFor(country: string): string[] {
  return REGIONS_BY_COUNTRY[country.trim()] ?? [];
}

/* ---------- Cities, Nigeria only ---------- */

const NIGERIA_CITIES: Record<string, string[]> = {
  Abia: ["Aba", "Arochukwu", "Ohafia", "Umuahia"],
  Adamawa: ["Ganye", "Jimeta", "Mubi", "Numan", "Yola"],
  "Akwa Ibom": ["Eket", "Ikot Abasi", "Ikot Ekpene", "Oron", "Uyo"],
  Anambra: ["Awka", "Ekwulobia", "Nnewi", "Onitsha"],
  Bauchi: ["Azare", "Bauchi", "Jama'are", "Misau"],
  Bayelsa: ["Brass", "Ogbia", "Sagbama", "Yenagoa"],
  Benue: ["Gboko", "Katsina-Ala", "Makurdi", "Otukpo"],
  Borno: ["Bama", "Biu", "Maiduguri", "Monguno"],
  "Cross River": ["Calabar", "Ikom", "Obudu", "Ogoja"],
  Delta: ["Agbor", "Asaba", "Sapele", "Ughelli", "Warri"],
  Ebonyi: ["Abakaliki", "Afikpo", "Onueke"],
  Edo: ["Auchi", "Benin City", "Ekpoma", "Uromi"],
  Ekiti: ["Ado-Ekiti", "Ikere-Ekiti", "Ikole-Ekiti", "Oye-Ekiti"],
  Enugu: ["Agbani", "Enugu", "Nsukka", "Oji River"],
  "Federal Capital Territory": ["Abuja", "Gwagwalada", "Kubwa", "Kuje", "Nyanya"],
  Gombe: ["Bajoga", "Billiri", "Gombe", "Kaltungo"],
  Imo: ["Okigwe", "Orlu", "Owerri"],
  Jigawa: ["Birnin Kudu", "Dutse", "Gumel", "Hadejia"],
  Kaduna: ["Kaduna", "Kafanchan", "Zaria"],
  Kano: ["Bichi", "Gwarzo", "Kano", "Wudil"],
  Katsina: ["Daura", "Funtua", "Katsina", "Malumfashi"],
  Kebbi: ["Argungu", "Birnin Kebbi", "Yauri", "Zuru"],
  Kogi: ["Idah", "Kabba", "Lokoja", "Okene"],
  Kwara: ["Ilorin", "Jebba", "Offa", "Omu-Aran"],
  Lagos: [
    "Agege","Alimosho","Apapa","Badagry","Epe","Ikeja","Ikorodu","Lagos Island",
    "Lekki","Mushin","Oshodi","Surulere","Victoria Island","Yaba",
  ],
  Nasarawa: ["Akwanga", "Karu", "Keffi", "Lafia"],
  Niger: ["Bida", "Kontagora", "Minna", "Suleja"],
  Ogun: ["Abeokuta", "Ijebu-Ode", "Ota", "Sagamu"],
  Ondo: ["Akure", "Ikare", "Okitipupa", "Ondo", "Owo"],
  Osun: ["Ede", "Ikirun", "Ile-Ife", "Ilesa", "Osogbo"],
  Oyo: ["Ibadan", "Iseyin", "Ogbomosho", "Oyo", "Saki"],
  Plateau: ["Barkin Ladi", "Jos", "Pankshin", "Shendam"],
  Rivers: ["Bonny", "Bori", "Okrika", "Port Harcourt"],
  Sokoto: ["Gwadabawa", "Sokoto", "Tambuwal", "Wurno"],
  Taraba: ["Bali", "Jalingo", "Takum", "Wukari"],
  Yobe: ["Damaturu", "Gashua", "Nguru", "Potiskum"],
  Zamfara: ["Gusau", "Kaura Namoda", "Talata Mafara"],
};

const CITIES_BY_COUNTRY: Record<string, Record<string, string[]>> = {
  Nigeria: NIGERIA_CITIES,
};

/** Cities for a country/region pair, or [] when we don't have a list. */
export function citiesFor(country: string, region: string): string[] {
  return CITIES_BY_COUNTRY[country.trim()]?.[region.trim()] ?? [];
}

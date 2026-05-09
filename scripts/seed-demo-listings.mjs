#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEMO_EMAIL = "demo-owner@rentulo.local";
const DEFAULT_COUNT = 96;
const ITEM_IMAGE_BUCKET = "item-images";
const ORIGINAL_ENV_KEYS = new Set(Object.keys(process.env));

const CATEGORIES = [
  "Náradie",
  "Záhrada",
  "Stavebné stroje",
  "Auto-moto",
  "Elektronika",
  "Šport a voľný čas",
  "Dom a dielňa",
];

const CATEGORY_PALETTES = {
  "Náradie": { bgA: "#0f172a", bgB: "#2563eb", accent: "#38bdf8", surface: "#eff6ff" },
  "Záhrada": { bgA: "#052e16", bgB: "#15803d", accent: "#86efac", surface: "#f0fdf4" },
  "Stavebné stroje": { bgA: "#422006", bgB: "#f59e0b", accent: "#fde68a", surface: "#fffbeb" },
  "Auto-moto": { bgA: "#111827", bgB: "#dc2626", accent: "#fb7185", surface: "#fff1f2" },
  "Elektronika": { bgA: "#082f49", bgB: "#0891b2", accent: "#67e8f9", surface: "#ecfeff" },
  "Šport a voľný čas": { bgA: "#172554", bgB: "#f97316", accent: "#fdba74", surface: "#fff7ed" },
  "Dom a dielňa": { bgA: "#1c1917", bgB: "#ea580c", accent: "#fed7aa", surface: "#fff7ed" },
};

const CONDITION_LABELS = {
  new: "Nové",
  like_new: "Ako nové",
  very_good: "Veľmi dobré",
  good: "Dobré",
  acceptable: "Používané",
  damaged: "Poškodené",
};

const CONDITION_SENTENCES = {
  new: "Stav je nový, bez známok používania.",
  like_new: "Stav je veľmi čistý a technicky bez pripomienok.",
  very_good: "Všetko funguje bez problému, vidno len bežné kozmetické stopy.",
  good: "Funkčne bez problému, na tele sú bežné známky používania.",
  acceptable: "Plne funkčné, ale je na ňom vidieť intenzívnejšie používanie.",
  damaged: "Funkčne použiteľné s menším obmedzením, detail je rozpísaný nižšie.",
};

const HANDOVER_NOTES = [
  "Po dohode viem pripraviť odovzdanie ráno aj večer.",
  "Pred odovzdaním ukážem základné nastavenie a obsluhu.",
  "Preferujem vrátenie čisté a v rovnakom stave, v akom sa preberá.",
  "Po dohode viem nachystať aj víkendové odovzdanie.",
  "Ak treba, poradím aj s rýchlym prvým nastavením na mieste.",
];

const CITY_CATALOG = [
  {
    name: "Bratislava",
    latitude: 48.148596,
    longitude: 17.107748,
    postalCodes: ["821 08", "831 04", "841 01", "851 01"],
    streets: ["Bajkalská", "Račianska", "Kazanská", "Dúbravská cesta", "Trnavská cesta"],
  },
  {
    name: "Trnava",
    latitude: 48.377433,
    longitude: 17.587238,
    postalCodes: ["917 01", "917 02"],
    streets: ["Hospodárska", "Bratislavská", "Veterná", "Jána Bottu", "Mikovíniho"],
  },
  {
    name: "Nitra",
    latitude: 48.306391,
    longitude: 18.076391,
    postalCodes: ["949 01", "949 11", "949 12"],
    streets: ["Štúrova", "Párovská", "Levická", "Dlhá", "Novozámocká"],
  },
  {
    name: "Trenčín",
    latitude: 48.89452,
    longitude: 18.044361,
    postalCodes: ["911 01", "911 05"],
    streets: ["Legionárska", "Soblahovská", "Brnianska", "Opatovská", "Električná"],
  },
  {
    name: "Žilina",
    latitude: 49.22315,
    longitude: 18.73941,
    postalCodes: ["010 01", "010 08", "010 09"],
    streets: ["Vysokoškolákov", "Košická", "Na priekope", "Bánovská cesta", "Pri celulózke"],
  },
  {
    name: "Banská Bystrica",
    latitude: 48.736277,
    longitude: 19.146191,
    postalCodes: ["974 01", "974 04", "974 05"],
    streets: ["Zvolenská cesta", "Partizánska cesta", "Tajovského", "Námestie Ľudovíta Štúra", "Trieda SNP"],
  },
  {
    name: "Košice",
    latitude: 48.716385,
    longitude: 21.261074,
    postalCodes: ["040 01", "040 11", "040 23"],
    streets: ["Južná trieda", "Trieda SNP", "Moldavská cesta", "Watsonova", "Rastislavova"],
  },
  {
    name: "Prešov",
    latitude: 48.998383,
    longitude: 21.239344,
    postalCodes: ["080 01", "080 05", "080 06"],
    streets: ["Masarykova", "Levočská", "Sabinovská", "Volgogradská", "Košická"],
  },
];

const CATEGORY_TEMPLATES = {
  "Náradie": [
    {
      title: "Aku vŕtačka DeWalt 18V XR",
      description:
        "Silná aku vŕtačka vhodná na montáže, sadrokartón a bežné práce okolo domu.",
      pricePerDay: 14,
      replacementValue: 320,
      includedAccessories: ["2 batérie 5 Ah", "nabíjačka", "kufor"],
      excludedAccessories: [],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Jemné oderky na kufri.", "Bežné kozmetické stopy na rukoväti."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.45,
      deliveryFeeCap: 18,
      deliveryRadiusKm: 18,
      illustration: "drill",
    },
    {
      title: "Búracie kladivo Hilti TE 800",
      description:
        "Výkonné búracie kladivo na sekanie drážok, betónu a starých poterov pri rekonštrukcii.",
      pricePerDay: 34,
      replacementValue: 1180,
      includedAccessories: ["špicatý sekáč", "plochý sekáč", "transportný kufor"],
      excludedAccessories: ["predlžovací kábel"],
      conditionCycle: ["very_good", "good", "acceptable"],
      damageNotes: ["Povrchové oškretie na bočnom kryte.", null, "Na kufri je prasknutý jeden roh."],
      deliveryMode: "delivery_available",
      deliveryRatePerKm: 0.95,
      deliveryFeeCap: 39,
      deliveryRadiusKm: 28,
      illustration: "hammer",
    },
    {
      title: "Laserový nivelačný prístroj Bosch GLL 3-80",
      description:
        "Presný krížový laser na interiérové montáže, obklady, SDK a vyrovnávanie konštrukcií.",
      pricePerDay: 19,
      replacementValue: 540,
      includedAccessories: ["statív", "cieľová doska", "nabíjací adaptér", "puzdro"],
      excludedAccessories: [],
      conditionCycle: ["new", "like_new", "very_good"],
      damageNotes: [null, "Mierne škrabance na spodnej základni."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.4,
      deliveryFeeCap: 16,
      deliveryRadiusKm: 15,
      illustration: "laser",
    },
    {
      title: "Priamočiara píla Makita 4350",
      description:
        "Spoľahlivá priamočiara píla na drevo, OSB, plast a jemnejšie presné výrezy.",
      pricePerDay: 11,
      replacementValue: 230,
      includedAccessories: ["2 listy na drevo", "1 list na lamino", "plastový kufor"],
      excludedAccessories: ["vysávač"],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Na základni je jemný ošuch od vedenia po materiáli."],
      deliveryMode: "mixed",
      deliveryRatePerKm: 0.55,
      deliveryFeeCap: 20,
      deliveryRadiusKm: 16,
      illustration: "saw",
    },
  ],
  "Záhrada": [
    {
      title: "Benzínová kosačka Honda HRG 466",
      description:
        "Spoľahlivá kosačka na pravidelnú údržbu záhrady, zvládne aj hustejšiu trávu.",
      pricePerDay: 22,
      replacementValue: 520,
      includedAccessories: ["kôš na trávu", "kanister 5 l"],
      excludedAccessories: ["benzín"],
      conditionCycle: ["very_good", "good", "acceptable"],
      damageNotes: [null, "Na koši je mierne vyblednutý plast.", "Rukoväť má drobnú kozmetickú odreninu."],
      deliveryMode: "delivery_available",
      deliveryRatePerKm: 0.65,
      deliveryFeeCap: 24,
      deliveryRadiusKm: 20,
      illustration: "mower",
    },
    {
      title: "Motorová píla Husqvarna 450",
      description:
        "Výkonná motorová píla na palivové drevo, orez stromov a bežné práce okolo domu.",
      pricePerDay: 24,
      replacementValue: 470,
      includedAccessories: ["reťaz", "kľúč na napnutie", "ochranný kryt lišty"],
      excludedAccessories: ["olej na reťaz", "benzínová zmes"],
      conditionCycle: ["good", "very_good", "acceptable"],
      damageNotes: ["Na štartovacom kryte sú viditeľné bežné škrabance.", null],
      deliveryMode: "mixed",
      deliveryRatePerKm: 0.6,
      deliveryFeeCap: 22,
      deliveryRadiusKm: 18,
      illustration: "chainsaw",
    },
    {
      title: "Vertikutátor Gardena EVC 1000",
      description:
        "Elektrický vertikutátor na prevzdušnenie trávnika po zime a odstránenie plsti.",
      pricePerDay: 15,
      replacementValue: 210,
      includedAccessories: ["zberný kôš", "predlžovací adaptér"],
      excludedAccessories: ["dlhý predlžovací kábel"],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Na plastovom kryte je drobný škrabanec."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.45,
      deliveryFeeCap: 18,
      deliveryRadiusKm: 14,
      illustration: "rake",
    },
    {
      title: "Tlakový postrekovač Gloria 8 l",
      description:
        "Ručný tlakový postrekovač na záhradu, dezinfekciu, náterové práce aj jemné čistenie.",
      pricePerDay: 8,
      replacementValue: 69,
      includedAccessories: ["ramenný popruh", "nastaviteľná tryska"],
      excludedAccessories: [],
      conditionCycle: ["new", "like_new", "very_good"],
      damageNotes: [null, "Bežné stopy po používaní na spodnej hrane nádoby."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.35,
      deliveryFeeCap: 12,
      deliveryRadiusKm: 12,
      illustration: "sprayer",
    },
  ],
  "Stavebné stroje": [
    {
      title: "Vibračná doska Wacker Neuson 90 kg",
      description:
        "Vhodná na hutnenie zámkovej dlažby, podsypu a menších stavebných plôch.",
      pricePerDay: 48,
      replacementValue: 1650,
      includedAccessories: ["transportné kolieska", "gumová podložka na dlažbu"],
      excludedAccessories: ["benzín"],
      conditionCycle: ["very_good", "good", "acceptable"],
      damageNotes: ["Na ráme sú bežné oškretia z nakladania.", null],
      deliveryMode: "delivery_available",
      deliveryRatePerKm: 1.1,
      deliveryFeeCap: 54,
      deliveryRadiusKm: 35,
      illustration: "plate",
    },
    {
      title: "Elektrická miešačka 160 l",
      description:
        "Stabilná miešačka na betón, poter a väčšie objemy stavebných zmesí pri stavbe domu.",
      pricePerDay: 21,
      replacementValue: 430,
      includedAccessories: ["predlžovací adaptér", "stabilizačná noha"],
      excludedAccessories: ["predlžovací kábel"],
      conditionCycle: ["good", "very_good", "acceptable"],
      damageNotes: ["Na bubne sú zvyšky staršieho náteru a bežné stopy používania.", null],
      deliveryMode: "delivery_available",
      deliveryRatePerKm: 0.85,
      deliveryFeeCap: 30,
      deliveryRadiusKm: 24,
      illustration: "mixer",
    },
    {
      title: "Odvlhčovač Trotec TTK 170",
      description:
        "Silný odvlhčovač na vysúšanie po maľovaní, po havárii vody alebo pri vlhkých stenách.",
      pricePerDay: 27,
      replacementValue: 690,
      includedAccessories: ["odtoková hadica", "napájací kábel 3 m"],
      excludedAccessories: [],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Na rukoväti sú jemné oderky od presúvania."],
      deliveryMode: "mixed",
      deliveryRatePerKm: 0.7,
      deliveryFeeCap: 26,
      deliveryRadiusKm: 22,
      illustration: "dryer",
    },
    {
      title: "Rezačka na dlažbu Rubi DC-250",
      description:
        "Vodou chladená rezačka na veľkoformátovú dlažbu, obklad a presné rezy na stavbe.",
      pricePerDay: 39,
      replacementValue: 1320,
      includedAccessories: ["diamantový kotúč", "bočný doraz", "vodná vaňa"],
      excludedAccessories: [],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Na stole sú drobné pracovné škrabance."],
      deliveryMode: "delivery_available",
      deliveryRatePerKm: 0.95,
      deliveryFeeCap: 42,
      deliveryRadiusKm: 30,
      illustration: "cutter",
    },
  ],
  "Auto-moto": [
    {
      title: "Autobox Thule Motion XT L",
      description:
        "Priestranný strešný box vhodný na dovolenku, kočík, lyže aj víkendové výjazdy.",
      pricePerDay: 18,
      replacementValue: 790,
      includedAccessories: ["upevňovací systém", "2 kľúče"],
      excludedAccessories: ["priečniky na strechu"],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: ["Na spodnej časti sú bežné stopy po montáži.", null],
      deliveryMode: "mixed",
      deliveryRatePerKm: 0.55,
      deliveryFeeCap: 18,
      deliveryRadiusKm: 20,
      illustration: "roofbox",
    },
    {
      title: "Štartovací booster NOCO GB70",
      description:
        "Kompaktný štartovací zdroj pre auto, dodávku alebo moto, vhodný aj na cesty.",
      pricePerDay: 10,
      replacementValue: 190,
      includedAccessories: ["nabíjací kábel", "štartovacie svorky", "textilné puzdro"],
      excludedAccessories: [],
      conditionCycle: ["new", "like_new", "very_good"],
      damageNotes: [null, "Puzdro má drobný škrabanec na zipse."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.3,
      deliveryFeeCap: 10,
      deliveryRadiusKm: 12,
      illustration: "booster",
    },
    {
      title: "Nosič bicyklov na ťažné zariadenie Thule VeloCompact",
      description:
        "Stabilný nosič na 2 bicykle, vhodný na dlhšie trasy aj víkendové presuny.",
      pricePerDay: 17,
      replacementValue: 620,
      includedAccessories: ["2 kľúče", "upevňovacie popruhy", "adaptér na rám"],
      excludedAccessories: [],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Na spodnej hrane sú bežné kozmetické stopy od skladania."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.4,
      deliveryFeeCap: 15,
      deliveryRadiusKm: 15,
      illustration: "bike-rack",
    },
    {
      title: "Diagnostika OBD2 Launch CRP129",
      description:
        "Čítačka chýb a základná diagnostika pre rýchlu kontrolu auta pred servisom.",
      pricePerDay: 12,
      replacementValue: 260,
      includedAccessories: ["OBD kábel", "nabíjací kábel", "ochranné puzdro"],
      excludedAccessories: [],
      conditionCycle: ["very_good", "good", "like_new"],
      damageNotes: [null, "Na ochrannom obale sú jemné škrabance."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.35,
      deliveryFeeCap: 12,
      deliveryRadiusKm: 12,
      illustration: "scanner",
    },
  ],
  "Elektronika": [
    {
      title: "Projektor Epson Full HD EH-TW5820",
      description:
        "Svetelný projektor na filmy, športové prenosy, prezentácie aj menšie eventy.",
      pricePerDay: 29,
      replacementValue: 860,
      includedAccessories: ["diaľkové ovládanie", "HDMI kábel 5 m", "napájací kábel"],
      excludedAccessories: ["plátno"],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Na vrchnom kryte je jemný vlasový škrabanec."],
      deliveryMode: "mixed",
      deliveryRatePerKm: 0.55,
      deliveryFeeCap: 20,
      deliveryRadiusKm: 18,
      illustration: "projector",
    },
    {
      title: "Ozvučenie JBL PartyBox 310",
      description:
        "Prenosný reproduktor s výkonom na oslavu, záhradu, školský event alebo firemnú akciu.",
      pricePerDay: 24,
      replacementValue: 590,
      includedAccessories: ["nabíjací kábel", "mikrofónny kábel"],
      excludedAccessories: ["mikrofón"],
      conditionCycle: ["very_good", "good", "like_new"],
      damageNotes: [null, "Na spodnej hrane sú drobné známky manipulácie."],
      deliveryMode: "delivery_available",
      deliveryRatePerKm: 0.7,
      deliveryFeeCap: 24,
      deliveryRadiusKm: 22,
      illustration: "speaker",
    },
    {
      title: "GoPro HERO12 Black",
      description:
        "Akčná kamera vhodná na bicykel, lyže, motorku, turistiku aj dovolenkové zábery.",
      pricePerDay: 16,
      replacementValue: 420,
      includedAccessories: ["2 batérie", "nabíjačka", "držiak na prilbu", "malý statív"],
      excludedAccessories: ["microSD karta"],
      conditionCycle: ["new", "like_new", "very_good"],
      damageNotes: [null, "Na ráme okolo objektívu je malá kozmetická stopa."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.35,
      deliveryFeeCap: 12,
      deliveryRadiusKm: 12,
      illustration: "camera",
    },
    {
      title: "DJI Mini 3 Fly More Combo",
      description:
        "Ľahký dron na cestovanie, nehnuteľnosti a krátke video zábery v meste aj prírode.",
      pricePerDay: 36,
      replacementValue: 880,
      includedAccessories: ["3 batérie", "ovládač", "nabíjací hub", "taška"],
      excludedAccessories: ["microSD karta"],
      conditionCycle: ["new", "like_new", "very_good"],
      damageNotes: [null, "Na taške sú jemné stopy z prenášania."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.4,
      deliveryFeeCap: 14,
      deliveryRadiusKm: 14,
      illustration: "drone",
    },
  ],
  "Šport a voľný čas": [
    {
      title: "Paddleboard Aqua Marina Beast",
      description:
        "Stabilný paddleboard vhodný pre začiatočníkov aj rekreačné jazdenie na vode.",
      pricePerDay: 19,
      replacementValue: 380,
      includedAccessories: ["pumpa", "pádlo", "leash", "batoh"],
      excludedAccessories: [],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Na vaku sú jemné oderky od skladania."],
      deliveryMode: "mixed",
      deliveryRatePerKm: 0.5,
      deliveryFeeCap: 18,
      deliveryRadiusKm: 18,
      illustration: "board",
    },
    {
      title: "Kempingový stan pre 4 osoby Coleman",
      description:
        "Praktický rodinný stan na víkendové kempovanie, festival alebo letné výjazdy.",
      pricePerDay: 13,
      replacementValue: 240,
      includedAccessories: ["podlážka", "kolíky", "obal", "náhradné lanká"],
      excludedAccessories: ["nafukovacie matrace"],
      conditionCycle: ["very_good", "good", "acceptable"],
      damageNotes: [null, "Obal má jemné odreniny od prepravy."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.35,
      deliveryFeeCap: 12,
      deliveryRadiusKm: 12,
      illustration: "tent",
    },
    {
      title: "Detská cyklosedačka Thule Yepp 2",
      description:
        "Komfortná detská sedačka na mestské výjazdy, cyklocesty aj kratšie rodinné trasy.",
      pricePerDay: 9,
      replacementValue: 160,
      includedAccessories: ["montážny adaptér", "2 kľúče"],
      excludedAccessories: [],
      conditionCycle: ["new", "like_new", "very_good"],
      damageNotes: [null, "Na bočnici je drobná kozmetická stopa od skladovania."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.3,
      deliveryFeeCap: 10,
      deliveryRadiusKm: 10,
      illustration: "seat",
    },
    {
      title: "Nafukovací kajak Intex Excursion Pro",
      description:
        "Dvojmiestny nafukovací kajak na pokojnejšiu vodu, jazero alebo rodinné výlety.",
      pricePerDay: 21,
      replacementValue: 340,
      includedAccessories: ["2 pádla", "pumpa", "taška", "opravná sada"],
      excludedAccessories: ["záchranné vesty"],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Taška má mierne vyblednutý roh."],
      deliveryMode: "mixed",
      deliveryRatePerKm: 0.45,
      deliveryFeeCap: 16,
      deliveryRadiusKm: 16,
      illustration: "kayak",
    },
  ],
  "Dom a dielňa": [
    {
      title: "Tepovač Kärcher Puzzi 8/1",
      description:
        "Tepovací stroj na sedačky, matrace, autá a menšie koberce pri hĺbkovom čistení.",
      pricePerDay: 25,
      replacementValue: 640,
      includedAccessories: ["ručná hubica", "podlahová hubica", "čistiaca hadica"],
      excludedAccessories: ["čistiaca chémia"],
      conditionCycle: ["like_new", "very_good", "good"],
      damageNotes: [null, "Na kryte nádrže je drobná odrenina."],
      deliveryMode: "mixed",
      deliveryRatePerKm: 0.55,
      deliveryFeeCap: 18,
      deliveryRadiusKm: 18,
      illustration: "extractor",
    },
    {
      title: "Priemyselný vysávač Nilfisk Aero 26",
      description:
        "Suché aj mokré vysávanie do dielne, pri brúsení, v garáži alebo po menšej rekonštrukcii.",
      pricePerDay: 14,
      replacementValue: 260,
      includedAccessories: ["hadica", "štrbinový nadstavec", "podlahová hubica"],
      excludedAccessories: ["brúska"],
      conditionCycle: ["very_good", "good", "acceptable"],
      damageNotes: [null, "Na hadici sú bežné stopy po používaní."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.35,
      deliveryFeeCap: 12,
      deliveryRadiusKm: 12,
      illustration: "vacuum",
    },
    {
      title: "Rebrík Krause 3x11",
      description:
        "Hliníkový viacúčelový rebrík na maľovanie, fasádu, strechu aj práce v záhrade.",
      pricePerDay: 16,
      replacementValue: 290,
      includedAccessories: ["stabilizačná tyč"],
      excludedAccessories: [],
      conditionCycle: ["very_good", "good", "acceptable"],
      damageNotes: [null, "Na bočných profiloch sú bežné škrabance od skladania."],
      deliveryMode: "delivery_available",
      deliveryRatePerKm: 0.6,
      deliveryFeeCap: 22,
      deliveryRadiusKm: 22,
      illustration: "ladder",
    },
    {
      title: "Zváračka MIG/MAG Kühtreiber 200",
      description:
        "Invertorová zváračka vhodná do dielne, na brány, rámové konštrukcie a bežné opravy.",
      pricePerDay: 29,
      replacementValue: 760,
      includedAccessories: ["horák", "zemniaci kábel", "redukčný ventil"],
      excludedAccessories: ["plynová fľaša", "drôt"],
      conditionCycle: ["good", "very_good", "acceptable"],
      damageNotes: [null, "Na plechovom kryte sú viditeľné pracovné škrabance."],
      deliveryMode: "pickup_only",
      deliveryRatePerKm: 0.4,
      deliveryFeeCap: 14,
      deliveryRadiusKm: 14,
      illustration: "welder",
    },
  ],
};

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    let value = normalizedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\n/g, "\n");

    if (ORIGINAL_ENV_KEYS.has(key)) {
      continue;
    }

    process.env[key] = value;
  }
}

function loadLocalEnvFiles() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildSupabaseClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function parseArgs(argv) {
  let count = DEFAULT_COUNT;
  let clean = false;

  for (const arg of argv) {
    if (arg === "--clean") {
      clean = true;
      continue;
    }

    if (arg.startsWith("--count=")) {
      const rawCount = arg.slice("--count=".length);
      const parsedCount = Number(rawCount);

      if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
        throw new Error(`Invalid --count value: ${rawCount}`);
      }

      count = parsedCount;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return { count, clean };
}

async function listAllAuthUsers(supabase) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    const currentUsers = data.users ?? [];
    users.push(...currentUsers);

    if (!data.nextPage || currentUsers.length === 0) {
      break;
    }

    page = data.nextPage;
  }

  return users;
}

async function findDemoUser(supabase) {
  const users = await listAllAuthUsers(supabase);
  return (
    users.find((user) => (user.email ?? "").toLowerCase() === DEMO_EMAIL.toLowerCase()) ?? null
  );
}

async function ensureDemoUser(supabase, createIfMissing) {
  const existingUser = await findDemoUser(supabase);
  if (existingUser) {
    return { user: existingUser, created: false };
  }

  if (!createIfMissing) {
    return { user: null, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: `Rentulo-${randomUUID()}-demo`,
    email_confirm: true,
    user_metadata: {
      full_name: "Martin Kováč",
    },
  });

  if (error) {
    throw new Error(`Unable to create demo auth user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Demo auth user creation returned no user.");
  }

  return { user: data.user, created: true };
}

async function upsertDemoProfile(supabase, userId) {
  const profilePayload = {
    id: userId,
    role: "user",
    full_name: "Martin Kováč",
    city: "Bratislava",
    verification_status: "verified",
  };

  const { error } = await supabase.from("profiles").upsert(profilePayload, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(`Unable to upsert demo profile: ${error.message}`);
  }
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function cleanupDemoOwnerItems(supabase, ownerId) {
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("id")
    .eq("owner_id", ownerId);

  if (itemsError) {
    throw new Error(`Unable to load demo owner items: ${itemsError.message}`);
  }

  const itemIds = (items ?? []).map((item) => Number(item.id)).filter(Number.isFinite);
  if (itemIds.length === 0) {
    return {
      itemsDeleted: 0,
      blockedRangesDeleted: 0,
      imageRowsDeleted: 0,
      storageObjectsDeleted: 0,
    };
  }

  const { data: imageRows, error: imageRowsError } = await supabase
    .from("item_images")
    .select("id,path")
    .in("item_id", itemIds);

  if (imageRowsError) {
    throw new Error(`Unable to load item image rows: ${imageRowsError.message}`);
  }

  const storagePaths = Array.from(
    new Set(
      (imageRows ?? [])
        .map((row) => (typeof row.path === "string" ? row.path.trim() : ""))
        .filter(Boolean)
    )
  );

  let storageObjectsDeleted = 0;
  for (const storageChunk of chunk(storagePaths, 100)) {
    const { error } = await supabase.storage.from(ITEM_IMAGE_BUCKET).remove(storageChunk);
    if (error) {
      throw new Error(`Unable to remove stored SVG images: ${error.message}`);
    }
    storageObjectsDeleted += storageChunk.length;
  }

  const { data: deletedImageRows, error: deleteImageRowsError } = await supabase
    .from("item_images")
    .delete()
    .in("item_id", itemIds)
    .select("id");

  if (deleteImageRowsError) {
    throw new Error(`Unable to delete item image rows: ${deleteImageRowsError.message}`);
  }

  const { data: deletedBlockedRanges, error: deleteBlockedRangesError } = await supabase
    .from("item_blocked_ranges")
    .delete()
    .in("item_id", itemIds)
    .select("id");

  if (deleteBlockedRangesError) {
    throw new Error(`Unable to delete blocked ranges: ${deleteBlockedRangesError.message}`);
  }

  const { data: deletedItems, error: deleteItemsError } = await supabase
    .from("items")
    .delete()
    .eq("owner_id", ownerId)
    .select("id");

  if (deleteItemsError) {
    throw new Error(`Unable to delete demo items: ${deleteItemsError.message}`);
  }

  return {
    itemsDeleted: (deletedItems ?? []).length,
    blockedRangesDeleted: (deletedBlockedRanges ?? []).length,
    imageRowsDeleted: (deletedImageRows ?? []).length,
    storageObjectsDeleted,
  };
}

function formatList(values) {
  if (!values || values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} a ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")} a ${values[values.length - 1]}`;
}

function addDays(baseDate, daysToAdd) {
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
  return nextDate;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeCondition(template, index) {
  return template.conditionCycle[index % template.conditionCycle.length];
}

function normalizeKnownDamage(template, index, condition) {
  const note = template.damageNotes[index % template.damageNotes.length] ?? null;
  if (condition === "new") {
    return null;
  }
  return note;
}

function resolveDelivery(template, index) {
  const isDeliveryAvailable =
    template.deliveryMode === "delivery_available" ||
    (template.deliveryMode === "mixed" && index % 2 === 0);

  if (!isDeliveryAvailable) {
    return {
      mode: "pickup_only",
      ratePerKm: null,
      feeCap: null,
      maxRadiusKm: null,
    };
  }

  const priceOffset = Number((index % 3) * 0.05);
  return {
    mode: "delivery_available",
    ratePerKm: Number((template.deliveryRatePerKm + priceOffset).toFixed(2)),
    feeCap: Number((template.deliveryFeeCap + (index % 4) * 2).toFixed(2)),
    maxRadiusKm: template.deliveryRadiusKm + (index % 3) * 2,
  };
}

function buildAddress(city, index) {
  const street = city.streets[index % city.streets.length];
  const houseNumber = 6 + ((index * 7) % 48);
  const latitudeOffset = ((index % 5) - 2) * 0.0042 + ((Math.floor(index / 5) % 3) - 1) * 0.0013;
  const longitudeOffset =
    ((index % 7) - 3) * 0.0051 + ((Math.floor(index / 7) % 3) - 1) * 0.0011;

  return {
    streetAddress: `${street} ${houseNumber}`,
    postalCode: city.postalCodes[index % city.postalCodes.length],
    latitude: Number((city.latitude + latitudeOffset).toFixed(6)),
    longitude: Number((city.longitude + longitudeOffset).toFixed(6)),
  };
}

function buildBlockedRanges(index) {
  const today = new Date();
  const baseDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12, 0, 0)
  );

  const ranges = [];
  if (index % 3 === 0) {
    const startOffset = 6 + (index % 15);
    const length = 1 + (index % 4);
    ranges.push({
      dateFrom: formatDateOnly(addDays(baseDate, startOffset)),
      dateTo: formatDateOnly(addDays(baseDate, startOffset + length)),
    });
  }

  if (index % 10 === 0) {
    const startOffset = 36 + (index % 18);
    const length = 2 + (index % 3);
    ranges.push({
      dateFrom: formatDateOnly(addDays(baseDate, startOffset)),
      dateTo: formatDateOnly(addDays(baseDate, startOffset + length)),
    });
  }

  return ranges;
}

function buildDescription({ template, city, condition, delivery, knownDamage, index }) {
  const pieces = [
    template.description,
    CONDITION_SENTENCES[condition],
    template.includedAccessories.length > 0
      ? `K dispozícii je ${formatList(template.includedAccessories)}.`
      : null,
    template.excludedAccessories.length > 0
      ? `Súčasťou výpožičky nie je ${formatList(template.excludedAccessories)}.`
      : null,
    delivery.mode === "delivery_available"
      ? `Po dohode viem zabezpečiť doručenie v rámci okolia mesta ${city.name}.`
      : `Osobný odber riešim v rámci mesta ${city.name}.`,
    knownDamage ? `Známe opotrebenie: ${knownDamage}` : null,
    HANDOVER_NOTES[index % HANDOVER_NOTES.length],
  ];

  return pieces.filter(Boolean).join(" ");
}

function buildListing(index) {
  const city = CITY_CATALOG[index % CITY_CATALOG.length];
  const category = CATEGORIES[index % CATEGORIES.length];
  const categoryTemplates = CATEGORY_TEMPLATES[category];
  const template = categoryTemplates[Math.floor(index / CATEGORIES.length) % categoryTemplates.length];
  const address = buildAddress(city, index);
  const condition = normalizeCondition(template, index);
  const knownDamage = normalizeKnownDamage(template, index, condition);
  const delivery = resolveDelivery(template, index);
  const pricePerDay = template.pricePerDay + (index % 3);
  const replacementValue = template.replacementValue + (index % 5) * 10;

  return {
    title: template.title,
    category,
    city: city.name,
    streetAddress: address.streetAddress,
    postalCode: address.postalCode,
    latitude: address.latitude,
    longitude: address.longitude,
    pricePerDay,
    condition,
    includedAccessories: template.includedAccessories,
    excludedAccessories: template.excludedAccessories,
    knownDamage,
    replacementValue,
    delivery,
    blockedRanges: buildBlockedRanges(index),
    illustration: template.illustration,
    description: buildDescription({
      template,
      city,
      condition,
      delivery,
      knownDamage,
      index,
    }),
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value, maxChars) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || current.length === 0) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
}

function truncateText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function buildIllustration(key, palette) {
  switch (key) {
    case "drill":
      return `
        <rect x="120" y="150" width="220" height="88" rx="24" fill="${palette.surface}" opacity="0.92" />
        <rect x="252" y="208" width="48" height="118" rx="18" fill="${palette.accent}" />
        <rect x="334" y="176" width="92" height="34" rx="16" fill="${palette.surface}" opacity="0.9" />
        <rect x="424" y="186" width="86" height="12" rx="6" fill="${palette.accent}" />
      `;
    case "hammer":
      return `
        <rect x="140" y="118" width="210" height="70" rx="22" fill="${palette.surface}" opacity="0.94" />
        <rect x="220" y="184" width="46" height="174" rx="18" fill="${palette.accent}" />
        <rect x="138" y="98" width="90" height="28" rx="14" fill="${palette.accent}" />
      `;
    case "laser":
      return `
        <rect x="162" y="132" width="144" height="128" rx="28" fill="${palette.surface}" opacity="0.94" />
        <circle cx="234" cy="196" r="22" fill="${palette.accent}" />
        <line x1="234" y1="262" x2="188" y2="344" stroke="${palette.surface}" stroke-width="10" stroke-linecap="round" />
        <line x1="234" y1="262" x2="280" y2="344" stroke="${palette.surface}" stroke-width="10" stroke-linecap="round" />
      `;
    case "saw":
      return `
        <rect x="150" y="142" width="196" height="122" rx="28" fill="${palette.surface}" opacity="0.94" />
        <path d="M332 216 L422 188 L422 242 L332 274 Z" fill="${palette.accent}" />
        <rect x="196" y="118" width="80" height="44" rx="18" fill="${palette.accent}" />
      `;
    case "mower":
      return `
        <rect x="140" y="188" width="190" height="84" rx="24" fill="${palette.surface}" opacity="0.94" />
        <circle cx="182" cy="286" r="28" fill="${palette.accent}" />
        <circle cx="306" cy="286" r="28" fill="${palette.accent}" />
        <line x1="310" y1="182" x2="372" y2="104" stroke="${palette.surface}" stroke-width="12" stroke-linecap="round" />
      `;
    case "chainsaw":
      return `
        <rect x="142" y="160" width="170" height="106" rx="28" fill="${palette.surface}" opacity="0.94" />
        <rect x="306" y="186" width="148" height="34" rx="16" fill="${palette.accent}" />
        <rect x="182" y="118" width="72" height="34" rx="16" fill="${palette.accent}" />
      `;
    case "rake":
      return `
        <rect x="214" y="114" width="18" height="246" rx="9" fill="${palette.surface}" opacity="0.94" />
        <rect x="146" y="118" width="154" height="34" rx="16" fill="${palette.accent}" />
        <line x1="164" y1="146" x2="164" y2="222" stroke="${palette.surface}" stroke-width="8" stroke-linecap="round" />
        <line x1="194" y1="146" x2="194" y2="222" stroke="${palette.surface}" stroke-width="8" stroke-linecap="round" />
        <line x1="224" y1="146" x2="224" y2="222" stroke="${palette.surface}" stroke-width="8" stroke-linecap="round" />
        <line x1="254" y1="146" x2="254" y2="222" stroke="${palette.surface}" stroke-width="8" stroke-linecap="round" />
        <line x1="284" y1="146" x2="284" y2="222" stroke="${palette.surface}" stroke-width="8" stroke-linecap="round" />
      `;
    case "sprayer":
      return `
        <rect x="170" y="122" width="140" height="194" rx="32" fill="${palette.surface}" opacity="0.94" />
        <rect x="204" y="94" width="70" height="34" rx="14" fill="${palette.accent}" />
        <line x1="310" y1="154" x2="402" y2="114" stroke="${palette.surface}" stroke-width="10" stroke-linecap="round" />
        <circle cx="408" cy="112" r="10" fill="${palette.accent}" />
      `;
    case "plate":
      return `
        <rect x="144" y="214" width="208" height="86" rx="18" fill="${palette.surface}" opacity="0.94" />
        <line x1="196" y1="210" x2="152" y2="128" stroke="${palette.surface}" stroke-width="14" stroke-linecap="round" />
        <line x1="240" y1="210" x2="286" y2="130" stroke="${palette.surface}" stroke-width="14" stroke-linecap="round" />
        <rect x="274" y="112" width="52" height="28" rx="12" fill="${palette.accent}" />
      `;
    case "mixer":
      return `
        <circle cx="230" cy="192" r="74" fill="${palette.surface}" opacity="0.94" />
        <line x1="184" y1="252" x2="146" y2="344" stroke="${palette.surface}" stroke-width="12" stroke-linecap="round" />
        <line x1="276" y1="252" x2="314" y2="344" stroke="${palette.surface}" stroke-width="12" stroke-linecap="round" />
        <rect x="130" y="170" width="50" height="18" rx="9" fill="${palette.accent}" />
      `;
    case "dryer":
      return `
        <rect x="158" y="108" width="176" height="228" rx="34" fill="${palette.surface}" opacity="0.94" />
        <circle cx="246" cy="196" r="44" fill="${palette.accent}" />
        <rect x="210" y="278" width="72" height="18" rx="9" fill="${palette.accent}" />
      `;
    case "cutter":
      return `
        <rect x="120" y="228" width="256" height="70" rx="20" fill="${palette.surface}" opacity="0.94" />
        <rect x="174" y="142" width="154" height="68" rx="20" fill="${palette.accent}" />
        <circle cx="340" cy="192" r="34" fill="${palette.surface}" opacity="0.94" />
      `;
    case "roofbox":
      return `
        <path d="M126 220 C160 146, 352 146, 422 214 L410 250 C326 280, 192 284, 118 250 Z" fill="${palette.surface}" opacity="0.94" />
        <rect x="186" y="250" width="170" height="14" rx="7" fill="${palette.accent}" />
      `;
    case "booster":
      return `
        <rect x="156" y="128" width="176" height="212" rx="36" fill="${palette.surface}" opacity="0.94" />
        <circle cx="244" cy="194" r="22" fill="${palette.accent}" />
        <path d="M332 250 C372 250, 380 306, 422 306" stroke="${palette.accent}" stroke-width="12" fill="none" stroke-linecap="round" />
      `;
    case "bike-rack":
      return `
        <rect x="152" y="158" width="50" height="170" rx="18" fill="${palette.surface}" opacity="0.94" />
        <rect x="216" y="158" width="50" height="170" rx="18" fill="${palette.surface}" opacity="0.94" />
        <line x1="266" y1="200" x2="382" y2="162" stroke="${palette.accent}" stroke-width="12" stroke-linecap="round" />
        <circle cx="390" cy="160" r="18" fill="${palette.accent}" />
      `;
    case "scanner":
      return `
        <rect x="166" y="118" width="154" height="228" rx="30" fill="${palette.surface}" opacity="0.94" />
        <rect x="198" y="158" width="90" height="92" rx="18" fill="${palette.accent}" />
        <line x1="244" y1="344" x2="244" y2="382" stroke="${palette.surface}" stroke-width="12" stroke-linecap="round" />
      `;
    case "projector":
      return `
        <rect x="126" y="170" width="240" height="120" rx="28" fill="${palette.surface}" opacity="0.94" />
        <circle cx="304" cy="230" r="34" fill="${palette.accent}" />
        <rect x="156" y="204" width="72" height="18" rx="9" fill="${palette.accent}" />
      `;
    case "speaker":
      return `
        <rect x="176" y="96" width="136" height="268" rx="34" fill="${palette.surface}" opacity="0.94" />
        <circle cx="244" cy="172" r="26" fill="${palette.accent}" />
        <circle cx="244" cy="252" r="40" fill="${palette.accent}" />
      `;
    case "camera":
      return `
        <rect x="152" y="154" width="196" height="128" rx="28" fill="${palette.surface}" opacity="0.94" />
        <circle cx="250" cy="218" r="38" fill="${palette.accent}" />
        <rect x="188" y="130" width="64" height="34" rx="14" fill="${palette.accent}" />
      `;
    case "drone":
      return `
        <circle cx="244" cy="204" r="34" fill="${palette.surface}" opacity="0.94" />
        <line x1="210" y1="172" x2="156" y2="128" stroke="${palette.surface}" stroke-width="12" stroke-linecap="round" />
        <line x1="278" y1="172" x2="332" y2="128" stroke="${palette.surface}" stroke-width="12" stroke-linecap="round" />
        <line x1="210" y1="236" x2="156" y2="280" stroke="${palette.surface}" stroke-width="12" stroke-linecap="round" />
        <line x1="278" y1="236" x2="332" y2="280" stroke="${palette.surface}" stroke-width="12" stroke-linecap="round" />
        <circle cx="146" cy="120" r="20" fill="${palette.accent}" />
        <circle cx="342" cy="120" r="20" fill="${palette.accent}" />
        <circle cx="146" cy="288" r="20" fill="${palette.accent}" />
        <circle cx="342" cy="288" r="20" fill="${palette.accent}" />
      `;
    case "board":
      return `
        <path d="M232 92 C288 122, 300 320, 232 364 C164 320, 176 122, 232 92 Z" fill="${palette.surface}" opacity="0.94" />
        <rect x="218" y="130" width="28" height="194" rx="14" fill="${palette.accent}" />
      `;
    case "tent":
      return `
        <path d="M144 320 L244 138 L344 320 Z" fill="${palette.surface}" opacity="0.94" />
        <path d="M188 320 L244 200 L300 320 Z" fill="${palette.accent}" />
      `;
    case "seat":
      return `
        <rect x="176" y="120" width="124" height="196" rx="34" fill="${palette.surface}" opacity="0.94" />
        <rect x="208" y="286" width="60" height="58" rx="18" fill="${palette.accent}" />
        <circle cx="214" cy="174" r="18" fill="${palette.accent}" />
      `;
    case "kayak":
      return `
        <path d="M118 236 C156 180, 336 180, 390 236 C336 292, 156 292, 118 236 Z" fill="${palette.surface}" opacity="0.94" />
        <line x1="210" y1="170" x2="278" y2="304" stroke="${palette.accent}" stroke-width="12" stroke-linecap="round" />
        <line x1="278" y1="170" x2="210" y2="304" stroke="${palette.accent}" stroke-width="12" stroke-linecap="round" />
      `;
    case "extractor":
      return `
        <rect x="162" y="128" width="144" height="182" rx="30" fill="${palette.surface}" opacity="0.94" />
        <circle cx="202" cy="324" r="22" fill="${palette.accent}" />
        <circle cx="268" cy="324" r="22" fill="${palette.accent}" />
        <path d="M308 214 C360 214, 358 272, 410 272" stroke="${palette.accent}" stroke-width="12" fill="none" stroke-linecap="round" />
      `;
    case "vacuum":
      return `
        <circle cx="230" cy="218" r="74" fill="${palette.surface}" opacity="0.94" />
        <path d="M296 204 C356 204, 360 286, 424 286" stroke="${palette.accent}" stroke-width="12" fill="none" stroke-linecap="round" />
        <circle cx="198" cy="294" r="20" fill="${palette.accent}" />
        <circle cx="262" cy="294" r="20" fill="${palette.accent}" />
      `;
    case "ladder":
      return `
        <line x1="176" y1="98" x2="146" y2="348" stroke="${palette.surface}" stroke-width="14" stroke-linecap="round" />
        <line x1="286" y1="98" x2="316" y2="348" stroke="${palette.surface}" stroke-width="14" stroke-linecap="round" />
        <line x1="164" y1="144" x2="298" y2="144" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round" />
        <line x1="158" y1="198" x2="304" y2="198" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round" />
        <line x1="152" y1="252" x2="310" y2="252" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round" />
        <line x1="146" y1="306" x2="316" y2="306" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round" />
      `;
    case "welder":
      return `
        <rect x="150" y="156" width="188" height="140" rx="30" fill="${palette.surface}" opacity="0.94" />
        <circle cx="192" cy="308" r="24" fill="${palette.accent}" />
        <circle cx="298" cy="308" r="24" fill="${palette.accent}" />
        <path d="M338 210 C378 210, 388 286, 430 286" stroke="${palette.accent}" stroke-width="12" fill="none" stroke-linecap="round" />
      `;
    default:
      return `
        <rect x="146" y="126" width="204" height="190" rx="36" fill="${palette.surface}" opacity="0.94" />
        <circle cx="248" cy="220" r="42" fill="${palette.accent}" />
      `;
  }
}

function buildHeroSvg(listing) {
  const palette = CATEGORY_PALETTES[listing.category];
  const titleLines = wrapText(listing.title, 24);
  const priceLabel = `${listing.pricePerDay} € / deň`;
  const deliveryLabel =
    listing.delivery.mode === "delivery_available" ? "Doručenie dostupné" : "Osobný odber";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200" role="img" aria-label="${escapeXml(
    listing.title
  )}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bgA}" />
      <stop offset="100%" stop-color="${palette.bgB}" />
    </linearGradient>
  </defs>
  <rect width="1600" height="1200" fill="url(#bg)" />
  <circle cx="1340" cy="210" r="180" fill="${palette.accent}" opacity="0.12" />
  <circle cx="240" cy="1010" r="220" fill="${palette.accent}" opacity="0.12" />
  <rect x="80" y="90" width="1440" height="1020" rx="64" fill="#0b1220" opacity="0.18" />
  <rect x="120" y="130" width="640" height="940" rx="56" fill="#ffffff" opacity="0.08" />
  ${buildIllustration(listing.illustration, palette)}
  <rect x="840" y="160" width="620" height="880" rx="48" fill="#ffffff" opacity="0.12" />
  <rect x="900" y="228" width="220" height="56" rx="28" fill="${palette.accent}" opacity="0.96" />
  <text x="1010" y="264" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a" text-anchor="middle">${escapeXml(
    listing.category
  )}</text>
  ${titleLines
    .map(
      (line, index) =>
        `<text x="900" y="${392 + index * 82}" font-size="68" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${escapeXml(
          line
        )}</text>`
    )
    .join("")}
  <text x="900" y="640" font-size="34" font-family="Arial, sans-serif" fill="#dbeafe">${escapeXml(
    listing.city
  )}</text>
  <text x="900" y="714" font-size="54" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${escapeXml(
    priceLabel
  )}</text>
  <text x="900" y="792" font-size="30" font-family="Arial, sans-serif" fill="#e2e8f0">${escapeXml(
    CONDITION_LABELS[listing.condition]
  )}</text>
  <text x="900" y="848" font-size="30" font-family="Arial, sans-serif" fill="#e2e8f0">${escapeXml(
    deliveryLabel
  )}</text>
  <text x="900" y="964" font-size="26" font-family="Arial, sans-serif" fill="#cbd5e1">${escapeXml(
    truncateText(listing.description, 94)
  )}</text>
</svg>`;
}

function buildDetailSvg(listing) {
  const palette = CATEGORY_PALETTES[listing.category];
  const chips = listing.includedAccessories.slice(0, 3);
  const descriptionLine = truncateText(listing.description, 120);
  const valueLabel = `Hodnota ${listing.replacementValue} €`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200" role="img" aria-label="${escapeXml(
    `${listing.title} detail`
  )}">
  <defs>
    <linearGradient id="detailBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.surface}" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
  </defs>
  <rect width="1600" height="1200" fill="url(#detailBg)" />
  <rect x="88" y="96" width="1424" height="1008" rx="60" fill="#0f172a" opacity="0.06" />
  <rect x="132" y="144" width="512" height="912" rx="48" fill="${palette.bgA}" />
  <rect x="176" y="188" width="424" height="824" rx="40" fill="${palette.bgB}" opacity="0.28" />
  ${buildIllustration(listing.illustration, palette)}
  <text x="724" y="248" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="${palette.bgB}">${escapeXml(
    listing.category
  )}</text>
  ${wrapText(listing.title, 32)
    .map(
      (line, index) =>
        `<text x="724" y="${330 + index * 64}" font-size="54" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">${escapeXml(
          line
        )}</text>`
    )
    .join("")}
  <text x="724" y="540" font-size="28" font-family="Arial, sans-serif" fill="#334155">${escapeXml(
    descriptionLine
  )}</text>
  <rect x="724" y="620" width="244" height="54" rx="27" fill="${palette.bgB}" />
  <text x="846" y="656" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeXml(
    CONDITION_LABELS[listing.condition]
  )}</text>
  <rect x="988" y="620" width="234" height="54" rx="27" fill="${palette.accent}" />
  <text x="1105" y="656" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a" text-anchor="middle">${escapeXml(
    valueLabel
  )}</text>
  <text x="724" y="756" font-size="30" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">Príslušenstvo</text>
  ${chips
    .map((chip, index) => {
      const x = 724 + (index % 2) * 252;
      const y = 804 + Math.floor(index / 2) * 74;
      return `
        <rect x="${x}" y="${y - 34}" width="226" height="50" rx="25" fill="${palette.surface}" stroke="${palette.bgB}" stroke-opacity="0.16" />
        <text x="${x + 20}" y="${y}" font-size="24" font-family="Arial, sans-serif" fill="#1e293b">${escapeXml(
          truncateText(chip, 22)
        )}</text>
      `;
    })
    .join("")}
  <text x="724" y="980" font-size="30" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">Mesto</text>
  <text x="724" y="1030" font-size="28" font-family="Arial, sans-serif" fill="#334155">${escapeXml(
    listing.city
  )}</text>
  <text x="1020" y="1030" font-size="28" font-family="Arial, sans-serif" fill="#334155">${escapeXml(
    `${listing.pricePerDay} € / deň`
  )}</text>
</svg>`;
}

function buildImageVariants(listing) {
  return [
    { pathSuffix: "cover", svg: buildHeroSvg(listing) },
    { pathSuffix: "detail", svg: buildDetailSvg(listing) },
  ];
}

async function createItemWithLocation(supabase, ownerId, listing) {
  const { data, error } = await supabase.rpc("create_item_with_location", {
    p_owner_id: ownerId,
    p_title: listing.title,
    p_description: listing.description,
    p_price_per_day: listing.pricePerDay,
    p_city: listing.city,
    p_postal_code: listing.postalCode,
    p_is_active: true,
    p_street_address: listing.streetAddress,
    p_latitude: listing.latitude,
    p_longitude: listing.longitude,
  });

  if (error) {
    throw new Error(`create_item_with_location failed for "${listing.title}": ${error.message}`);
  }

  const itemId = Number(data);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new Error(`create_item_with_location returned invalid item id for "${listing.title}".`);
  }

  return itemId;
}

async function updateListingFields(supabase, itemId, ownerId, listing) {
  const { data, error } = await supabase
    .from("items")
    .update({
      category: listing.category,
      condition: listing.condition,
      included_accessories: listing.includedAccessories,
      excluded_accessories: listing.excludedAccessories,
      known_damage: listing.knownDamage,
      replacement_value: listing.replacementValue,
    })
    .eq("id", itemId)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to update item fields for "${listing.title}": ${error.message}`);
  }

  if (!data) {
    throw new Error(`Updated item row was not returned for "${listing.title}".`);
  }
}

async function updateDeliveryConfig(supabase, itemId, listing) {
  const { error } = await supabase.rpc("item_delivery_config_update", {
    p_item_id: itemId,
    p_delivery_mode: listing.delivery.mode,
    p_delivery_rate_per_km: listing.delivery.ratePerKm,
    p_delivery_fee_cap: listing.delivery.feeCap,
    p_delivery_max_radius_km: listing.delivery.maxRadiusKm,
  });

  if (error) {
    throw new Error(`item_delivery_config_update failed for "${listing.title}": ${error.message}`);
  }
}

async function createBlockedRanges(supabase, itemId, listing) {
  for (const blockedRange of listing.blockedRanges) {
    const { error } = await supabase.rpc("item_blocked_range_create", {
      p_item_id: itemId,
      p_date_from: blockedRange.dateFrom,
      p_date_to: blockedRange.dateTo,
    });

    if (error) {
      throw new Error(`item_blocked_range_create failed for "${listing.title}": ${error.message}`);
    }
  }
}

async function uploadGeneratedImages(supabase, ownerId, itemId, listing) {
  const variants = buildImageVariants(listing);

  for (let position = 0; position < variants.length; position += 1) {
    const variant = variants[position];
    const pathValue = `${ownerId}/${itemId}/${variant.pathSuffix}.svg`;

    const { error: uploadError } = await supabase.storage
      .from(ITEM_IMAGE_BUCKET)
      .upload(pathValue, Buffer.from(variant.svg, "utf8"), {
        contentType: "image/svg+xml",
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Unable to upload SVG for "${listing.title}": ${uploadError.message}`);
    }

    const { error: imageRowError } = await supabase.from("item_images").insert({
      owner_id: ownerId,
      item_id: itemId,
      path: pathValue,
      position,
      is_primary: position === 0,
    });

    if (imageRowError) {
      throw new Error(`Unable to insert item_images row for "${listing.title}": ${imageRowError.message}`);
    }
  }

  return variants.length;
}

async function seedListings(supabase, ownerId, count) {
  let createdItems = 0;
  let uploadedImages = 0;
  let createdBlockedRanges = 0;

  for (let index = 0; index < count; index += 1) {
    const listing = buildListing(index);
    console.log(`[${index + 1}/${count}] Creating ${listing.title} (${listing.city})`);

    const itemId = await createItemWithLocation(supabase, ownerId, listing);
    await updateListingFields(supabase, itemId, ownerId, listing);
    await updateDeliveryConfig(supabase, itemId, listing);
    await createBlockedRanges(supabase, itemId, listing);
    uploadedImages += await uploadGeneratedImages(supabase, ownerId, itemId, listing);

    createdItems += 1;
    createdBlockedRanges += listing.blockedRanges.length;
  }

  return {
    createdItems,
    uploadedImages,
    createdBlockedRanges,
  };
}

function isDirectRun() {
  const entryFile = process.argv[1];
  if (!entryFile) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryFile).href;
}

async function main() {
  loadLocalEnvFiles();
  const { count, clean } = parseArgs(process.argv.slice(2));
  const supabase = buildSupabaseClient();

  const { user, created } = await ensureDemoUser(supabase, !clean);
  if (!user) {
    console.log(`No auth user found for ${DEMO_EMAIL}. Nothing to clean.`);
    return;
  }

  if (created) {
    console.log(`Created demo auth user ${DEMO_EMAIL}.`);
  } else {
    console.log(`Reusing demo auth user ${DEMO_EMAIL}.`);
  }

  await upsertDemoProfile(supabase, user.id);
  const cleanupSummary = await cleanupDemoOwnerItems(supabase, user.id);

  console.log(
    `Cleanup finished: ${cleanupSummary.itemsDeleted} items, ${cleanupSummary.blockedRangesDeleted} blocked ranges, ${cleanupSummary.imageRowsDeleted} image rows, ${cleanupSummary.storageObjectsDeleted} storage objects.`
  );

  if (clean) {
    return;
  }

  const seedSummary = await seedListings(supabase, user.id, count);
  console.log(
    `Seed finished: ${seedSummary.createdItems} items, ${seedSummary.uploadedImages} SVG images, ${seedSummary.createdBlockedRanges} blocked ranges.`
  );
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

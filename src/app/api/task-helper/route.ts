import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PlannedTask = {
  task_title: string;
  summary: string;
  difficulty: string;
  steps: string[];
  required_tools: string[];
  optional_tools: string[];
  safety_tips: string[];
  search_keywords: string[];
};

type ItemRow = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number | null;
  city: string | null;
  category: string | null;
  is_active: boolean | null;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function planTask(rawTask: string): PlannedTask {
  const task = normalize(rawTask);

  if (task.includes("odtok") || task.includes("sifon") || task.includes("upchat")) {
    return {
      task_title: "Vyčistenie odtoku",
      summary: "Jednoduchý postup na vyčistenie odtoku alebo sifónu bez zbytočného chaosu.",
      difficulty: "ľahké",
      steps: [
        "Priprav vedro a handru pod sifón alebo odtok.",
        "Rozober sifón alebo otvor kryt odtoku.",
        "Odstráň nánosy, vlasy a usadeniny.",
        "Prepláchni diely vodou a skontroluj tesnenia.",
        "Všetko zlož späť a otestuj odtok vodou."
      ],
      required_tools: ["Vedro", "Rukavice", "Handra", "Siko kliešte alebo kľúč"],
      optional_tools: ["Špirála na potrubie", "Čistič odtoku", "Malá sada náradia"],
      safety_tips: [
        "Použi rukavice.",
        "Pri chemickom čističi nemiešaj rôzne prípravky.",
        "Daj pozor na tesnenia pri skladaní."
      ],
      search_keywords: ["siko kliešte", "špirála na potrubie", "inštalatérske náradie", "vedro", "sada náradia"]
    };
  }

  if (task.includes("polick") || task.includes("navrt") || task.includes("vrtat") || task.includes("vrtack")) {
    return {
      task_title: "Navŕtanie poličky",
      summary: "Postup na uchytenie poličky rovno a bezpečne.",
      difficulty: "stredné",
      steps: [
        "Zmeraj miesto a označ body na vŕtanie.",
        "Skontroluj rovinu a správne rozostupy.",
        "Vyber vhodný vrták podľa steny.",
        "Navŕtaj otvory a vlož hmoždinky.",
        "Pripevni držiaky alebo poličku a skontroluj pevnosť."
      ],
      required_tools: ["Vŕtačka", "Vrtáky", "Hmoždinky", "Skrutky", "Vodováha", "Meter"],
      optional_tools: ["Aku skrutkovač", "Detektor káblov", "Ceruzka"],
      safety_tips: [
        "Pred vŕtaním si over, či v stene nie sú káble alebo potrubie.",
        "Použi správny vrták na betón, tehlu alebo sadrokartón.",
        "Nedávaj príliš veľkú záťaž na slabé uchytenie."
      ],
      search_keywords: ["vŕtačka", "aku skrutkovač", "vrtáky", "vodováha", "sada náradia"]
    };
  }

  if (task.includes("trava") || task.includes("pokosit") || task.includes("kosit")) {
    return {
      task_title: "Pokosenie trávy",
      summary: "Krátky checklist na pokosenie trávnika a dočistenie okrajov.",
      difficulty: "ľahké",
      steps: [
        "Skontroluj plochu a odprat z nej kamene alebo konáre.",
        "Nastav vhodnú výšku kosenia.",
        "Pokos trávnik po pásoch.",
        "Dokonči okraje krovinorezom alebo vyžínačom.",
        "Vyčisti stroj a pracovné miesto."
      ],
      required_tools: ["Kosačka", "Predlžovací kábel alebo batéria", "Rukavice"],
      optional_tools: ["Vyžínač", "Fúkač lístia", "Zberný kôš"],
      safety_tips: [
        "Nekos mokrú trávu, ak sa tomu dá vyhnúť.",
        "Dávaj pozor na kamene a tvrdé predmety.",
        "Použi pevnú obuv."
      ],
      search_keywords: ["kosačka", "vyžínač", "záhradné náradie", "fúkač lístia"]
    };
  }

  if (task.includes("stenu") || task.includes("malovat") || task.includes("malba") || task.includes("natriet")) {
    return {
      task_title: "Maľovanie steny",
      summary: "Základný postup, aby si nezabudol na prípravu ani na dôležité pomôcky.",
      difficulty: "stredné",
      steps: [
        "Zakry podlahu a nábytok.",
        "Očisti stenu a oprav väčšie nerovnosti.",
        "Oblep hrany páskou.",
        "Nanášaj farbu valčekom a detaily štetcom.",
        "Nechaj zaschnúť a podľa potreby daj druhú vrstvu."
      ],
      required_tools: ["Valček", "Štetec", "Maliarska páska", "Fólia", "Vedro alebo vanička"],
      optional_tools: ["Brúska", "Rebrík", "Miešadlo na farbu"],
      safety_tips: [
        "Vetraj miestnosť.",
        "Zakry zásuvky a citlivé povrchy.",
        "Na vyššie miesta používaj stabilný rebrík."
      ],
      search_keywords: ["rebrík", "brúska", "maliarske náradie", "valček", "ručné náradie"]
    };
  }

  return {
    task_title: "Návrh postupu pre tvoju úlohu",
    summary: "Pripravil som univerzálny checklist a pokúsil som sa nájsť vhodné veci z ponúk.",
    difficulty: "stredné",
    steps: [
      "Rozdeľ si úlohu na prípravu, realizáciu a dokončenie.",
      "Skontroluj miesto práce a priprav si náradie dopredu.",
      "Vyber vhodné náradie podľa materiálu a typu práce.",
      "Po dokončení skontroluj výsledok a uprac pracovné miesto."
    ],
    required_tools: ["Základná sada náradia", "Rukavice", "Meranie alebo kontrola roviny podľa potreby"],
    optional_tools: ["Aku náradie", "Rebrík", "Ochranné pomôcky navyše"],
    safety_tips: [
      "Použi vhodné ochranné pomôcky.",
      "Pred prácou skontroluj stav náradia.",
      "Pri elektrickom náradí dávaj pozor na káble a stabilitu."
    ],
    search_keywords: uniqueStrings(
      rawTask
        .split(/[,.;]/)
        .flatMap((part) => part.split(" "))
        .map((part) => part.trim())
        .filter((part) => part.length >= 3)
        .concat(["sada náradia", "aku náradie", "ručné náradie"])
    )
  };
}

function scoreItem(item: ItemRow, keywords: string[]) {
  const haystack = normalize(
    [item.title, item.description, item.category, item.city].filter(Boolean).join(" ")
  );

  let score = 0;

  for (const keyword of keywords) {
    const needle = normalize(keyword);
    if (!needle) continue;

    if (haystack.includes(needle)) score += 5;

    const needleWords = needle.split(" ").filter(Boolean);
    for (const word of needleWords) {
      if (word.length >= 3 && haystack.includes(word)) score += 2;
    }
  }

  return score;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawTask = typeof body?.task === "string" ? body.task.trim() : "";

    if (!rawTask) {
      return NextResponse.json({ error: "Chýba text úlohy." }, { status: 400 });
    }

    const planned = planTask(rawTask);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("items")
      .select("id,title,description,price_per_day,city,category,is_active")
      .eq("is_active", true)
      .limit(150);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = ((data ?? []) as ItemRow[])
      .map((item) => ({
        id: item.id,
        title: item.title,
        price_per_day: item.price_per_day ?? null,
        city: item.city ?? null,
        category: item.category ?? null,
        score: scoreItem(item, planned.search_keywords),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return NextResponse.json({
      ...planned,
      suggested_items: items,
    });
  } catch {
    return NextResponse.json({ error: "Interná chyba." }, { status: 500 });
  }
}
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

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(normalize(needle)));
}

function scoreItem(item: ItemRow, keywords: string[]) {
  const title = normalize(item.title || "");
  const description = normalize(item.description || "");
  const category = normalize(item.category || "");
  const city = normalize(item.city || "");
  const full = `${title} ${description} ${category} ${city}`;

  let score = 0;

  for (const keywordRaw of keywords) {
    const keyword = normalize(keywordRaw);
    if (!keyword) continue;

    if (title.includes(keyword)) score += 12;
    if (category.includes(keyword)) score += 10;
    if (description.includes(keyword)) score += 6;

    const words = keyword.split(" ").filter((w) => w.length >= 3);
    for (const word of words) {
      if (title.includes(word)) score += 4;
      if (category.includes(word)) score += 3;
      if (description.includes(word)) score += 2;
      if (full.includes(word)) score += 1;
    }
  }

  return score;
}

function planTask(rawTask: string): PlannedTask {
  const task = normalize(rawTask);

  if (includesAny(task, ["odtok", "sifon", "upchat", "upchaty odtok"])) {
    return {
      task_title: "Vyčistenie odtoku",
      summary: "Postup a veci, ktoré sa ti na to pravdepodobne zídu.",
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
      safety_tips: ["Použi rukavice.", "Daj pozor na tesnenia pri skladaní."],
      search_keywords: ["siko kliešte", "špirála na potrubie", "inštalatérske náradie", "čistič odtoku"],
    };
  }

  if (includesAny(task, ["polick", "navrt", "vrtat", "vrtack"])) {
    return {
      task_title: "Navŕtanie poličky",
      summary: "Základný postup a potrebné veci na uchytenie poličky.",
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
      safety_tips: ["Pred vŕtaním si over, či v stene nie sú káble alebo potrubie."],
      search_keywords: ["vŕtačka", "aku skrutkovač", "vrtáky", "vodováha"],
    };
  }

  if (includesAny(task, ["trava", "pokosit", "kosit", "kosa"])) {
    return {
      task_title: "Pokosenie trávy",
      summary: "Krátky checklist na pokosenie trávnika.",
      difficulty: "ľahké",
      steps: [
        "Skontroluj plochu a odprat z nej kamene alebo konáre.",
        "Nastav vhodnú výšku kosenia.",
        "Pokos trávnik po pásoch.",
        "Dokonči okraje vyžínačom.",
        "Vyčisti stroj a pracovné miesto."
      ],
      required_tools: ["Kosačka", "Predlžovací kábel alebo batéria", "Rukavice"],
      optional_tools: ["Vyžínač", "Fúkač lístia", "Zberný kôš"],
      safety_tips: ["Použi pevnú obuv."],
      search_keywords: ["kosačka", "vyžínač", "záhradné náradie", "fúkač lístia"],
    };
  }

  if (includesAny(task, ["stenu", "malovat", "malba", "natriet"])) {
    return {
      task_title: "Maľovanie steny",
      summary: "Základný postup a veci, ktoré si priprav.",
      difficulty: "stredné",
      steps: [
        "Zakry podlahu a nábytok.",
        "Očisti stenu a oprav väčšie nerovnosti.",
        "Oblep hrany páskou.",
        "Nanášaj farbu valčekom a detaily štetcom.",
        "Nechaj zaschnúť a podľa potreby daj druhú vrstvu."
      ],
      required_tools: ["Valček", "Štetec", "Maliarska páska", "Fólia", "Vanička"],
      optional_tools: ["Brúska", "Rebrík", "Miešadlo na farbu"],
      safety_tips: ["Vetraj miestnosť."],
      search_keywords: ["rebrík", "brúska", "maliarske náradie", "valček"],
    };
  }

  if (includesAny(task, ["3d model", "3d tlac", "3d tlaciaren", "vytlacit model", "vytlacit 3d", "tlaciaren"])) {
    return {
      task_title: "Vytlačenie 3D modelu",
      summary: "Na toto potrebuješ hlavne 3D tlačiareň a materiál. Keď v ponukách nič také nie je, nič neodporučím.",
      difficulty: "stredné",
      steps: [
        "Priprav alebo skontroluj 3D model.",
        "Nastav správny materiál a parametre tlače.",
        "Skontroluj podložku a pripravenosť tlačiarne.",
        "Spusť tlač a priebežne ju sleduj.",
        "Po dotlačení model opatrne odober a dočisti."
      ],
      required_tools: ["3D tlačiareň", "Filament alebo resin", "Počítač so slicerom"],
      optional_tools: ["Špachtľa", "Klieštiky", "Brúsny papier"],
      safety_tips: ["Nedotýkaj sa horúcich častí tlačiarne."],
      search_keywords: ["3d tlačiareň", "3d printer", "filament", "resin printer", "sla tlačiareň"],
    };
  }

  return {
    task_title: "Túto úlohu ešte nemám dobre naučenú",
    summary: "Zatiaľ ti viem ukázať len relevantné ponuky, ak niečo naozaj sedí.",
    difficulty: "",
    steps: [],
    required_tools: [],
    optional_tools: [],
    safety_tips: [],
    search_keywords: rawTask
      .split(/[,.;]/)
      .flatMap((part) => part.split(" "))
      .map((part) => part.trim())
      .filter((part) => part.length >= 4),
  };
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
      .limit(300);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const suggestedItems = ((data ?? []) as ItemRow[])
      .map((item) => ({
        id: item.id,
        title: item.title,
        price_per_day: item.price_per_day ?? null,
        city: item.city ?? null,
        category: item.category ?? null,
        score: scoreItem(item, planned.search_keywords),
      }))
      .filter((item) => item.score >= 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return NextResponse.json({
      ...planned,
      suggested_items: suggestedItems,
    });
  } catch {
    return NextResponse.json({ error: "Interná chyba." }, { status: 500 });
  }
}
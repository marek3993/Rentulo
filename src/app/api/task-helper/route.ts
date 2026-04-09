import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ItemRow = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number | null;
  city: string | null;
  category: string | null;
  is_active: boolean | null;
  distance_km?: number | null;
};

type ItemImageRow = {
  item_id: number;
  path: string;
  is_primary: boolean | null;
  position: number | null;
  id: number;
};

type SuggestedItem = {
  id: number;
  title: string;
  price_per_day: number | null;
  city: string | null;
  category: string | null;
  image_url: string | null;
  score: number;
  distance_km: number | null;
};

const GENERIC_FINDER_ERROR =
  "Vyhľadanie vhodných ponúk je teraz chvíľu nedostupné. Skús to prosím znova o chvíľu.";
const MISSING_SUPABASE_CONFIG_ERROR =
  "Pomocník momentálne nevie načítať ponuky. Skontroluj serverové nastavenie Supabase.";
const ALLOWED_RADIUS_KM = [5, 10, 20, 50] as const;
const STOP_WORDS = new Set([
  "a",
  "aby",
  "aj",
  "ako",
  "alebo",
  "asi",
  "bez",
  "by",
  "cez",
  "co",
  "chcem",
  "do",
  "doma",
  "for",
  "ho",
  "ich",
  "iba",
  "ja",
  "je",
  "ju",
  "ked",
  "kde",
  "ku",
  "mam",
  "ma",
  "mi",
  "mna",
  "mne",
  "na",
  "nad",
  "nech",
  "od",
  "po",
  "pod",
  "poprosim",
  "potrebujem",
  "pre",
  "pri",
  "s",
  "sa",
  "si",
  "som",
  "to",
  "tu",
  "uz",
  "v",
  "vo",
  "z",
  "za",
]);

const KEYWORD_RULES: Array<{ match: string[]; keywords: string[] }> = [
  {
    match: ["odtok", "sifon", "upchat", "kanal"],
    keywords: ["cistenie odtoku", "spirala", "instalaterske naradie", "mokro-suchy vysavac"],
  },
  {
    match: ["polic", "navrt", "vrt", "stena", "hmozd"],
    keywords: ["vrtacka", "aku skrutkovac", "vrtaky", "vodovaha"],
  },
  {
    match: ["trava", "kosit", "kosac", "zahrad"],
    keywords: ["kosacka", "vyzinac", "zahradne naradie", "vozik"],
  },
  {
    match: ["tepov", "sedack", "koberec", "cistenie"],
    keywords: ["tepovac", "cistic kobercov", "mokre cistenie"],
  },
  {
    match: ["malov", "farb", "valcek", "stierk"],
    keywords: ["maliarske naradie", "valcek", "rebrik", "miesadlo"],
  },
  {
    match: ["plot", "tuj", "konar", "strihat"],
    keywords: ["plotostrih", "noznice na zivy plot", "zahradne naradie"],
  },
  {
    match: ["stan", "event", "party", "oslav", "svadb"],
    keywords: ["party stan", "event vybavenie", "stoly", "lavice"],
  },
  {
    match: ["bicykel", "bike", "cyklo", "kolobez"],
    keywords: ["bicykel", "cyklo vybava", "sport"],
  },
];

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseRadiusKm(value: unknown) {
  const parsed = Number(value);
  return ALLOWED_RADIUS_KM.includes(parsed as (typeof ALLOWED_RADIUS_KM)[number]) ? parsed : 10;
}

function parseCoordinate(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value;
}

function uniqueStrings(values: string[], limit: number) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

function extractSearchKeywords(rawTask: string) {
  const normalizedTask = normalize(rawTask);
  const splitWords = normalizedTask
    .split(/[\s,.;:!?()/\\-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part));

  const ruleKeywords = KEYWORD_RULES.flatMap((rule) =>
    rule.match.some((token) => normalizedTask.includes(token))
      ? rule.keywords.map((keyword) => normalize(keyword))
      : []
  );

  return uniqueStrings([normalizedTask, ...splitWords, ...ruleKeywords], 10);
}

function scoreItem(item: ItemRow, keywords: string[]) {
  const title = normalize(item.title || "");
  const description = normalize(item.description || "");
  const category = normalize(item.category || "");
  const city = normalize(item.city || "");
  const full = `${title} ${description} ${category} ${city}`;

  let score = 0;

  for (const keyword of keywords) {
    if (!keyword) continue;

    if (title.includes(keyword)) score += 14;
    if (category.includes(keyword)) score += 10;
    if (description.includes(keyword)) score += 6;

    const words = keyword.split(" ").filter((word) => word.length >= 3);
    for (const word of words) {
      if (title.includes(word)) score += 4;
      if (category.includes(word)) score += 3;
      if (description.includes(word)) score += 2;
      if (full.includes(word)) score += 1;
    }
  }

  return score;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawTask = typeof body?.task === "string" ? body.task.trim() : "";
    const radiusKm = parseRadiusKm(body?.radius_km);
    const searchLat = parseCoordinate(body?.search_lat);
    const searchLng = parseCoordinate(body?.search_lng);

    if (!rawTask) {
      return NextResponse.json({ error: "Napíš, čo hľadáš." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: MISSING_SUPABASE_CONFIG_ERROR }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const keywords = extractSearchKeywords(rawTask);

    const itemsResult =
      searchLat !== null && searchLng !== null
        ? await supabase.rpc("search_items_near", {
            search_lat: searchLat,
            search_lng: searchLng,
            radius_km: radiusKm,
          })
        : await supabase
            .from("items")
            .select("id,title,description,price_per_day,city,category,is_active")
            .eq("is_active", true)
            .limit(300);

    if (itemsResult.error) {
      console.error("task-helper supabase error", itemsResult.error);
      return NextResponse.json(
        { error: "Nepodarilo sa načítať odporúčané ponuky. Skús to prosím znova." },
        { status: 500 }
      );
    }

    const rankedItems: SuggestedItem[] = ((itemsResult.data ?? []) as ItemRow[])
      .map((item) => ({
        id: item.id,
        title: item.title,
        price_per_day: item.price_per_day ?? null,
        city: item.city ?? null,
        category: item.category ?? null,
        image_url: null,
        score: scoreItem(item, keywords),
        distance_km: typeof item.distance_km === "number" ? item.distance_km : null,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (a.distance_km !== null && b.distance_km !== null) {
          return a.distance_km - b.distance_km;
        }

        if (a.distance_km !== null) {
          return -1;
        }

        if (b.distance_km !== null) {
          return 1;
        }

        return 0;
      });

    const meaningfulItems = rankedItems.filter((item) => item.score > 0);
    const selectedItems = (meaningfulItems.length > 0 ? meaningfulItems : rankedItems).slice(0, 6);

    const imageIds = selectedItems.map((item) => item.id);
    const imageMap: Record<number, string> = {};

    if (imageIds.length > 0) {
      const { data: imageRows, error: imageError } = await supabase
        .from("item_images")
        .select("item_id,path,is_primary,position,id")
        .in("item_id", imageIds)
        .order("is_primary", { ascending: false })
        .order("position", { ascending: true })
        .order("id", { ascending: true });

      if (imageError) {
        console.error("task-helper item_images error", imageError);
      } else {
        const grouped: Record<number, ItemImageRow[]> = {};

        for (const image of (imageRows ?? []) as ItemImageRow[]) {
          if (!grouped[image.item_id]) {
            grouped[image.item_id] = [];
          }

          grouped[image.item_id].push(image);
        }

        for (const itemId of imageIds) {
          const images = grouped[itemId] ?? [];
          const primary = [...images].sort((a, b) => {
            if (!!a.is_primary !== !!b.is_primary) {
              return a.is_primary ? -1 : 1;
            }

            const aPos = Number.isFinite(Number(a.position)) ? Number(a.position) : 999999;
            const bPos = Number.isFinite(Number(b.position)) ? Number(b.position) : 999999;
            if (aPos !== bPos) {
              return aPos - bPos;
            }

            return Number(a.id) - Number(b.id);
          })[0];

          if (primary) {
            imageMap[itemId] = supabase.storage.from("item-images").getPublicUrl(primary.path).data.publicUrl;
          }
        }
      }
    }

    return NextResponse.json({
      suggested_items: selectedItems.map((item) => ({
        id: item.id,
        title: item.title,
        price_per_day: item.price_per_day,
        city: item.city,
        category: item.category,
        image_url: imageMap[item.id] ?? null,
      })),
    });
  } catch (error) {
    console.error("task-helper route error", error);
    return NextResponse.json({ error: GENERIC_FINDER_ERROR }, { status: 500 });
  }
}

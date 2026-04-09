import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type PlannerStatus = "final" | "needs_followup";

type PlannedTask = {
  status: PlannerStatus;
  task_title: string | null;
  summary: string | null;
  difficulty: string | null;
  steps: string[];
  required_tools: string[];
  safety_tips: string[];
  search_keywords: string[];
  followup_question: string | null;
};

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
};

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const GENERIC_PLANNER_ERROR =
  "AI pomocn\u00edk je teraz chv\u00ed\u013eu nedostupn\u00fd. Sk\u00fas to pros\u00edm znova o chv\u00ed\u013eu.";
const MISSING_OPENAI_KEY_ERROR =
  "AI pomocn\u00edk e\u0161te nie je nastaven\u00fd. Dopl\u0148 OPENAI_API_KEY na serveri.";
const MISSING_SUPABASE_CONFIG_ERROR =
  "Pomocn\u00edk moment\u00e1lne nevie na\u010d\u00edta\u0165 ponuky. Skontroluj serverov\u00e9 nastavenie Supabase.";
const ALLOWED_RADIUS_KM = [5, 10, 20, 50] as const;

const plannerSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "task_title",
    "summary",
    "difficulty",
    "steps",
    "required_tools",
    "safety_tips",
    "search_keywords",
    "followup_question",
  ],
  properties: {
    status: {
      type: "string",
      enum: ["final", "needs_followup"],
    },
    task_title: {
      type: ["string", "null"],
    },
    summary: {
      type: ["string", "null"],
    },
    difficulty: {
      type: ["string", "null"],
    },
    steps: {
      type: "array",
      items: { type: "string" },
    },
    required_tools: {
      type: "array",
      items: { type: "string" },
    },
    safety_tips: {
      type: "array",
      items: { type: "string" },
    },
    search_keywords: {
      type: "array",
      items: { type: "string" },
    },
    followup_question: {
      type: ["string", "null"],
    },
  },
} as const;

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toStringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  ).slice(0, limit);
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

function sanitizePlannedTask(raw: unknown, forceFinal: boolean): PlannedTask {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const status: PlannerStatus =
    !forceFinal && record.status === "needs_followup" ? "needs_followup" : "final";

  const followupQuestion =
    status === "needs_followup"
      ? toNullableString(record.followup_question) ||
        "O ak\u00fd presn\u00fd typ pr\u00e1ce alebo veci ide?"
      : null;

  return {
    status,
    task_title:
      toNullableString(record.task_title) ||
      (status === "needs_followup"
        ? "Potrebujem e\u0161te spresnenie"
        : "Orienta\u010dn\u00fd pl\u00e1n \u00falohy"),
    summary:
      toNullableString(record.summary) ||
      (status === "needs_followup"
        ? "Sta\u010d\u00ed mi e\u0161te jedna kr\u00e1tka odpove\u010f a potom u\u017e d\u00e1m fin\u00e1lny n\u00e1vrh."
        : "Stru\u010dn\u00fd postup a pom\u00f4cky pod\u013ea zadania."),
    difficulty: toNullableString(record.difficulty),
    steps: toStringArray(record.steps, 6),
    required_tools: toStringArray(record.required_tools, 6),
    safety_tips: toStringArray(record.safety_tips, 3),
    search_keywords: toStringArray(record.search_keywords, 6),
    followup_question: followupQuestion,
  };
}

function buildMinimalFinalTask(rawTask: string, draft: PlannedTask): PlannedTask {
  const fallbackKeywords = Array.from(
    new Set(
      rawTask
        .split(/[\s,.;:!?()/\\-]+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 4)
    )
  ).slice(0, 6);

  return {
    status: "final",
    task_title:
      draft.task_title ||
      `Postup: ${rawTask
        .split(/\s+/)
        .slice(0, 5)
        .join(" ")
        .trim()}`,
    summary: draft.summary || "Stručný praktický postup a základné pomôcky podľa zadania.",
    difficulty: draft.difficulty,
    steps:
      draft.steps.length > 0
        ? draft.steps.slice(0, 6)
        : [
            "Skontroluj miesto, povrch alebo materiál, s ktorým budeš pracovať.",
            "Priprav si základné náradie a ochranné pomôcky vhodné pre túto úlohu.",
            "Pracuj opatrne a priebežne kontroluj výsledok alebo pevnosť.",
            "Po dokončení skontroluj výsledok a uprac pracovné miesto.",
          ],
    required_tools:
      draft.required_tools.length > 0
        ? draft.required_tools.slice(0, 6)
        : (draft.search_keywords.length > 0 ? draft.search_keywords : fallbackKeywords).slice(0, 4),
    safety_tips: draft.safety_tips.slice(0, 3),
    search_keywords:
      (draft.search_keywords.length > 0 ? draft.search_keywords : fallbackKeywords).slice(0, 6),
    followup_question: null,
  };
}

function getPlannerPrompt(rawTask: string, followupAnswer?: string) {
  const hasFollowupAnswer = Boolean(followupAnswer);

  return [
    "Si Rentulo task helper pre slovensk\u00fa homepage.",
    "Odpovedaj iba po slovensky a iba pod\u013ea JSON sch\u00e9my.",
    "Bu\u010f stru\u010dn\u00fd, praktick\u00fd a zameran\u00fd na kroky, n\u00e1radie a po\u017ei\u010date\u013en\u00e9 veci.",
    "Preferuj dom\u00e1ce pr\u00e1ce, diel\u0148u, z\u00e1hradu, \u010distenie a event vybavenie.",
    "Predvolene daj hne\u010f fin\u00e1lnu odpove\u010f. Vo v\u00e4\u010d\u0161ine be\u017en\u00fdch praktick\u00fdch \u00faloh m\u00e1\u0161 vr\u00e1ti\u0165 status final.",
    "Dopl\u0148uj\u00facu ot\u00e1zku polo\u017e iba vtedy, ke\u010f ch\u00fdbaj\u00faci \u00fadaj materi\u00e1lne zmen\u00ed required_tools, safety_tips, difficulty alebo samotn\u00fd typ pr\u00e1ce.",
    "Nikdy sa nep\u00fdtaj slab\u00e9, kozmetick\u00e9 alebo n\u00edzkohodnotn\u00e9 follow-up ot\u00e1zky.",
    "Nep\u00fdtaj sa na \u010das, sez\u00f3nu, po\u010dasie, mieru preferencie alebo v\u0161eobecn\u00fd kontext, ak aj bez toho vie\u0161 da\u0165 u\u017eito\u010dn\u00fd praktick\u00fd n\u00e1vod.",
    "Ak u\u017e dopl\u0148uj\u00faca odpove\u010f existuje, mus\u00ed\u0161 vr\u00e1ti\u0165 status final a nesmie\u0161 sa p\u00fdta\u0165 \u010fal\u0161iu ot\u00e1zku.",
    "Pri status needs_followup vypl\u0148 followup_question jednou kr\u00e1tkou vetou a ostatn\u00e9 polia nechaj stru\u010dn\u00e9 alebo pr\u00e1zdne.",
    "Pri status final vr\u00e1\u0165 konkr\u00e9tny n\u00e1zov \u00falohy, kr\u00e1tke zhrnutie, praktick\u00e9 kroky, required_tools, safety_tips a search_keywords vhodn\u00e9 na matching s ponukami.",
    "Summary m\u00e1 by\u0165 kr\u00e1tke, steps maj\u00fa ma\u0165 3 a\u017e 6 polo\u017eiek, required_tools 3 a\u017e 6 polo\u017eiek, safety_tips 0 a\u017e 3 polo\u017eky.",
    "Nevracaj esej, dlh\u00e9 vysvetlenia ani duplicitn\u00e9 body.",
    "Pr\u00edklady rozhodovania:",
    "- \"Ostriha\u0165 tuje po zime\" -> final, bez follow-up.",
    "- \"Pokosi\u0165 vysok\u00fa tr\u00e1vu\" -> final, bez follow-up.",
    "- \"Nav\u0155ta\u0165 nie\u010do do steny\" -> follow-up je dovolen\u00fd, lebo materi\u00e1l steny men\u00ed vrt\u00e1k, kotvenie a bezpe\u010dnos\u0165.",
    "- \"Namontova\u0165 policu\" -> follow-up je dovolen\u00fd len ak je typ steny alebo povrchu podstatn\u00fd pre n\u00e1radie a uchytenie.",
    "- Ak vie\u0161 da\u0165 rozumn\u00fd postup so z\u00e1kladn\u00fdmi predpokladmi, vr\u00e1\u0165 final a tie predpoklady stru\u010dne pomenuj v summary alebo safety_tips.",
    "",
    `Povolen\u00e9 polo\u017ei\u0165 follow-up ot\u00e1zku: ${hasFollowupAnswer ? "nie" : "\u00e1no"}.`,
    `P\u00f4vodn\u00e1 \u00faloha: ${rawTask}`,
    `Dopl\u0148uj\u00faca odpove\u010f: ${followupAnswer || "\u017eiadna"}`,
  ].join("\n");
}

function normalizeFollowupQuestion(question: string) {
  return normalize(question).replace(/[?!.]/g, " ").replace(/\s+/g, " ").trim();
}

function isWeakFollowupQuestion(question: string) {
  const normalizedQuestion = normalizeFollowupQuestion(question);

  if (!normalizedQuestion) {
    return true;
  }

  const weakSignals = [
    "kedy",
    "aky presny cas",
    "aky cas",
    "ktore rocne obdobie",
    "aka sezona",
    "v ktorom mesiaci",
    "kde to bude",
    "aka farba",
    "aka znacka",
    "aka velkost",
    "ako velmi",
    "aky styl",
    "aka presna predstava",
  ];

  return weakSignals.some((signal) => normalizedQuestion.includes(signal));
}

function isHighValueFollowupQuestion(question: string) {
  const normalizedQuestion = normalizeFollowupQuestion(question);

  if (!normalizedQuestion || isWeakFollowupQuestion(question)) {
    return false;
  }

  const materialSignals = [
    "aky typ steny",
    "z akeho materialu je stena",
    "aky material",
    "do coho",
    "na aky povrch",
    "aky povrch",
    "je to beton",
    "je to tehla",
    "je to sadrokarton",
    "je to drevo",
    "ide o elektrinu",
    "ide o plyn",
    "ide o vodu",
    "ake uchytenie",
    "aka nosnost",
    "vnutri alebo vonku",
  ];

  return materialSignals.some((signal) => normalizedQuestion.includes(signal));
}

function extractRefusal(response: OpenAI.Responses.Response) {
  for (const output of response.output) {
    if (output.type !== "message") {
      continue;
    }

    for (const content of output.content) {
      if (content.type === "refusal") {
        return content.refusal;
      }
    }
  }

  return null;
}

async function planTaskWithOpenAI(rawTask: string, followupAnswer?: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(MISSING_OPENAI_KEY_ERROR);
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    max_output_tokens: 320,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: getPlannerPrompt(rawTask, followupAnswer),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "rentulo_task_helper",
        strict: true,
        schema: plannerSchema,
      },
    },
  });

  const refusal = extractRefusal(response);
  if (refusal) {
    throw new Error(refusal);
  }

  if (!response.output_text) {
    throw new Error("Planner returned no output.");
  }

  const planned = sanitizePlannedTask(JSON.parse(response.output_text), Boolean(followupAnswer));

  if (planned.status === "needs_followup") {
    if (followupAnswer || !isHighValueFollowupQuestion(planned.followup_question || "")) {
      return buildMinimalFinalTask(rawTask, planned);
    }

    return planned;
  }

  return buildMinimalFinalTask(rawTask, planned);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawTask = typeof body?.task === "string" ? body.task.trim() : "";
    const followupAnswer =
      typeof body?.followup_answer === "string" ? body.followup_answer.trim() : "";
    const radiusKm = parseRadiusKm(body?.radius_km);
    const searchLat = parseCoordinate(body?.search_lat);
    const searchLng = parseCoordinate(body?.search_lng);

    if (!rawTask) {
      return NextResponse.json({ error: "Ch\u00fdba text \u00falohy." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: MISSING_SUPABASE_CONFIG_ERROR }, { status: 500 });
    }

    const planned = await planTaskWithOpenAI(rawTask, followupAnswer || undefined);
    const matchKeywords = Array.from(
      new Set([...planned.search_keywords, ...planned.required_tools])
    );

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
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

    const data = (itemsResult.data ?? []) as ItemRow[];
    const error = itemsResult.error;

    if (error) {
      console.error("task-helper supabase error", error);
      return NextResponse.json(
        {
          error:
            "Nepodarilo sa na\u010d\u00edta\u0165 odpor\u00fa\u010dan\u00e9 ponuky. Sk\u00fas to pros\u00edm znova.",
        },
        { status: 500 }
      );
    }

    const rankedItems: SuggestedItem[] = ((data ?? []) as ItemRow[])
      .map((item) => ({
        id: item.id,
        title: item.title,
        price_per_day: item.price_per_day ?? null,
        city: item.city ?? null,
        category: item.category ?? null,
        image_url: null,
        score: scoreItem(item, matchKeywords),
      }))
      .filter((item) => item.score >= 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const imageIds = rankedItems.map((item) => item.id);
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
            imageMap[itemId] = supabase.storage
              .from("item-images")
              .getPublicUrl(primary.path).data.publicUrl;
          }
        }
      }
    }

    const suggestedItems = rankedItems.map((item) => ({
      ...item,
      image_url: imageMap[item.id] ?? null,
    }));

    return NextResponse.json({
      ...planned,
      suggested_items: suggestedItems,
    });
  } catch (error) {
    console.error("task-helper route error", error);

    if (error instanceof Error && error.message === MISSING_OPENAI_KEY_ERROR) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: GENERIC_PLANNER_ERROR }, { status: 500 });
  }
}

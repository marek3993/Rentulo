export type AccountType = "private" | "sole_trader" | "company";

type MetadataUser = {
  user_metadata?: Record<string, unknown> | null;
} | null | undefined;

export const ACCOUNT_TYPE_OPTIONS: Array<{
  value: AccountType;
  label: string;
  description: string;
}> = [
  {
    value: "private",
    label: "Súkromná osoba",
    description: "Prenajímaš alebo si požičiavaš ako fyzická osoba.",
  },
  {
    value: "sole_trader",
    label: "SZČO",
    description: "Prenajímaš ako živnostník alebo samostatne podnikajúca osoba.",
  },
  {
    value: "company",
    label: "Firma",
    description: "Účet je vedený pre s.r.o., a.s. alebo inú firmu.",
  },
];

export function normalizeAccountType(value: unknown): AccountType | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();

  if (normalized === "private" || normalized === "personal" || normalized === "individual") {
    return "private";
  }

  if (normalized === "sole_trader" || normalized === "sole-trader" || normalized === "szco") {
    return "sole_trader";
  }

  if (normalized === "company" || normalized === "business") {
    return "company";
  }

  return null;
}

export function getAccountTypeFromUser(user: MetadataUser): AccountType | null {
  const metadata = user?.user_metadata ?? null;

  if (!metadata) return null;

  return normalizeAccountType(metadata.account_type ?? metadata.accountType ?? null);
}

export function accountTypeLabel(accountType: AccountType | null): string {
  if (accountType === "sole_trader") return "SZČO";
  if (accountType === "company") return "Firma";
  if (accountType === "private") return "Súkromná osoba";
  return "Nezvolený typ účtu";
}

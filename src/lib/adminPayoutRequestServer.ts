type RpcArgs = Record<string, unknown>;

type RpcVariant = {
  args: RpcArgs;
  label: string;
};

type AdminPayoutActionInput = {
  adminUserId: string;
  payoutRequestId: number;
  note: string | null;
  paidAt?: string | null;
  providerPayoutRef?: string | null;
  failureReason?: string | null;
};

export function parseOptionalAdminText(value: unknown, fieldLabel: string) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldLabel} must be a string.`);
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export function parseOptionalIsoDateTime(value: unknown, fieldLabel: string) {
  const parsedValue = parseOptionalAdminText(value, fieldLabel);

  if (!parsedValue) {
    return null;
  }

  const timestamp = Date.parse(parsedValue);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`${fieldLabel} must be a valid ISO datetime.`);
  }

  return new Date(timestamp).toISOString();
}

export function buildMarkPayoutRequestProcessingVariants(input: AdminPayoutActionInput): RpcVariant[] {
  return [
    {
      label: "confirmed_db_contract",
      args: {
        p_payout_request_id: input.payoutRequestId,
        p_provider_payout_ref: input.providerPayoutRef ?? null,
        p_note: input.note,
      },
    },
  ];
}

export function buildMarkPayoutRequestPaidVariants(input: AdminPayoutActionInput): RpcVariant[] {
  return [
    {
      label: "confirmed_db_contract",
      args: {
        p_payout_request_id: input.payoutRequestId,
        p_provider_payout_ref: input.providerPayoutRef ?? null,
        p_note: input.note,
      },
    },
  ];
}

export function buildMarkPayoutRequestFailedVariants(input: AdminPayoutActionInput): RpcVariant[] {
  return [
    {
      label: "confirmed_db_contract",
      args: {
        p_payout_request_id: input.payoutRequestId,
        p_failure_reason: input.failureReason ?? null,
        p_note: input.note,
      },
    },
  ];
}

export type { RpcArgs, RpcVariant };

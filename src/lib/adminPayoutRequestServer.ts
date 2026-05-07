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
  providerRef?: string | null;
  failureReason?: string | null;
};

function withDefinedEntries(entries: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));
}

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
  const commonNoteArgs = [
    {
      label: "payout_request_id_note",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_note: input.note ?? undefined,
      }),
    },
    {
      label: "request_id_note",
      args: withDefinedEntries({
        p_request_id: input.payoutRequestId,
        p_note: input.note ?? undefined,
      }),
    },
    {
      label: "id_note",
      args: withDefinedEntries({
        p_id: input.payoutRequestId,
        p_note: input.note ?? undefined,
      }),
    },
    {
      label: "payout_request_id_admin_note",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_admin_note: input.note ?? undefined,
      }),
    },
    {
      label: "payout_request_id_admin_user_note",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_admin_user_id: input.adminUserId,
        p_note: input.note ?? undefined,
      }),
    },
    {
      label: "request_id_admin_user_note",
      args: withDefinedEntries({
        p_request_id: input.payoutRequestId,
        p_admin_user_id: input.adminUserId,
        p_note: input.note ?? undefined,
      }),
    },
    {
      label: "payout_request_id_only",
      args: {
        p_payout_request_id: input.payoutRequestId,
      },
    },
    {
      label: "request_id_only",
      args: {
        p_request_id: input.payoutRequestId,
      },
    },
    {
      label: "id_only",
      args: {
        p_id: input.payoutRequestId,
      },
    },
  ];

  return commonNoteArgs;
}

export function buildMarkPayoutRequestPaidVariants(input: AdminPayoutActionInput): RpcVariant[] {
  const providerRefArgs = withDefinedEntries({
    p_note: input.note ?? undefined,
    p_provider_ref: input.providerRef ?? undefined,
    p_paid_at: input.paidAt ?? undefined,
  });
  const externalRefArgs = withDefinedEntries({
    p_note: input.note ?? undefined,
    p_external_ref: input.providerRef ?? undefined,
    p_paid_at: input.paidAt ?? undefined,
  });

  return [
    {
      label: "payout_request_id_note_provider_ref",
      args: {
        p_payout_request_id: input.payoutRequestId,
        ...providerRefArgs,
      },
    },
    {
      label: "request_id_note_provider_ref",
      args: {
        p_request_id: input.payoutRequestId,
        ...providerRefArgs,
      },
    },
    {
      label: "payout_request_id_note_external_ref",
      args: {
        p_payout_request_id: input.payoutRequestId,
        ...externalRefArgs,
      },
    },
    {
      label: "payout_request_id_admin_note_provider_ref",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_admin_note: input.note ?? undefined,
        p_provider_ref: input.providerRef ?? undefined,
        p_paid_at: input.paidAt ?? undefined,
      }),
    },
    {
      label: "payout_request_id_admin_user_note_provider_ref",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_admin_user_id: input.adminUserId,
        p_note: input.note ?? undefined,
        p_provider_ref: input.providerRef ?? undefined,
        p_paid_at: input.paidAt ?? undefined,
      }),
    },
    {
      label: "payout_request_id_note_only",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_note: input.note ?? undefined,
      }),
    },
    {
      label: "request_id_note_only",
      args: withDefinedEntries({
        p_request_id: input.payoutRequestId,
        p_note: input.note ?? undefined,
      }),
    },
    {
      label: "payout_request_id_only",
      args: {
        p_payout_request_id: input.payoutRequestId,
      },
    },
  ];
}

export function buildMarkPayoutRequestFailedVariants(input: AdminPayoutActionInput): RpcVariant[] {
  return [
    {
      label: "payout_request_id_note_failure_reason",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_note: input.note ?? undefined,
        p_failure_reason: input.failureReason ?? undefined,
      }),
    },
    {
      label: "request_id_note_failure_reason",
      args: withDefinedEntries({
        p_request_id: input.payoutRequestId,
        p_note: input.note ?? undefined,
        p_failure_reason: input.failureReason ?? undefined,
      }),
    },
    {
      label: "payout_request_id_reason_only",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_reason: input.failureReason ?? undefined,
      }),
    },
    {
      label: "payout_request_id_admin_user_note_failure_reason",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_admin_user_id: input.adminUserId,
        p_note: input.note ?? undefined,
        p_failure_reason: input.failureReason ?? undefined,
      }),
    },
    {
      label: "payout_request_id_note_only",
      args: withDefinedEntries({
        p_payout_request_id: input.payoutRequestId,
        p_note: input.note ?? undefined,
      }),
    },
    {
      label: "request_id_note_only",
      args: withDefinedEntries({
        p_request_id: input.payoutRequestId,
        p_note: input.note ?? undefined,
      }),
    },
    {
      label: "payout_request_id_only",
      args: {
        p_payout_request_id: input.payoutRequestId,
      },
    },
  ];
}

export type { RpcArgs, RpcVariant };

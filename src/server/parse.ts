import "server-only";

import type { z } from "zod";
import { firstError } from "@/lib/validation";
import { UserError } from "./errors";

/** Valideer invoer server-side; ongeldige invoer wordt een nette foutmelding. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new UserError(firstError(result.error));
  return result.data;
}

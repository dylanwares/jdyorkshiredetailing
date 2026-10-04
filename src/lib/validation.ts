import { z } from 'zod';

// Blank form fields arrive as "" — treat them as "not provided".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

// Single-line text: trimmed, length-limited, newlines removed so it is safe in subjects and headers.
const oneLine = (max: number, required = 'Please fill in this field') =>
  z
    .string({ error: required })
    .trim()
    .max(max, `Please keep this under ${max} characters`)
    .transform((v) => v.replace(/[\r\n\t]+/g, ' '));

export const enquirySchema = z.object({
  name: oneLine(100, 'Please enter your name').pipe(z.string().min(1, 'Please enter your name')),
  phone: oneLine(30, 'Please enter your phone number').pipe(
    z.string().refine((v) => /^[+\d][\d\s()-]*$/.test(v) && v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 15, {
      message: 'Please enter a valid phone number',
    }),
  ),
  email: optional(z.email('Please enter a valid email address').max(200)),
  postcode: oneLine(10, 'Please enter your postcode').pipe(
    z
      .string()
      .regex(/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/, 'Please enter a valid UK postcode')
      .transform((v) => {
        const compact = v.replace(/\s+/g, '').toUpperCase();
        return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
      }),
  ),
  vehicle: optional(oneLine(100)),
  service: optional(oneLine(100)),
  date: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date')),
  message: optional(z.string().trim().max(2000, 'Please keep your message under 2000 characters')),
});

export type Enquiry = z.infer<typeof enquirySchema>;

export function parseEnquiry(form: FormData) {
  const result = enquirySchema.safeParse(Object.fromEntries(form));
  return result.success
    ? ({ ok: true, enquiry: result.data } as const)
    : ({ ok: false, fieldErrors: z.flattenError(result.error).fieldErrors } as const);
}

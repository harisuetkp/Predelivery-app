import { Resend } from "resend"

export async function sendMarketingBatch(params: {
  from: string
  subject: string
  bodyHtml: string
  recipients: { email: string }[]
}): Promise<{ email: string; messageId: string }[]> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set")
  }

  if (params.recipients.length === 0) {
    throw new Error("No recipients provided")
  }

  if (params.recipients.length > 100) {
    throw new Error("Batch exceeds 100 recipient limit")
  }

  if (!params.from || !params.subject || !params.bodyHtml) {
    throw new Error("from, subject, bodyHtml are all required")
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const payload = params.recipients.map((r) => ({
    from: params.from,
    to: [r.email],
    subject: params.subject,
    html: params.bodyHtml,
  }))

  const response = await resend.batch.send(payload)

  if (response.error) {
    throw new Error(
      `Resend batch failed: ${response.error.message || JSON.stringify(response.error)}`
    )
  }

  if (!response.data?.data || response.data.data.length !== params.recipients.length) {
    throw new Error("Resend batch response length mismatch")
  }

  return response.data.data.map((item: { id: string }, i: number) => ({
    email: params.recipients[i].email,
    messageId: item.id,
  }))
}

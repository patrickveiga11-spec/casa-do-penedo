/** Cron diário (Vercel): chama a API no Render para enviar guias de boas-vindas. */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.authorization;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const apiUrl = (process.env.CASA_API_URL || process.env.VITE_API_URL || "").replace(/\/$/, "");
  const adminPassword = process.env.CASA_ADMIN_PASSWORD?.trim();

  if (!apiUrl || !adminPassword) {
    return res.status(500).json({ error: "CASA_API_URL e CASA_ADMIN_PASSWORD são obrigatórios na Vercel" });
  }

  try {
    const response = await fetch(`${apiUrl}/cron/welcome-emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminPassword}` },
    });

    const body = await response.text();
    let data;

    try {
      data = JSON.parse(body);
    } catch {
      data = { raw: body };
    }

    return res.status(response.status).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}

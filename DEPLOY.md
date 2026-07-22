# Publicar Casa do Penedo (grátis)

Stack: **GitHub** + **Neon** (base de dados) + **Render** (API) + **Vercel** (site).

Tempo estimado: ~30 minutos.

---

## Passo 1 — GitHub

1. Cria conta em https://github.com (se ainda não tens).
2. Cria um repositório **privado** chamado `casa-do-penedo`.
3. No Mac, na pasta do projecto:

```bash
cd ~/Projects/casa-do-penedo
git add .
git commit -m "Preparar deploy gratuito"
git branch -M main
git remote add origin https://github.com/TEU-UTILIZADOR/casa-do-penedo.git
git push -u origin main
```

Substitui `TEU-UTILIZADOR` pelo teu nome de utilizador GitHub.

---

## Passo 2 — Neon (base de dados, grátis)

1. Regista-te em https://neon.tech
2. **New Project** → nome `casa-do-penedo` → região **EU (Frankfurt)** ou mais perto de Portugal
3. Copia a **connection string** (PostgreSQL), algo como:
   `postgresql://user:pass@ep-xxx.eu-west-1.aws.neon.tech/neondb?sslmode=require`
4. Guarda num sítio seguro — vais usar no Render.

---

## Passo 3 — Render (API, grátis)

1. Regista-te em https://render.com (podes entrar com GitHub).
2. **New → Blueprint** (ou **Web Service** se Blueprint não aparecer).
3. Liga o repositório `casa-do-penedo`.
4. Se usares o ficheiro `render.yaml` do projecto, o Render preenche quase tudo.
5. Se criares manualmente:
   - **Root Directory:** (vazio — raiz do repo)
   - **Build Command:** `npm install --include=dev && npm run build:api`
   - **Start Command:** `npm run start:api`
   - **Plan:** Free
6. **Environment Variables** (Environment):

| Variável | Valor |
|----------|--------|
| `DATABASE_URL` | connection string da Neon |
| `ADMIN_PASSWORD` | password forte para `/gestao` |
| `BREVO_API_KEY` | a tua chave Brevo (`xkeysib-...`) |
| `SMTP_FROM` | `Casa do Penedo <casa_do_penedo@casadopenedo.pt>` |
| `OWNER_EMAIL` | `casa_do_penedo@casadopenedo.pt` |
| `BREVO_SENDER_EMAIL` | `casa_do_penedo@casadopenedo.pt` (opcional; reforça o remetente) |
| `NODE_ENV` | `production` (só depois do 1.º deploy bem-sucedido, ou usa o Build Command abaixo) |

**Nota:** com `NODE_ENV=production`, o Render não instala TypeScript e o build falha. Usa sempre:
`npm install --include=dev && npm run build:api`

7. Clica **Deploy** e espera ficar **Live**.
8. Copia o URL da API, ex.: `https://casa-do-penedo-api.onrender.com`
9. Testa no browser: `https://TEU-API.onrender.com/health` → deve responder `{"status":"ok",...}`

### Semear dados iniciais (uma vez)

No teu Mac, com a connection string da Neon:

```bash
cd ~/Projects/casa-do-penedo
export DATABASE_URL="postgresql://..."
npm run db:seed -w @casa/api
```

Isto cria a propriedade «Casa do Penedo» e as regras de preço.

---

## Passo 4 — Vercel (site, grátis)

1. Regista-te em https://vercel.com (entrada com GitHub).
2. **Add New → Project** → importa `casa-do-penedo`.
3. O ficheiro `vercel.json` já configura o build.
4. **Environment Variables:**

| Variável | Valor |
|----------|--------|
| `VITE_API_URL` | URL da API no Render (sem `/` no fim), ex. `https://casa-do-penedo-api.onrender.com` |

5. **Deploy**.
6. O link final será algo como: `https://casa-do-penedo.vercel.app`

---

## Passo 5 — Brevo (emails em produção)

1. Em https://app.brevo.com/security/authorised_ips — desactiva restrição de IP **ou** autoriza IPs da Render (para testes, desactivar é mais simples).
2. **Domínio próprio (obrigatório anti-spam):** em Brevo → **Senders, Domains & Dedicated IPs** → **Domains** → `casadopenedo.pt` com DKIM verde.
3. **SPF (crítico):** o registo TXT do domínio deve incluir a Brevo. Exemplo correcto:

   ```
   v=spf1 +a +mx +ip4:185.12.116.243 +include:spf.pmg.host-services.com +include:spf.brevo.com ~all
   ```

   Se já existe um SPF, **não cries um segundo** — só acrescenta `+include:spf.brevo.com` ao que já tens.
4. **DMARC (recomendado):** TXT em `_dmarc.casadopenedo.pt`, por exemplo:

   ```
   v=DMARC1; p=none; rua=mailto:casa_do_penedo@casadopenedo.pt; pct=100
   ```

   Quando estiver estável, podes subir para `p=quarantine`.
5. Adiciona o remetente `casa_do_penedo@casadopenedo.pt` em **Senders** e confirma-o.
6. Confirma no Render:
   - `BREVO_API_KEY` = chave da Brevo
   - `SMTP_FROM` = `Casa do Penedo <casa_do_penedo@casadopenedo.pt>`
   - `BREVO_SENDER_EMAIL` = `casa_do_penedo@casadopenedo.pt`
   - `OWNER_EMAIL` = `casa_do_penedo@casadopenedo.pt`
7. Testa em https://www.mail-tester.com (deve ficar ≥ 8/10) e em https://mxtoolbox.com/SuperTool.aspx (SPF + DKIM + DMARC).
8. Reinicia o serviço no Render após alterar as variáveis.

---

## Passo 6 — Guia de boas-vindas (automático às 9h, grátis)

O PDF está em `apps/api/assets/guia-boas-vindas.pdf`.

**Envio automático com Vercel Cron (grátis):**

O projecto inclui `api/welcome-emails.js` e um cron diário no `vercel.json`. A Vercel chama esta função (~9h Lisboa) e esta chama a API no Render.

### Variáveis na Vercel (Settings → Environment Variables)

| Variável | Valor |
|----------|--------|
| `CASA_API_URL` | `https://casa-do-penedo.onrender.com` |
| `CASA_ADMIN_PASSWORD` | a mesma password da gestão (`/gestao`) |
| `CRON_SECRET` | uma string aleatória longa (ex. `penedo-cron-2026-xK9m`) |

Depois do deploy, o cron fica activo automaticamente.

Reservas validadas com **menos de 2 dias** de antecedência recebem o guia **logo na validação**.

---

## O que enviar ao cliente

**Só o link da Vercel:**

`https://casa-do-penedo.vercel.app`

**Não partilhes** `/gestao` nem a `ADMIN_PASSWORD`.

---

## Gestão (só para ti)

`https://casa-do-penedo.vercel.app/gestao` → password que definiste em `ADMIN_PASSWORD`.

---

## Limitações do plano grátis

- **Render:** adormece após ~15 min sem uso; a 1.ª visita pode demorar ~30–60 s.
- **Neon:** espaço limitado (suficiente para começar).

---

## Actualizar o site depois

```bash
git add .
git commit -m "Descrição da alteração"
git push
```

Render e Vercel fazem redeploy automático.

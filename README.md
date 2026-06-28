# Casa do Penedo

Plataforma de gestão de alojamento local — módulo **Reservas** (MVP).

## Stack

- **Frontend:** React + Vite (`apps/web`)
- **Backend:** Node.js + Fastify + Prisma (`apps/api`)
- **Base de dados:** PostgreSQL (embebido em dev, Docker opcional)

## Funcionalidades incluídas

- Calendário unificado com reservas e bloqueios
- Criação de reservas directas com **anti-overbooking**
- **Preços dinâmicos** por regras (fim de semana, estadia longa, época alta)
- KPIs mensais (reservas, receita, ocupação, noites reservadas)

## Arranque rápido

```bash
cd ~/Projects/casa-do-penedo
npm install
cp .env.example .env
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001/health

## Email de confirmação (Brevo)

Quando um hóspede reserva com email, a API envia confirmação via [Brevo](https://www.brevo.com) (grátis ~300 emails/dia).

### 1. Criar conta Brevo

1. Regista-te em https://www.brevo.com
2. Vai a **Settings → SMTP & API → SMTP**
3. Cria uma **SMTP key** (chave longa)
4. O **SMTP login** é o email da tua conta Brevo

### 2. Configurar `apps/api/.env`

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=email-da-tua-conta-brevo@exemplo.com
SMTP_PASS=xsmtpsib-xxxxxxxx
SMTP_FROM="Casa do Penedo <casa_do_penedo@casadopenedo.pt>"
OWNER_EMAIL=casa_do_penedo@casadopenedo.pt
BREVO_SENDER_EMAIL=casa_do_penedo@casadopenedo.pt
```

### 3. Testar

```bash
npm run test:email -w @casa/api -- casa_do_penedo@casadopenedo.pt
```

Reinicia a API (`npm run dev`) após alterar o `.env`.

## Próximos passos sugeridos

1. Autenticação multi-tenant
2. Sincronização multi-canal (Airbnb, Booking.com)
3. Módulo Check-in/out digital

# Anexos de email

Coloque aqui os PDFs usados nos emails automáticos:

| Ficheiro | Quando é enviado |
|----------|------------------|
| **`regulamento-interno.pdf`** | Email de confirmação final (ao validar a reserva) |
| **`guia-boas-vindas.pdf`** | Email de boas-vindas (2 dias antes do check-in, às 9h) |

Variáveis opcionais no Render:

- `REGULAMENTO_PDF_PATH` — caminho absoluto ao regulamento
- `GUIA_BOAS_VINDAS_PDF_PATH` — caminho absoluto ao guia de boas-vindas

O envio automático do guia usa a tarefa `cron:welcome` (9h, hora de Lisboa). Se a reserva for validada com menos de 2 dias para o check-in, o guia é enviado logo na validação.

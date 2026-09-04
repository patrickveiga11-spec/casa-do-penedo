#!/usr/bin/env php
<?php
/**
 * Relay de email no alojamento casadopenedo.pt
 * A API (Render) chama este endpoint por HTTPS — assim não depende do SMTP bloqueado no Render free.
 *
 * Instalar em: public_html/casa-mail-relay.php (ou subdomínio)
 * Variável na API: DOMAIN_MAIL_WEBHOOK_URL + DOMAIN_MAIL_WEBHOOK_SECRET
 */
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST only']);
    exit;
}

$secret = getenv('CASA_MAIL_RELAY_SECRET') ?: 'CHANGE_ME_IN_SETUP';
$provided = $_SERVER['HTTP_X_CASA_RELAY_SECRET'] ?? '';
if (!$secret || !hash_equals($secret, $provided)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
    exit;
}

$to = trim((string)($data['to'] ?? ''));
$subject = trim((string)($data['subject'] ?? ''));
$text = (string)($data['text'] ?? '');
$fromEmail = trim((string)($data['fromEmail'] ?? 'casa_do_penedo@casadopenedo.pt'));
$fromName = trim((string)($data['fromName'] ?? 'Casa do Penedo'));
$replyTo = trim((string)($data['replyTo'] ?? $fromEmail));

if ($to === '' || $subject === '' || $text === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'to, subject and text are required']);
    exit;
}

if (!filter_var($to, FILTER_VALIDATE_EMAIL) || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid email']);
    exit;
}

$boundary = 'casa_' . bin2hex(random_bytes(8));
$headers = [];
$headers[] = 'From: ' . sprintf('%s <%s>', encode_header($fromName), $fromEmail);
$headers[] = 'Reply-To: ' . $replyTo;
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'X-Mailer: CasaDoPenedo-Relay';

$attachments = $data['attachments'] ?? [];
if (is_array($attachments) && count($attachments) > 0) {
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
    $body = "--{$boundary}\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($text)) . "\r\n";

    foreach ($attachments as $file) {
        if (!is_array($file)) continue;
        $filename = preg_replace('/[^A-Za-z0-9._-]/', '_', (string)($file['filename'] ?? 'anexo.bin'));
        $contentType = (string)($file['contentType'] ?? 'application/octet-stream');
        $content = base64_decode((string)($file['contentBase64'] ?? ''), true);
        if ($content === false) continue;
        $body .= "--{$boundary}\r\n";
        $body .= 'Content-Type: ' . $contentType . '; name="' . $filename . "\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n";
        $body .= 'Content-Disposition: attachment; filename="' . $filename . "\"\r\n\r\n";
        $body .= chunk_split(base64_encode($content)) . "\r\n";
    }
    $body .= "--{$boundary}--\r\n";
} else {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: base64';
    $body = chunk_split(base64_encode($text));
}

$ok = @mail($to, encode_header($subject), $body, implode("\r\n", $headers), '-f' . $fromEmail);

if (!$ok) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mail() failed']);
    exit;
}

echo json_encode(['ok' => true, 'to' => $to]);

function encode_header(string $value): string {
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

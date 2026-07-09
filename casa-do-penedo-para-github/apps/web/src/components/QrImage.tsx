function qrImageUrl(data: string, size: number) {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data,
    margin: "0",
    format: "svg",
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params}`;
}

export function QrImage({
  value,
  size,
  label,
}: {
  value: string;
  size: number;
  label: string;
}) {
  return (
    <img
      className="qr-image"
      src={qrImageUrl(value, size)}
      width={size}
      height={size}
      alt={label}
      loading="lazy"
      decoding="async"
    />
  );
}

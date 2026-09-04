#!/usr/bin/env python3
"""Actualiza variáveis de email no Render (requer RENDER_API_KEY)."""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

SERVICE_ID = os.environ.get("RENDER_SERVICE_ID", "srv-d8eovan40ujc73dqfgb0")
SERVICE_NAME = os.environ.get("RENDER_SERVICE_NAME", "casa-do-penedo")
ENV_UPDATES = {
    "SMTP_FROM": "Casa do Penedo <casa_do_penedo@casadopenedo.pt>",
    "OWNER_EMAIL": "casa_do_penedo@casadopenedo.pt",
    "OWNER_NOTIFICATION_EMAILS": "casa_do_penedo@casadopenedo.pt",
    "BREVO_SENDER_EMAIL": "casa_do_penedo@casadopenedo.pt",
    "DOMAIN_SMTP_HOST": "webdomain03.dnscpanel.com",
    "DOMAIN_SMTP_PORT": "587",
    "DOMAIN_SMTP_USER": "casa_do_penedo@casadopenedo.pt",
}


def load_render_api_key() -> str:
    key = os.environ.get("RENDER_API_KEY", "").strip()
    if key:
        return key

    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        match = re.search(r"^RENDER_API_KEY=(.+)$", env_path.read_text(), re.M)
        if match:
            return match.group(1).strip()

    print("RENDER_API_KEY em falta. Cria em https://dashboard.render.com/u/settings#api-keys")
    sys.exit(1)


def api(method: str, path: str, body=None, api_key: str = ""):
    payload = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(
        f"https://api.render.com/v1{path}",
        data=payload,
        method=method,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if payload else {}),
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read().decode()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode()
        try:
            data = json.loads(raw) if raw else {"error": error.reason}
        except Exception:
            data = raw
        return error.code, data


def main() -> None:
    api_key = load_render_api_key()
    code, services = api("GET", f"/services/{SERVICE_ID}", api_key=api_key)
    if code == 200 and isinstance(services, dict) and "id" in services:
        service = services
    else:
        code, services = api("GET", "/services?limit=50", api_key=api_key)
        if code != 200:
            print("Erro ao listar serviços Render:", code, services)
            sys.exit(1)
        service = next(
            (item["service"] for item in services if item["service"]["name"] == SERVICE_NAME),
            None,
        )
        if not service:
            service = next(
                (item["service"] for item in services if item["service"]["id"] == SERVICE_ID),
                None,
            )

    if not service:
        print(f"Serviço Render não encontrado (id={SERVICE_ID}).")
        sys.exit(1)

    service_id = service["id"]
    print(f"Serviço: {service['name']} ({service_id})")

    for key, value in ENV_UPDATES.items():
        code, result = api(
            "PUT",
            f"/services/{service_id}/env-vars/{key}",
            {"value": value},
            api_key=api_key,
        )
        if code in (200, 201):
            print(f"OK  {key}")
        else:
            code, result = api(
                "POST",
                f"/services/{service_id}/env-vars",
                {"envVar": {"key": key, "value": value}},
                api_key=api_key,
            )
            if code in (200, 201):
                print(f"OK  {key} (criada)")
            else:
                print(f"ERR {key}: {code} {result}")
                sys.exit(1)

    print("\nVariáveis actualizadas. O Render vai redeployar automaticamente.")


if __name__ == "__main__":
    main()

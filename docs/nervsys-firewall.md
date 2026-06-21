# Firewall: devcode-1 → bared (claude-imagine / ComfyUI)

Request for IaC agent — image generation from **devcode-1** (`10.0.100.100`) to **bared** (`10.0.254.10`).

## Required (should already exist)

| Source | Destination | Port | Protocol | Purpose |
|--------|-------------|------|----------|---------|
| `10.0.100.100/32` (devcode-1) | `10.0.254.10/32` (bared LAN) | **443** | TCP | HTTPS gateway: Ollama `/` + ComfyUI `/comfy/` (Bearer auth) |
| `10.0.100.100/32` | `10.0.254.10/32` | **443** | TCP | TLS PKI cert validation path (same connection) |

### Where configured today

- **bared UFW** (`ansible/roles/bared/tasks/ufw.yml`): `bared_llm_client_cidrs` includes `nervsys_devcode_ip/32` on port 443
- **Proxmox** (`tofu/modules/proxmox-firewall/nervsys-groups.tf`): security group `ns_bared_llm_acc` — devcode VM OUT TCP 443 → `ns_bared_lan`
- **UniFi**: broad MANAGEMENT rules may already permit; optional explicit rule for auditability

## NOT required (do not open)

| Port | Reason |
|------|--------|
| **8188** | ComfyUI binds `127.0.0.1` only; remote access via nginx `/comfy/` on 443 |
| **11434** (Ollama) | Same — proxied via nginx 443 |

Opening 8188 to devcode would bypass Bearer auth and is **not recommended**.

## Optional hardening (audit clarity)

Add explicit UniFi inter-VLAN rules (if not relying on broad MANAGEMENT access):

| Rule name | Source alias | Dest alias | Service | Action |
|-----------|--------------|------------|---------|--------|
| `devcode → bared LLM HTTPS` | `ns_devcode` / `10.0.100.100` | `ns_bared_lan` / `10.0.254.10` | TCP 443 | Allow |

Proxmox VM chain: confirm `nervsys-vm-devcode.tf` attaches `ns_bared_llm_acc` (OUT 443 → bared).

## DNS

Ensure `bared.mngm.nexusecurus.lab` resolves to `10.0.254.10` from devcode (internal DNS — already in `tofu/modules/unifi-firewall/dns-records.tf`).

## Verification (from devcode-1)

```bash
TOKEN=$(bao kv get -field=devcode secret/bared-llm/api)
curl -sk -H "Authorization: Bearer $TOKEN" \
  https://bared.mngm.nexusecurus.lab/comfy/system_stats
# Expect HTTP 200 + JSON with comfyui_version and RTX 3090
```

If this fails:

1. Check Proxmox OUT rule on devcode VM
2. Check bared UFW allows `10.0.100.100` → 443
3. Check nginx + ComfyUI systemd units on bared

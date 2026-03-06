#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# claude-imagine installer
#
# Installs the MCP server binary, Claude Code skills, rules, and config.
# Auto-detects the image generation backend and discovers available models.
#
#   git clone <repo-url> claude-imagine
#   cd claude-imagine
#   ./install.sh
#
# Options:
#   --uninstall    Remove everything installed by this script
#   --check        Verify an existing installation
#   --verbose, -v  Show detailed output
# ─────────────────────────────────────────────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(REPO_DIR="${REPO_DIR}" node -e "process.stdout.write(require(process.env.REPO_DIR + '/package.json').version)" 2>/dev/null || echo "0.1.0")"
CLAUDE_DIR="${HOME}/.claude"
SKILLS_DIR="${CLAUDE_DIR}/skills"
COMMANDS_DIR="${CLAUDE_DIR}/commands"
RULES_DIR="${CLAUDE_DIR}/rules"
CONFIG_DIR="${HOME}/.config/claude-imagine"
VERBOSE="${VERBOSE:-0}"
INSTALL_SCOPE=""
PROJECT_DIR=""
LOG_FILE="$(mktemp)"
trap 'rm -f "$LOG_FILE" "${LOG_FILE}.setup"' EXIT

REQUIRED_REPO_FILES=(
    "package.json"
    "src/index.ts"
    "skills/claude-imagine/image-generate/SKILL.md"
    "skills/claude-imagine/image-suggest/SKILL.md"
    "commands/claude-imagine/image-generate.md"
    "commands/claude-imagine/image-suggest.md"
    "rules/image/image-generation.md"
    "config.example.json"
)

# ─────────────────────────────────────────────────────────────────────────────
# Terminal UI
# ─────────────────────────────────────────────────────────────────────────────

if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    DIM='\033[2m'
    BOLD='\033[1m'
    RESET='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' DIM='' BOLD='' RESET=''
fi

debug()   { [ "$VERBOSE" = "1" ] && echo -e "  ${DIM}$*${RESET}" || true; }
step()    { echo -e "  ${GREEN}+${RESET} $*"; }
warn()    { echo -e "  ${YELLOW}!${RESET} $*"; }
fail()    { echo -e "  ${RED}x${RESET} $*"; }
die()     { echo -e "\n  ${RED}Error:${RESET} $*"; exit 1; }
header()  { echo -e "\n  ${BOLD}$*${RESET}"; }
detail()  { echo -e "    ${DIM}$*${RESET}"; }

print_banner() {
    echo ""
    echo -e "  ${BOLD}claude-imagine${RESET} ${DIM}v${VERSION}${RESET}"
    echo -e "  ${DIM}AI image generation for Claude Code${RESET}"
    echo ""
}

print_line() {
    echo -e "  ${DIM}──────────────────────────────────────────────────${RESET}"
}

# ─────────────────────────────────────────────────────────────────────────────
# Scope selection
# ─────────────────────────────────────────────────────────────────────────────

choose_install_scope() {
    local verb="${1:-Install}"

    header "${verb} scope"
    echo ""
    echo -e "    ${CYAN}1${RESET}  Global  ${DIM}~/.claude/ (available in all projects)${RESET}"
    echo -e "    ${CYAN}2${RESET}  Local   ${DIM}a specific project directory${RESET}"
    echo ""

    local choice=""
    while true; do
        printf "  Choose [1/2]: "
        read -r choice
        case "$choice" in
            1) INSTALL_SCOPE="global"; CLAUDE_DIR="${HOME}/.claude"; break ;;
            2)
                INSTALL_SCOPE="local"
                local default_dir
                default_dir="$(pwd)"

                if [ "$default_dir" = "$REPO_DIR" ]; then
                    echo -e "    ${YELLOW}Warning: current directory is the claude-imagine repo.${RESET}"
                    echo -e "    ${DIM}Enter the path to the project you want to install into.${RESET}"
                fi

                echo ""
                printf "  Project directory [${default_dir}]: "
                read -r input_dir

                if [ -z "$input_dir" ]; then
                    PROJECT_DIR="$default_dir"
                else
                    PROJECT_DIR="${input_dir/#\~/$HOME}"
                fi

                if [ ! -d "$PROJECT_DIR" ]; then
                    printf "  Directory does not exist. Create it? [y/N]: "
                    read -r confirm
                    if [[ "$confirm" =~ ^[Yy]$ ]]; then
                        mkdir -p "$PROJECT_DIR"
                    else
                        echo -e "    ${RED}Aborted.${RESET}"
                        exit 1
                    fi
                fi

                CLAUDE_DIR="${PROJECT_DIR}/.claude"
                echo -e "    ${DIM}Project: ${PROJECT_DIR}${RESET}"
                break
                ;;
            *) echo -e "    ${DIM}Enter 1 or 2${RESET}" ;;
        esac
    done

    SKILLS_DIR="${CLAUDE_DIR}/skills"
    COMMANDS_DIR="${CLAUDE_DIR}/commands"
    RULES_DIR="${CLAUDE_DIR}/rules"
}

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

copy_file() {
    local src="$1" dst="$2"
    [ -f "$src" ] || die "Source file not found: $src"
    mkdir -p "$(dirname "$dst")"

    if [ -f "$dst" ]; then
        if diff -q "$src" "$dst" &>/dev/null; then
            debug "unchanged: $dst"
            return 0
        fi
        cp "$dst" "${dst}.bak"
        debug "backed up: ${dst}.bak"
    fi

    cp "$src" "$dst"
    debug "copied: $dst"
}

remove_file() {
    local path="$1"
    if [ -f "$path" ] || [ -L "$path" ]; then
        rm "$path" || { warn "Cannot remove: $path"; return 1; }
        debug "removed: $path"
        local parent
        parent="$(dirname "$path")"
        while [ "$parent" != "$CLAUDE_DIR" ] && [ "$parent" != "/" ] && [ "$parent" != "." ]; do
            if [ -d "$parent" ] && [ -z "$(ls -A "$parent")" ]; then
                rmdir "$parent" 2>/dev/null || break
                parent="$(dirname "$parent")"
            else
                break
            fi
        done
    fi
}

check_server_reachable() {
    local url="$1"
    local hostport host port
    hostport="$(echo "$url" | sed 's|^[a-z]*://||' | cut -d/ -f1)"
    host="$(echo "$hostport" | cut -d: -f1)"
    port="$(echo "$hostport" | cut -d: -f2)"
    if [ "$host" = "$port" ]; then
        case "$url" in
            https://*) port=443 ;;
            *)         port=80  ;;
        esac
    fi
    if command -v curl &>/dev/null; then
        curl -s --connect-timeout 5 --max-time 5 -o /dev/null "${url}" &>/dev/null
    elif command -v nc &>/dev/null; then
        nc -z -w 5 "$host" "$port" &>/dev/null
    else
        SERVER_HOST="$host" SERVER_PORT="$port" node -e "
          const net = require('net');
          const s = net.createConnection({ host: process.env.SERVER_HOST, port: +process.env.SERVER_PORT });
          s.setTimeout(5000);
          s.on('connect', () => { s.destroy(); process.exit(0); });
          s.on('error',   () => process.exit(1));
          s.on('timeout', () => { s.destroy(); process.exit(1); });
        " &>/dev/null
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Prerequisites
# ─────────────────────────────────────────────────────────────────────────────

check_prereqs() {
    header "Prerequisites"
    local errors=0

    if [ "$(id -u)" -eq 0 ]; then
        die "Do not run as root."
    fi

    # Claude Code
    if [ ! -d "$CLAUDE_DIR" ] && [ "$INSTALL_SCOPE" != "local" ]; then
        die "Claude Code not found at $CLAUDE_DIR\n         Install it first: https://docs.anthropic.com/en/docs/claude-code"
    fi

    # Node.js
    if command -v node &>/dev/null; then
        local node_version node_major
        node_version="$(node --version 2>/dev/null)"
        node_major="$(echo "$node_version" | sed 's/v//' | cut -d. -f1)"
        if [ "$node_major" -lt 20 ]; then
            fail "Node.js ${node_version} found, need 20+"
            errors=$((errors + 1))
        else
            step "Node.js ${node_version}"
        fi
    else
        fail "Node.js not found (need 20+)"
        errors=$((errors + 1))
    fi

    # npm
    if command -v npm &>/dev/null; then
        step "npm $(npm --version 2>/dev/null)"
    else
        fail "npm not found"
        errors=$((errors + 1))
    fi

    if [ "$errors" -gt 0 ]; then
        die "Missing $errors prerequisite(s)."
    fi

    for dir in "$SKILLS_DIR" "$COMMANDS_DIR" "$RULES_DIR" "$CONFIG_DIR"; do
        mkdir -p "$dir" 2>/dev/null || die "Cannot create directory: $dir"
    done
}

validate_repo() {
    local missing=0
    for file in "${REQUIRED_REPO_FILES[@]}"; do
        if [ ! -f "${REPO_DIR}/${file}" ]; then
            debug "missing: ${file}"
            missing=$((missing + 1))
        fi
    done

    if [ "$missing" -gt 0 ]; then
        die "Repository incomplete ($missing file(s) missing). Re-clone and try again."
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Install steps
# ─────────────────────────────────────────────────────────────────────────────

install_binary() {
    header "Building"
    debug "compiling TypeScript..."
    if ! npm run build --prefix "$REPO_DIR" >>"$LOG_FILE" 2>&1; then
        [ "$VERBOSE" = "1" ] || echo -e "\n${DIM}$(tail -20 "$LOG_FILE")${RESET}"
        die "Build failed. Re-run with --verbose for details."
    fi
    step "TypeScript compiled"

    debug "installing globally via npm..."
    if ! npm install -g "$REPO_DIR" >>"$LOG_FILE" 2>&1; then
        [ "$VERBOSE" = "1" ] || echo -e "\n${DIM}$(tail -20 "$LOG_FILE")${RESET}"
        die "npm install -g failed. Re-run with --verbose for details."
    fi

    if ! command -v claude-imagine &>/dev/null; then
        die "Binary not in PATH after install. Ensure npm global bin is in your PATH."
    fi

    step "Binary installed"
}

install_skills() {
    copy_file \
        "${REPO_DIR}/skills/claude-imagine/image-generate/SKILL.md" \
        "${SKILLS_DIR}/claude-imagine/image-generate/SKILL.md"
    copy_file \
        "${REPO_DIR}/skills/claude-imagine/image-suggest/SKILL.md" \
        "${SKILLS_DIR}/claude-imagine/image-suggest/SKILL.md"
    step "Skills installed"
}

install_commands() {
    copy_file \
        "${REPO_DIR}/commands/claude-imagine/image-generate.md" \
        "${COMMANDS_DIR}/claude-imagine/image-generate.md"
    copy_file \
        "${REPO_DIR}/commands/claude-imagine/image-suggest.md" \
        "${COMMANDS_DIR}/claude-imagine/image-suggest.md"
    remove_file "${COMMANDS_DIR}/image-generate.md" 2>/dev/null || true
    remove_file "${COMMANDS_DIR}/image-suggest.md" 2>/dev/null || true
    step "Commands installed"
}

install_rules() {
    copy_file \
        "${REPO_DIR}/rules/image/image-generation.md" \
        "${RULES_DIR}/image/image-generation.md"
    step "Rules installed"
}

install_claude_code() {
    header "Claude Code Integration"
    install_skills
    install_commands
    install_rules
}

# ─────────────────────────────────────────────────────────────────────────────
# Server configuration & model discovery
# ─────────────────────────────────────────────────────────────────────────────

prompt_numbered_list() {
    local label="$1"
    shift
    local items=("$@")
    local count="${#items[@]}"

    if [ "$count" -eq 0 ]; then
        return 1
    fi

    local i=1
    for item in "${items[@]}"; do
        echo -e "    ${CYAN}${i}${RESET}  ${item}" >&2
        i=$((i + 1))
    done
    echo "" >&2

    local choice=""
    while true; do
        printf "  ${label} [1-%d]: " "$count" >&2
        read -r choice < /dev/tty
        if [ -z "$choice" ]; then
            choice=1
        fi
        if [ "$choice" -ge 1 ] 2>/dev/null && [ "$choice" -le "$count" ] 2>/dev/null; then
            echo "$((choice - 1))"
            return 0
        fi
        echo -e "    ${DIM}Enter a number between 1 and ${count}${RESET}" >&2
    done
}

configure_unet_support_files() {
    local config_json="$1"
    local clip_files_str="$2"
    local vae_files_str="$3"

    local clip_files=()
    local vae_files=()

    while IFS= read -r line; do
        [ -n "$line" ] && clip_files+=("$line")
    done <<< "$clip_files_str"

    while IFS= read -r line; do
        [ -n "$line" ] && vae_files+=("$line")
    done <<< "$vae_files_str"

    echo "" >&2
    header "CLIP & VAE Configuration" >&2
    echo "" >&2
    detail "UNET models (e.g. Flux) require separate CLIP and VAE files." >&2
    detail "Select the files that match each model." >&2
    echo "" >&2

    local clip1="" clip2="" vae=""

    # Select CLIP 1
    if [ "${#clip_files[@]}" -gt 0 ]; then
        echo -e "  ${BOLD}CLIP model 1${RESET} ${DIM}(e.g. clip_l for Flux)${RESET}" >&2
        local idx
        idx="$(prompt_numbered_list "Select" "${clip_files[@]}")"
        clip1="${clip_files[$idx]}"
        step "CLIP 1: ${clip1}" >&2
        echo "" >&2
    fi

    # Select CLIP 2 (exclude already-selected CLIP 1)
    local clip2_candidates=()
    for f in "${clip_files[@]}"; do
        [ "$f" != "$clip1" ] && clip2_candidates+=("$f")
    done
    if [ "${#clip2_candidates[@]}" -gt 0 ]; then
        echo -e "  ${BOLD}CLIP model 2${RESET} ${DIM}(e.g. t5xxl for Flux)${RESET}" >&2
        local idx
        idx="$(prompt_numbered_list "Select" "${clip2_candidates[@]}")"
        clip2="${clip2_candidates[$idx]}"
        step "CLIP 2: ${clip2}" >&2
        echo "" >&2
    fi

    # Select VAE
    if [ "${#vae_files[@]}" -gt 0 ]; then
        echo -e "  ${BOLD}VAE model${RESET} ${DIM}(e.g. ae for Flux)${RESET}" >&2
        local idx
        idx="$(prompt_numbered_list "Select" "${vae_files[@]}")"
        vae="${vae_files[$idx]}"
        step "VAE: ${vae}" >&2
    fi

    # Patch config JSON using node (pass via stdin to avoid arg length limits)
    echo "$config_json" | CLIP1="$clip1" CLIP2="$clip2" VAE_NAME="$vae" node -e "
      let data = '';
      process.stdin.on('data', c => data += c);
      process.stdin.on('end', () => {
        const config = JSON.parse(data);
        const clip1 = process.env.CLIP1;
        const clip2 = process.env.CLIP2;
        const vae = process.env.VAE_NAME;
        for (const [id, model] of Object.entries(config.models || {})) {
          if (model.type === 'unet') {
            if (!model.params) model.params = {};
            if (clip1) model.params.clip_name1 = clip1;
            if (clip2) model.params.clip_name2 = clip2;
            if (vae) model.params.vae_name = vae;
          }
        }
        process.stdout.write(JSON.stringify(config, null, 2));
      });
    "
}

install_config() {
    local default_url="http://localhost:8188"
    local current_url=""

    if [ -f "${CONFIG_DIR}/config.json" ] && command -v node &>/dev/null; then
        current_url="$(CONFIG_PATH="${CONFIG_DIR}/config.json" node -e "try{const c=require(process.env.CONFIG_PATH);process.stdout.write((c.server&&c.server.url)||c.serverUrl||'')}catch(e){}" 2>/dev/null || true)"
    fi

    local prompt_default="${current_url:-${default_url}}"
    local server_url=""

    header "Server Configuration"
    echo ""

    while true; do
        printf "  Server URL [${CYAN}%s${RESET}]: " "${prompt_default}"
        read -r server_url
        server_url="${server_url:-${prompt_default}}"

        case "$server_url" in
            http://*|https://*) ;;
            *) server_url="http://${server_url}" ;;
        esac

        printf "  Connecting to ${CYAN}%s${RESET} ... " "${server_url}"
        if check_server_reachable "${server_url}"; then
            echo -e "${GREEN}OK${RESET}"
            break
        else
            echo -e "${RED}unreachable${RESET}"
            printf "  Use this URL anyway? [y/N]: "
            local answer=""
            read -r answer
            case "$answer" in
                [yY]*) break ;;
                *) echo "" ;;
            esac
        fi
    done

    mkdir -p "$CONFIG_DIR"

    # Auto-detection and model discovery
    if [ -f "${REPO_DIR}/dist/setup.js" ]; then
        echo ""
        header "Backend Detection"

        local setup_log="${LOG_FILE}.setup"

        # Phase 1: discover models (setup.js reads nothing from stdin when TTY)
        local setup_result=""
        setup_result="$(node "${REPO_DIR}/dist/setup.js" "${server_url}" < /dev/null 2>"${setup_log}" || true)"

        if [ -z "$setup_result" ]; then
            # Detection failed — show why
            local fail_reason=""
            while IFS= read -r line; do
                case "$line" in
                    BACKEND:FAIL) fail_reason="No supported backend detected" ;;
                    SETUP_ERROR:*) fail_reason="${line#SETUP_ERROR:}" ;;
                esac
            done < "$setup_log"

            warn "Auto-detection failed: ${fail_reason:-unknown error}"
            detail "The server may not be a supported backend (ComfyUI, A1111)"
            detail "Re-run install once your server is running"
            rm -f "$setup_log"
            return 1
        fi

        # Parse structured output from setup.js
        local detected_backend=""
        local model_count=0
        local model_ids=()
        local model_names=()
        local model_types=()
        local model_suggested_tiers=()

        while IFS= read -r line; do
            case "$line" in
                BACKEND:*)
                    detected_backend="${line#BACKEND:}"
                    step "Backend: ${BOLD}${detected_backend}${RESET}"
                    ;;
                MODELS:*)
                    model_count="${line#MODELS:}"
                    ;;
                MODEL:*)
                    local model_data="${line#MODEL:}"
                    local m_type m_file m_name m_suggested
                    m_type="$(echo "$model_data" | cut -d: -f1)"
                    m_file="$(echo "$model_data" | cut -d: -f2)"
                    m_name="$(echo "$model_data" | cut -d: -f3)"
                    m_suggested="$(echo "$model_data" | cut -d: -f4)"

                    # Derive ID from filename (same as discover.ts)
                    local m_id
                    m_id="$(echo "$m_file" | sed 's/\.[^.]*$//' | sed 's/[^a-zA-Z0-9]/_/g' | sed 's/__*/_/g' | sed 's/^_//;s/_$//' | tr '[:upper:]' '[:lower:]')"
                    model_ids+=("$m_id")
                    model_names+=("$m_name")
                    model_types+=("$m_type")
                    model_suggested_tiers+=("$m_suggested")
                    ;;
            esac
        done < "$setup_log"

        if [ "$model_count" -eq 0 ]; then
            warn "No models found on server"
            rm -f "$setup_log"
            return 1
        fi

        echo ""
        header "Discovered Models (${model_count})"
        echo ""
        echo -e "    ${BOLD}Type          Model${RESET}"
        print_line

        for i in "${!model_ids[@]}"; do
            local type_color="$RESET"
            case "${model_types[$i]}" in
                checkpoint) type_color="$YELLOW" ;;
                unet)       type_color="$BLUE" ;;
            esac
            printf "    ${type_color}%-13s${RESET} %s\n" \
                "${model_types[$i]}" "${model_names[$i]}"
        done

        echo ""
        header "Quality Tier Assignment"
        echo ""
        detail "Assign each model a quality tier. This determines which image types use it."
        detail "  fast     = ICON, THUMBNAIL, BACKGROUND, TEXTURE"
        detail "  standard = AVATAR, CONTENT, BANNER, PRODUCT"
        detail "  high     = LOGO, HERO, FEATURED"
        echo ""

        local tier_assignments=""
        for i in "${!model_ids[@]}"; do
            local m_id="${model_ids[$i]}"
            local m_name="${model_names[$i]}"
            local m_suggested="${model_suggested_tiers[$i]}"

            local tier=""
            while true; do
                printf "  ${BOLD}%s${RESET} [%s]: " "$m_name" "$m_suggested"
                read -r tier
                tier="${tier:-$m_suggested}"
                case "$tier" in
                    fast|standard|high) break ;;
                    *) echo "    Please enter: fast, standard, or high" ;;
                esac
            done

            step "${m_name} -> ${tier}"
            tier_assignments="${tier_assignments}${m_id}:${tier}\n"
        done

        # Phase 2: re-run setup.js with tier assignments piped to stdin
        setup_result="$(printf '%b' "$tier_assignments" | node "${REPO_DIR}/dist/setup.js" "${server_url}" 2>/dev/null || true)"

        if [ -z "$setup_result" ]; then
            warn "Failed to build config with tier assignments"
            rm -f "$setup_log"
            return 1
        fi

        # CLIP/VAE configuration for UNET models
        local has_unets=0
        local clip_files=()
        local vae_files=()

        while IFS= read -r line; do
            case "$line" in
                HAS_UNETS:true) has_unets=1 ;;
                CLIP_FILE:*)    clip_files+=("${line#CLIP_FILE:}") ;;
                VAE_FILE:*)     vae_files+=("${line#VAE_FILE:}") ;;
            esac
        done < "$setup_log"

        if [ "$has_unets" -eq 1 ] && { [ "${#clip_files[@]}" -gt 0 ] || [ "${#vae_files[@]}" -gt 0 ]; }; then
            setup_result="$(configure_unet_support_files "$setup_result" \
                "$(printf '%s\n' "${clip_files[@]}")" \
                "$(printf '%s\n' "${vae_files[@]}")")"
        fi

        echo ""
        echo "$setup_result" > "${CONFIG_DIR}/config.json"
        rm -f "$setup_log"
        step "Config saved (${CONFIG_DIR}/config.json)"
        return 0
    else
        die "Setup binary not found. Run 'npm run build' first."
    fi
}

register_mcp_server() {
    local mcp_scope="user"
    if [ "$INSTALL_SCOPE" = "local" ]; then
        mcp_scope="project"
    fi

    if command -v claude &>/dev/null; then
        local run_in_dir="${PROJECT_DIR:-.}"
        if (
            cd "$run_in_dir"
            # Remove first to avoid duplicates, then add
            claude mcp remove claude-imagine -s "$mcp_scope" >>"$LOG_FILE" 2>&1 || true
            claude mcp add -s "$mcp_scope" claude-imagine -- npx -y claude-imagine --server >>"$LOG_FILE" 2>&1
        ); then
            step "MCP server registered with Claude Code (${mcp_scope})"
        else
            warn "Could not register MCP server (try: claude mcp add -s ${mcp_scope} claude-imagine -- npx -y claude-imagine --server)"
        fi
    else
        warn "Claude Code CLI not found — register manually: claude mcp add -s ${mcp_scope} claude-imagine -- npx -y claude-imagine --server"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Install
# ─────────────────────────────────────────────────────────────────────────────

do_install() {
    print_banner

    choose_install_scope "Install"
    validate_repo

    check_prereqs
    install_binary
    install_claude_code
    install_config
    register_mcp_server

    echo ""
    print_line
    echo ""
    echo -e "  ${GREEN}${BOLD}Installation complete${RESET}"
    echo ""
    echo -e "  ${BOLD}Next steps:${RESET}"
    echo ""
    echo -e "    Restart Claude Code, then generate images:"
    echo -e "       ${CYAN}/claude-imagine:image-generate${RESET}"
    echo -e "       ${CYAN}/claude-imagine:image-suggest${RESET}"
    echo ""
    echo -e "  ${DIM}Config: ${CONFIG_DIR}/config.json${RESET}"
    echo -e "  ${DIM}Edit config to customize model assignments or add models${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Uninstall
# ─────────────────────────────────────────────────────────────────────────────

do_uninstall() {
    print_banner
    choose_install_scope "Uninstall"

    header "Removing components"

    remove_file "${SKILLS_DIR}/claude-imagine/image-generate/SKILL.md"
    remove_file "${SKILLS_DIR}/claude-imagine/image-suggest/SKILL.md"
    step "Skills removed"

    remove_file "${COMMANDS_DIR}/claude-imagine/image-generate.md"
    remove_file "${COMMANDS_DIR}/claude-imagine/image-suggest.md"
    remove_file "${COMMANDS_DIR}/image-generate.md" 2>/dev/null || true
    remove_file "${COMMANDS_DIR}/image-suggest.md" 2>/dev/null || true
    step "Commands removed"

    remove_file "${RULES_DIR}/image/image-generation.md"
    step "Rules removed"

    # Deregister MCP server from Claude Code
    local mcp_scope="user"
    if [ "$INSTALL_SCOPE" = "local" ]; then
        mcp_scope="project"
    fi

    if command -v claude &>/dev/null; then
        local run_in_dir="${PROJECT_DIR:-.}"
        if (cd "$run_in_dir" && claude mcp remove claude-imagine -s "$mcp_scope" >>"$LOG_FILE" 2>&1); then
            step "MCP server deregistered from Claude Code (${mcp_scope})"
        else
            warn "Could not deregister MCP server (try: claude mcp remove claude-imagine -s ${mcp_scope})"
        fi
    else
        warn "Claude Code CLI not found — deregister manually: claude mcp remove claude-imagine -s ${mcp_scope}"
    fi

    if command -v claude-imagine &>/dev/null; then
        if command -v npm &>/dev/null; then
            if npm uninstall -g claude-imagine >>"$LOG_FILE" 2>&1; then
                step "Binary uninstalled"
            else
                warn "Could not uninstall binary (try: npm uninstall -g claude-imagine)"
            fi
        else
            warn "npm not found — remove manually: $(command -v claude-imagine)"
        fi
    else
        step "Binary not installed (skip)"
    fi

    if [ -f "${CONFIG_DIR}/config.json" ] || [ -f "${CONFIG_DIR}/mcp.json" ]; then
        warn "Config preserved: ${CONFIG_DIR}/ (delete manually if unneeded)"
    fi

    echo ""
    print_line
    echo ""
    echo -e "  ${BOLD}Uninstall complete.${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Check
# ─────────────────────────────────────────────────────────────────────────────

do_check() {
    print_banner

    header "Installation Status"
    local errors=0 warnings=0

    # Binary
    if command -v claude-imagine &>/dev/null; then
        step "Binary: $(command -v claude-imagine)"
    else
        warn "Binary: not in PATH (will run via npx)"
        warnings=$((warnings + 1))
    fi

    # Skills
    for skill in image-generate image-suggest; do
        if [ -f "${SKILLS_DIR}/claude-imagine/${skill}/SKILL.md" ]; then
            step "Skill: ${skill}"
        else
            fail "Skill: ${skill} missing"
            errors=$((errors + 1))
        fi
    done

    # Commands
    for cmd in image-generate image-suggest; do
        if [ -f "${COMMANDS_DIR}/claude-imagine/${cmd}.md" ]; then
            step "Command: /claude-imagine:${cmd}"
        else
            fail "Command: /claude-imagine:${cmd} missing"
            errors=$((errors + 1))
        fi
    done

    # Rule
    if [ -f "${RULES_DIR}/image/image-generation.md" ]; then
        step "Rule: image-generation"
    else
        fail "Rule: image-generation missing"
        errors=$((errors + 1))
    fi

    # Config
    if [ -f "${CONFIG_DIR}/config.json" ]; then
        step "Config: ${CONFIG_DIR}/config.json"

        # Show configured backend and model count
        if command -v node &>/dev/null; then
            local config_info
            config_info="$(CONFIG_PATH="${CONFIG_DIR}/config.json" node -e "
              try {
                const c = require(process.env.CONFIG_PATH);
                const b = c.backend || 'unknown';
                const m = c.models ? Object.keys(c.models).length : 0;
                console.log(b + ':' + m);
              } catch(e) { console.log('error:0'); }
            " 2>/dev/null || echo "error:0")"

            local cfg_backend cfg_models
            cfg_backend="$(echo "$config_info" | cut -d: -f1)"
            cfg_models="$(echo "$config_info" | cut -d: -f2)"
            detail "Backend: ${cfg_backend}, Models: ${cfg_models}"
        fi
    else
        warn "Config: not found (using defaults)"
        warnings=$((warnings + 1))
    fi

    # MCP template
    if [ -f "${CONFIG_DIR}/mcp.json" ]; then
        step "MCP template: ${CONFIG_DIR}/mcp.json"
    else
        warn "MCP template: not found"
        warnings=$((warnings + 1))
    fi

    # Server connectivity
    header "Server"
    local server_url=""
    if [ -f "${CONFIG_DIR}/config.json" ] && command -v node &>/dev/null; then
        server_url="$(CONFIG_PATH="${CONFIG_DIR}/config.json" node -e "try{const c=require(process.env.CONFIG_PATH);console.log((c.server&&c.server.url)||c.serverUrl||'')}catch(e){}" 2>/dev/null || true)"
    fi
    server_url="${server_url:-http://localhost:8188}"

    printf "  Connecting to ${CYAN}%s${RESET} ... " "${server_url}"
    if check_server_reachable "${server_url}"; then
        echo -e "${GREEN}OK${RESET}"
    else
        echo -e "${RED}unreachable${RESET}"
        warnings=$((warnings + 1))
    fi

    echo ""
    print_line
    echo ""
    if [ "$errors" -eq 0 ] && [ "$warnings" -eq 0 ]; then
        echo -e "  ${GREEN}All checks passed.${RESET}"
    elif [ "$errors" -eq 0 ]; then
        echo -e "  ${GREEN}OK${RESET} with ${warnings} warning(s)."
    else
        echo -e "  ${RED}${errors} issue(s) found.${RESET} Re-run ./install.sh to fix."
    fi
    echo ""

    return "$errors"
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

ACTION=""
for arg in "$@"; do
    case "$arg" in
        --verbose|-v) VERBOSE=1 ;;
        --uninstall)  ACTION="uninstall" ;;
        --check)      ACTION="check" ;;
        --help|-h)    ACTION="help" ;;
        *)            die "Unknown option: $arg — run ./install.sh --help" ;;
    esac
done

case "${ACTION}" in
    uninstall) do_uninstall ;;
    check)     do_check ;;
    help)
        echo ""
        echo -e "  ${BOLD}claude-imagine${RESET} installer v${VERSION}"
        echo ""
        echo "  Usage: ./install.sh [options]"
        echo ""
        echo "    (no args)      Install claude-imagine"
        echo "    --uninstall    Remove everything installed by this script"
        echo "    --check        Verify an existing installation"
        echo "    --verbose, -v  Show detailed output"
        echo ""
        ;;
    "")        do_install ;;
esac

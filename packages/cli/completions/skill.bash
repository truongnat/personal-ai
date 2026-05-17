#!/bin/bash
# Bash completion for skill CLI

_skill_completions() {
    local cur prev
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    local commands="kb skill auth config help"

    # KB subcommands
    local kb_commands="search push list get update delete"

    # Skill subcommands
    local skill_commands="publish install compose search list info"

    # Config subcommands
    local config_commands="set get list"

    case "${COMP_WORDS[1]}" in
        kb)
            case "${COMP_WORDS[2]}" in
                search)
                    if [[ "$prev" == "--limit" ]]; then
                        COMPREPLY=($(compgen -W "5 10 20 50" -- "$cur"))
                    elif [[ "$prev" == "--tag" ]]; then
                        # Suggest recent tags (would need to query API)
                        COMPREPLY=($(compgen -W "backend frontend devops neo4j performance" -- "$cur"))
                    else
                        COMPREPLY=($(compgen -W "--limit --tag --project --json" -- "$cur"))
                    fi
                    ;;
                push)
                    if [[ "$cur" == -* ]]; then
                        COMPREPLY=($(compgen -W "--tags --project --ticket --json" -- "$cur"))
                    else
                        # Suggest .md files
                        COMPREPLY=($(compgen -f -X '!*.md' -- "$cur"))
                    fi
                    ;;
                *)
                    COMPREPLY=($(compgen -W "$kb_commands" -- "$cur"))
                    ;;
            esac
            ;;
        skill)
            COMPREPLY=($(compgen -W "$skill_commands" -- "$cur"))
            ;;
        config)
            if [[ "$prev" == "set" ]]; then
                COMPREPLY=($(compgen -W "hub_url api_key skills_dir default_project" -- "$cur"))
            else
                COMPREPLY=($(compgen -W "$config_commands" -- "$cur"))
            fi
            ;;
        *)
            COMPREPLY=($(compgen -W "$commands" -- "$cur"))
            ;;
    esac
}

complete -o bashdefault -o default -o nospace -F _skill_completions skill

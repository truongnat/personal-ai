#!/bin/zsh
# Zsh completion for skill CLI

_skill_completion() {
    local -a _commands _kb_commands _skill_commands _config_commands

    _commands=(
        'kb:Knowledge base operations'
        'skill:Skill management'
        'config:Configuration'
        'auth:Authentication'
        'help:Show help'
    )

    _kb_commands=(
        'search:Search knowledge base'
        'push:Push solution to KB'
        'list:List solutions'
        'get:Get solution by ID'
        'update:Update solution'
        'delete:Delete solution'
    )

    _skill_commands=(
        'publish:Publish new skill'
        'install:Install skill'
        'compose:Compose multiple skills'
        'search:Search skills'
        'list:List all skills'
        'info:Get skill info'
    )

    _config_commands=(
        'set:Set config value'
        'get:Get config value'
        'list:List all config'
    )

    local context state line
    _arguments -C \
        '1: :->commands' \
        '2: :->subcommands' \
        '3: :->subcommand_args' \
        '*::args:->args'

    case $state in
        commands)
            _describe 'commands' _commands
            ;;
        subcommands)
            case ${line[1]} in
                kb)
                    _describe 'kb commands' _kb_commands
                    ;;
                skill)
                    _describe 'skill commands' _skill_commands
                    ;;
                config)
                    _describe 'config commands' _config_commands
                    ;;
            esac
            ;;
        subcommand_args)
            case ${line[1]} in
                kb)
                    case ${line[2]} in
                        search)
                            _arguments \
                                '--limit[Result limit]:(5 10 20 50)' \
                                '--tag[Filter by tag]:' \
                                '--project[Filter by project]:' \
                                '--json[JSON output]'
                            ;;
                        push)
                            _arguments \
                                '--tags[Tags for solution]:' \
                                '--project[Project name]:' \
                                '--ticket[Ticket reference]:' \
                                '--json[JSON output]'
                            _files -g '*.md'
                            ;;
                    esac
                    ;;
            esac
            ;;
    esac
}

compdef _skill_completion skill

#!/bin/bash
# Install git hooks for KB integration

HOOKS_DIR=".git/hooks"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "📚 Installing KB git hooks..."

# Create pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash
# Auto-search KB before commit for relevant solutions

if ! command -v skill &> /dev/null; then
    exit 0
fi

# Extract commit subject from staged changes (heuristic)
FILES=$(git diff --cached --name-only | head -5)
KEYWORDS=$(echo "$FILES" | sed 's/[^a-zA-Z0-9 ]/ /g' | tr ' ' '\n' | sort -u | head -3 | tr '\n' ' ')

if [ -z "$KEYWORDS" ]; then
    exit 0
fi

echo ""
echo "🔍 Searching KB for relevant solutions..."
if skill kb search "$KEYWORDS" 2>/dev/null | grep -q "results"; then
    echo "✅ Found relevant solutions. Consider reviewing before committing."
    echo ""
fi

exit 0
EOF

# Create post-merge hook
cat > "$HOOKS_DIR/post-merge" << 'EOF'
#!/bin/bash
# Reminder to push solution after merge

if [ "$1" != "0" ]; then
    exit 0
fi

if ! command -v skill &> /dev/null; then
    exit 0
fi

echo ""
echo "💡 Reminder: Did you solve a ticket? Push a solution!"
echo "   skill kb push ./solution.md --tags issue,resolved --project your-project"
echo ""

exit 0
EOF

# Create post-checkout hook (for branch switching)
cat > "$HOOKS_DIR/post-checkout" << 'EOF'
#!/bin/bash
# Show KB stats when switching branches (optional)

if [ "$3" != "1" ]; then
    exit 0
fi

if ! command -v skill &> /dev/null; then
    exit 0
fi

# Only show on branch switches, not initial checkout
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" =~ ^feature ]]; then
    echo "📊 KB stats for this project:"
    skill stats --project "$(basename $(pwd))" 2>/dev/null | head -3
fi

exit 0
EOF

# Make hooks executable
chmod +x "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/post-merge"
chmod +x "$HOOKS_DIR/post-checkout"

echo "✅ Git hooks installed:"
echo "   • pre-commit: Auto-search KB for relevant solutions"
echo "   • post-merge: Remind to push solutions"
echo "   • post-checkout: Show KB stats on branch switch"
echo ""
echo "To uninstall: rm .git/hooks/pre-{commit,checkout} .git/hooks/post-merge"

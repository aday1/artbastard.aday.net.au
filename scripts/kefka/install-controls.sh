#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/.local/share/artbastard" "$HOME/.local/share/applications" \
  "$HOME/.local/bin" "$HOME/.config/systemd/user" "$HOME/.config/kefka"
stamp=$(date +%Y%m%d-%H%M%S)
for name in artbastard-input.service artbastard-deck.service; do
  target="$HOME/.config/systemd/user/$name"
  if [[ -f "$target" ]]; then cp -a "$target" "$target.bak.$stamp"; fi
  install -m 644 "$here/$name" "$target"
done
install -m 644 "$here/deck-input.py" "$HOME/.local/share/artbastard/deck-input.py"
classes="$HOME/.config/kefka/game-classes"
pattern='^chrome-127\.0\.0\.1__deck-control\.html-Default$'
if ! grep -Fxq "$pattern" "$classes" 2>/dev/null; then
  if [[ -f "$classes" ]]; then cp -a "$classes" "$classes.bak.$stamp"; fi
  printf '\n# Artbastard native Deck buttons.\n%s\n' "$pattern" >> "$classes"
  if systemctl --user is-active --quiet deckhypr.service; then
    systemctl --user restart deckhypr.service
  fi
fi
cat > "$HOME/.local/bin/artbastard-deck-open" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
systemctl --user start artbastard-deck.service
for _ in {1..30}; do
  if hyprctl clients | grep -Fq 'chrome-127.0.0.1__deck-control.html-Default'; then
    hyprctl dispatch focuswindow 'class:^chrome-127\.0\.0\.1__deck-control\.html-Default$' >/dev/null
    exit 0
  fi
  sleep 0.1
done
SH
chmod 755 "$HOME/.local/bin/artbastard-deck-open"
cat > "$HOME/.local/share/applications/artbastard-deck.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=ArtBastard Deck
Comment=DMX lighting, scenes and Steam Deck controls
Exec=$HOME/.local/bin/artbastard-deck-open
Icon=applications-multimedia
Terminal=false
Categories=AudioVideo;X-Kefka;
DESKTOP
systemctl --user daemon-reload
systemctl --user try-restart artbastard-input.service

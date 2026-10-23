# Example profiles

Ready-made looks to start from. Download one and drop it onto the editor (or choose
**Import profile file…** in the profile menu), then apply it to any place.

A profile is a small JSON file. It describes the look of a poster and, if you choose so when
saving, the place and text as well:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/dev-nick421/i-was-here/main/docs/profile.schema.json",
  "app": "i-was-here",
  "kind": "profile",
  "version": 1,
  "name": "Midnight Lens",
  "style": {
    "layout": "halo",            // classic (Atlas) | card (Ticket) | poster (Horizon) | halo (Lens) |
                                 // square (Polaroid) | architect (Label) | banner (Ribbon) | mapOnly (Pure)
    "frame": "double",           // none | margin | line | double
    "themeId": "midnight",       // or "custom"
    "colors": { "land": "#1b2a41", "water": "#101b2c", "roads": "#e9eef5", "...": "..." },
    "map": { "detail": "medium", "roads": "standard", "buildings": true, "parks": false, "...": "..." },
    "typography": { "font": "elegant", "size": "m", "uppercase": true, "coordFormat": "dms" },
    "output": { "paper": "50x70", "orientation": "portrait", "resolution": "print300", "fileType": "png" }
  }
}
```

- The full format is described by the JSON Schema in
  [`docs/profile.schema.json`](../docs/profile.schema.json).
- Importing is forgiving: unknown keys are ignored, missing or invalid values fall back to
  defaults, and numbers are clamped. Hand-edited files are fine.
- Several profiles can travel in one file (*Manage profiles → Export all*).

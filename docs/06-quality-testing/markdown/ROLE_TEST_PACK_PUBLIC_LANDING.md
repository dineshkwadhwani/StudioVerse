# StudioVerse — Public Landing Test Pack

Primary actor: Guest visitor and SuperAdmin configuring landing settings

## Journeys In Scope

- `LAND-01` Default Landing Rendering
- `LAND-02` Toggle Programs Section
- `LAND-03` Toggle Tools Section
- `LAND-04` Toggle Events Section
- `LAND-05` Validate Carousel Limits And Labels
- `LAND-06` Signed-In Header State

## Regression Order

1. Base rendering: `LAND-01`
2. Section toggles: `LAND-02`, `LAND-03`, `LAND-04`
3. Presentation controls: `LAND-05`
4. Auth state change: `LAND-06`

## Exit Criteria

- DB landing configuration overrides the static defaults.
- Programs, Tools, and Events sections toggle correctly.
- Labels, intros, and carousel limits are reflected in the UI.
- Signed-out and signed-in header states are correct.

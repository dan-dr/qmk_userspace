/**
 * Manual inject scripts shown under the Argos Desktop "Inject" menu.
 * Add a new entry + matching .js file in this directory to expose it.
 */
export const injectMenuScripts = [
  {
    id: "combo-chord-capture",
    label: "Combo Chord Capture",
    file: "combo-chord-capture.js",
    detail:
      "Click a combo slot in Argos, then press mod+key chords (e.g. Shift+F). Escape cancels."
  }
];

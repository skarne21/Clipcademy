// 'live' calls the API on the same origin; 'samples' answers from learning/samples/.
// Switch with VITE_DATA_MODE=samples npm run dev
export const DATA_MODE = import.meta.env.VITE_DATA_MODE ?? 'live'

// Set when the build is frozen. Must be on the server's CLIPCADEMY_BUILD_IDS.
export const BUILD_ID = 'study-4'

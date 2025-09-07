// Halftone utility replaced with a no-op passthrough to disable effects.
// This keeps any callers working but avoids CPU-heavy processing.

export async function halftone(buffer, _opts = {}) {
  // Return the input buffer unchanged so callers receive the original image.
  return buffer;
}

export default halftone;

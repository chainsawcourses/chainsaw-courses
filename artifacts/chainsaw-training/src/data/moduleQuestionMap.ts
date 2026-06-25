/**
 * Maps module DB IDs to the question IDs from VOCAL_EXAM_QUESTIONS that are
 * relevant to that module. Used to filter the mock assessment when launched
 * from a specific training module's completion overlay.
 */
export const MODULE_QUESTION_MAP: Record<number, number[]> = {
  9:  [],                                    // PPE & First Aid — no vocal exam Qs
  10: [1],                                   // 5 Steps To Risk Assessment
  11: [2, 3, 4],                             // Hazards & Risks
  12: [5],                                   // Emergency Planning Information
  13: [6, 7, 8],                             // Law & Legislation
  14: [9, 10, 11],                           // Chainsaw Safety Features
  40: [12, 13, 14],                          // Battery Chainsaws
  15: [15, 16, 17, 18],                      // Air Filter
  16: [19, 20, 21],                          // Spark Plug
  17: [22, 23],                              // Cooling System
  18: [24, 25, 26],                          // Exhaust
  19: [27, 28],                              // Fuel & Oil Filters
  20: [29, 30],                              // Recoil Starter
  21: [31],                                  // Clutch Assembly
  22: [32, 33, 34, 35],                      // Sprocket
  23: [36, 37, 38],                          // Chain Brake
  24: [39, 40, 41],                          // Guidebar
  25: [42, 43],                              // Chain Basics
  26: [42, 43],                              // Chain Tension
  27: [44, 45, 46, 47, 48],                  // Identifying The Chain
  28: [42, 43, 44, 45],                      // Replacing The Chain
  29: [49, 50, 51, 52, 53, 54, 55, 56, 57], // Chain Sharpening
  30: [69, 70],                              // Stacking
  31: [58, 68],                              // Work Positioning
  32: [71],                                  // Pre-Start Checks
  33: [43, 71],                              // Starting The Chainsaw
  34: [72],                                  // Pre-Use Checks
  35: [59, 60],                              // Cutting Basics
  36: [61, 62, 65],                          // Tension & Compression
  37: [63],                                  // Releasing A Trapped Chainsaw
  38: [64, 66],                              // Bore Cutting
  39: [65, 67],                              // Oversized & Tensioned Timber
};

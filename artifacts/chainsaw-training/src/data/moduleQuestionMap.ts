/**
 * Maps module DB IDs to the spoken question IDs from VOCAL_EXAM_QUESTIONS that are
 * relevant to that module. Action-only questions (isAction: true — physical tasks
 * with no verbal answer) are excluded from all module sets.
 *
 * Action question IDs excluded everywhere: 15, 29, 31, 42, 43, 73, 74, 75
 */
export const MODULE_QUESTION_MAP: Record<number, number[]> = {
  9:  [77],                                  // PPE & First Aid
  10: [1],                                   // 5 Steps To Risk Assessment
  11: [2, 3, 4],                             // Hazards & Risks
  12: [5],                                   // Emergency Planning Information
  13: [6, 7, 8],                             // Law & Regulations
  14: [9, 10, 11],                           // Chainsaw Safety Features
  40: [12, 13, 14],                          // Battery Chainsaws
  15: [16, 17, 18],                          // Air Filter (Q15 is a physical action — excluded)
  16: [19, 20, 21],                          // Spark Plug
  17: [22, 23],                              // Cooling System
  18: [24, 25, 26],                          // Exhaust
  19: [27, 28],                              // Fuel & Oil Filters
  41: [],                                    // The Oiling System (questions TBD)
  20: [30],                                  // Recoil Starter (Q29 is a physical action — excluded)
  21: [],                                    // Clutch Assembly (Q31 is a physical action only)
  22: [32, 33, 34, 35],                      // Sprocket
  23: [36, 37, 38],                          // Chain Brake
  24: [39, 40, 41],                          // Guidebar
  25: [],                                    // Chain Basics (Q42/Q43 are physical actions only)
  26: [],                                    // Chain Tension (Q42/Q43 are physical actions only)
  27: [44, 45, 46, 47, 48],                  // How to identify a chainsaw chain
  28: [44, 45],                              // Replacing The Chain (Q42/Q43 excluded as actions)
  29: [49, 50, 51, 52, 53, 54, 55, 56, 57], // Chain Sharpening
  42: [76],                                  // Kickback
  30: [69, 70],                              // Stacking
  43: [],                                    // Additional Cuts (questions TBD)
  31: [58, 68],                              // Work Positioning
  32: [71],                                  // Pre-Start Checks
  33: [71],                                  // Starting The Chainsaw (Q43 excluded as action)
  34: [72],                                  // Pre-Use Checks
  35: [59, 60],                              // Cutting Basics
  36: [61, 62, 65],                          // Tension & Compression
  37: [63],                                  // Releasing A Trapped Chainsaw
  38: [64, 66],                              // Bore Cutting
  39: [65, 67],                              // Oversized & Tensioned Timber
};

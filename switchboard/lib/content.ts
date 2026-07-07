// Hand-written content so the mocked exchange reads like real conversations,
// not lorem ipsum. Everything here is generated in code, zero external calls.

export const CALLERS = [
  "Marguerite Adeyemi", "Tomas Vlk", "Priya Nair", "Colm Beecher",
  "Ines Haddad", "Rafael Ortiz", "Nadia Roussel", "Wen Li",
  "Peter Okonkwo", "Astrid Solberg", "Yusuf Demir", "Bianca Rossi",
  "Dermot Walsh", "Fatima Zahra", "Lars Pedersen", "Grace Mbeki",
  "Otto Kirchner", "Sofia Marchetti", "Ravi Kapoor", "Elin Bergqvist",
  "Kwame Asante", "Noor Al-Rashid", "Hiroshi Tanaka", "Aoife Byrne",
  "Mateus Silva", "Zara Okafor", "Lucien Moreau", "Anouk de Vries",
];

// A topic plus a short, human opening line and the shape the AI takes.
export const SCENARIOS: {
  topic: string;
  opener: string;
  aiTurns: string[];
  handoff?: string; // why the AI would hold for a human
}[] = [
  {
    topic: "Refund on a duplicate charge",
    opener: "I was billed twice for the March order and I need one of them back.",
    aiTurns: [
      "I can see two charges of forty two pounds against the March order, four minutes apart.",
      "The second one is a duplicate. I have started the reversal now.",
      "You should see it back on the same card within three working days. Anything else on this?",
    ],
    handoff: "Refund is over the auto-approve limit and needs a human sign-off.",
  },
  {
    topic: "Cannot log in after email change",
    opener: "I changed my email last week and now nothing lets me in.",
    aiTurns: [
      "Your old address still holds the login. The new one never finished verifying.",
      "I have resent the verification link to the new address. It lands in about a minute.",
      "Once you click it, the old address stops working and you are back in.",
    ],
  },
  {
    topic: "Where is my delivery",
    opener: "The tracking has said out for delivery since yesterday morning.",
    aiTurns: [
      "The courier scanned it at the local depot at six last night, then nothing.",
      "That pattern usually means a missed van load, not a lost parcel.",
      "I have flagged it for redelivery tomorrow and put a note on your account.",
    ],
    handoff: "Courier claims need a human to file with the carrier portal.",
  },
  {
    topic: "Cancel before renewal",
    opener: "I do not want it to renew on the ninth. Can you stop that.",
    aiTurns: [
      "Your plan renews on the ninth at nine in the morning for the annual rate.",
      "I can turn off the renewal so it lapses at the end of this term instead.",
      "Done. You keep everything until the ninth, then it simply stops. No charge.",
    ],
  },
  {
    topic: "Item arrived damaged",
    opener: "The corner of the unit is cracked right out of the box.",
    aiTurns: [
      "That should never leave the warehouse in that state. Sorry.",
      "I can send a replacement on next-day and a prepaid label for the broken one.",
      "Do you want the replacement to the same address, or somewhere you will be?",
    ],
    handoff: "Caller is upset and asked to speak to a person.",
  },
  {
    topic: "Dispute a late fee",
    opener: "There is a late fee but I paid on time, I have the receipt.",
    aiTurns: [
      "I see the payment landed on the second, and the fee was applied on the third.",
      "The fee looks like it fired before the payment cleared overnight.",
      "I have removed it and left a note so it does not come back.",
    ],
  },
  {
    topic: "Change the delivery address",
    opener: "I moved. The next box needs to go to the new place.",
    aiTurns: [
      "The next box is scheduled for the twelfth, still going to the old address.",
      "I can redirect it if you give me the new postcode and house number.",
      "Redirected. Everything after this ships to the new address by default.",
    ],
  },
  {
    topic: "Booking clashes with a closure",
    opener: "I booked the fourteenth but I heard you are shut that week.",
    aiTurns: [
      "You are right, the site is closed the whole of that week for works.",
      "The booking system should have blocked it. That is on us.",
      "I can move you to the same slot the following week at no cost.",
    ],
    handoff: "Rebooking during the closure needs a manager to confirm capacity.",
  },
];

export const WAITING_LINES = [
  "Caller asked for a human.",
  "Refund above the AI limit.",
  "Account flagged for manual review.",
  "Repeated contact in 24 hours.",
  "Low confidence on the last answer.",
];

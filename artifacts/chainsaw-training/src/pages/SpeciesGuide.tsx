import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Search, Leaf, X, AlertTriangle, Flame, Axe } from "lucide-react";
import { Button } from "@/components/ui/button";

function LogEndIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.75" />
      <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.6" />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" />
      <circle cx="12" cy="12" r="0.7" fill="currentColor" />
      <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="0.4" strokeOpacity="0.2" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="0.4" strokeOpacity="0.2" />
    </svg>
  );
}

interface Species {
  common: string;
  scientific: string;
  native: boolean;
  wildlifeValue: "High" | "Medium" | "Low";
  traits: string[];
  firewood: {
    value: "Excellent" | "Good" | "Poor";
    seasoning: string;
    spitRisk: "Low" | "Medium" | "High";
    burn: string;
  };
  timber: {
    value: "High" | "Medium" | "Low";
    note: string;
  };
  crafts: string;
  pests: string;
  safety: string | null;
}

const SPECIES: Species[] = [
  {
    common: "English Oak", scientific: "Quercus robur", native: true, wildlifeValue: "High",
    traits: ["Heavy, dense, and highly durable", "Hard and tough to split", "Acidic wood"],
    firewood: { value: "Excellent", seasoning: "2+ Years", spitRisk: "Low", burn: "Steady heat, sweet aroma" },
    timber: { value: "High", note: "Premium structural hardwood used in flooring, beams, barrels, and shipbuilding" },
    crafts: "Structural timber, flooring, barrels, shipbuilding",
    pests: "Acute Oak Decline, Oak Processionary Moth",
    safety: "Acorns toxic to livestock; tannins can corrode iron",
  },
  {
    common: "Ash", scientific: "Fraxinus excelsior", native: true, wildlifeValue: "High",
    traits: ["Tough, elastic, and shock-resistant", "Very easy to split", "Pale, straight-grained wood"],
    firewood: { value: "Excellent", seasoning: "6–12 Months", spitRisk: "Low", burn: "Minimal smoke, neutral scent" },
    timber: { value: "High", note: "Highly valued for tool handles, sports equipment, and furniture; threatened by Ash Dieback" },
    crafts: "Tool handles, hockey sticks, oars, fine furniture",
    pests: "Ash Dieback (Chalara)",
    safety: null,
  },
  {
    common: "Beech", scientific: "Fagus sylvatica", native: true, wildlifeValue: "Medium",
    traits: ["Heavy, hard, and fine-grained", "Hard to split; turns beautifully", "Warps easily if dried unevenly"],
    firewood: { value: "Excellent", seasoning: "1–2 Years", spitRisk: "Low", burn: "Steady, intense heat, clean burn" },
    timber: { value: "High", note: "Major commercial hardwood for furniture, flooring, and kitchen utensils" },
    crafts: "Furniture, flooring, kitchen utensils, tool parts",
    pests: "Beech Bark Disease, Phytophthora",
    safety: null,
  },
  {
    common: "Silver Birch", scientific: "Betula pendula", native: true, wildlifeValue: "High",
    traits: ["Soft, perishable outdoors", "Easy to split", "Medium density, easy to turn"],
    firewood: { value: "Good", seasoning: "1 Year", spitRisk: "Low", burn: "Bright flame, sweet birch aroma" },
    timber: { value: "Medium", note: "Used for plywood, turnery, and bobbins; perishable outdoors limits structural use" },
    crafts: "Bobbins, toys, turnery, plywood, kindling",
    pests: "Birch Dieback, Birch Polypore",
    safety: "Fine sawdust can irritate respiratory tract",
  },
  {
    common: "Sycamore", scientific: "Acer pseudoplatanus", native: false, wildlifeValue: "Medium",
    traits: ["Fine-grained, pale white wood", "Moderate split; easy to carve", "Medium density"],
    firewood: { value: "Good", seasoning: "1 Year", spitRisk: "Low", burn: "Clean burn, very mild scent" },
    timber: { value: "Medium", note: "Valued for food-safe kitchenware, musical instruments, and decorative veneers" },
    crafts: "Kitchenware (non-tainting), violins, veneers",
    pests: "Sooty Bark Disease",
    safety: "Seeds and seedlings highly toxic to horses",
  },
  {
    common: "Scots Pine", scientific: "Pinus sylvestris", native: true, wildlifeValue: "High",
    traits: ["Medium weight softwood", "Resin-rich", "Easy to split"],
    firewood: { value: "Good", seasoning: "1–1.5 Years", spitRisk: "High", burn: "Sweet resin scent" },
    timber: { value: "High", note: "Major UK construction softwood for joinery, telegraph poles, and structural framing" },
    crafts: "Construction timber, telegraph poles, joinery",
    pests: "Red Band Needle Blight",
    safety: "High resin can trigger contact skin allergies; creosote risk in flues",
  },
  {
    common: "Common Alder", scientific: "Alnus glutinosa", native: true, wildlifeValue: "High",
    traits: ["Soft and lightweight", "Highly rot-resistant underwater", "Very easy to split"],
    firewood: { value: "Poor", seasoning: "1 Year", spitRisk: "Low", burn: "Warm, sweet scent; low heat output" },
    timber: { value: "Low", note: "Specialist underwater use only (lock gates, piles); low general commercial demand" },
    crafts: "Canal lock gates, clogs, quality gunpowder charcoal",
    pests: "Phytophthora Disease of Alder",
    safety: null,
  },
  {
    common: "Hazel", scientific: "Corylus avellana", native: true, wildlifeValue: "High",
    traits: ["Soft, incredibly flexible", "Lightweight wood", "Very easy to split"],
    firewood: { value: "Good", seasoning: "6–12 Months", spitRisk: "Low", burn: "Clean, steady, quiet burn" },
    timber: { value: "Low", note: "Coppice craft use only — basketry, hurdles, and hedge stakes; not a structural timber" },
    crafts: "Basketry, hurdles, hedge-laying, walking sticks",
    pests: "None major",
    safety: null,
  },
  {
    common: "Sweet Chestnut", scientific: "Castanea sativa", native: false, wildlifeValue: "High",
    traits: ["Lightweight but durable outdoors", "Very rich in tannins", "Very easy to split"],
    firewood: { value: "Good", seasoning: "1.5–2 Years", spitRisk: "High", burn: "Sparks violently, sweet wood smoke" },
    timber: { value: "Medium", note: "Durable outdoors without treatment; valued for fencing, cladding, and roof shingles" },
    crafts: "Fencing, roof shingles, exterior cladding",
    pests: "Chestnut Blight, Ink Disease",
    safety: "Tannins can stain hands and tools purple",
  },
  {
    common: "Horse Chestnut", scientific: "Aesculus hippocastanum", native: false, wildlifeValue: "Medium",
    traits: ["Soft, lightweight, and very weak", "Rots quickly in wet conditions", "Easy to split"],
    firewood: { value: "Poor", seasoning: "1 Year", spitRisk: "Low", burn: "Smolders, low heat output" },
    timber: { value: "Low", note: "Weak and perishable outdoors; limited to carving, cheap packaging, and toys" },
    crafts: "Woodcarving, cheap packaging crates, toys",
    pests: "Bleeding Canker, Leaf Miner",
    safety: "Conkers and foliage are highly toxic to dogs and horses",
  },
  {
    common: "Hawthorn", scientific: "Crataegus monogyna", native: true, wildlifeValue: "High",
    traits: ["Extremely hard, heavy, and tough", "Fine-grained wood", "Hard to split"],
    firewood: { value: "Excellent", seasoning: "1–2 Years", spitRisk: "Low", burn: "Intense heat, pleasant floral aroma" },
    timber: { value: "Low", note: "Too small and slow-growing for commercial timber; used only for small tool handles and mallets" },
    crafts: "Tool handles, mallets, wood engraving",
    pests: "Fireblight",
    safety: "Sharp thorns can cause deep, septic wounds",
  },
  {
    common: "Rowan", scientific: "Sorbus aucuparia", native: true, wildlifeValue: "High",
    traits: ["Hard, heavy, and dense", "Fine-grained wood", "Moderate splitting difficulty"],
    firewood: { value: "Good", seasoning: "1 Year", spitRisk: "Low", burn: "Clean, quiet burn, moderate heat" },
    timber: { value: "Low", note: "Small diameter limits commercial use; valued for craft turnery and spinning wheels only" },
    crafts: "Woodcarving, tool handles, spinning wheels",
    pests: "Fireblight, Silver Leaf",
    safety: "Seeds and berries are toxic if eaten raw",
  },
  {
    common: "Goat Willow", scientific: "Salix caprea", native: true, wildlifeValue: "High",
    traits: ["Lightweight and soft", "Excellent shock-absorption", "Easy to split"],
    firewood: { value: "Poor", seasoning: "1 Year", spitRisk: "Medium", burn: "High moisture; spits heavily if unseasoned" },
    timber: { value: "Low", note: "Low structural value; used for charcoal, paper pulp, and cricket bat blanks only" },
    crafts: "High-quality charcoal, cricket bats, paper pulp",
    pests: "Willow Scab, Rust",
    safety: null,
  },
  {
    common: "Common Lime", scientific: "Tilia x europaea", native: true, wildlifeValue: "Medium",
    traits: ["Soft and lightweight", "Highly stable, uniform grain", "Very easy to carve"],
    firewood: { value: "Poor", seasoning: "1 Year", spitRisk: "Low", burn: "Low heat, neutral smell" },
    timber: { value: "Medium", note: "Specialist carving and musical instrument wood; stable grain makes it ideal for intricate work" },
    crafts: "Intricate woodcarving, piano keys, beehives",
    pests: "Aphid infestations (heavy honeydew drop)",
    safety: "Sticky sap can coat tools during felling",
  },
  {
    common: "Field Maple", scientific: "Acer campestre", native: true, wildlifeValue: "High",
    traits: ["Hard, dense, and tough", "Beautiful, fine fiddleback grain", "Moderate splitting difficulty"],
    firewood: { value: "Excellent", seasoning: "1–2 Years", spitRisk: "Low", burn: "Clean, very hot burn" },
    timber: { value: "Medium", note: "Prized for decorative fiddleback grain; used in musical instruments, bowls, and turnery" },
    crafts: "Harps, musical instruments, bowls, turnery",
    pests: "Powdery Mildew",
    safety: null,
  },
  {
    common: "Hornbeam", scientific: "Carpinus betulus", native: true, wildlifeValue: "Medium",
    traits: ["Incredibly dense and heavy", "Hardest native UK wood", "Very hard to split or work"],
    firewood: { value: "Excellent", seasoning: "2 Years", spitRisk: "Low", burn: "Intense, slow heat ('King of Firewoods')" },
    timber: { value: "Medium", note: "Extremely hard engineering wood for cogs, butcher blocks, and mallets; difficult to machine" },
    crafts: "Windmill cogs, butcher blocks, heavy mallets",
    pests: "Phytophthora",
    safety: "Extremely tough on saw chains and carving tools",
  },
  {
    common: "Wild Cherry", scientific: "Prunus avium", native: true, wildlifeValue: "High",
    traits: ["Medium weight", "Fine texture with deep reddish hue", "Easy to split and carve"],
    firewood: { value: "Good", seasoning: "1 Year", spitRisk: "Low", burn: "Highly aromatic, sweet cherry scent" },
    timber: { value: "High", note: "Premium decorative hardwood; highly sought for fine furniture, veneers, and cabinet-making" },
    crafts: "Fine furniture, decorative veneer, smoking meat",
    pests: "Bacterial Canker",
    safety: "Wilted leaves and stones contain cyanide; toxic to pets",
  },
  {
    common: "Holly", scientific: "Ilex aquifolium", native: true, wildlifeValue: "High",
    traits: ["Very heavy, hard, and dense", "Uniform, bone-white colour", "Hard to split; cuts cleanly"],
    firewood: { value: "Excellent", seasoning: "1.5–2 Years", spitRisk: "Low", burn: "Steady, intense heat" },
    timber: { value: "Low", note: "Scarce and small-diameter; limited to decorative inlay, chess pieces, and wood engraving" },
    crafts: "Chess pieces, wood engraving, decorative inlay work",
    pests: "Holly Leaf Miner",
    safety: "Prickly foliage; berries are highly toxic to humans",
  },
  {
    common: "Yew", scientific: "Taxus baccata", native: true, wildlifeValue: "High",
    traits: ["Heavy and dense", "Incredibly elastic and highly durable", "Tough and springy to work"],
    firewood: { value: "Excellent", seasoning: "2 Years", spitRisk: "Low", burn: "Steady heat, pleasant cedar-like scent" },
    timber: { value: "Medium", note: "Prized for longbows and high-end turnery; limited availability and toxic dust restrict use" },
    crafts: "Traditional longbows, high-end turnery, tool handles",
    pests: "Phytophthora Root Rot",
    safety: "All parts (except red aril) are lethal if ingested",
  },
  {
    common: "Wych Elm", scientific: "Ulmus glabra", native: true, wildlifeValue: "High",
    traits: ["Highly durable when wet", "Flexible but cross-grained", "Very hard to split (interlocking grain)"],
    firewood: { value: "Good", seasoning: "1.5–2 Years", spitRisk: "Low", burn: "Low flame, steady coal bed" },
    timber: { value: "Medium", note: "Historically prized for boat building and water pipes; now scarce due to Dutch Elm Disease" },
    crafts: "Boat building, water pipes, coffin boards, furniture",
    pests: "Dutch Elm Disease",
    safety: "Wood dust is a known respiratory allergen",
  },
  {
    common: "Sitka Spruce", scientific: "Picea sitchensis", native: false, wildlifeValue: "Low",
    traits: ["Soft and lightweight", "High strength-to-weight ratio", "Easy to split"],
    firewood: { value: "Poor", seasoning: "1 Year", spitRisk: "Medium", burn: "Strong resin aroma; sparks if unseasoned" },
    timber: { value: "High", note: "UK's most commercially planted timber species; key softwood for construction, pulp, and soundboards" },
    crafts: "Construction joists, paper pulp, musical soundboards",
    pests: "Spruce Bark Beetle (Ips typographus)",
    safety: "Fine sawdust can trigger asthma",
  },
  {
    common: "European Larch", scientific: "Larix decidua", native: false, wildlifeValue: "Medium",
    traits: ["Highly resinous and dense", "Naturally rot-resistant outdoors", "Moderate splitting difficulty"],
    firewood: { value: "Good", seasoning: "1–1.5 Years", spitRisk: "High", burn: "Sparks heavily; pleasant resinous scent" },
    timber: { value: "High", note: "Durable outdoor structural timber; widely used for cladding, fencing, and boat planking without treatment" },
    crafts: "Exterior cladding, fencing, boat planking",
    pests: "Phytophthora ramorum, Larch Canker",
    safety: "Sharp splinters easily fester under skin",
  },
  {
    common: "Norway Spruce", scientific: "Picea abies", native: false, wildlifeValue: "Medium",
    traits: ["Soft, uniform, and pale", "Low natural outdoor durability", "Easy to split"],
    firewood: { value: "Poor", seasoning: "1 Year", spitRisk: "Medium", burn: "Classic pine/Christmas aroma" },
    timber: { value: "Medium", note: "Common interior joinery and pulp softwood; low outdoor durability limits structural applications" },
    crafts: "Cheap interior joinery, paper pulp, structural frames",
    pests: "Spruce Bark Beetle (Ips typographus)",
    safety: "Resin can cause contact skin reactions",
  },
  {
    common: "Douglas Fir", scientific: "Pseudotsuga menziesii", native: false, wildlifeValue: "Medium",
    traits: ["Strongest UK softwood", "Durable, heavy, and resinous", "Moderate splitting difficulty"],
    firewood: { value: "Good", seasoning: "1–1.5 Years", spitRisk: "Medium", burn: "Sweet, citrusy-pine aroma" },
    timber: { value: "High", note: "Strongest UK softwood; premium structural timber for heavy beams, cladding, and utility poles" },
    crafts: "Heavy structural beams, cladding, poles",
    pests: "Swiss Needle Cast",
    safety: "Fine dust is a skin and lung irritant",
  },
  {
    common: "Elder", scientific: "Sambucus nigra", native: true, wildlifeValue: "High",
    traits: ["Very soft with thick pith", "Mature wood is surprisingly hard", "Moderate splitting difficulty"],
    firewood: { value: "Poor", seasoning: "1 Year", spitRisk: "High", burn: "Acrid smoke, unpleasant odour" },
    timber: { value: "Low", note: "No commercial timber value; small craft use only for flutes and whistles" },
    crafts: "Woodwind flutes, whistles, small carved toys",
    pests: "None major",
    safety: "Foliage, bark, and raw berries are toxic",
  },
  {
    common: "Blackthorn", scientific: "Prunus spinosa", native: true, wildlifeValue: "High",
    traits: ["Extremely hard, heavy, and dense", "Rich dark brown wood", "Hard to split"],
    firewood: { value: "Excellent", seasoning: "1–2 Years", spitRisk: "Low", burn: "Very high heat, minimal smoke" },
    timber: { value: "Low", note: "Shrub-form only; too small for structural timber but valued for walking sticks and small turned pieces" },
    crafts: "Walking sticks (shillelaghs), turnery, small parts",
    pests: "Silver Leaf Disease",
    safety: "Sharp thorns carry septic bacteria that cause infections",
  },
  {
    common: "Aspen", scientific: "Populus tremula", native: true, wildlifeValue: "High",
    traits: ["Soft and lightweight", "Low density, does not splinter", "Very easy to split"],
    firewood: { value: "Poor", seasoning: "1 Year", spitRisk: "Low", burn: "Sweet smell but burns very fast with low heat" },
    timber: { value: "Low", note: "Low structural value; used for safety matches, sauna slats, and paper pulp due to non-splintering properties" },
    crafts: "Safety matches, sauna benches, paper pulp",
    pests: "Aspen Rust",
    safety: null,
  },
  {
    common: "Crack Willow", scientific: "Salix fragilis", native: true, wildlifeValue: "High",
    traits: ["Soft and lightweight", "Very high natural moisture content", "Easy to split"],
    firewood: { value: "Poor", seasoning: "1 Year", spitRisk: "Medium", burn: "Low heat, high ash volume" },
    timber: { value: "Low", note: "Very low timber value; used for pulp and charcoal only due to high moisture and low density" },
    crafts: "Lower-grade cricket bats, pulp, charcoal",
    pests: "Willow Scab, Anthracnose",
    safety: null,
  },
  {
    common: "Corsican Pine", scientific: "Pinus nigra", native: false, wildlifeValue: "Medium",
    traits: ["Soft but highly resinous", "Moderate strength and density", "Easy to split"],
    firewood: { value: "Good", seasoning: "1–1.5 Years", spitRisk: "High", burn: "Strong pine smell; creosote hazard" },
    timber: { value: "Medium", note: "Commercial plantation softwood for packaging, pallets, and rough framing; lower grade than Scots Pine" },
    crafts: "Packaging, pallets, rough building framing",
    pests: "Red Band Needle Blight",
    safety: "Resin can trigger skin rashes",
  },
  {
    common: "Crab Apple", scientific: "Malus sylvestris", native: true, wildlifeValue: "High",
    traits: ["Hard, dense, and tough", "Fine-grained wood", "Moderate splitting difficulty"],
    firewood: { value: "Excellent", seasoning: "1.5–2 Years", spitRisk: "Low", burn: "Sweet, highly aromatic fruitwood smoke" },
    timber: { value: "Low", note: "Small-diameter fruit tree; no structural value but prized for carving, mallet heads, and food smoking" },
    crafts: "Carving, mallet heads, luxury food smoking",
    pests: "Apple Scab, Codling Moth",
    safety: "Seeds contain cyanide (toxic if crushed)",
  },
];

const FIREWOOD_COLOURS: Record<Species["firewood"]["value"], string> = {
  Excellent: "bg-green-100 text-green-800 border-green-200",
  Good:      "bg-amber-100 text-amber-800 border-amber-200",
  Poor:      "bg-red-100 text-red-700 border-red-200",
};

const TIMBER_COLOURS: Record<Species["timber"]["value"], string> = {
  High:   "bg-green-100 text-green-800 border-green-200",
  Medium: "bg-amber-100 text-amber-800 border-amber-200",
  Low:    "bg-red-100 text-red-700 border-red-200",
};

const SPIT_COLOURS: Record<Species["firewood"]["spitRisk"], string> = {
  Low:    "text-green-700",
  Medium: "text-amber-600",
  High:   "text-red-600",
};

const WILDLIFE_COLOURS: Record<Species["wildlifeValue"], string> = {
  High:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  Medium: "bg-sky-100 text-sky-800 border-sky-200",
  Low:    "bg-gray-100 text-gray-600 border-gray-200",
};

type FirewoodFilter = "all" | "Excellent" | "Good" | "Poor";
type TimberFilter   = "all" | "High" | "Medium" | "Low";
type SpitFilter     = "all" | "Low" | "Medium" | "High";
type NativeFilter   = "all" | "native" | "non-native";

export default function SpeciesGuide() {
  const [search, setSearch]             = useState("");
  const [filterNative, setFilterNative] = useState<NativeFilter>("all");
  const [filterFirewood, setFilterFirewood] = useState<FirewoodFilter>("all");
  const [filterTimber, setFilterTimber] = useState<TimberFilter>("all");
  const [filterSpit, setFilterSpit]     = useState<SpitFilter>("all");

  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    return SPECIES.filter((s) => {
      if (filterNative === "native" && !s.native) return false;
      if (filterNative === "non-native" && s.native) return false;
      if (filterFirewood !== "all" && s.firewood.value !== filterFirewood) return false;
      if (filterTimber !== "all" && s.timber.value !== filterTimber) return false;
      if (filterSpit !== "all" && s.firewood.spitRisk !== filterSpit) return false;
      if (!q) return true;
      return (
        s.common.toLowerCase().includes(q) ||
        s.scientific.toLowerCase().includes(q) ||
        s.traits.some((t) => t.toLowerCase().includes(q)) ||
        s.crafts.toLowerCase().includes(q) ||
        s.pests.toLowerCase().includes(q) ||
        s.timber.note.toLowerCase().includes(q)
      );
    });
  }, [search, filterNative, filterFirewood, filterTimber, filterSpit]);

  const hasFilters =
    filterNative !== "all" || filterFirewood !== "all" ||
    filterTimber !== "all" || filterSpit !== "all" || search !== "";

  function clearAll() {
    setSearch(""); setFilterNative("all");
    setFilterFirewood("all"); setFilterTimber("all"); setFilterSpit("all");
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <LogEndIcon className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="font-mono font-bold uppercase tracking-widest text-sm">Timber Characteristics</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Intro */}
        <div className="border border-border rounded bg-white/80 p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            A field reference for 30 UK tree species covering wood characteristics, firewood suitability, timber value, practical uses, common pests, and safety notes. Use this alongside your dynamic risk assessment and biosecurity checks when working on site.
          </p>
        </div>

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, trait, timber use, or pest…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Row 1: Origin + Firewood */}
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            {(["all", "native", "non-native"] as const).map((v) => (
              <button key={v} onClick={() => setFilterNative(v)}
                className={`px-2.5 py-1 rounded-full border transition-colors ${filterNative === v ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/50"}`}>
                {v === "all" ? "All Origin" : v === "native" ? "Native" : "Non-Native"}
              </button>
            ))}
            <span className="border-l border-border mx-0.5" />
            {(["all", "Excellent", "Good", "Poor"] as const).map((v) => {
              const activeClass =
                v === "Excellent" ? "bg-green-600 text-white border-green-600" :
                v === "Good"      ? "bg-amber-500 text-white border-amber-500" :
                v === "Poor"      ? "bg-red-500 text-white border-red-500" :
                                    "bg-primary text-white border-primary";
              return (
                <button key={v} onClick={() => setFilterFirewood(v)}
                  className={`px-2.5 py-1 rounded-full border transition-colors ${filterFirewood === v ? activeClass : "bg-white border-border text-muted-foreground hover:border-primary/50"}`}>
                  {v === "all" ? "All Firewood" : `🔥 ${v}`}
                </button>
              );
            })}
          </div>

          {/* Row 2: Timber + Spit */}
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            {(["all", "High", "Medium", "Low"] as const).map((v) => (
              <button key={v} onClick={() => setFilterTimber(v)}
                className={`px-2.5 py-1 rounded-full border transition-colors ${filterTimber === v ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/50"}`}>
                {v === "all" ? "All Timber Quality" : `🪵 Timber Quality: ${v}`}
              </button>
            ))}
            <span className="border-l border-border mx-0.5" />
            {(["all", "Low", "Medium", "High"] as const).map((v) => (
              <button key={v} onClick={() => setFilterSpit(v)}
                className={`px-2.5 py-1 rounded-full border transition-colors ${filterSpit === v ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/50"}`}>
                {v === "all" ? "All Spit Risk" : `Spit: ${v}`}
              </button>
            ))}
            {hasFilters && (
              <button onClick={clearAll} className="px-2.5 py-1 rounded-full border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {results.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Leaf className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm">No species match your filters.</p>
            <button onClick={clearAll} className="mt-3 text-primary text-sm underline underline-offset-2">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((s) => (
              <SpeciesCard key={s.common} species={s} />
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="border border-border rounded bg-white/80 p-4 space-y-2.5">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Legend</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5"><span className={`px-2 py-0.5 rounded border font-mono ${FIREWOOD_COLOURS.Excellent}`}>Firewood: Excellent</span></div>
            <div className="flex items-center gap-1.5"><span className={`px-2 py-0.5 rounded border font-mono ${FIREWOOD_COLOURS.Good}`}>Firewood: Good</span></div>
            <div className="flex items-center gap-1.5"><span className={`px-2 py-0.5 rounded border font-mono ${FIREWOOD_COLOURS.Poor}`}>Firewood: Poor</span></div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5"><span className={`px-2 py-0.5 rounded border font-mono ${TIMBER_COLOURS.High}`}>Timber Quality: High</span></div>
            <div className="flex items-center gap-1.5"><span className={`px-2 py-0.5 rounded border font-mono ${TIMBER_COLOURS.Medium}`}>Timber Quality: Medium</span></div>
            <div className="flex items-center gap-1.5"><span className={`px-2 py-0.5 rounded border font-mono ${TIMBER_COLOURS.Low}`}>Timber Quality: Low</span></div>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">Spit Risk — <span className={SPIT_COLOURS.High}>High</span> means keep distance from open flames when unseasoned</p>
        </div>

        <p className="text-center text-muted-foreground text-xs font-mono pb-4">
          30 species · Firewood, timber, crafts &amp; safety data from the Chainsaw Courses manual
        </p>
      </main>
    </div>
  );
}

function SpeciesCard({ species: s }: { species: Species }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border border-border rounded bg-white/90 overflow-hidden flex flex-col cursor-pointer"
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-black text-base tracking-tight leading-tight">{s.common}</h2>
            <p className="text-muted-foreground text-xs italic mt-0.5">{s.scientific}</p>
          </div>
          {/* Stacked rating badges */}
          <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase ${FIREWOOD_COLOURS[s.firewood.value]}`}>
              Firewood: {s.firewood.value}
            </span>
            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase ${TIMBER_COLOURS[s.timber.value]}`}>
              Timber Quality: {s.timber.value}
            </span>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono ${s.native ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
            {s.native ? "Native" : "Non-Native"}
          </span>
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono ${WILDLIFE_COLOURS[s.wildlifeValue]}`}>
            Wildlife Value: {s.wildlifeValue}
          </span>
        </div>
      </div>

      {/* Always-visible: seasoning + burn */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-b border-border/60">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Seasoning</p>
          <p className="font-mono">{s.firewood.seasoning}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Burn Quality</p>
          <p className="font-mono leading-tight">{s.firewood.burn}</p>
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="px-4 py-3 space-y-3 text-xs border-b border-border/60">

          {/* Timber note */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Timber Quality &amp; Use</p>
            <p className="font-mono text-foreground/80 leading-relaxed">{s.timber.note}</p>
          </div>

          {/* Spit risk */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Spit Risk</p>
            <span className={`font-mono font-bold ${SPIT_COLOURS[s.firewood.spitRisk]}`}>{s.firewood.spitRisk}</span>
          </div>

          {/* Wood traits */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
              <Axe className="w-3 h-3" /> Wood Traits
            </p>
            <ul className="space-y-0.5">
              {s.traits.map((t) => (
                <li key={t} className="flex items-start gap-1.5 font-mono text-foreground/80">
                  <span className="text-primary mt-0.5 shrink-0">·</span>{t}
                </li>
              ))}
            </ul>
          </div>

          {/* Crafts */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
              <Flame className="w-3 h-3 inline mr-1" />Crafts &amp; Uses
            </p>
            <p className="font-mono text-foreground/80 leading-relaxed">{s.crafts}</p>
          </div>

          {/* Pests */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Pests &amp; Diseases</p>
            <p className="font-mono text-foreground/80">{s.pests}</p>
          </div>
        </div>
      )}

      {/* Safety warning — always visible if present */}
      {s.safety && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-mono text-amber-800 leading-snug">{s.safety}</p>
        </div>
      )}

      {/* Tap hint */}
      <div className="w-full px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground text-center select-none">
        {expanded ? "Tap to collapse ▲" : "Tap for traits & uses ▼"}
      </div>
    </div>
  );
}

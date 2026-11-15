// Photos from the NASA Image and Video Library (images.nasa.gov), public domain, credit NASA.
// Each was chosen because NASA's own description names the investigation or its hardware; the
// caption below paraphrases that description and `nasaSays` quotes it. Files are NASA's "medium"
// rendition, resized to at most 720 px for the app; `sha256` is of the file NASA served.
import bassFlame from "../assets/nasa/iss035e015900.jpg";
import bass2Flame from "../assets/nasa/iss040e086481.jpg";
import saffire3Cygnus from "../assets/nasa/iss051e039882.jpg";
import saffire4Pmma from "../assets/nasa/jsc2023e046631.jpg";
import saffire4Fabric from "../assets/nasa/jsc2023e046375.jpg";
import acmeInsert from "../assets/nasa/GRC-2016-C-05051.jpg";
import flameDesign from "../assets/nasa/iss059e103188.jpg";
import efield from "../assets/nasa/GRC-2013-C-03367.jpg";
import mdca from "../assets/nasa/iss043e190395.jpg";
import sameHw from "../assets/nasa/iss015e27411.jpg";

export interface NasaPhoto {
  nasaId: string;
  src: string;
  /** EMBER's short caption, from NASA's description. */
  caption: string;
  /** Words copied from NASA's description, for the alt text and the tooltip. */
  nasaSays: string;
  date: string;
  center: string;
  /** Who NASA credits, when the record names a photographer. */
  photographer?: string;
  kind: "flame" | "hardware";
  /** Investigation profile ids (or "saffire-iv-vi" for the NTRS flights) the photo shows. */
  shows: string[];
  /** Profiles that used the same hardware, shown with "shared hardware". */
  shared?: string[];
  /** Anything about the record a reader should know. */
  note?: string;
  sha256: string;
}

export const NASA_PHOTOS: NasaPhoto[] = [
  {
    nasaId: "iss035e015900", src: bassFlame, kind: "flame", shows: ["bass"], date: "2013-04-09", center: "JSC",
    caption: "A BASS flame on the ISS, photographed close up during a test run.",
    nasaSays: "This is one of a series of close-up images photographed during a run of the Burning and Suppression of Solids (BASS) experiment onboard the Earth-orbiting International Space Station.",
    sha256: "2c5b32794398640f66101ed81b0fbeb9ec35ff9393687d9311ee6806ae10819b",
  },
  {
    nasaId: "iss040e086481", src: bass2Flame, kind: "flame", shows: ["bass-ii"], date: "2014-08-02", center: "JSC", photographer: "Reid Wiseman",
    caption: "A BASS-II flame on sample card 8, in a session at reduced oxygen partial pressure.",
    nasaSays: "Image taken on card 8 during BASS-II flame test session with reduced O2 partial pressure.",
    sha256: "4943b547b950016019308d6ac9cddac26d37a5c3714a21d87414894f6ceda516",
  },
  {
    nasaId: "iss051e039882", src: saffire3Cygnus, kind: "hardware", shows: ["saffire-iii"], date: "2017-05-08", center: "JSC", photographer: "Thomas Pesquet",
    caption: "The Saffire-III experiment strapped inside the OA-7 Cygnus cargo craft, where it burned after leaving the ISS.",
    nasaSays: "A view of Spacecraft Fire Experiment-III (Saffire-III) award the John Glenn Orbital ATK 7 (OA-7) Cygnus spacecraft, taken during cargo transfer operations (OPS).",
    note: "NASA's title for this photo says Saffire-II; its description says Saffire-III on OA-7, the flight that carried Saffire-III.",
    sha256: "02bc5a9bbe2d36fc27df30a586cfefcb7e728ea91058a5dc1b1aad0c460a5339",
  },
  {
    nasaId: "jsc2023e046631", src: saffire4Pmma, kind: "flame", shows: ["saffire-iv-vi"], date: "2023-07-25", center: "JSC",
    caption: "Plexiglass (PMMA) burning in Saffire-IV. The orange is soot; the bright balls are vapour burning as it leaves the surface.",
    nasaSays: "Plexiglass is shown burning in Spacecraft Fire Experiment-IV (Saffire-IV).",
    sha256: "35d72708e943d8626e3ba9661c07ec08b9c1b510db24f968d4ce6601d1e287b8",
  },
  {
    nasaId: "jsc2023e046375", src: saffire4Fabric, kind: "flame", shows: ["saffire-iv-vi"], date: "2023-07-25", center: "JSC",
    caption: "Cotton-fiberglass fabric, 40 cm wide, burning in Saffire-IV under green LED light. Black to the right is cotton starting to char.",
    nasaSays: "A sample of fabric burns inside Spacecraft Fire Experiment-IV (Saffire-IV).",
    sha256: "29a21f8aa65cd686f77193f94d9f0ee6b3be6f569d9c1b03c1eaf329847afe3c",
  },
  {
    nasaId: "GRC-2016-C-05051", src: acmeInsert, kind: "hardware", shows: [], shared: ["acme-bre", "acme-cld", "acme-s-flame", "acme-cfi-g", "acme-efield", "acme-flame-design"], date: "2016-06-22", center: "GRC", photographer: "NASA/GRC/Marvin Smith",
    caption: "A NASA Glenn engineer inspects the gas-jet burner in the ACME insert for the Combustion Integrated Rack, the hardware all six ACME studies used.",
    nasaSays: "NASA Glenn engineer Christopher Mroczka inspects the gas-jet burner within the Advanced Combustion via Microgravity Experiments, ACME insert for the Combustion Integrated Rack, CIR.",
    sha256: "695574eb3c38f32b74ea9c7d3d5f3b3fda4338dfd69bc93c238181a3bb1d5ade",
  },
  {
    nasaId: "iss059e103188", src: flameDesign, kind: "hardware", shows: ["acme-flame-design"], date: "2019-06-14", center: "JSC", photographer: "Christina Koch",
    caption: "Flame Design hardware being replaced inside the Combustion Integrated Rack on the ISS.",
    nasaSays: "Photo documentation taken aboard the International Space Station (ISS) during the Fluids and Combustion Facility (FCF) Combustion Integration Rack (CIR) / Advanced Combustion via Microgravity Experiments (ACME) / Flame Design hardware replacement.",
    sha256: "a7acee59e9f0a738b982e0b6610d6cb5bf5a590d3f8955444f67722495a42244",
  },
  {
    nasaId: "GRC-2013-C-03367", src: efield, kind: "hardware", shows: ["acme-efield"], date: "2013-08-19", center: "GRC", photographer: "NASA/GRC/Marvin Smith",
    caption: "Engineering-model hardware that makes the high-voltage field for E-FIELD Flames, on the ground at NASA Glenn.",
    nasaSays: "Mechanical Engineer Adrian Drake inspects engineering model hardware built to generate a high-voltage electric field for the Electric-Field Effects on Laminar Diffusion Flames (E-FIELD Flames) experiment",
    sha256: "3e5c3ce36ef13b8c99bee07947c785f07c92cadbce7fb5ad270661a13d596329",
  },
  {
    nasaId: "iss043e190395", src: mdca, kind: "hardware", shows: ["flex-2"], shared: ["flex", "cfi"], date: "2015-05-13", center: "JSC", photographer: "Terry Virts",
    caption: "Terry Virts prepares the Multi-user Droplet Combustion Apparatus for FLEX-2 runs; FLEX and CFI used the same apparatus.",
    nasaSays: "NASA astronaut Terry Virts prepares the Multi-user Droplet Combustion Apparatus from inside the Combustion Integrated Rack for upcoming runs of the FLame Extinguishment Experiment, or FLEX-2.",
    sha256: "977d777bff8429c6b2714f9a57cc3427f7a41e8be34c7223618c5a96f4b3f7b5",
  },
  {
    nasaId: "iss015e27411", src: sameHw, kind: "hardware", shows: ["same"], date: "2007-09-08", center: "JSC",
    caption: "Clay Anderson works on the SAME smoke-measurement hardware in the Microgravity Science Glovebox.",
    nasaSays: "NASA astronaut Clay Anderson, Expedition 15 flight engineer, works on the Smoke and Aerosol Measurement Experiment (SAME) hardware located in the Microgravity Science Glovebox (MSG) in the Destiny laboratory of the International Space Station.",
    sha256: "ed564d2a7b8b019cf514d7f2cf5f34c3009bf5f4828d1168abf19c74c6b65c6a",
  },
];

export const nasaPhotoUrl = (id: string) => `https://images.nasa.gov/details/${id}`;

/** Photos of an investigation: its own first, then shared hardware. */
export function photosFor(investigationId: string): { photo: NasaPhoto; shared: boolean }[] {
  return [
    ...NASA_PHOTOS.filter((p) => p.shows.includes(investigationId)).map((photo) => ({ photo, shared: false })),
    ...NASA_PHOTOS.filter((p) => p.shared?.includes(investigationId) && !p.shows.includes(investigationId)).map((photo) => ({ photo, shared: true })),
  ];
}
